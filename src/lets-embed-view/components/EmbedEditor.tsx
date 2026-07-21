const { useState, useEffect } = window.React
const { Button } = orca.components

type EmbedData = { mode: "url"; url?: string } | { mode: "html"; html?: string }

export const EmbedEditor = ({
  data,
  onSave,
  onCancel,
}: {
  data: EmbedData
  onSave: (d: EmbedData) => void
  onCancel: () => void
}) => {
  const [value, setValue] = useState(data.mode === "url" ? data.url || "" : data.html || "")

  useEffect(() => {
    setValue(data.mode === "url" ? data.url || "" : data.html || "")
  }, [data.mode])

  const handleSubmit = () => {
    if (data.mode === "url") {
      onSave({ mode: "url", url: value.trim() } as EmbedData)
    } else {
      onSave({ mode: "html", html: value } as EmbedData)
    }
  }

  const sharedInputStyle = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid var(--orca-color-border-2)",
    borderRadius: "6px",
    fontSize: "13px",
    outline: "none",
    background: "var(--orca-color-bg-1)",
    color: "var(--orca-color-text-1)",
    boxSizing: "border-box" as const,
  }

  if (data.mode === "url") {
    return (
      <div style={{ padding: "12px" }}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onCancel() }}
          placeholder="输入 URL..."
          autoFocus
          className="orca-input"
          style={sharedInputStyle}
        />
        <div style={{ display: "flex", gap: "6px", marginTop: "8px", justifyContent: "flex-end" }}>
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button variant="solid" onClick={handleSubmit}>确认</Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: "12px" }}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="输入 HTML..."
        autoFocus
        className="orca-input"
        style={{ ...sharedInputStyle, minHeight: "160px", fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace", resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: "6px", marginTop: "8px", justifyContent: "flex-end" }}>
        <Button variant="outline" onClick={onCancel}>取消</Button>
        <Button variant="solid" onClick={handleSubmit}>确认</Button>
      </div>
    </div>
  )
}
