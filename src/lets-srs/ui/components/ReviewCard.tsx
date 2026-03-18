import React, { useState, useEffect, useMemo } from "react";
import type { DbId } from "@/orca";
import { ItemRenderer } from "./ItemRenderer";
import { TopicRenderer } from "./TopicRenderer";
import { t } from "../../../libs/l10n";
import { FsrsGrade, calculateNextReview, CardState } from "../../core/fsrs";
import {
  TopicGrade,
  predictTopicIntervals,
  isTopicState,
} from "../../core/topic-scheduler";
import { CardGrade } from "../../core/storage";
import {
  saveCardReview,
  postponeCard,
  toggleCardStatus,
  saveCardRemark,
  ensureCardTag,
} from "../../core/storage";
import { SrsCardData } from "../../core/query";

const { Button, Tooltip } = orca.components;

export type CardDisplayMode = "srs-item" | "srs-topic" | "roaming";

interface ReviewCardProps {
  activeCard: SrsCardData;
  panelId: string;
  displayMode: CardDisplayMode;
  onCardCompleted: () => void;
  onSkip: () => void;
  shortcutsEnabled: boolean;
}

function formatInterval(days: number): string {
  if (days < 1) {
    const minutes = Math.round(days * 24 * 60);
    if (minutes < 1) return t("<1m");
    return t("${minutes}m", { minutes: minutes.toString() });
  }
  const rounded = Math.round(days);
  if (rounded < 30) return t("${days}d", { days: rounded.toString() });
  if (rounded < 365)
    return t("${months}mo", { months: (rounded / 30.44).toFixed(1) });
  return t("${years}y", { years: (rounded / 365.25).toFixed(1) });
}

