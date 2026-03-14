import React, { useState, useEffect } from "react";
import { fetchDueCards, SrsCardData } from "../core/query";
import { t } from "../../libs/l10n";
import { ensureCardTagSchema } from "../core/tagSchema";
import { PropType } from "@/libs/consts";
import { Logger } from "@/libs/logger";
import { ReviewCard } from "./components/ReviewCard";

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
  const [loading, setLoading] = useState(true);

  const activeCard = cards[currentIndex];

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

  useEffect(() => {
    loadCards();
  }, []);

  const handleSkip = () => {
    setCurrentIndex((prev) => prev + 1);
  };

  const handleCardCompleted = () => {
    setCurrentIndex((prev) => prev + 1);
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
            contentEditable={false}
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
          <orca.components.Tooltip text={t("Refresh")}>
            <Button variant="plain" onClick={() => loadCards()}>
              <i className="ti ti-refresh" style={{ fontSize: "16px" }} />
            </Button>
          </orca.components.Tooltip>
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
              activeCard={activeCard}
              panelId={props.panelId}
              onCardCompleted={handleCardCompleted}
              onSkip={handleSkip}
            />
          </div>
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
