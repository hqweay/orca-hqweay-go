import React, { useState, useEffect, useMemo } from "react";
import type { DbId } from "@/orca";
import { ItemRenderer } from "./ItemRenderer";
import { TopicRenderer } from "./TopicRenderer";
import { t } from "../../../libs/l10n";
import { FsrsGrade, calculateNextReview } from "../../core/fsrs";
import { saveCardReview } from "../../core/storage";
import { SrsCardData } from "../../core/query";

const { Button } = orca.components;

interface ReviewCardProps {
  activeCard: SrsCardData;
  panelId: string;
  onCardCompleted: () => void;
  onSkip: () => void;
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

/**
 * 卡片容器外壳 (Shell)
 * 负责分层渲染、交互逻辑 (快捷键、显示答案) 以及触发进度保存
 */
export const ReviewCard: React.FC<ReviewCardProps> = ({
  activeCard,
  panelId,
  onCardCompleted,
  onSkip,
}) => {
  const { blockId, type, fsrsData } = activeCard;
  const isTopic = type === "Topic";

  const [showAnswer, setShowAnswer] = useState(isTopic);
  const [isSaving, setIsSaving] = useState(false);

  // 当卡片切换时，重置状态
  useEffect(() => {
    setShowAnswer(isTopic);
    setIsSaving(false);
  }, [blockId, isTopic]);

  // 预测下一次复习间隔
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

  // 处理评分逻辑
  const handleGradeAction = async (grade: FsrsGrade) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveCardReview(activeCard, grade);
      onCardCompleted();
    } catch (err) {
      console.error("[lets-srs] failed to save card review", err);
      // 报错后允许重试
      setIsSaving(false);
    }
  };

  // 快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果焦点在输入区域，屏蔽快捷键
      if (
        document.activeElement?.getAttribute("contenteditable") === "true" ||
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (!showAnswer && !isTopic) {
          setShowAnswer(true);
        } else {
          handleGradeAction("good");
        }
      } else if (e.key.toLowerCase() === "s") {
        onSkip();
      } else if (showAnswer || isTopic) {
        if (e.key === "1") handleGradeAction("again");
        if (e.key === "2") handleGradeAction("hard");
        if (e.key === "3") handleGradeAction("good");
        if (e.key === "4") handleGradeAction("easy");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAnswer, isTopic, activeCard, isSaving, onSkip]);

  return (
    <div className="srs-card-container" style={{ display: "flex", flexDirection: "column", height: "100%", gap: "24px" }}>
      <style>{`
        .srs-grade-btn {
          transition: all 0.2s ease;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 8px !important;
          height: auto !important;
        }
        .srs-grade-btn:hover {
          transform: translateY(-2px);
          filter: brightness(1.1);
        }
        .srs-interval-hint {
          font-size: 10px;
          opacity: 0.8;
        }
      `}</style>

      {/* 渲染器：根据卡片类型选择 */}
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
        style={{ display: "flex", justifyContent: "center" }}
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
