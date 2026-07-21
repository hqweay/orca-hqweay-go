import React, { useState } from "react"
import { ResizableBox } from "../ResizableBox"
import { t } from "@/libs/l10n"

function IframeWidget({ url }: { url: string }) {
  const [error, setError] = useState(false)

  const handleError = () => setError(true)

  if (error) {
    return (
      <div style={{ padding: "12px", textAlign: "center", opacity: 0.4, fontSize: "13px" }}>
        {t("embed-view.iframe-not-allowed")}
      </div>
    )
  }

  return (
    <ResizableBox>
      <iframe
        src={url}
        style={{
          border: "none",
          width: "100%",
          height: "100%",
          display: "block",
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        onError={handleError}
        title="Embedded Content"
      />
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
