import React, { useState } from "react"

function IframeWidget({ url }: { url: string }) {
  const [error, setError] = useState(false)

  const handleError = () => setError(true)

  if (error) {
    return (
      <div style={{ padding: "12px", textAlign: "center", opacity: 0.4, fontSize: "13px" }}>
        该网站不允许 iframe 嵌入
      </div>
    )
  }

  return (
    <iframe
      src={url}
      style={{
        border: "none",
        width: "100%",
        height: "400px",
        minHeight: "200px",
        display: "block",
      }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      onError={handleError}
      title="Embedded Content"
    />
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
