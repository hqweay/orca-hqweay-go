const { useState, useEffect, useRef } = window.React
const { Button } = orca.components

type EmbedData = { mode: "url"; url?: string } | { mode: "html"; html?: string }

function detectMode(input: string): "url" | "html" {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed)) return "url"
  return "html"
}

export const EmbedEditor = ({
  data,
  onSave,
  onCancel,
}: {
  data: EmbedData
  onSave: (d: EmbedData) => void
  onCancel: () => void
}) => {
  const initialValue = data.mode === "url" ? data.url || "" : data.html || ""
  const [value, setValue] = useState(initialValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed) return

    const mode = detectMode(trimmed)
    if (mode === "url") {
      onSave({ mode: "url", url: trimmed })
    } else {
      onSave({ mode: "html", html: value })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === "Escape") {
      onCancel()
    }
  }

  return (
    <div style={{ padding: "12px" }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入 URL 或 HTML..."
        className="orca-input"
        style={{
          width: "100%",
          minHeight: "120px",
          padding: "8px 10px",
          border: "1px solid var(--orca-color-border-2)",
          borderRadius: "6px",
          fontSize: "13px",
          fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
          outline: "none",
          resize: "vertical",
          background: "var(--orca-color-bg-1)",
          color: "var(--orca-color-text-1)",
          boxSizing: "border-box" as const,
        }}
      />
      <div style={{ display: "flex", gap: "6px", marginTop: "8px", justifyContent: "space-between" }}>
        <span style={{ fontSize: "11px", opacity: 0.4, alignSelf: "center" }}>
          ⌘+Enter 确认
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button variant="solid" onClick={handleSubmit}>确认</Button>
        </div>
      </div>
    </div>
  )
}
