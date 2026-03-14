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

interface QuestionBlockProps {
  blockId: number;
  panelId: string;
}

function QuestionBlock({ blockId, panelId }: QuestionBlockProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { Block } = orca.components;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const removeChildren = () => {
      const selectors = [
        ".orca-block-children",
        ".orca-repr-children",
        "[data-role='children']",
        "[data-testid='children']",
      ];
      selectors.forEach((s) => {
        container.querySelectorAll(s).forEach((el) => el.remove());
      });
    };

    removeChildren();
    const observer = new MutationObserver(removeChildren);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [blockId]);

  return (
    <div
      ref={containerRef}
      className="srs-question-block"
      data-orca-block-root="true"
    >
      <Block
        panelId={panelId}
        blockId={blockId}
        blockLevel={0}
        indentLevel={0}
        renderingMode="simple"
      />
    </div>
  );
}

interface AnswerBlockProps {
  blockId: number;
  panelId: string;
}

function AnswerBlock({ blockId, panelId }: AnswerBlockProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { Block } = orca.components;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ensureExpanded = () => {
      const rootBlock = container.querySelector<HTMLElement>(
        ":scope > .orca-block",
      );
      if (rootBlock) {
        const collapseSelector =
          ".orca-repr-collapse, [data-role='collapse'], [data-testid='collapse']";
        const collapseEl =
          rootBlock.querySelector<HTMLElement>(collapseSelector);
        if (collapseEl) {
          const isCollapsed =
            collapseEl.getAttribute("aria-expanded") === "false" ||
            collapseEl.getAttribute("data-state") === "closed" ||
            collapseEl.classList.contains("collapsed");
          if (isCollapsed) {
            collapseEl.click();
          }
        }
      }
    };

    const hideParent = () => {
      ensureExpanded();

      // 1. 隐藏父块的主内容
      const main = container.querySelector<HTMLElement>(
        ":scope > .orca-block > .orca-repr > .orca-repr-main",
      );
      if (main) main.style.display = "none";

      // 2. 隐藏 handle/bullet/折叠按钮
      const selectors = [
        ":scope > .orca-block > .orca-block-handle",
        ":scope > .orca-block > .orca-block-bullet",
        ":scope > .orca-block > .orca-repr > .orca-repr-handle",
        ":scope > .orca-block > .orca-repr > .orca-repr-collapse",
      ];
      selectors.forEach((s) => {
        container.querySelectorAll(s).forEach((el: any) => {
          el.style.display = "none";
          el.style.width = "0";
          el.style.height = "0";
          el.style.overflow = "hidden";
        });
      });

      // 3. 强制显示子块
      const children = container.querySelectorAll<HTMLElement>(
        ".orca-block-children, .orca-repr-children, [data-role='children']",
      );
      children.forEach((el) => {
        el.style.display = "";
        el.style.visibility = "";
      });
    };

    hideParent();
    const observer = new MutationObserver(hideParent);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [blockId]);

  return (
    <div
      ref={containerRef}
      className="srs-answer-block"
      style={{ marginLeft: "-24px" }}
      data-orca-block-root="true"
    >
      <Block
        panelId={panelId}
        blockId={blockId}
        blockLevel={0}
        indentLevel={0}
        renderingMode="normal"
        initiallyCollapsed={false}
      />
    </div>
  );
}

export function ReviewPanel(props: RendererProps) {
  const Button = orca.components.Button;
  const BlockShell = orca.components.BlockShell;

  const { useSnapshot } = window.Valtio;
  const snapshot = useSnapshot(orca.state);

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
      // Don't trigger if user is typing in a block
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
          // Space is "Good" if answer is shown
          handleGrade("good");
        }
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

  // Auto-show answer if it's a Topic card
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
      // pluginName 可以从 snapshot 或其他地方获取，这里硬编码或从 props 尝试
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

  const handleGrade = async (grade: FsrsGrade) => {
    if (!activeCard) return;

    const { nextState, nextDue } = calculateNextReview(
      activeCard.fsrsData,
      grade,
    );

    console.log("[lets-srs] next state:", activeCard);

    // Save properties back to the block/tag
    try {
      const tagProperties = [
        { name: "due", value: nextDue },
        // {
        //   name: "type",
        //   type: PropType.TextChoices,
        //   value: [activeCard.type],
        //   typeArgs: { choices: ["Auto", "Topic", "Item"], subType: "single" },
        // },
        { name: "fsrsData", value: JSON.stringify(nextState) },
      ];

      console.log("[lets-srs] tag properties:", tagProperties);

      if (activeCard.cardRef) {
        await orca.commands.invokeEditorCommand(
          "core.editor.setRefData",
          null,
          activeCard.cardRef,
          tagProperties,
        );
      } else {
        // await orca.commands.invokeEditorCommand(
        //   "core.editor.insertTag",
        //   null,
        //   activeCard.blockId,
        //   "Card",
        //   tagProperties,
        // );
      }

      // Move to next card
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

    // 借鉴 vendor 方案：找到父级 .orca-block-editor 并隐藏相关块级 UI
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
    const blockData = snapshot.blocks[activeCard.blockId];

    if (!blockData || !Array.isArray(blockData.children)) {
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
              background: "#1e88e5", // Consistent blue
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
            {/* 题目区域 */}
            <QuestionBlock
              blockId={activeCard.blockId}
              panelId={props.panelId}
            />

            {/* 答案部分 */}
            {showAnswer && (
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 24,
                  borderTop: "1px dashed var(--orca-border)",
                  animation: "fadeIn 0.4s ease-out",
                }}
              >
                <AnswerBlock
                  blockId={activeCard.blockId}
                  panelId={props.panelId}
                />
              </div>
            )}
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
            <Button
              variant="solid"
              onClick={() => setShowAnswer(true)}
              style={{
                width: "100%",
                maxWidth: 400,
                padding: "14px",
                fontSize: 16,
                borderRadius: 8,
                background: "#1e88e5", // Consistent blue
                color: "white",
                boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
              }}
            >
              {t("Show Answer")}
              <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.8 }}>
                [Space]
              </span>
            </Button>
          ) : (
            <div
              style={{ display: "flex", gap: 12, width: "100%", maxWidth: 500 }}
            >
              {isTopic ? (
                <Button
                  variant="solid"
                  onClick={() => handleGrade("good")}
                  className="srs-grade-btn"
                  style={{
                    background: "#1e88e5", // Consistent blue
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
                      background: "#e53935", // More solid red
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
                      background: "#fb8c00", // More solid orange
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
                      background: "#43a047", // More solid green
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
                      background: "#1e88e5", // More solid blue
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
