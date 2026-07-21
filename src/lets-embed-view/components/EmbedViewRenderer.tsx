const { useMemo, useState, useEffect, useCallback } = window.React
const { useSnapshot } = window.Valtio
const { BlockShell, BlockChildren, Button, Tooltip } = orca.components

import { registerAdapter } from "./adapters/registry"
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

  useEffect(() => {
    if (repr.mode) {
      setLocalData({ mode: repr.mode, url: repr.url, html: repr.html })
    }
  }, [repr.mode, repr.url, repr.html])

  const save = useCallback(async (data: EmbedData) => {
    await orca.commands.invokeEditorCommand(
      "core.editor.setProperties",
      null,
      [blockId],
      [{ name: "_repr", type: 0, value: { type: "lets.embed-view", ...data } }],
    )
    setLocalData(data)
  }, [blockId])

  const handleSave = useCallback(async (data: EmbedData) => {
    await save(data)
    setEditing(false)
  }, [save])

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
            <span style={{ fontSize: "11px", opacity: 0.5, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {localData.mode === "url" ? "URL" : "HTML"}
            </span>
            <div style={{ display: "flex", gap: "2px" }}>
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
            <EmbedPreview data={localData} />
          )}
        </div>
      }
      childrenJsx={childrenBlocks}
    />
  )
}
