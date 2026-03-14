import React, { useState, useEffect } from "react";
import { fetchDueCards, SrsCardData } from "../core/query";
import { calculateNextReview, FsrsGrade, CardState } from "../core/fsrs";
import { t } from "../../libs/l10n";
import { ensureCardTagSchema } from "../core/tagSchema";
import { PropType } from "@/libs/consts";
import { Logger } from "@/libs/logger";
const logger = new Logger("lets-srs");
interface RendererProps {
  panelId: string;
  blockId: number;
  rndId: string;
  blockLevel: number;
  indentLevel: number;
  mirrorId?: number;
  initiallyCollapsed?: boolean;
  renderingMode?: "normal" | "simple" | "simple-children";
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

interface ReviewCardProps {
  blockId: number;
  panelId: string;
  showAnswer: boolean;
}

function ReviewCard({ blockId, panelId, showAnswer }: ReviewCardProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { Block } = orca.components;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateVisibility = () => {
      const rootBlock = container.querySelector<HTMLElement>(
        ":scope > .orca-block",
      );
      if (!rootBlock) return;

      // 1. 自动展开
      const collapseSelector =
        ".orca-repr-main-expand, .orca-block-expand, [data-role='expand']";
      const collapseEl = rootBlock.querySelector<HTMLElement>(collapseSelector);
      if (collapseEl) {
        const isCollapsed =
          collapseEl.getAttribute("aria-expanded") === "false" ||
          collapseEl.classList.contains("collapsed");
        if (isCollapsed) collapseEl.click();
      }

      // 2. 隐藏块级杂项 (Handle, Bullet, etc.)
      const uiSelectors = [
        // ".orca-block-handle",
        //  ".orca-block-bullet",
        // ".orca-repr-main-expand",
        // ".orca-block-expand-wrapper",
        // ".orca-block-breadcrumb",
        ".orca-repr-scope-line",
      ];
      uiSelectors.forEach((sel) => {
        // rootBlock.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        //   el.style.display = "none";
        // });
        container.querySelectorAll<HTMLElement>(sel).forEach((el) => {
          el.style.display = "none";
        });
      });

      // 3. 核心切换逻辑：隐藏/显示主内容与子块
      const repr = rootBlock.querySelector<HTMLElement>(".orca-repr");
      if (repr) {
        // const main = repr.querySelector<HTMLElement>(
        //   ":scope > .orca-repr-main",
        // );
        const children = repr.querySelector<HTMLElement>(
          ":scope > .orca-block-children, :scope > .orca-repr-children",
        );

        // if (main) {
        //   main.style.display = showAnswer ? "none" : "";
        // }
        if (children) {
          children.style.display = showAnswer ? "" : "none";
        }
      }
    };

    const observer = new MutationObserver(updateVisibility);
    observer.observe(container, { childList: true, subtree: true });

    updateVisibility();

    return () => observer.disconnect();
  }, [showAnswer]);

  return (
    <div ref={containerRef} className="srs-review-card" data-orca-block-root>
      <Block
        panelId={panelId}
        blockId={blockId}
        blockLevel={0}
        indentLevel={0}
      />
    </div>
  );
}

