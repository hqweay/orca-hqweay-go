import { useMemo } from "react";
import { useSnapshot } from "valtio";
import { t } from "@/libs/l10n";
import React from "react";

const { BlockShell, BlockChildren } = orca.components;

interface EmbedData {
  mode: "url" | "html";
  url?: string;
  html?: string;
}

export const EmbedViewRenderer = (props: any) => {
  const {
    panelId,
    blockId,
    rndId,
    blockLevel,
    indentLevel,
    mirrorId,
    initiallyCollapsed,
    renderingMode,
  } = props;
  const { blocks } = useSnapshot(orca.state);
  const block = blocks[mirrorId ?? blockId];

  const embedData: EmbedData = (block as any)?._repr || { mode: "html", html: "" };
  const [isEditing, setIsEditing] = React.useState(true);
  const [inputValue, setInputValue] = React.useState("");

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

  const saveEmbedData = (data: EmbedData) => {
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
    const newData: EmbedData = { mode: "url", url, html: undefined };
    saveEmbedData(newData);
    setIsEditing(false);
  };

  const handleHtmlSubmit = (html: string) => {
    const newData: EmbedData = { mode: "html", html, url: undefined };
    saveEmbedData(newData);
    setIsEditing(false);
  };

  const handleSwitchMode = () => {
    const newMode = embedData.mode === "url" ? "html" : "url";
    const newData: EmbedData = {
      mode: newMode,
      url: newMode === "url" ? embedData.url : undefined,
      html: newMode === "html" ? embedData.html : "",
    };
    setIsEditing(true);
    setInputValue(newMode === "url" ? embedData.url || "" : embedData.html || "");
    saveEmbedData(newData);
  };

  const renderPreview = () => {
    if (embedData.mode === "url" && embedData.url) {
      const isTwitter = /twitter\.com|x\.com/.test(embedData.url);
      if (isTwitter) {
        return (
          <iframe
            src={`https://platform.twitter.com/embed/Tweet.html?url=${encodeURIComponent(embedData.url)}`}
            style={{ border: "none", width: "100%", minHeight: "400px" }}
            title="Twitter Embed"
          />
        );
      }
      return (
        <iframe
          src={embedData.url}
          style={{ border: "none", width: "100%", height: "500px", borderRadius: "4px" }}
          title="Web Embed"
          sandbox="allow-scripts allow-same-origin"
        />
      );
    }
    if (embedData.mode === "html" && embedData.html) {
      return (
        <div
          dangerouslySetInnerHTML={{ __html: embedData.html }}
          style={{ padding: "8px" }}
        />
      );
    }
    return null;
  };

  const renderEditor = () => {
    if (embedData.mode === "url") {
      return (
        <div style={{ padding: "8px" }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleUrlSubmit(); if (e.key === "Escape") setIsEditing(false); }}
            placeholder={t("embed-view.input-url")}
            autoFocus
            style={{ width: "100%", padding: "8px", border: "1px solid var(--orca-color-border-2)", borderRadius: "4px", fontSize: "13px", outline: "none" }}
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "8px", justifyContent: "flex-end" }}>
            <button onClick={() => setIsEditing(false)} style={{ padding: "4px 12px", border: "none", borderRadius: "4px", cursor: "pointer", background: "var(--orca-color-bg-2)" }}>{t("common.cancel")}</button>
            <button onClick={handleUrlSubmit} style={{ padding: "4px 12px", border: "none", borderRadius: "4px", cursor: "pointer", background: "var(--orca-brand-primary)", color: "white" }}>{t("common.confirm")}</button>
          </div>
        </div>
      );
    }
    return (
      <div style={{ padding: "8px" }}>
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={t("embed-view.input-html")}
          autoFocus
          style={{ width: "100%", minHeight: "200px", padding: "8px", border: "1px solid var(--orca-color-border-2)", borderRadius: "4px", fontSize: "13px", fontFamily: "monospace", outline: "none", resize: "vertical" }}
        />
        <div style={{ display: "flex", gap: "8px", marginTop: "8px", justifyContent: "space-between" }}>
          <button onClick={handleSwitchMode} style={{ padding: "4px 12px", border: "1px solid var(--orca-color-border-2)", borderRadius: "4px", cursor: "pointer", background: "transparent" }}>{t("embed-view.switch-mode")}</button>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setIsEditing(false)} style={{ padding: "4px 12px", border: "none", borderRadius: "4px", cursor: "pointer", background: "var(--orca-color-bg-2)" }}>{t("common.cancel")}</button>
            <button onClick={() => handleHtmlSubmit(inputValue)} style={{ padding: "4px 12px", border: "none", borderRadius: "4px", cursor: "pointer", background: "var(--orca-brand-primary)", color: "white" }}>{t("common.confirm")}</button>
          </div>
        </div>
      </div>
    );
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
      contentAttrs={{ contentEditable: false }}
      contentJsx={
        <div style={{ border: "1px solid var(--orca-color-border-2)", borderRadius: "4px", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", background: "var(--orca-color-bg-2)", fontSize: "12px", borderBottom: "1px solid var(--orca-color-border-2)" }}>
            <span style={{ opacity: 0.6 }}>{embedData.mode === "url" ? t("embed-view.mode-url") : t("embed-view.mode-html")}</span>
            <div style={{ display: "flex", gap: "4px" }}>
              <button onClick={handleSwitchMode} style={{ padding: "2px 6px", border: "none", borderRadius: "3px", cursor: "pointer", background: "transparent", fontSize: "11px" }} title={t("embed-view.switch-mode")}><i className="ti ti-switch-horizontal" /></button>
              <button onClick={() => setIsEditing(!isEditing)} style={{ padding: "2px 6px", border: "none", borderRadius: "3px", cursor: "pointer", background: isEditing ? "var(--orca-brand-primary)" : "transparent", color: isEditing ? "white" : "inherit", fontSize: "11px" }} title={isEditing ? t("embed-view.preview") : t("embed-view.edit")}><i className={isEditing ? "ti ti-eye" : "ti ti-pencil"} /></button>
            </div>
          </div>
          {isEditing ? renderEditor() : renderPreview()}
        </div>
      }
      childrenJsx={childrenBlocks}
    />
  );
};
