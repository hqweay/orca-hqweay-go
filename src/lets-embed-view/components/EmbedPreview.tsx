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
  const injectedRef = useRef(false)
  const [src, setSrc] = useState("")
  const [contentHeight, setContentHeight] = useState<number | undefined>()
  const hasScripts = /<\s*script[\s>]/i.test(html)

  useEffect(() => {
    const processed = html.replace(/(src=["']?)\/\//g, "$1https://")
    const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0">${processed}</body></html>`
    const blob = new Blob([wrapped], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    setSrc(url)
    setContentHeight(undefined)
    return () => URL.revokeObjectURL(url)
  }, [html])

  useEffect(() => {
    if (!hasScripts) return
    const wv = webviewRef.current
    if (!wv) return
    let timer: NodeJS.Timeout | null = null
    injectedRef.current = false

    const KEY_SCRIPT = `
document.addEventListener('keydown', function(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
    e.preventDefault()
    console.log('ORCA_RELOAD')
  }
})`

    const measureHeight = () => {
      wv.executeJavaScript("Math.max(document.body.scrollHeight || 0, document.documentElement.scrollHeight || 0)")
        .then((h: number) => {
          if (h > 0) setContentHeight(h)
        })
        .catch(() => {})
    }

    const onDomReady = () => {
      if (injectedRef.current) return
      injectedRef.current = true
      wv.executeJavaScript(KEY_SCRIPT).catch(() => {})
      measureHeight()
      timer = setTimeout(measureHeight, 300)
    }

    const onConsole = (e: any) => {
      if (e.message === "ORCA_RELOAD") window.location.reload()
    }

    wv.addEventListener("dom-ready", onDomReady)
    wv.addEventListener("console-message", onConsole)
    return () => {
      if (timer) clearTimeout(timer)
      try { wv.removeEventListener("dom-ready", onDomReady) } catch {}
      try { wv.removeEventListener("console-message", onConsole) } catch {}
    }
  }, [src, hasScripts])

  if (!src) return null

  const effectiveHeight = height ?? contentHeight

  return (
    <ResizableBox defaultHeight={500} height={effectiveHeight} onHeightChange={onHeightChange}>
      {hasScripts ? (
        <webview
          ref={webviewRef}
          src={src}
          style={{ border: "none", width: "100%", height: "100%" }}
        />
      ) : (
        <iframe
          src={src}
          style={{ border: "none", width: "100%", height: "100%" }}
        />
      )}
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
  onSwitchMode,
}: {
  data: EmbedData
  displayMode?: DisplayMode
  height?: number
  onHeightChange?: (h: number) => void
  onSwitchMode?: (mode: DisplayMode) => void
}) => {
  if (data.mode === "html" && data.html) {
    return <HtmlPreview html={data.html} height={height} onHeightChange={onHeightChange} />
  }

  if (data.mode === "url" && data.url) {
    const adapter = findAdapter(data.url)
    if (adapter) {
      const mode = displayMode || adapter.defaultMode
      const ModeComponent = adapter.modes[mode]

      return ModeComponent ? <ModeComponent url={data.url} height={height} onHeightChange={onHeightChange} onSwitchMode={onSwitchMode} /> : <EmptyState />
    }
    return <EmptyState />
  }

  return <EmptyState />
}
