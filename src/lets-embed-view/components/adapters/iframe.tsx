const { useRef, useEffect } = window.React

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

// Link mode: Simple URL link
function WebviewLink({ url }: { url: string }) {
  return (
    <div style={{ padding: "12px" }}>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--orca-color-primary)", textDecoration: "none" }}>
        {url}
      </a>
    </div>
  )
}

export const iframeAdapter = {
  name: "iframe",
  match: () => true,  // Fallback adapter - matches everything
  modes: {
    widget: WebviewWidget,
    link: WebviewLink,
  },
  defaultMode: "widget" as const,
}
