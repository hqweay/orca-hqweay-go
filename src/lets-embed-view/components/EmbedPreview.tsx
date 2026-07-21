const { useState, useEffect, useMemo } = window.React
import { findAdapter, getAdapters, type EmbedAdapter } from "./adapters/registry"

type EmbedData = { mode: "url"; url?: string } | { mode: "html"; html?: string }

const HtmlPreview = ({ html }: { html: string }) => (
  <div dangerouslySetInnerHTML={{ __html: html }} style={{ padding: "12px" }} />
)

const EmptyState = () => (
  <div style={{ padding: "24px", textAlign: "center", opacity: 0.3, fontSize: "13px" }}>暂无内容</div>
)

export const EmbedPreview = ({
  data,
  adapter,
  onAdapterChange,
}: {
  data: EmbedData
  adapter?: string
  onAdapterChange?: (name: string) => void
}) => {
  if (data.mode === "html" && data.html) {
    return <HtmlPreview html={data.html} />
  }

  if (data.mode === "url" && data.url) {
    const matched = findAdapter(data.url)
    const all = getAdapters().filter((a) => a.match(data.url))
    const active = all.find((a) => a.name === adapter) || matched

    if (active) {
      return <active.Preview url={data.url} />
    }

    return <EmptyState />
  }

  return <EmptyState />
}
