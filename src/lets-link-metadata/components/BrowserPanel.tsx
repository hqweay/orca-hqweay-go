import React, { useState, useRef, useEffect } from "react";
import { t } from "@/libs/l10n";
import { Rule, MetadataProperty } from "../types";
import { PropType } from "@/libs/consts";
import { matchRule } from "../metadataExtractor";
import { WebviewUtils } from "@/libs/WebviewUtils";
import { HTML_TO_MARKDOWN_SCRIPT, CLEAN_URL_SCRIPT } from "../webviewScripts";
import { defaultGeneric } from "../rules/generic";

interface RendererProps {
  panelId: string;
  blockId: number;
  rndId: string;
}

// Mobile UA for iPhone 15 Pro
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function BrowserPanel(props: RendererProps) {
  const { panelId } = props;

  const viewPanel = orca.nav.findViewPanel(panelId, orca.state.panels);
  const viewArgs = viewPanel?.viewArgs || {};

  const initialUrl = viewArgs.initialUrl || "";
  const rules = (viewArgs.rules as Rule[]) || [];
  const quickLinks =
    (viewArgs.quickLinks as { name: string; url: string }[]) || [];
  const plugin = viewArgs.plugin; // Passing plugin instance to call methods

  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [activeUrl, setActiveUrl] = useState(initialUrl);
  const [currentRule, setCurrentRule] = useState<Rule | null>(null);
  const webviewRef = useRef<any>(null);
  // const [contextMenu, setContextMenu] = useState<{
  //   visible: boolean;
  //   x: number;
  //   y: number;
  //   text: string;
  //   type?: "text" | "image";
  // } | null>(null);

  const [isMobileMode, setIsMobileMode] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const Button = orca.components.Button;
  const Input = orca.components.Input;

  const updateNavigationState = () => {
    if (webviewRef.current) {
      try {
        setCanGoBack(webviewRef.current.canGoBack());
        setCanGoForward(webviewRef.current.canGoForward());
      } catch (e) {
        // Ignore if webview not ready
      }
    }
  };

  useEffect(() => {
    if (webviewRef.current) {
      const targetUA = isMobileMode ? MOBILE_UA : DESKTOP_UA;
      if (webviewRef.current.setUserAgent) {
        try {
          webviewRef.current.setUserAgent(targetUA);
        } catch (e) {
          console.debug("Failed to set UA:", e);
        }
      }
      setTimeout(() => {
        try {
          webviewRef.current.reload();
        } catch (e) {}
      }, 50);
    }
  }, [isMobileMode]);

  useEffect(() => {
    console.log("BrowserPanel useEffect", initialUrl, activeUrl, rules);
    if (initialUrl && initialUrl !== activeUrl) {
      setInputUrl(initialUrl);
      setActiveUrl(initialUrl);
      const rule = matchRule(initialUrl, rules);
      setCurrentRule(rule || null);
    }
  }, [initialUrl]);

  useEffect(() => {
    console.log("BrowserPanel useEffect", initialUrl, activeUrl, rules);
    const webview = webviewRef.current;
    if (!webview) return;

    const handleNavigate = (e: any) => {
      if (e.url) {
        setInputUrl(e.url);
        const rule = matchRule(e.url, rules);
        setCurrentRule(rule || null);
        if (viewArgs.onUrlChange) {
          viewArgs.onUrlChange(e.url);
        }
      }
      updateNavigationState();
    };

    const handleDomReady = () => {
      webview.executeJavaScript(`
        document.body.addEventListener('click', (e) => {
          let target = e.target;
          while (target && target.tagName !== 'A') {
            target = target.parentElement;
          }
          if (target && target.tagName === 'A' && target.target === '_blank') {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = target.href;
          }
        }, true);
      `);
    };

    const handleNewWindow = (e: any) => {
      const url = e.url;
      if (url) {
        setActiveUrl(url);
        setInputUrl(url);
      }
    };

    // const handleContextMenu = (e: any) => {
    //   const params = e.params;
    //   if (params.mediaType === "image" && params.srcURL) {
    //     setContextMenu({
    //       visible: true,
    //       x: params.x,
    //       y: params.y,
    //       text: params.srcURL,
    //       type: "image",
    //     });
    //   } else if (params && params.selectionText) {
    //     setContextMenu({
    //       visible: true,
    //       x: params.x,
    //       y: params.y,
    //       text: params.selectionText,
    //       type: "text",
    //     });
    //   }
    // };

    webview.addEventListener("did-navigate", handleNavigate);
    webview.addEventListener("did-navigate-in-page", handleNavigate);
    webview.addEventListener("dom-ready", handleDomReady);
    webview.addEventListener("new-window", handleNewWindow);
    // webview.addEventListener("context-menu", handleContextMenu);

    return () => {
      webview.removeEventListener("did-navigate", handleNavigate);
      webview.removeEventListener("did-navigate-in-page", handleNavigate);
      webview.removeEventListener("dom-ready", handleDomReady);
      webview.removeEventListener("new-window", handleNewWindow);
      // webview.removeEventListener("context-menu", handleContextMenu);
    };
  }, [activeUrl]);

  const handleGo = () => {
    if (webviewRef.current && inputUrl) {
      try {
        webviewRef.current.loadURL(inputUrl);
      } catch (e) {
        setActiveUrl(inputUrl);
      }
    } else {
      setActiveUrl(inputUrl);
    }
  };

  const handleGoBack = () => {
    if (webviewRef.current && webviewRef.current.canGoBack()) {
      webviewRef.current.goBack();
    }
  };

  const handleGoForward = () => {
    if (webviewRef.current && webviewRef.current.canGoForward()) {
      webviewRef.current.goForward();
    }
  };

  const handleExtract = async () => {
    if (!webviewRef.current) return;
    let ruleToUse = currentRule;
    if (!ruleToUse) {
      const currentWebviewUrl = webviewRef.current.getURL();
      ruleToUse = matchRule(currentWebviewUrl, rules) || null;
    }
    if (!ruleToUse) {
      orca.notify("warn", t("No matching rule for current URL"));
      return;
    }

    try {
      const shimScript = `
        (() => {
          const PropType = ${JSON.stringify(PropType)};
          const url = window.location.href;
          const doc = document;
          const getBaseMeta = () => {
            const title = doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim() || doc.querySelector("title")?.textContent?.trim() || "";
            const thumbnail = doc.querySelector("meta[property='og:image']")?.getAttribute("content") || doc.querySelector("meta[name='og:image']")?.getAttribute("content") || doc.querySelector("link[rel='icon']")?.getAttribute("href") || "";
            const description = doc.querySelector("meta[property='og:description']")?.getAttribute("content") || doc.querySelector("meta[name='description']")?.getAttribute("content") || "";
            return { title, thumbnail, description, url }; 
          };
          const baseMeta = getBaseMeta();
          const userScriptBody = ${JSON.stringify(ruleToUse.script.join("\n"))};
          try {
              const extractorFn = new Function("doc", "url", "PropType", "cleanUrl", "baseMeta", userScriptBody);
              return extractorFn(doc, url, PropType, cleanUrl, baseMeta);
          } catch(err) {
              return { error: err.toString() };
          }
        })()
      `;
      const fullScript = `${CLEAN_URL_SCRIPT}${shimScript}`;
      const properties = await webviewRef.current.executeJavaScript(fullScript);

      if (properties && properties.error) throw new Error(properties.error);
      if (Array.isArray(properties)) {
        if (viewArgs.onExtract) {
          viewArgs.onExtract(properties, ruleToUse);
        }
      } else {
        orca.notify("error", t("Script returned invalid data"));
      }
    } catch (e: any) {
      orca.notify(
        "error",
        t("Failed to extract metadata: ${msg}", { msg: e.message }),
      );
    }
  };

  const handleClip = async () => {
    if (!webviewRef.current) return;
    let ruleToUse = currentRule;
    if (!ruleToUse) {
      const currentWebviewUrl = webviewRef.current.getURL();
      ruleToUse = matchRule(currentWebviewUrl, rules) || null;
    }

    try {
      const shimScript = `
        (() => {
          const PropType = ${JSON.stringify(PropType)};
          const url = window.location.href;
          const doc = document;
          const getBaseMeta = () => {
             const title = doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim() || doc.querySelector("title")?.textContent?.trim() || "";
             const thumbnail = doc.querySelector("meta[property='og:image']")?.getAttribute("content") || doc.querySelector("meta[name='og:image']")?.getAttribute("content") || doc.querySelector("link[rel='icon']")?.getAttribute("href") || "";
             const description = doc.querySelector("meta[property='og:description']")?.getAttribute("content") || doc.querySelector("meta[name='description']")?.getAttribute("content") || "";
             return { title, thumbnail, description, url }; 
          };
          const baseMeta = getBaseMeta();
          const userScriptBody = ${ruleToUse ? JSON.stringify(ruleToUse.script.join("\n")) : "''"};
          const runScript = (body) => {
             if (!body) return [];
             const extractorFn = new Function("doc", "url", "PropType", "cleanUrl", "baseMeta", "htmlToMarkdown", body);
             return extractorFn(doc, url, PropType, cleanUrl, baseMeta, htmlToMarkdown);
          };
          try {
              const metadata = runScript(userScriptBody) || [];
              let content = [];
              const contentScriptBody = ${
                ruleToUse && ruleToUse.contentScript
                  ? JSON.stringify(ruleToUse.contentScript.join("\n"))
                  : JSON.stringify(defaultGeneric.contentScript?.join("\n"))
              };
              if (contentScriptBody) content = runScript(contentScriptBody) || [];
              return (Array.isArray(metadata) && Array.isArray(content)) ? [...metadata, ...content] : metadata;
          } catch(err) {
              return { error: err.toString() };
          }
        })()
      `;
      const fullScript = `${CLEAN_URL_SCRIPT}${HTML_TO_MARKDOWN_SCRIPT}${shimScript}`;
      const properties = await webviewRef.current.executeJavaScript(fullScript);

      if (properties && properties.error) throw new Error(properties.error);
      if (Array.isArray(properties)) {
        const contentProp = properties.find(
          (p: any) => p.name === "正文" || p.name === "Content",
        );
        if (contentProp && contentProp.value) {
          if (viewArgs.onSaveToDailyNote) {
            viewArgs.onSaveToDailyNote(properties, "markdown", ruleToUse);
            orca.notify("success", t("Content clipped to Daily Note"));
          }
        } else {
          orca.notify("warn", t("No content found to clip"));
        }
      }
    } catch (e: any) {
      orca.notify(
        "error",
        t("Failed to clip content: ${msg}", { msg: e.message }),
      );
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        backgroundColor: "var(--orca-color-bg-main)",
        padding: "12px",
        boxSizing: "border-box",
      }}
      // onClick={() => setContextMenu(null)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "8px",
          gap: "8px",
        }}
      >
        <div
          style={{
            fontSize: "1rem",
            fontWeight: "bold",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentRule?.name || "Generic"}
        </div>
        <Button
          variant="plain"
          onClick={() => setIsMobileMode(!isMobileMode)}
          title={isMobileMode ? t("Switch to Desktop") : t("Switch to Mobile")}
        >
          <i
            className={
              isMobileMode ? "ti ti-device-desktop" : "ti ti-device-mobile"
            }
            style={{ fontSize: "18px" }}
          ></i>
        </Button>
      </div>

      <div
        style={{
          display: "flex",
          gap: "4px",
          marginBottom: "8px",
          alignItems: "center",
        }}
      >
        <Button
          variant="plain"
          onClick={handleGoBack}
          disabled={!canGoBack}
          style={{ minWidth: "28px", padding: 0, height: "28px" }}
        >
          <i className="ti ti-chevron-left" style={{ fontSize: "16px" }}></i>
        </Button>
        <Button
          variant="plain"
          onClick={handleGoForward}
          disabled={!canGoForward}
          style={{ minWidth: "28px", padding: 0, height: "28px" }}
        >
          <i className="ti ti-chevron-right" style={{ fontSize: "16px" }}></i>
        </Button>
        <Input
          value={inputUrl}
          onChange={(e: any) => setInputUrl(e.target.value)}
          onKeyDown={(e: any) => e.key === "Enter" && handleGo()}
          placeholder="URL"
          style={{ flex: 1, height: "28px", fontSize: "12px" }}
        />
        <Button
          variant="solid"
          onClick={handleExtract}
          style={{ minWidth: "28px", height: "28px", padding: 0 }}
          title={t("Extract metadata")}
        >
          <i className="ti ti-link" style={{ fontSize: "16px" }}></i>
        </Button>
        <Button
          variant="outline"
          onClick={handleClip}
          style={{ minWidth: "28px", height: "28px", padding: 0 }}
          title={t("Clip content")}
        >
          <i className="ti ti-news" style={{ fontSize: "16px" }}></i>
        </Button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
          marginBottom: "8px",
        }}
      >
        {quickLinks.map((link) => (
          <Button
            key={link.name || link.url}
            variant="plain"
            onClick={() => {
              setInputUrl(link.url);
              setActiveUrl(link.url);
            }}
            style={{
              fontSize: "11px",
              padding: "2px 6px",
              height: "20px",
              backgroundColor: "var(--orca-color-bg-2)",
            }}
          >
            {link.name}
          </Button>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          border: "1px solid var(--orca-color-border)",
          borderRadius: "4px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <webview
          key="metadata-browser-panel"
          ref={webviewRef}
          src={activeUrl}
          useragent={isMobileMode ? MOBILE_UA : DESKTOP_UA}
          style={{ width: "100%", height: "100%", display: "flex" }}
          partition="persist:metadata-browser"
          allowpopups={true}
        />
      </div>

      {/* {contextMenu && contextMenu.visible && (
        <div
          style={{
            position: "fixed",
            top: Math.round(contextMenu.y),
            left: Math.round(contextMenu.x),
            zIndex: 10001,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <orca.components.Menu>
            {contextMenu.type === "image" ? (
              <>
                <orca.components.MenuText
                  title={t("Save Image to Daily Note")}
                  preIcon="ti ti-photo"
                  onClick={() => {
                    if (viewArgs.onSaveToDailyNote) {
                      viewArgs.onSaveToDailyNote(
                        {
                          type: "image",
                          src: contextMenu.text,
                          download: true,
                        },
                        "image",
                        currentRule,
                      );
                    }
                    setContextMenu(null);
                  }}
                />
                <orca.components.MenuText
                  title={t("Copy Image")}
                  preIcon="ti ti-copy"
                  onClick={async () => {
                    const src = contextMenu.text;
                    setContextMenu(null);
                    const success = await WebviewUtils.copyImageToClipboard(
                      webviewRef.current,
                      src,
                    );
                    if (success)
                      orca.notify("success", t("Image copied to clipboard"));
                  }}
                />
              </>
            ) : (
              <orca.components.MenuText
                title={t("Save to Daily Note")}
                preIcon="ti ti-notes"
                onClick={() => {
                  if (viewArgs.onSaveToDailyNote) {
                    viewArgs.onSaveToDailyNote(
                      contextMenu.text,
                      "text",
                      currentRule,
                    );
                  }
                  setContextMenu(null);
                }}
              />
            )}
          </orca.components.Menu>
        </div>
      )} */}
    </div>
  );
}