export function ReviewPanel(props: RendererProps) {
  const Button = orca.components.Button;
  const BlockShell = orca.components.BlockShell;

  const [cards, setCards] = useState<SrsCardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);

  const activeCard = cards[currentIndex];

  // 计算预览间隔
  const predictedIntervals = React.useMemo(() => {
    if (!activeCard) return null;
    const grades: FsrsGrade[] = ["again", "hard", "good", "easy"];
    const results: Record<string, string> = {};
    grades.forEach((g) => {
      const { nextState } = calculateNextReview(activeCard.fsrsData, g);
      results[g] = formatInterval(nextState.interval);
    });
    return results;
  }, [activeCard]);

  useEffect(() => {
    loadCards();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.getAttribute("contenteditable") === "true" ||
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (!activeCard) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (!showAnswer && activeCard.type !== "Topic") {
          setShowAnswer(true);
        } else {
          handleGrade("good");
        }
      } else if (e.key.toLowerCase() === "s") {
        handleSkip();
      } else if (showAnswer || activeCard.type === "Topic") {
        if (e.key === "1") handleGrade("again");
        if (e.key === "2") handleGrade("hard");
        if (e.key === "3") handleGrade("good");
        if (e.key === "4") handleGrade("easy");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCard, showAnswer, cards, currentIndex]);

  useEffect(() => {
    if (activeCard && activeCard.type === "Topic") {
      setShowAnswer(true);
    } else {
      setShowAnswer(false);
    }
  }, [currentIndex, activeCard]);

  const loadCards = async () => {
    try {
      setLoading(true);
      await ensureCardTagSchema("lets-srs");
      const dueCards = await fetchDueCards();
      logger.debug("due cards:", dueCards);
      setCards(dueCards || []);
      setCurrentIndex(0);
    } catch (err) {
      console.error("[lets-srs] failed to load cards", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setCurrentIndex((prev) => prev + 1);
    setShowAnswer(false);
  };

  const handleGrade = async (grade: FsrsGrade) => {
    if (!activeCard) return;

    const { nextState, nextDue } = calculateNextReview(
      activeCard.fsrsData,
      grade,
    );

    try {
      const tagProperties = [
        { name: "due", value: nextDue },
        { name: "fsrsData", value: JSON.stringify(nextState) },
        { name: "type", value: activeCard.type },
      ];

      if (activeCard.cardRef) {
        await orca.commands.invokeEditorCommand(
          "core.editor.setRefData",
          null,
          activeCard.cardRef,
          tagProperties,
        );
      }

      setCurrentIndex((prev) => prev + 1);
      setShowAnswer(false);
    } catch (err) {
      console.error("[lets-srs] failed to save grade properties", err);
    }
  };

  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const blockEditor = el.closest(".orca-block-editor") as HTMLElement;
    if (!blockEditor) return;

    const selectors = [
      ".orca-block-handle",
      ".orca-repr-handle",
      ".orca-block-bullet",
      '[data-role="bullet"]',
      ".orca-block-drag-handle",
      ".orca-repr-collapse",
      ".orca-breadcrumb",
    ];

    const hiddenElements: HTMLElement[] = [];
    selectors.forEach((selector) => {
      blockEditor.querySelectorAll(selector).forEach((item: any) => {
        if (item.style.display !== "none") {
          item.style.display = "none";
          hiddenElements.push(item);
        }
      });
    });

    return () => {
      hiddenElements.forEach((item) => (item.style.display = ""));
    };
  }, []);

  const renderContent = () => {
    if (loading) {
      return (
        <div
          ref={containerRef}
          style={{
            padding: 16,
            textAlign: "center",
            color: "var(--orca-text-secondary)",
          }}
        >
          {t("Loading cards...")}
        </div>
      );
    }

    if (cards.length === 0 || currentIndex >= cards.length) {
      return (
        <div
          contentEditable={false}
          ref={containerRef}
          style={{
            padding: 32,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 48 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>
            {t("You're all caught up!")}
          </div>
          <Button
            variant="outline"
            onClick={loadCards}
            style={{ alignSelf: "center", marginTop: 16 }}
          >
            {t("Refresh")}
          </Button>
        </div>
      );
    }

    const isTopic = activeCard.type === "Topic";
    const remainingCount = cards.length - currentIndex;
    const blockData = activeCard.block;

    if (!blockData) {
      return (
        <div
          ref={containerRef}
          style={{ padding: 16, textAlign: "center", color: "gray" }}
        >
          {t("Preparing block data...")}
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: "24px",
          boxSizing: "border-box",
          maxWidth: 800,
          margin: "0 auto",
          width: "100%",
          animation: "fadeIn 0.3s ease-out",
        }}
      >
        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
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
              font-weight: 400;
            }
          `}
        </style>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
            paddingBottom: 16,
            borderBottom: "1px solid var(--orca-border)",
          }}
        >
          <div
            contentEditable={false}
            style={{ fontWeight: 600, fontSize: 18 }}
          >
            {t("SRS Review")}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "white",
              background: "#1e88e5",
              padding: "4px 12px",
              borderRadius: 20,
              fontWeight: 500,
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            {remainingCount} {t("cards left")}
          </div>
        </div>

        {/* Card Content Area */}
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          <div style={{ marginBottom: 12, opacity: 0.6, fontSize: 12 }}>
            <orca.components.BlockBreadcrumb blockId={activeCard.blockId} />
          </div>

          <div
            style={{
              border: "1px solid var(--orca-border)",
              borderRadius: 12,
              padding: 24,
              background: "var(--orca-bg-secondary)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              minHeight: 180,
              transition: "all 0.3s ease",
            }}
          >
            <ReviewCard
              blockId={activeCard.blockId}
              panelId={props.panelId}
              showAnswer={showAnswer}
            />
          </div>
        </div>

        {/* Footer Controls */}
        <div
          style={{
            marginTop: 32,
            paddingBottom: 16,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {!showAnswer && !isTopic ? (
            <div
              style={{ display: "flex", gap: 12, width: "100%", maxWidth: 600 }}
            >
              <Button
                variant="outline"
                onClick={handleSkip}
                style={{
                  flex: 1,
                  borderRadius: 8,
                  borderColor: "var(--orca-border)",
                }}
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
              <div style={{ display: "flex", gap: 12, flex: 4 }}>
                {isTopic ? (
                  <Button
                    variant="solid"
                    onClick={() => handleGrade("good")}
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
                      onClick={() => handleGrade("again")}
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
                      onClick={() => handleGrade("hard")}
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
                      onClick={() => handleGrade("good")}
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
                      onClick={() => handleGrade("easy")}
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
              <Button
                variant="outline"
                onClick={handleSkip}
                style={{
                  flex: 1,
                  borderRadius: 8,
                  borderColor: "var(--orca-border)",
                }}
              >
                {t("Skip")}
                <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}>
                  [S]
                </span>
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <BlockShell
      panelId={props.panelId}
      blockId={props.blockId}
      rndId={props.rndId}
      mirrorId={props.mirrorId}
      blockLevel={props.blockLevel}
      indentLevel={props.indentLevel}
      initiallyCollapsed={props.initiallyCollapsed}
      renderingMode={props.renderingMode}
      reprClassName="lets-srs-review-session"
      contentClassName="lets-srs-review-session-content"
      contentJsx={renderContent()}
      childrenJsx={null}
    />
  );
}
