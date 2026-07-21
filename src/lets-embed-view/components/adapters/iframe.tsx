function IFramePreview({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      style={{ border: "none", width: "100%", height: "500px", maxHeight: "600px" }}
      title="Web Embed"
      sandbox="allow-scripts allow-same-origin"
    />
  )
}

export const iframeAdapter = {
  name: "iframe",
  match: () => true,
  Preview: IFramePreview,
}