function formatDateTime(date: number | null): string {
  if (!date) return t("Never");
  const d = new Date(date);
  return d.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCardState(state?: number): string {
  if (state === undefined || state === null) return t("New");
  switch (state) {
    case 0:
      return t("New");
    case 1:
      return t("Learning");
    case 2:
      return t("Review");
    case 3:
      return t("Relearning");
    default:
      return t("Unknown");
  }
}

/**
 * 卡片容器外壳 (Shell)
 * 负责分层渲染、交互逻辑、卡片动作以及详细状态展示
 */
export const ReviewCard: React.FC<ReviewCardProps> = ({
  activeCard,
  panelId,
  displayMode,
  onCardCompleted,
  onSkip,
  shortcutsEnabled,
}) => {
  const {
    blockId,
    type,
    srsData,
    status: cardStatus,
    remark: cardRemark,
  } = activeCard;

  const [showAnswer, setShowAnswer] = useState(displayMode !== "srs-item");
  const [isSaving, setIsSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [localRemark, setLocalRemark] = useState(cardRemark || "");

  const isMarked = cardStatus?.includes("marked");
  const isArchived = cardStatus?.includes("archived");
  const isSuspended = cardStatus?.includes("suspend");

  // 重置状态
  useEffect(() => {
    setShowAnswer(displayMode !== "srs-item");
    setIsSaving(false);
    setShowInfo(false);
    setLocalRemark(cardRemark || "");
  }, [blockId, displayMode, cardRemark]);

  // 计算预测间隔
  const predictedIntervals = useMemo(() => {
    if (displayMode === "roaming") return null;
    if (displayMode === "srs-topic") {
      // Topic 使用递增间隔调度器
      const topicState = isTopicState(srsData) ? srsData : null;
      const intervals = predictTopicIntervals(topicState);
      return {
        soon: formatInterval(intervals.soon),
        done: formatInterval(intervals.done),
        easy: formatInterval(intervals.easy),
      };
    } else if (displayMode === "srs-item") {
      // Item 使用 FSRS
      if (!srsData) return null;
      const grades: FsrsGrade[] = ["again", "hard", "good", "easy"];
      const results: Record<string, string> = {};
      grades.forEach((g) => {
        const { nextState } = calculateNextReview(srsData, g);
        results[g] = formatInterval(nextState.interval);
      });
      return results;
    }
  }, [srsData, displayMode]);

  // 动作处理
  const handleGradeAction = async (grade: CardGrade) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveCardReview(activeCard, grade);
      onCardCompleted();
    } catch (err) {
      console.error("[lets-srs] failed to save card review", err);
      setIsSaving(false);
    }
  };

  const handleCaptureCard = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (activeCard.isVirtual) {
        await ensureCardTag(activeCard);
      } else {
        // 对于已有的卡片，评 Soon 来提升优先级并缩短间隔
        await saveCardReview(activeCard, "soon");
      }
      onCardCompleted();
    } catch (err) {
      console.error("[lets-srs] failed to capture card", err);
      setIsSaving(false);
    }
  };

  const handlePostpone = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await postponeCard(activeCard);
      onCardCompleted();
    } catch (err) {
      console.error("[lets-srs] failed to postpone card", err);
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (status: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await toggleCardStatus(activeCard, status);
      // 如果切换的是 suspend 或 archived，通常意味着不再复习
      if (status === "suspend" || status === "archived") {
        onCardCompleted();
      } else {
        setIsSaving(false);
        // 注意：此处需要让外部刷新状态，但由于 Orca 的响应式特性，
        // 如果标签数据更新了，fetchDueCards 下次运行时会反映出来。
        // 在当前的单次渲染中，我们由于是从 activeCard 读的 status，
        // 除非父组件 reload，否则 UI 不会立刻显示“已标记”。
        // TODO: 考虑触发父组件 reloadCard(activeCard)
      }
    } catch (err) {
      console.error(`[lets-srs] failed to toggle status: ${status}`, err);
      setIsSaving(false);
    }
  };

  const handleSaveRemark = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveCardRemark(activeCard, localRemark);
      setIsSaving(false);
    } catch (err) {
      console.error("[lets-srs] failed to save remark", err);
      setIsSaving(false);
    }
  };

  const handleUpgrade = async () => {
    console.log("isSaving", isSaving);
    if (isSaving) return;
    setIsSaving(true); 
    try {
      await ensureCardTag(activeCard);
      // 将 isVirtual 设为 false 以刷新 UI
      activeCard.isVirtual = false;
      setIsSaving(false);
    } catch (err) {
      console.error("[lets-srs] failed to upgrade card", err);
      setIsSaving(false);
    }
  };

  // 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!shortcutsEnabled) return;
      // const target = e.target as HTMLElement;

      // if (
      //   target.tagName === "INPUT" ||
      //   target.tagName === "TEXTAREA" ||
      //   target.isContentEditable
      // ) {
      //   return;
      // }
      e.preventDefault();
      const key = e.key.toLowerCase();
      if (e.code === "Space") {
        switch (displayMode) {
          case "roaming":
            handleCaptureCard();
            break;
          case "srs-item":
            if (!showAnswer) setShowAnswer(true);
            else handleGradeAction("good");
            break;
          case "srs-topic":
            handleGradeAction("done");
            break;
        }
      } else if (key === "s") {
        onSkip();
      } else if (key === "b" || key === "p") {
        handlePostpone();
      } else if (key === "h") {
        handleToggleStatus("suspend");
      } else if (key === "m") {
        handleToggleStatus("marked");
      } else if (key === "a") {
        handleToggleStatus("archived");
      } else if (key === "i") {
        setShowInfo(!showInfo);
      } else if (key === "u" && activeCard.isVirtual) {
        handleUpgrade();
      } else if (displayMode === "srs-topic") {
        // Topic 快捷键：1=Soon, 2=Done, 3=Easy
        if (e.key === "1") handleGradeAction("soon");
        if (e.key === "2") handleGradeAction("done");
        if (e.key === "3") handleGradeAction("easy");
      } else if (displayMode === "srs-item" && showAnswer) {
        // Item 快捷键：1=Again, 2=Hard, 3=Good, 4=Easy
        if (e.key === "1") handleGradeAction("again");
        if (e.key === "2") handleGradeAction("hard");
        if (e.key === "3") handleGradeAction("good");
        if (e.key === "4") handleGradeAction("easy");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showAnswer,
    displayMode,
    activeCard,
    isSaving,
    onSkip,
    shortcutsEnabled,
    showInfo,
  ]);

  return (
    <div
      className="srs-card-container"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        position: "relative",
        overflow: "hidden", // 防止外部滚动
      }}
    >
      <style>{`
        .srs-grade-btn { transition: all 0.2s ease; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px !important; height: auto !important; }
        .srs-grade-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.1); }
        .srs-interval-hint { font-size: 10px; opacity: 0.8; }
        .srs-info-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--orca-border-low); }
        .srs-info-item:last-child { border-bottom: none; }
        .srs-card-toolbar-btn { padding: 6px !important; opacity: 0.6; transition: all 0.2s; }
        .srs-card-toolbar-btn:hover { opacity: 1; }
        .srs-card-toolbar-btn.active { opacity: 1; color: var(--orca-color-primary-5); }
        .srs-marked-flag { position: absolute; top: -10px; right: -10px; color: #f44336; font-size: 24px; pointer-events: none; z-index: 10; }
      `}</style>

      {/* {isMarked && (
        <div className="srs-marked-flag">
          <i className="ti ti-flag-filled" />
        </div>
      )} */}

      {/* 卡片顶部工具栏 - 固定在顶部 */}
      <div
        contentEditable={false}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            className="srs-card-type-badge"
            style={{
              padding: "4px 8px",
              background: displayMode === "srs-topic"
                ? "var(--orca-color-warning-transparent-2)"
                : "var(--orca-color-success-transparent-2)",
              color: displayMode === "srs-topic"
                ? "var(--orca-color-warning-5)"
                : "var(--orca-color-success-5)",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {displayMode === "srs-topic" ? t("Topic") : displayMode === "roaming" ? "Roam" : t("Item")}
          </span>
          {isSuspended && (
            <span
              style={{ fontSize: 10, color: "var(--orca-color-warning-5)" }}
            >
              [{t("Suspended")}]
            </span>
          )}
          {isArchived && (
            <span
              style={{ fontSize: 10, color: "var(--orca-color-success-5)" }}
            >
              [{t("Archived")}]
            </span>
          )}
          {activeCard.isVirtual && (
            <Tooltip text={t("Convert to Card [U]")}>
              <Button
                variant="plain"
                onClick={() => handleUpgrade()}
                style={{ color: "var(--orca-color-primary-6)" }}
              >
                <i className="ti ti-bolt" style={{ fontSize: 16 }} />
              </Button>
            </Tooltip>
          )}
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          <Tooltip text={t("Mark/Flag [M]")}>
            <Button
              variant="plain"
              onClick={() => handleToggleStatus("marked")}
              className={`srs-card-toolbar-btn ${isMarked ? "active" : ""}`}
              style={{ color: isMarked ? "#f44336" : "" }}
            >
              <i
                className={isMarked ? "ti ti-flag-filled" : "ti ti-flag"}
                style={{ fontSize: 16 }}
              />
            </Button>
          </Tooltip>
          <Tooltip text={t("Archive [A]")}>
            <Button
              variant="plain"
              onClick={() => handleToggleStatus("archived")}
              className={`srs-card-toolbar-btn ${isArchived ? "active" : ""}`}
              style={{ color: isArchived ? "#4caf50" : "" }}
            >
              <i className="ti ti-archive" style={{ fontSize: 16 }} />
            </Button>
          </Tooltip>
          <Tooltip text={t("Postpone to tomorrow [B/P]")}>
            <Button
              variant="plain"
              onClick={handlePostpone}
              className="srs-card-toolbar-btn"
            >
              <i className="ti ti-calendar-pause" style={{ fontSize: 16 }} />
            </Button>
          </Tooltip>
          <Tooltip text={t("Suspend Card [H]")}>
            <Button
              variant="plain"
              onClick={() => handleToggleStatus("suspend")}
              className={`srs-card-toolbar-btn ${isSuspended ? "active" : ""}`}
            >
              <i className="ti ti-player-pause" style={{ fontSize: 16 }} />
            </Button>
          </Tooltip>
          <Tooltip text={t("Card Information [I]")}>
            <Button
              variant="plain"
              onClick={() => setShowInfo(!showInfo)}
              className={`srs-card-toolbar-btn ${showInfo ? "active" : ""}`}
            >
              <i className="ti ti-info-circle" style={{ fontSize: 16 }} />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* 内部滚动区 - 包含详情和主内容 */}
      <div
        className="srs-card-scroll-body"
        style={{
          flex: 1,
          overflowY: "auto",
          // paddingRight: "8px", // 为滚动条预留一点空间
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* 卡片详情面板 */}
        {showInfo && (
          <div
            contentEditable={false}
            style={{
              padding: 16,
              background: "var(--orca-bg-tertiary)",
              borderRadius: 8,
              fontSize: 12,
              animation: "fadeIn 0.2s ease-out",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px 16px",
              }}
            >
              <div className="srs-info-item">
                <span>{t("Priority")}</span>
                <span style={{ fontWeight: 600 }}>{activeCard.priority ?? 3}</span>
              </div>
              <div className="srs-info-item">
                <span>{t("Retention Lapses")}</span>
                <span style={{ fontWeight: 600 }}>{srsData?.lapses || 0}</span>
              </div>
              <div className="srs-info-item">
                <span>{t("Review Counts")}</span>
                <span style={{ fontWeight: 600 }}>{srsData?.reps || 0}</span>
              </div>
              <div className="srs-info-item">
                <span>{t("Last Reviewed")}</span>
                <span style={{ fontWeight: 600 }}>
                  {formatDateTime(srsData?.lastReviewed)}
                </span>
              </div>
              <div className="srs-info-item">
                <span>{t("State")}</span>
                <span style={{ fontWeight: 600 }}>
                  {formatCardState(srsData?.state)}
                </span>
              </div>
              <div className="srs-info-item">
                <span>{t("Stability")}</span>
                <span style={{ fontWeight: 600 }}>
                  {srsData?.stability?.toFixed(2) || "0.00"}
                </span>
              </div>
              <div className="srs-info-item">
                <span>{t("Difficulty")}</span>
                <span style={{ fontWeight: 600 }}>
                  {srsData?.difficulty?.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 4 }}>
              <div style={{ marginBottom: 4, opacity: 0.7, fontWeight: 500 }}>
                {t("Remark")}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={localRemark}
                  onChange={(e) => setLocalRemark(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveRemark()}
                  onBlur={handleSaveRemark}
                  style={{
                    flex: 1,
                    background: "var(--orca-bg-primary)",
                    border: "1px solid var(--orca-border-low)",
                    borderRadius: 4,
                    padding: "4px 8px",
                    fontSize: 12,
                    color: "var(--orca-text-primary)",
                  }}
                  placeholder={t("Add a remark...")}
                />
              </div>
            </div>
          </div>
        )}

        {/* 内容展示区 */}
        <div className="srs-card-content" style={{ flex: 1 }}>
          {displayMode === "srs-item" ? (
            <ItemRenderer
              blockId={blockId}
              panelId={panelId}
              showAnswer={showAnswer}
            />
          ) : (
            <TopicRenderer blockId={blockId} panelId={panelId} />
          )}
        </div>
      </div>

      {/* 底部控制栏 - 固定在底部 */}
      <div
        className="srs-card-footer"
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "16px 0",
          flexShrink: 0,
          borderTop: "1px solid var(--orca-border-low)",
          backgroundColor: "var(--orca-bg-secondary)",
          zIndex: 10,
        }}
      >
        {(() => {
          switch (displayMode) {
            case "roaming":
              return (
                <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 600 }}>
                  <Button
                    variant="outline"
                    onClick={onSkip}
                    disabled={isSaving}
                    style={{ flex: 1, borderRadius: 8, background: "#f5f5f5" }}
                    className="srs-grade-btn"
                  >
                    <div style={{ fontWeight: 600 }}>{t("Next")}</div>
                    <div className="srs-interval-hint">{t("[S]")}</div>
                  </Button>
                  <Button
                    variant="solid"
                    onClick={handleCaptureCard}
                    disabled={isSaving}
                    className="srs-grade-btn"
                    style={{ flex: 3, background: "#1e88e5", color: "white", borderRadius: 8 }}
                  >
                    <div style={{ fontWeight: 600 }}>{activeCard.isVirtual ? t("Add to SRS") : t("Boost Priority")}</div>
                    <div className="srs-interval-hint">{t("[Space]")}</div>
                  </Button>
                </div>
              );

            case "srs-topic":
              return (
                <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 600 }}>
                  <Button
                    variant="outline"
                    onClick={onSkip}
                    disabled={isSaving}
                    style={{ flex: 1, borderRadius: 8, background: "#f5f5f5" }}
                    className="srs-grade-btn"
                  >
                    {t("Skip")}
                    <span contentEditable={false} style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}>
                      {t("[S]")}
                    </span>
                  </Button>
                  <div style={{ display: "flex", gap: 12, flex: 4 }}>
                    <Button
                      variant="solid"
                      onClick={() => handleGradeAction("soon")}
                      disabled={isSaving}
                      className="srs-grade-btn"
                      style={{ background: "#fb8c00", color: "white", borderRadius: 8 }}
                    >
                      <div style={{ fontWeight: 600 }}>{t("Soon")}</div>
                      <div className="srs-interval-hint">{predictedIntervals?.soon}</div>
                    </Button>
                    <Button
                      variant="solid"
                      onClick={() => handleGradeAction("done")}
                      disabled={isSaving}
                      className="srs-grade-btn"
                      style={{ background: "#43a047", color: "white", borderRadius: 8 }}
                    >
                      <div style={{ fontWeight: 600 }}>{t("Done")}</div>
                      <div className="srs-interval-hint">{predictedIntervals?.done}</div>
                    </Button>
                    <Button
                      variant="solid"
                      onClick={() => handleGradeAction("easy")}
                      disabled={isSaving}
                      className="srs-grade-btn"
                      style={{ background: "#1e88e5", color: "white", borderRadius: 8 }}
                    >
                      <div style={{ fontWeight: 600 }}>{t("Easy")}</div>
                      <div className="srs-interval-hint">{predictedIntervals?.easy}</div>
                    </Button>
                  </div>
                </div>
              );

            case "srs-item":
              if (!showAnswer) {
                return (
                  <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 600 }}>
                    <Button
                      variant="outline"
                      onClick={onSkip}
                      style={{ flex: 1, borderRadius: 8, background: "#f5f5f5" }}
                    >
                      {t("Skip")}
                      <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}>{t("[S]")}</span>
                    </Button>
                    <Button
                      variant="solid"
                      onClick={() => setShowAnswer(true)}
                      style={{
                        flex: 3,
                        padding: "14px",
                        fontSize: 16,
                        borderRadius: 8,
                        background: "#1e88e5",
                        color: "white",
                        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                      }}
                    >
                      {t("Show Answer")}
                      <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.8 }}>{t("[Space]")}</span>
                    </Button>
                  </div>
                );
              }
              return (
                <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 600 }}>
                  <Button
                    variant="outline"
                    onClick={onSkip}
                    disabled={isSaving}
                    style={{ flex: 1, borderRadius: 8, background: "#f5f5f5" }}
                    className="srs-grade-btn"
                  >
                    {t("Skip")}
                    <span contentEditable={false} style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}>
                      {t("[S]")}
                    </span>
                  </Button>
                  <div style={{ display: "flex", gap: 12, flex: 4 }}>
                    <Button
                      variant="solid"
                      onClick={() => handleGradeAction("again")}
                      disabled={isSaving}
                      className="srs-grade-btn"
                      style={{ background: "#e53935", color: "white", borderRadius: 8 }}
                    >
                      <div style={{ fontWeight: 600 }}>{t("Again")}</div>
                      <div className="srs-interval-hint">{predictedIntervals?.again}</div>
                    </Button>
                    <Button
                      variant="solid"
                      onClick={() => handleGradeAction("hard")}
                      disabled={isSaving}
                      className="srs-grade-btn"
                      style={{ background: "#fb8c00", color: "white", borderRadius: 8 }}
                    >
                      <div style={{ fontWeight: 600 }}>{t("Hard")}</div>
                      <div className="srs-interval-hint">{predictedIntervals?.hard}</div>
                    </Button>
                    <Button
                      variant="solid"
                      onClick={() => handleGradeAction("good")}
                      disabled={isSaving}
                      className="srs-grade-btn"
                      style={{ background: "#43a047", color: "white", borderRadius: 8 }}
                    >
                      <div style={{ fontWeight: 600 }}>{t("Good")}</div>
                      <div className="srs-interval-hint">{predictedIntervals?.good}</div>
                    </Button>
                    <Button
                      variant="solid"
                      onClick={() => handleGradeAction("easy")}
                      disabled={isSaving}
                      className="srs-grade-btn"
                      style={{ background: "#1e88e5", color: "white", borderRadius: 8 }}
                    >
                      <div style={{ fontWeight: 600 }}>{t("Easy")}</div>
                      <div className="srs-interval-hint">{predictedIntervals?.easy}</div>
                    </Button>
                  </div>
                </div>
              );
          }
        })()}
      </div>
    </div>
  );
};
