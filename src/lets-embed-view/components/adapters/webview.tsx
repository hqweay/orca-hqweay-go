import React, { useRef, useEffect } from "react"

// Widget mode: webview embed
function WebviewWidget({ url }: { url: string }) {
  const webviewRef = useRef<any>(null)

  useEffect(() => {
    if (webviewRef.current && url) {
      webviewRef.current.loadURL(url)
    }
  }, [url])

  return (
    <webview
      ref={webviewRef}
      src={url}
      style={{ border: "none", width: "100%", height: "500px", maxHeight: "600px" }}
      partition="persist:embed"
      allowpopups
    />
  )
}

export const webviewAdapter = {
  name: "webview",
  match: () => true,  // Fallback adapter - matches everything
  modes: {
    widget: WebviewWidget,
  },
  defaultMode: "widget" as const,
}
