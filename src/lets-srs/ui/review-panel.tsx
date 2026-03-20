import React, { useState, useEffect } from "react";
import {
  fetchDueCards,
  SrsCardData,
  normalizeBlockToCard,
  getRelatedBlockIds,
} from "../core/query";
import { t } from "../../libs/l10n";
import { ensureCardTagSchema } from "../core/tagSchema";
import { Logger } from "@/libs/logger";
import { ReviewCard } from "./components/ReviewCard";
import { CardGrade, revertCardToState } from "../core/storage";
import cloneDeep from "lodash.clonedeep";

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

export function ReviewPanel(props: RendererProps) {
  const Button = orca.components.Button;
  const BlockShell = orca.components.BlockShell;

  const [cards, setCards] = useState<SrsCardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [shortcutsEnabled, setShortcutsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentRoamDepth, setCurrentRoamDepth] = useState(1);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const loadedIdsRef = React.useRef<Set<number>>(new Set());

  const activeCard = cards[currentIndex];

  const viewPanel = orca.nav.findViewPanel(props.panelId, orca.state.panels);
  const viewArgs = viewPanel?.viewArgs;

  const loadCards = async () => {
    try {
      setLoading(true);
      await ensureCardTagSchema("lets-srs");

      logger.debug("props", props);
      // 检查是否有外部传入的块列表（漫游模式）
      let blockIds = viewArgs?.initialBlockIds;

      // 如果有查询描述符，则重新查询以刷新数据（例如漫游模式随机换一波）
      if (viewArgs?.query) {
        logger.debug("Refreshing dynamic query results", viewArgs.query);
        const queryReq = cloneDeep(viewArgs.query);
        queryReq.randomSeed = Date.now();
        const queryResults = (await orca.invokeBackend(
          "query",
          queryReq,
        )) as number[];
        if (Array.isArray(queryResults)) {
          blockIds = queryResults;
        }
      }

      logger.debug("viewArgs", viewArgs);
      logger.debug("blockIds to load", blockIds);

      const sessionMode = viewArgs?.sessionMode || "mixed";

      if (Array.isArray(blockIds) && blockIds.length > 0) {
        const roamingCards: SrsCardData[] = [];
        loadedIdsRef.current.clear();
        if (viewArgs?.roamSeedId) loadedIdsRef.current.add(viewArgs.roamSeedId);

        for (const bid of blockIds) {
          const card = await normalizeBlockToCard(bid);
          if (card) {
            roamingCards.push(card);
            loadedIdsRef.current.add(card.blockId);
          }
        }
        setCards(roamingCards);
        setCurrentRoamDepth(1);
      } else {
        const dueCards = await fetchDueCards(sessionMode);
        logger.debug("due cards:", dueCards);
        setCards(dueCards || []);
      }

      setCurrentIndex(0);
      setHistory([]);
    } catch (err) {
      console.error("[lets-srs] failed to load cards", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, [viewArgs?.roamSeedId, viewArgs?.sessionMode]);

  const loadMoreRoamingCards = async (seedId: number, nextDepth: number) => {
    if (isFetchingMore) return;
    setIsFetchingMore(true);
    logger.info(`Fetching more roaming cards for depth: ${nextDepth}`);

    try {
      const hubCap = viewArgs?.roamHubCap || 50;

      const { ids } = await getRelatedBlockIds(
        seedId,
        nextDepth,
        hubCap,
        loadedIdsRef.current,
      );

      if (ids.length > 0) {
        const newCards: SrsCardData[] = [];
        for (const id of ids) {
          const card = await normalizeBlockToCard(id);
          if (card) {
            newCards.push(card);
            loadedIdsRef.current.add(card.blockId);
          }
        }

        if (newCards.length > 0) {
          setCards((prev) => [...prev, ...newCards]);
        }
      }
      setCurrentRoamDepth(nextDepth);
    } catch (err) {
      logger.error("Failed to load more roaming cards", err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  useEffect(() => {
    const seedId = viewArgs?.roamSeedId;

    if (
      seedId &&
      !isFetchingMore &&
      currentIndex >= cards.length - 3 &&
      cards.length > 0
    ) {
      const maxDepth = viewArgs.roamMaxDepth || 3;
      if (currentRoamDepth < maxDepth) {
        loadMoreRoamingCards(seedId, currentRoamDepth + 1);
      }
    }
  }, [currentIndex, cards.length, isFetchingMore, currentRoamDepth, viewArgs?.roamSeedId]);

  const handleSkip = () => {
    setHistory((prev) => [...prev, currentIndex]);
    setCurrentIndex((prev) => prev + 1);
  };

  const handleCardCompleted = async (grade?: CardGrade) => {
    setHistory((prev) => [...prev, currentIndex]);

    const currentCard = cards[currentIndex];
    if (currentCard && (grade === "again" || grade === "soon")) {
      // Momo-style: Re-queue with randomized gap (3-7 cards)
      const gap = Math.floor(Math.random() * 5) + 3;
      const targetIndex = Math.min(currentIndex + gap + 1, cards.length);

      // Fetch latest state from database for the repeated card
      const updatedCard = await normalizeBlockToCard(currentCard.blockId);
      if (updatedCard) {
        setCards((prev) => {
          const next = [...prev];
          next.splice(targetIndex, 0, updatedCard);
          return next;
        });
      }
    }

    setCurrentIndex((prev) => prev + 1);
  };

  const handleGoBack = async () => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const prevIndex = newHistory.pop();

    if (prevIndex !== undefined) {
      const cardToRevert = cards[prevIndex];
      if (cardToRevert) {
        try {
          await revertCardToState(cardToRevert);
        } catch (err) {
          console.error(
            "[lets-srs] failed to revert card state during undo",
            err,
          );
        }
      }
      setHistory(newHistory);
      setCurrentIndex(prevIndex);
    }
  };

  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!shortcutsEnabled) return;
      const target = e.target as HTMLElement;

      // if (
      //   target.tagName === "INPUT" ||
      //   target.tagName === "TEXTAREA" ||
      //   target.isContentEditable
      // ) {
      //   return;
      // }

      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        handleGoBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleGoBack, shortcutsEnabled]);

  // useEffect(() => {
  //   const el = containerRef.current;
  //   if (!el) return;

  //   const blockEditor = el.closest(".orca-block-editor") as HTMLElement;
  //   if (!blockEditor) return;

  //   const selectors = [
  //     // ".orca-block-handle",
  //     // ".orca-repr-handle",
  //     // ".orca-block-bullet",
  //     // '[data-role="bullet"]',
  //     // ".orca-block-drag-handle",
  //     // ".orca-repr-collapse",
  //     // ".orca-breadcrumb",
  //   ];

  //   const hiddenElements: HTMLElement[] = [];
  //   selectors.forEach((selector) => {
  //     blockEditor.querySelectorAll(selector).forEach((item: any) => {
  //       if (item.style.display !== "none") {
  //         item.style.display = "none";
  //         hiddenElements.push(item);
  //       }
  //     });
  //   });

  //   return () => {
  //     hiddenElements.forEach((item) => (item.style.display = ""));
  //   };
  // }, []);

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

    const remainingCount = cards.length - currentIndex;

    if (!activeCard || !activeCard.block) {
      return (
        <div
          ref={containerRef}
          style={{ padding: 16, textAlign: "center", color: "gray" }}
        >
          {t("Preparing block data...")}
        </div>
      );
    }

    const viewPanel = orca.nav.findViewPanel(props.panelId, orca.state.panels);
    const viewArgs = viewPanel?.viewArgs;
    const isRoamingSession =
      Array.isArray(viewArgs?.initialBlockIds) || !!viewArgs?.query;

    const displayMode: any = isRoamingSession
      ? "roaming"
      : activeCard.type === "Item"
        ? "srs-item"
        : "srs-topic";

    return (
      <div
        ref={containerRef}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "95vh",
          padding: "24px",
          boxSizing: "border-box",
          maxWidth: 800,
          margin: "0 auto",
          width: "100%",
          animation: "fadeIn 0.3s ease-out",
          // overflow: "hidden", // 防止全局滚动
        }}
      >
        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
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
            flexShrink: 0, // 头部不缩放
          }}
        >
          <div
            contentEditable={false}
            style={{ fontWeight: 600, fontSize: 18 }}
          >
            {history.length > 0
              ? t("SRS Review")
              : isRoamingSession
                ? t("Roaming Mode")
                : t("SRS Review")}
          </div>
          <div
            contentEditable={false}
            style={{
              fontSize: 13,
              color: "white",
              background: "#1e88e5",
              padding: "4px 12px",
              borderRadius: 20,
              fontWeight: 500,
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              marginRight: "auto",
              marginLeft: 12,
            }}
          >
            {t("${count} cards left", { count: remainingCount.toString() })}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {history.length > 0 && (
              <orca.components.Tooltip text={t("Undo [Z]")}>
                <Button variant="plain" onClick={handleGoBack}>
                  <i
                    className="ti ti-arrow-back-up"
                    style={{ fontSize: "18px" }}
                  />
                </Button>
              </orca.components.Tooltip>
            )}

            <orca.components.Tooltip
              text={
                shortcutsEnabled ? t("Lock Shortcuts") : t("Unlock Shortcuts")
              }
            >
              <Button
                variant="plain"
                onClick={() => setShortcutsEnabled(!shortcutsEnabled)}
                style={{
                  color: shortcutsEnabled
                    ? "var(--orca-text-secondary)"
                    : "var(--orca-color-warning-5)",
                }}
              >
                <i
                  className={
                    shortcutsEnabled ? "ti ti-keyboard" : "ti ti-keyboard-off"
                  }
                  style={{ fontSize: "18px" }}
                />
              </Button>
            </orca.components.Tooltip>

            <orca.components.Tooltip text={t("Refresh")}>
              <Button variant="plain" onClick={() => loadCards()}>
                <i className="ti ti-refresh" style={{ fontSize: "18px" }} />
              </Button>
            </orca.components.Tooltip>
          </div>
        </div>

        {/* Card Content Area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              marginBottom: 12,
              opacity: 0.6,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            <orca.components.BlockBreadcrumb blockId={activeCard.blockId} />
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              border: "1px solid var(--orca-border)",
              borderRadius: 12,
              // padding: "24px 24px 0 24px",
              background: "var(--orca-bg-secondary)",
              transition: "all 0.3s ease",
              overflow: "hidden",
            }}
          >
            <ReviewCard
              activeCard={activeCard}
              panelId={props.panelId}
              displayMode={displayMode}
              onCardCompleted={(grade) => handleCardCompleted(grade)}
              onSkip={handleSkip}
              shortcutsEnabled={shortcutsEnabled}
            />
          </div>
        </div>
      </div>
    );
  };

  // console.log("activeCard", activeCard);
  // const childrenBlocks = useMemo(
  //   () => (
  //     <orca.components.BlockChildren
  //       block={orca.state.blocks[8874] as Block}
  //       panelId={props.panelId}
  //       blockLevel={0}
  //       indentLevel={0}
  //     />
  //   ),
  //   [orca.state.blocks[8874]?.children],
  // );

  return renderContent();
  // return (
  //   <BlockShell
  //     panelId={props.panelId}
  //     blockId={props.blockId}
  //     rndId={props.rndId}
  //     mirrorId={props.mirrorId}
  //     blockLevel={props.blockLevel}
  //     indentLevel={props.indentLevel}
  //     initiallyCollapsed={props.initiallyCollapsed}
  //     renderingMode={props.renderingMode}
  //     reprClassName="lets-srs-review-session"
  //     contentClassName="lets-srs-review-session-content"
  //     contentJsx={renderContent()}
  //     childrenJsx={childrenBlocks}
  //   />
  // );
}
