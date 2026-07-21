import React from "react"
import { ResizableBox } from "../ResizableBox"

function WebviewWidget({ url, height, onHeightChange }: { url: string; height?: number; onHeightChange?: (h: number) => void }) {
  return (
    <ResizableBox defaultHeight={500} height={height} onHeightChange={onHeightChange}>
      <webview
        src={url}
        style={{ border: "none", width: "100%", height: "100%" }}
        partition="persist:embed"
        allowpopups
      />
    </ResizableBox>
  )
}

export const webviewAdapter = {
  name: "webview",
  match: () => true,
  modes: {
    widget: WebviewWidget,
  },
  defaultMode: "widget" as const,
}
