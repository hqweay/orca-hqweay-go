const { useMemo } = window.React;
const { useSnapshot } = window.Valtio;
const { BlockShell, BlockChildren } = orca.components;
const { useState } = window.React;

type EmbedData = {
  mode: "url" | "html";
  url?: string;
  html?: string;
};

type Props = {
  panelId: string;
  blockId: number;
  rndId: string;
  blockLevel: number;
  indentLevel: number;
  mirrorId?: number;
  initiallyCollapsed?: boolean;
  renderingMode?: "normal" | "simple" | "simple-children";
};

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
  const { blocks } = useSnapshot(orca.state);
  const block = blocks[mirrorId ?? blockId];
  const embedData: EmbedData = (block as any)?._repr || {
    mode: "html",
    html: "",
  };

  const [isEditing, setIsEditing] = useState(true);
  const [inputValue, setInputValue] = useState("");

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
  );

  const save = (data: EmbedData) => {
    orca.commands.invokeEditorCommand(
      "core.editor.setProperties",
      null,
      [blockId],
      [{ name: "_repr", type: 0, value: { type: "lets.embed-view", ...data } }],
    );
  };

  const handleUrlSubmit = () => {
    const url = inputValue.trim();
    if (!url) return;
    save({ mode: "url", url, html: undefined });
    setIsEditing(false);
  };

  const handleHtmlSubmit = (html: string) => {
    save({ mode: "html", html, url: undefined });
    setIsEditing(false);
  };

  const handleSwitchMode = () => {
    const newMode = embedData.mode === "url" ? "html" : "url";
    setIsEditing(true);
    setInputValue(
      newMode === "url" ? embedData.url || "" : embedData.html || "",
    );
    save({
      mode: newMode,
      url: newMode === "url" ? embedData.url : undefined,
      html: newMode === "html" ? embedData.html : "",
    });
  };

  if (!block) return null;

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
      selfFoldable={true}
      contentJsx={
        <div
          style={{
            border: "1px solid var(--orca-color-border-2)",
            borderRadius: "4px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "4px 8px",
              background: "var(--orca-color-bg-2)",
              fontSize: "12px",
              borderBottom: "1px solid var(--orca-color-border-2)",
            }}
          >
            <span style={{ opacity: 0.6 }}>
              {embedData.mode === "url" ? "URL 模式" : "HTML 模式"}
            </span>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                onClick={handleSwitchMode}
                style={{
                  padding: "2px 6px",
                  border: "none",
                  borderRadius: "3px",
                  cursor: "pointer",
                  background: "transparent",
                  fontSize: "11px",
                }}
                title="切换模式"
              >
                <i className="ti ti-switch-horizontal" />
              </button>
              <button
                onClick={() => setIsEditing(!isEditing)}
                style={{
                  padding: "2px 6px",
                  border: "none",
                  borderRadius: "3px",
                  cursor: "pointer",
                  background: isEditing
                    ? "var(--orca-brand-primary)"
                    : "transparent",
                  color: isEditing ? "white" : "inherit",
                  fontSize: "11px",
                }}
                title={isEditing ? "预览" : "编辑"}
              >
                <i className={isEditing ? "ti ti-eye" : "ti ti-pencil"} />
              </button>
            </div>
          </div>
          {isEditing ? (
            embedData.mode === "url" ? (
              <div style={{ padding: "8px" }}>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUrlSubmit();
                    if (e.key === "Escape") setIsEditing(false);
                  }}
                  placeholder="输入 URL..."
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid var(--orca-color-border-2)",
                    borderRadius: "4px",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "8px",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={() => setIsEditing(false)}
                    style={{
                      padding: "4px 12px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      background: "var(--orca-color-bg-2)",
                    }}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleUrlSubmit}
                    style={{
                      padding: "4px 12px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      background: "var(--orca-brand-primary)",
                      color: "white",
                    }}
                  >
                    确认
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "8px" }}>
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="输入 HTML..."
                  autoFocus
                  style={{
                    width: "100%",
                    minHeight: "200px",
                    padding: "8px",
                    border: "1px solid var(--orca-color-border-2)",
                    borderRadius: "4px",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "8px",
                    justifyContent: "space-between",
                  }}
                >
                  <button
                    onClick={handleSwitchMode}
                    style={{
                      padding: "4px 12px",
                      border: "1px solid var(--orca-color-border-2)",
                      borderRadius: "4px",
                      cursor: "pointer",
                      background: "transparent",
                    }}
                  >
                    切换模式
                  </button>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => setIsEditing(false)}
                      style={{
                        padding: "4px 12px",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        background: "var(--orca-color-bg-2)",
                      }}
                    >
                      取消
                    </button>
                    <button
                      onClick={() => handleHtmlSubmit(inputValue)}
                      style={{
                        padding: "4px 12px",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        background: "var(--orca-brand-primary)",
                        color: "white",
                      }}
                    >
                      确认
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : embedData.mode === "url" && embedData.url ? (
            /twitter\.com|x\.com/.test(embedData.url) ? (
              <iframe
                src={`https://platform.twitter.com/embed/Tweet.html?url=${encodeURIComponent(embedData.url)}`}
                style={{ border: "none", width: "100%", minHeight: "400px" }}
                title="Twitter Embed"
              />
            ) : (
              <iframe
                src={embedData.url}
                style={{
                  border: "none",
                  width: "100%",
                  height: "500px",
                  borderRadius: "4px",
                }}
                title="Web Embed"
                sandbox="allow-scripts allow-same-origin"
              />
            )
          ) : embedData.mode === "html" && embedData.html ? (
            <div
              dangerouslySetInnerHTML={{ __html: embedData.html }}
              style={{ padding: "8px" }}
            />
          ) : null}
        </div>
      }
      childrenJsx={childrenBlocks}
    />
  );
};
