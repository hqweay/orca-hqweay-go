import React, { useMemo, useState, useEffect, useCallback } from "react"
const { useSnapshot } = window.Valtio
const { BlockShell, BlockChildren, Button, Tooltip } = orca.components

import { findAdapter, getAvailableModes, type DisplayMode } from "./adapters/registry"
import { EmbedPreview } from "./EmbedPreview"
import { EmbedEditor } from "./EmbedEditor"
import type { EmbedData } from "../types"

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
  const { blocks } = useSnapshot(orca.state)
  const block = blocks[mirrorId ?? blockId]
  const repr = (block as any)?._repr || {}

  const [editing, setEditing] = useState(!repr.mode)
  const [localData, setLocalData] = useState<EmbedData>({ mode: repr.mode || "html", url: repr.url, html: repr.html })
  const [displayMode, setDisplayMode] = useState<DisplayMode | undefined>(repr.displayMode)

  useEffect(() => {
    if (repr.mode) {
      setLocalData({ mode: repr.mode, url: repr.url, html: repr.html })
    }
    if (repr.displayMode) {
      setDisplayMode(repr.displayMode)
    }
  }, [repr.mode, repr.url, repr.html, repr.displayMode])

  // Get available modes for current URL
  const adapter = localData.mode === "url" && localData.url ? findAdapter(localData.url) : null
  const availableModes = adapter ? getAvailableModes(adapter) : []

  // Auto-select default mode if not set
  useEffect(() => {
    if (adapter && !displayMode) {
      setDisplayMode(adapter.defaultMode)
    }
  }, [adapter, displayMode])

  const save = useCallback(async (data: EmbedData, mode?: DisplayMode) => {
    const value: any = { type: "lets.embed-view", ...data }
    if (mode || displayMode) {
      value.displayMode = mode || displayMode
    }
    await orca.commands.invokeEditorCommand(
      "core.editor.setProperties",
      null,
      [blockId],
      [{ name: "_repr", type: 0, value }],
    )
    setLocalData(data)
    if (mode) setDisplayMode(mode)
  }, [blockId, displayMode])

  const handleSave = useCallback(async (data: EmbedData) => {
    await save(data)
    setEditing(false)
  }, [save])

  const handleDisplayModeChange = useCallback(async (mode: DisplayMode) => {
    setDisplayMode(mode)
    await save(localData, mode)
  }, [localData, save])

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
              <span style={{ fontSize: "11px", opacity: 0.5, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {contentLabel}
              </span>
              <div style={{ display: "flex", gap: "2px" }}>
                {localData.mode === "url" && localData.url && (
                  <Tooltip text="在浏览器中打开">
                    <Button variant="plain" onClick={() => window.open(localData.url, "_blank")} style={{ fontSize: "13px", padding: "2px 4px", height: "auto", minHeight: 0 }}>
                      <i className="ti ti-external-link" />
                    </Button>
                  </Tooltip>
                )}
                <Tooltip text="编辑">
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
            <EmbedPreview data={localData} displayMode={displayMode} onDisplayModeChange={handleDisplayModeChange} />
          )}
        </div>
      }
      childrenJsx={childrenBlocks}
    />
  )
}
