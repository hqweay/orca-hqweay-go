import React, { useState, useEffect, useRef } from "react"

import type { EmbedData } from "../types"
import { detectMode } from "../logic"
import { t } from "@/libs/l10n"

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
  const [error, setError] = useState<string | null>(null)
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
      try {
        new URL(trimmed)
      } catch {
        setError(t("embed-view.invalid-url"))
        return
      }
      setError(null)
      onSave({ mode: "url", url: trimmed })
    } else {
      setError(null)
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
        placeholder={t("embed-view.placeholder-input")}
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
      {error && (
        <div style={{ color: "var(--orca-color-error)", fontSize: "12px", marginTop: "4px" }}>{error}</div>
      )}
      <style>{`.lets-embed-btn-cancel:hover { background: var(--orca-color-bg-3); }.lets-embed-btn-confirm:hover { background: var(--orca-color-primary-6); }`}</style>
      <div style={{ display: "flex", gap: "6px", marginTop: "8px", justifyContent: "space-between" }}>
        <span style={{ fontSize: "11px", opacity: 0.4, alignSelf: "center" }}>
          {t("embed-view.confirm-shortcut")}
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            className="lets-embed-btn-cancel"
            onClick={onCancel}
            style={{
              padding: "0 10px",
              fontSize: "12px",
              border: "1px solid var(--orca-color-border-1)",
              borderRadius: "4px",
              cursor: "pointer",
              lineHeight: "26px",
              background: "transparent",
              color: "var(--orca-color-text-1)",
            }}
          >
            {t("embed-view.cancel")}
          </button>
          <button
            className="lets-embed-btn-confirm"
            onClick={handleSubmit}
            style={{
              padding: "0 10px",
              fontSize: "12px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              lineHeight: "26px",
              background: "var(--orca-color-primary-5)",
              color: "#fff",
            }}
          >
            {t("embed-view.confirm")}
          </button>
        </div>
      </div>
    </div>
  )
}
