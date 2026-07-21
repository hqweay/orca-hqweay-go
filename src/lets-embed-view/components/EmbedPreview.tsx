import React, { useState, useEffect, useRef } from "react"
import { findAdapter, type DisplayMode } from "./adapters/registry"
import type { EmbedData } from "../types"
import { ResizableBox } from "./ResizableBox"
import { t } from "@/libs/l10n"

const HtmlPreview = ({
  html,
  height,
  onHeightChange,
}: {
  html: string
  height?: number
  onHeightChange?: (h: number) => void
}) => {
  const webviewRef = useRef<any>(null)
  const [src, setSrc] = useState("")
  const [contentHeight, setContentHeight] = useState<number | undefined>()

  useEffect(() => {
    const processed = html.replace(/(src=["']?)\/\//g, "$1https://")
    const wrapped = `<!DOCTYPE html><html><body style="margin:0;padding:0">${processed}</body></html>`
    const blob = new Blob([wrapped], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    setSrc(url)
    setContentHeight(undefined)
    return () => URL.revokeObjectURL(url)
  }, [html])

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return
    let timer: NodeJS.Timeout | null = null

    const measureHeight = () => {
      wv.executeJavaScript("Math.max(document.body.scrollHeight || 0, document.documentElement.scrollHeight || 0)")
        .then((h: number) => {
          if (h > 0) setContentHeight(h)
        })
        .catch(() => {})
    }

    const handler = () => {
      measureHeight()
      // Delayed check to capture dynamic script/widget renders
      timer = setTimeout(measureHeight, 300)
    }

    wv.addEventListener("dom-ready", handler)
    return () => {
      if (timer) clearTimeout(timer)
      try { wv.removeEventListener("dom-ready", handler) } catch {}
    }
  }, [src])

  if (!src) return null

  const effectiveHeight = height ?? contentHeight

  return (
    <ResizableBox defaultHeight={500} height={effectiveHeight} onHeightChange={onHeightChange}>
      <webview
        ref={webviewRef}
        src={src}
        style={{ border: "none", width: "100%", height: "100%" }}
      />
    </ResizableBox>
  )
}

const EmptyState = () => (
  <div style={{ padding: "24px", textAlign: "center", opacity: 0.3, fontSize: "13px" }}>{t("embed-view.no-content")}</div>
)

export const EmbedPreview = ({
  data,
  displayMode,
  height,
  onHeightChange,
}: {
  data: EmbedData
  displayMode?: DisplayMode
  height?: number
  onHeightChange?: (h: number) => void
}) => {
  if (data.mode === "html" && data.html) {
    return <HtmlPreview html={data.html} height={height} onHeightChange={onHeightChange} />
  }

  if (data.mode === "url" && data.url) {
    const adapter = findAdapter(data.url)
    if (adapter) {
      const mode = displayMode || adapter.defaultMode
      const ModeComponent = adapter.modes[mode]

      return ModeComponent ? <ModeComponent url={data.url} height={height} onHeightChange={onHeightChange} /> : <EmptyState />
    }
    return <EmptyState />
  }

  return <EmptyState />
}


