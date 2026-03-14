import React, { useState, useEffect, useMemo } from "react";
import type { DbId } from "@/orca";
import { ItemRenderer } from "./ItemRenderer";
import { TopicRenderer } from "./TopicRenderer";
import { t } from "../../../libs/l10n";
import { FsrsGrade, calculateNextReview, CardState } from "../../core/fsrs";
import {
  saveCardReview,
  postponeCard,
  toggleCardStatus,
  saveCardRemark,
} from "../../core/storage";
import { SrsCardData } from "../../core/query";

const { Button, Tooltip } = orca.components;

interface ReviewCardProps {
  activeCard: SrsCardData;
  panelId: string;
  onCardCompleted: () => void;
  onSkip: () => void;
  shortcutsEnabled: boolean;
}

function formatInterval(days: number): string {
  if (days < 1) {
    const minutes = Math.round(days * 24 * 60);
    if (minutes < 1) return "<1m";
    return `${minutes}m`;
  }
  const rounded = Math.round(days);
  if (rounded < 30) return `${rounded}d`;
  if (rounded < 365) return `${(rounded / 30.44).toFixed(1)}mo`;
  return `${(rounded / 365.25).toFixed(1)}y`;
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
  onCardCompleted,
  onSkip,
  shortcutsEnabled,
}) => {
  const {
    blockId,
    type,
    fsrsData,
    status: cardStatus,
    remark: cardRemark,
  } = activeCard;
  const isTopic = type === "Topic";

  const [showAnswer, setShowAnswer] = useState(isTopic);
  const [isSaving, setIsSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [localRemark, setLocalRemark] = useState(cardRemark || "");

  const isMarked = cardStatus?.includes("marked");
  const isArchived = cardStatus?.includes("archived");
  const isSuspended = cardStatus?.includes("suspend");

  // 重置状态
  useEffect(() => {
    setShowAnswer(isTopic);
    setIsSaving(false);
    setShowInfo(false);
    setLocalRemark(cardRemark || "");
  }, [blockId, isTopic, cardRemark]);

  // 计算预测间隔
  const predictedIntervals = useMemo(() => {
    if (!fsrsData) return null;
    const grades: FsrsGrade[] = ["again", "hard", "good", "easy"];
    const results: Record<string, string> = {};
    grades.forEach((g) => {
      const { nextState } = calculateNextReview(fsrsData, g);
      results[g] = formatInterval(nextState.interval);
    });
    return results;
  }, [fsrsData]);

  // 动作处理
  const handleGradeAction = async (grade: FsrsGrade) => {
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

  // 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!shortcutsEnabled) return;
      if (
        document.activeElement?.getAttribute("contenteditable") === "true" ||
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (e.code === "Space") {
        e.preventDefault();
        if (!showAnswer && !isTopic) setShowAnswer(true);
        else handleGradeAction("good");
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
      } else if (showAnswer || isTopic) {
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
    isTopic,
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
        gap: "16px",
        position: "relative",
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

      {isMarked && (
        <div className="srs-marked-flag">
          <i className="ti ti-flag-filled" />
        </div>
      )}

      {/* 卡片顶部工具栏 */}
      <div
        contentEditable={false}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: -4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "white",
              background: isTopic ? "#43a047" : "#fb8c00",
              padding: "2px 8px",
              borderRadius: 4,
              textTransform: "uppercase",
            }}
          >
            {isTopic ? t("Topic") : t("Item")}
          </div>
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
              <span>{t("Retention Lapses")}</span>
              <span style={{ fontWeight: 600 }}>{fsrsData?.lapses || 0}</span>
            </div>
            <div className="srs-info-item">
              <span>{t("Review Counts")}</span>
              <span style={{ fontWeight: 600 }}>{fsrsData?.reps || 0}</span>
            </div>
            <div className="srs-info-item">
              <span>{t("Last Reviewed")}</span>
              <span style={{ fontWeight: 600 }}>
                {formatDateTime(fsrsData?.lastReviewed)}
              </span>
            </div>
            <div className="srs-info-item">
              <span>{t("State")}</span>
              <span style={{ fontWeight: 600 }}>
                {formatCardState(fsrsData?.state)}
              </span>
            </div>
            <div className="srs-info-item">
              <span>{t("Stability")}</span>
              <span style={{ fontWeight: 600 }}>
                {fsrsData?.stability?.toFixed(2) || "0.00"}
              </span>
            </div>
            <div className="srs-info-item">
              <span>{t("Difficulty")}</span>
              <span style={{ fontWeight: 600 }}>
                {fsrsData?.difficulty?.toFixed(2) || "0.00"}
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
              {/* <Button
                variant="solid"
                onClick={handleSaveRemark}
                style={{ padding: "4px 8px", fontSize: 11 }}
              >
                {t("Save")}
              </Button> */}
            </div>
          </div>
        </div>
      )}

      {/* 内容展示区 */}
      <div className="srs-card-content" style={{ flex: 1 }}>
        {isTopic ? (
          <TopicRenderer blockId={blockId} panelId={panelId} />
        ) : (
          <ItemRenderer
            blockId={blockId}
            panelId={panelId}
            showAnswer={showAnswer}
          />
        )}
      </div>

      {/* 底部控制栏 */}
      <div
        className="srs-card-footer"
        style={{ display: "flex", justifyContent: "center", marginTop: 8 }}
      >
        {!showAnswer && !isTopic ? (
          <div
            style={{ display: "flex", gap: 12, width: "100%", maxWidth: 600 }}
          >
            <Button
              variant="outline"
              onClick={onSkip}
              style={{ flex: 1, borderRadius: 8 }}
            >
              {t("Skip")}
              <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}>
                [S]
              </span>
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
              <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.8 }}>
                [Space]
              </span>
            </Button>
          </div>
        ) : (
          <div
            style={{ display: "flex", gap: 12, width: "100%", maxWidth: 600 }}
          >
            <Button
              variant="outline"
              onClick={onSkip}
              disabled={isSaving}
              style={{ flex: 1, borderRadius: 8 }}
            >
              {t("Skip")}
              <span
                contentEditable={false}
                style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}
              >
                [S]
              </span>
            </Button>

            <div style={{ display: "flex", gap: 12, flex: 4 }}>
              {isTopic ? (
                <Button
                  variant="solid"
                  onClick={() => handleGradeAction("good")}
                  disabled={isSaving}
                  className="srs-grade-btn"
                  style={{
                    background: "#1e88e5",
                    color: "white",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{t("Mark as Read")}</div>
                  <div className="srs-interval-hint">
                    {predictedIntervals?.good}
                  </div>
                </Button>
              ) : (
                <>
                  <Button
                    variant="solid"
                    onClick={() => handleGradeAction("again")}
                    disabled={isSaving}
                    className="srs-grade-btn"
                    style={{
                      background: "#e53935",
                      color: "white",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{t("Again")}</div>
                    <div className="srs-interval-hint">
                      {predictedIntervals?.again}
                    </div>
                  </Button>
                  <Button
                    variant="solid"
                    onClick={() => handleGradeAction("hard")}
                    disabled={isSaving}
                    className="srs-grade-btn"
                    style={{
                      background: "#fb8c00",
                      color: "white",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{t("Hard")}</div>
                    <div className="srs-interval-hint">
                      {predictedIntervals?.hard}
                    </div>
                  </Button>
                  <Button
                    variant="solid"
                    onClick={() => handleGradeAction("good")}
                    disabled={isSaving}
                    className="srs-grade-btn"
                    style={{
                      background: "#43a047",
                      color: "white",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{t("Good")}</div>
                    <div className="srs-interval-hint">
                      {predictedIntervals?.good}
                    </div>
                  </Button>
                  <Button
                    variant="solid"
                    onClick={() => handleGradeAction("easy")}
                    disabled={isSaving}
                    className="srs-grade-btn"
                    style={{
                      background: "#1e88e5",
                      color: "white",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{t("Easy")}</div>
                    <div className="srs-interval-hint">
                      {predictedIntervals?.easy}
                    </div>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
