const { useMemo, useState, useEffect, useCallback } = window.React
const { useSnapshot } = window.Valtio
const { BlockShell, BlockChildren, Button, Tooltip } = orca.components

import { registerAdapter, findAdapter, getAvailableModes, type DisplayMode } from "./adapters/registry"
import { twitterAdapter } from "./adapters/twitter"
import { iframeAdapter } from "./adapters/iframe"
import { EmbedPreview } from "./EmbedPreview"
import { EmbedEditor } from "./EmbedEditor"

registerAdapter(twitterAdapter)
registerAdapter(iframeAdapter)

type Mode = "url" | "html"
type EmbedData = { mode: Mode; url?: string; html?: string }
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

const MODE_LABELS: Record<DisplayMode, string> = {
  widget: "Widget",
  embed: "Embed",
  card: "Card",
  link: "Link",
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

  const handleModeSwitch = useCallback(async () => {
    const newMode: Mode = localData.mode === "url" ? "html" : "url"
    const newData: EmbedData = {
      mode: newMode,
      url: newMode === "url" ? localData.url : undefined,
      html: newMode === "html" ? localData.html : undefined,
    }
    setLocalData(newData)
    setEditing(true)
    // Reset display mode when switching between URL/HTML
    setDisplayMode(undefined)
  }, [localData])

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
          <div className="lets-embed-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "var(--orca-color-bg-2)", borderBottom: "1px solid var(--orca-color-border-2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", opacity: 0.5, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {localData.mode === "url" ? "URL" : "HTML"}
              </span>
              {/* Display mode selector - only show for URL mode with available modes */}
              {localData.mode === "url" && availableModes.length > 1 && (
                <div style={{ display: "flex", gap: "2px", background: "var(--orca-color-bg-1)", borderRadius: "4px", padding: "2px" }}>
                  {availableModes.map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleDisplayModeChange(mode)}
                      style={{
                        padding: "2px 6px",
                        fontSize: "10px",
                        border: "none",
                        borderRadius: "3px",
                        cursor: "pointer",
                        background: displayMode === mode ? "var(--orca-color-primary)" : "transparent",
                        color: displayMode === mode ? "white" : "var(--orca-color-text-2)",
                        fontWeight: displayMode === mode ? 500 : 400,
                      }}
                    >
                      {MODE_LABELS[mode]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "2px" }}>
              <Tooltip text="切换模式">
                <Button variant="plain" onClick={handleModeSwitch} style={{ fontSize: "13px", padding: "2px 4px", height: "auto", minHeight: 0 }}>
                  <i className="ti ti-switch-horizontal" />
                </Button>
              </Tooltip>
              <Tooltip text={editing ? "预览" : "编辑"}>
                <Button variant="plain" onClick={() => setEditing(!editing)} style={{ fontSize: "13px", padding: "2px 4px", height: "auto", minHeight: 0 }}>
                  <i className={editing ? "ti ti-eye" : "ti ti-pencil"} />
                </Button>
              </Tooltip>
            </div>
          </div>
          {editing ? (
            <EmbedEditor data={localData} onSave={handleSave} onCancel={() => setEditing(false)} />
          ) : (
            <EmbedPreview data={localData} displayMode={displayMode} />
          )}
        </div>
      }
      childrenJsx={childrenBlocks}
    />
  )
}
