import React, { useState, useEffect } from "react";
import { fetchDueCards, SrsCardData } from "../core/query";
import { calculateNextReview, FsrsGrade, CardState } from "../core/fsrs";
import { t } from "../../libs/l10n";
import { ensureCardTagSchema } from "../core/tagSchema";
import { PropType } from "@/libs/consts";

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
        ":scope > .orca-block"
      );
      if (rootBlock) {
        const collapseSelector =
          ".orca-repr-collapse, [data-role='collapse'], [data-testid='collapse']";
        const collapseEl = rootBlock.querySelector<HTMLElement>(
          collapseSelector
        );
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
        ":scope > .orca-block > .orca-repr > .orca-repr-main"
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
        ".orca-block-children, .orca-repr-children, [data-role='children']"
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

  useEffect(() => {
    loadCards();
  }, []);

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

    // Save properties back to the block/tag
    try {
      const tagProperties = [
        { name: "due", type: PropType.DateTime, value: nextDue.getTime() },
        {
          name: "type",
          type: PropType.TextChoices,
          value: [activeCard.type],
          typeArgs: { choices: ["Auto", "Topic", "Item"], subType: "single" },
        },
        { name: "fsrsData", type: PropType.JSON, value: nextState },
      ];

      if (activeCard.cardRef) {
        await orca.commands.invokeEditorCommand(
          "core.editor.setRefData",
          null,
          activeCard.cardRef,
          tagProperties,
        );
      } else {
        await orca.commands.invokeEditorCommand(
          "core.editor.insertTag",
          null,
          activeCard.blockId,
          "Card",
          tagProperties,
        );
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
          padding: "16px",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            paddingBottom: 16,
            borderBottom: "1px solid var(--orca-border)",
          }}
        >
          <div contentEditable={false} style={{ fontWeight: 500 }}>
            {t("Review")}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--orca-text-secondary)",
              background: "var(--orca-bg-tertiary)",
              padding: "2px 8px",
              borderRadius: 12,
            }}
          >
            {remainingCount} {t("cards left")}
          </div>
        </div>

        {/* Card Content Area */}
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          <div style={{ marginBottom: 16, opacity: 0.7, fontSize: 13 }}>
            <orca.components.BlockBreadcrumb blockId={activeCard.blockId} />
          </div>

          <div
            style={{
              border: "1px solid var(--orca-border)",
              borderRadius: 8,
              padding: 16,
              background: "var(--orca-bg-secondary)",
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
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: "1px dashed var(--orca-border)",
                  opacity: 0.9,
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
            marginTop: 16,
            paddingTop: 16,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {!showAnswer && !isTopic ? (
            <Button
              variant="solid"
              onClick={() => setShowAnswer(true)}
              style={{ width: "100%", maxWidth: 300, padding: 12 }}
            >
              {t("Show Answer")}
            </Button>
          ) : (
            <div
              style={{ display: "flex", gap: 12, width: "100%", maxWidth: 400 }}
            >
              {isTopic ? (
                <Button
                  variant="solid"
                  onClick={() => handleGrade("good")}
                  style={{
                    flex: 1,
                    background: "var(--orca-blue)",
                    color: "white",
                  }}
                >
                  {t("Mark as Read")}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleGrade("again")}
                    style={{
                      flex: 1,
                      color: "var(--orca-red)",
                      borderColor: "var(--orca-red)",
                    }}
                  >
                    {t("Again")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleGrade("hard")}
                    style={{
                      flex: 1,
                      color: "var(--orca-orange)",
                      borderColor: "var(--orca-orange)",
                    }}
                  >
                    {t("Hard")}
                  </Button>
                  <Button
                    variant="soft"
                    onClick={() => handleGrade("good")}
                    style={{ flex: 1, color: "var(--orca-green)" }}
                  >
                    {t("Good")}
                  </Button>
                  <Button
                    variant="soft"
                    onClick={() => handleGrade("easy")}
                    style={{ flex: 1, color: "var(--orca-blue)" }}
                  >
                    {t("Easy")}
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
