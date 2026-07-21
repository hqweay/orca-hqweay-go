import React, { useMemo, useState, useEffect, useCallback } from "react"
const { useSnapshot } = window.Valtio
const { BlockShell, BlockChildren, Button, Tooltip } = orca.components

import { findAdapter, getAvailableModes, type DisplayMode } from "./adapters/registry"
import { EmbedPreview } from "./EmbedPreview"
import { EmbedEditor } from "./EmbedEditor"
import type { EmbedData } from "../types"
import { getRepr } from "@/libs/BlockFormatter"
import { t } from "@/libs/l10n"

type Props = {
  panelId: string
  blockId: number
  rndId: string
  blockLevel: number
  indentLevel: number
  mirrorId?: number
  initiallyCollapsed?: boolean
  renderingMode?: "normal" | "simple" | "simple-children"
}

export const EmbedViewRenderer = ({
  panelId,
  blockId,
  rndId,
  blockLevel,
  indentLevel,
  mirrorId,
  initiallyCollapsed,
  renderingMode,
}: Props) => {
  const targetId = mirrorId ?? blockId
  const { blocks } = useSnapshot(orca.state)
  const block = blocks[targetId]
  const repr = block ? getRepr(block) : {}

  const [editing, setEditing] = useState(!(repr.mode && (repr.url || repr.html)))
  const [localData, setLocalData] = useState<EmbedData>({ mode: repr.mode || "html", url: repr.url, html: repr.html })
  const [displayMode, setDisplayMode] = useState<DisplayMode | undefined>(repr.displayMode)
  const [height, setHeight] = useState<number | undefined>(repr.height)

  useEffect(() => {
    if (repr.mode) {
      setLocalData({ mode: repr.mode, url: repr.url, html: repr.html })
    }
    if (repr.displayMode) {
      setDisplayMode(repr.displayMode)
    }
    if (repr.height) {
      setHeight(repr.height)
    }
  }, [repr.mode, repr.url, repr.html, repr.displayMode, repr.height])

  // Get available modes for current URL
  const adapter = localData.mode === "url" && localData.url ? findAdapter(localData.url) : null
  const availableModes = adapter ? getAvailableModes(adapter) : []

  // Auto-select default mode if not set; reset if stored mode is invalid
  useEffect(() => {
    if (!adapter || !availableModes.length) return
    if (!displayMode) {
      setDisplayMode(adapter.defaultMode)
    } else if (!availableModes.includes(displayMode)) {
      setDisplayMode(adapter.defaultMode)
    }
  }, [adapter, displayMode, availableModes])

  const save = useCallback(async (data: EmbedData, mode?: DisplayMode, customHeight?: number) => {
    const value: any = { type: "lets.embed-view", ...data }
    const h = customHeight ?? height ?? repr.height
    if (mode || displayMode) {
      value.displayMode = mode || displayMode
    }
    if (h) {
      value.height = h
    }
    try {
      await orca.commands.invokeEditorCommand(
        "core.editor.setProperties",
        null,
        [targetId],
        [{ name: "_repr", type: 0, value }],
      )
      const b = orca.state.blocks[targetId]
      if (b) {
        (b as any)._repr = value
        if (!b.properties) b.properties = []
        const idx = b.properties.findIndex((p: any) => p.name === "_repr")
        if (idx >= 0) b.properties[idx] = { name: "_repr", value, type: 0 }
        else b.properties.push({ name: "_repr", value, type: 0 })
      }
    } catch (e) {
      console.error("[lets-embed-view] save failed", e)
      return
    }
    setLocalData(data)
    if (mode) setDisplayMode(mode)
    if (customHeight) setHeight(customHeight)
  }, [targetId, displayMode, height, repr.height])

  const handleSave = useCallback(async (data: EmbedData) => {
    await save(data)
    setEditing(false)
  }, [save])

  const handleDisplayModeChange = useCallback(async (mode: DisplayMode) => {
    setDisplayMode(mode)
    await save(localData, mode)
  }, [localData, save])

  const handleHeightChange = useCallback(async (newHeight: number) => {
    setHeight(newHeight)
    await save(localData, displayMode, newHeight)
  }, [localData, displayMode, save])

  const childrenBlocks = useMemo(
    () => (
      <BlockChildren
        blockId={blockId}
        panelId={panelId}
        blockLevel={blockLevel}
        indentLevel={indentLevel}
        renderingMode={renderingMode}
      />
    ),
    [blockId, panelId, blockLevel, indentLevel, renderingMode],
  )

  if (!block) return null

  const contentLabel = localData.mode === "url" ? "URL" : "HTML"

  return (
    <BlockShell
      panelId={panelId}
      blockId={blockId}
      rndId={rndId}
      mirrorId={mirrorId}
      blockLevel={blockLevel}
      indentLevel={indentLevel}
      initiallyCollapsed={initiallyCollapsed}
      renderingMode={renderingMode}
      reprClassName="lets-embed-repr"
      contentClassName="lets-embed-content"
      contentAttrs={{ contentEditable: false }}
      editable={false}
      selfFoldable
      contentJsx={
        <div className="lets-embed-container" style={{ borderRadius: "8px", border: "1px solid var(--orca-color-border-2)", overflow: "hidden", margin: "4px 0" }}>
          {/* Header - only show in preview mode */}
          {!editing && (
            <div className="lets-embed-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "var(--orca-color-bg-2)", borderBottom: "1px solid var(--orca-color-border-2)" }}>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {localData.mode === "url" && adapter?.name === "twitter" ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", opacity: 0.5, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    <i className="ti ti-brand-x" /> Twitter
                  </span>
                ) : (
                  <span style={{ fontSize: "11px", opacity: 0.5, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {contentLabel}
                  </span>
                )}
                {localData.mode === "url" && availableModes.length > 1 && adapter && (
                  <div style={{ display: "flex", gap: "2px", marginLeft: "4px" }}>
                    {availableModes.map((m) => (
                      <button
                        key={m}
                        onClick={() => handleDisplayModeChange(m)}
                        style={{
                          padding: "0 6px",
                          fontSize: "11px",
                          border: "none",
                          borderRadius: "3px",
                          cursor: "pointer",
                          lineHeight: "20px",
                          background: displayMode === m ? "var(--orca-color-primary-5)" : "transparent",
                          color: displayMode === m ? "#fff" : "var(--orca-color-text-1)",
                          fontWeight: displayMode === m ? 500 : 400,
                        }}
                      >
                        {m === "embed" ? "Embed" : m === "card" ? "Card" : m === "iframe" ? "Iframe" : m === "webview" ? "Webview" : m === "widget" ? "Widget" : "Link"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
                {localData.mode === "url" && localData.url && (
                  <Tooltip text={t("embed-view.open-in-browser")}>
                    <Button variant="plain" onClick={() => window.open(localData.url, "_blank")} style={{ fontSize: "13px", padding: "2px 4px", height: "auto", minHeight: 0 }}>
                      <i className="ti ti-external-link" />
                    </Button>
                  </Tooltip>
                )}
                <Tooltip text={t("embed-view.edit")}>
                  <Button variant="plain" onClick={() => setEditing(true)} style={{ fontSize: "13px", padding: "2px 4px", height: "auto", minHeight: 0 }}>
                    <i className="ti ti-pencil" />
                  </Button>
                </Tooltip>
              </div>
            </div>
          )}
          {editing ? (
            <EmbedEditor data={localData} onSave={handleSave} onCancel={() => setEditing(false)} />
          ) : (
            <EmbedPreview data={localData} displayMode={displayMode} height={height} onHeightChange={handleHeightChange} onSwitchMode={handleDisplayModeChange} />
          )}
        </div>
      }
      childrenJsx={childrenBlocks}
    />
  )
}
