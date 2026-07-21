import React, { useState, useEffect } from "react"
import { findAdapter, type DisplayMode } from "./adapters/registry"
import type { EmbedData } from "../types"
import { ResizableBox } from "./ResizableBox"

const HtmlPreview = ({ html }: { html: string }) => {
  const [src, setSrc] = useState("")

  useEffect(() => {
    const processed = html.replace(/(src=["']?)\/\//g, "$1https://")
    const wrapped = `<!DOCTYPE html><html><body style="margin:0;padding:0">${processed}</body></html>`
    const blob = new Blob([wrapped], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [html])

  if (!src) return null

  return (
    <ResizableBox defaultHeight={500}>
      <webview
        src={src}
        style={{ border: "none", width: "100%", height: "100%" }}
      />
    </ResizableBox>
  )
}

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


