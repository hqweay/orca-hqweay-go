import React, { useState } from "react"
import { ResizableBox } from "../ResizableBox"
import type { DisplayMode } from "./registry"
import { t } from "@/libs/l10n"

function IframeWidget({
  url,
  height,
  onHeightChange,
  onSwitchMode,
}: {
  url: string
  height?: number
  onHeightChange?: (h: number) => void
  onSwitchMode?: (mode: DisplayMode) => void
}) {
  const [error, setError] = useState(false)

  const handleError = () => setError(true)

  return (
    <ResizableBox height={height} onHeightChange={onHeightChange}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <iframe
          src={url}
          style={{ border: "none", width: "100%", flex: 1, display: "block" }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onError={handleError}
          title="Embedded Content"
        />
        {error && (
          <div
            style={{
              padding: "6px 10px",
              textAlign: "center",
              fontSize: "12px",
              borderTop: "1px solid var(--orca-color-border-2)",
              background: "var(--orca-color-bg-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span style={{ opacity: 0.45 }}>{t("embed-view.iframe-not-allowed")}</span>
            {onSwitchMode && (
              <button
                style={{
                  background: "var(--orca-color-primary-5)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "3px",
                  padding: "2px 8px",
                  fontSize: "12px",
                  cursor: "pointer",
                  lineHeight: "20px",
                }}
                onClick={() => onSwitchMode("webview")}
              >
                {t("embed-view.switch-to-webview")}
              </button>
            )}
          </div>
        )}
      </div>
    </ResizableBox>
  )
}

export const iframeAdapter = {
  name: "iframe",
  match: () => true,
  modes: {
    iframe: IframeWidget,
  },
  defaultMode: "iframe" as const,
}
