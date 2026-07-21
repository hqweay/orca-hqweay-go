import { findAdapter, type DisplayMode } from "./adapters/registry"
import type { EmbedData } from "../types"

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

      return ModeComponent ? <ModeComponent url={data.url} /> : <EmptyState />
    }
    return <EmptyState />
  }

  return <EmptyState />
}


