import React, { useState, useEffect, useMemo } from "react"
import { findAdapter, getAdapters, getAvailableModes, type DisplayMode } from "./adapters/registry"
import type { EmbedData } from "../types"

const MODE_LABELS: Record<DisplayMode, string> = {
  widget: "Widget",
  embed: "Embed",
  card: "Card",
  link: "Link",
}

const HtmlPreview = ({ html }: { html: string }) => (
  <div dangerouslySetInnerHTML={{ __html: html }} style={{ padding: "12px" }} />
)

const EmptyState = () => (
  <div style={{ padding: "24px", textAlign: "center", opacity: 0.3, fontSize: "13px" }}>暂无内容</div>
)

export const EmbedPreview = ({
  data,
  displayMode,
  onDisplayModeChange,
}: {
  data: EmbedData
  displayMode?: DisplayMode
  onDisplayModeChange?: (mode: DisplayMode) => void
}) => {
  if (data.mode === "html" && data.html) {
    return <HtmlPreview html={data.html} />
  }

  if (data.mode === "url" && data.url) {
    const adapter = findAdapter(data.url)
    if (adapter) {
      const mode = displayMode || adapter.defaultMode
      const ModeComponent = adapter.modes[mode]
      const availableModes = getAvailableModes(adapter)

      return (
        <div>
          {/* Display mode selector - show when multiple modes available */}
          {availableModes.length > 1 && onDisplayModeChange && (
            <div style={{
              display: "flex",
              gap: "2px",
              padding: "6px 12px",
              background: "var(--orca-color-bg-2)",
              borderBottom: "1px solid var(--orca-color-border-2)",
            }}>
              {availableModes.map((m) => (
                <button
                  key={m}
                  onClick={() => onDisplayModeChange(m)}
                  style={{
                    padding: "2px 8px",
                    fontSize: "11px",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                    background: mode === m ? "var(--orca-color-primary)" : "transparent",
                    color: mode === m ? "white" : "var(--orca-color-text-2)",
                    fontWeight: mode === m ? 500 : 400,
                  }}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          )}
          {ModeComponent ? <ModeComponent url={data.url} /> : <EmptyState />}
        </div>
      )
    }
    return <EmptyState />
  }

  return <EmptyState />
}


