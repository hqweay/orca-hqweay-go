import React from "react"

// Widget mode: webview embed
function WebviewWidget({ url }: { url: string }) {
  return (
    <webview
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
