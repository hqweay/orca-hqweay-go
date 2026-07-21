const { useState, useEffect, useMemo } = window.React
import { findAdapter, getAdapters, getAvailableModes, type EmbedAdapter, type DisplayMode } from "./adapters/registry"

type EmbedData = { mode: "url"; url?: string } | { mode: "html"; html?: string }

const HtmlPreview = ({ html }: { html: string }) => (
  <div dangerouslySetInnerHTML={{ __html: html }} style={{ padding: "12px" }} />
)

const EmptyState = () => (
  <div style={{ padding: "24px", textAlign: "center", opacity: 0.3, fontSize: "13px" }}>暂无内容</div>
)

export const EmbedPreview = ({
  data,
  displayMode,
}: {
  data: EmbedData
  displayMode?: DisplayMode
}) => {
  if (data.mode === "html" && data.html) {
    return <HtmlPreview html={data.html} />
  }

  if (data.mode === "url" && data.url) {
    const adapter = findAdapter(data.url)
    if (adapter) {
      const mode = displayMode || adapter.defaultMode
      const ModeComponent = adapter.modes[mode]
      if (ModeComponent) {
        return <ModeComponent url={data.url} />
      }
    }
    return <EmptyState />
  }

  return <EmptyState />
}

export { findAdapter, getAvailableModes }
export type { DisplayMode }
