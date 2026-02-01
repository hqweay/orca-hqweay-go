import React, { useState, useRef, useEffect } from "react";
import { t } from "@/libs/l10n";
import { Rule, MetadataProperty } from "../types";
import { PropType } from "@/libs/consts";

// Safe webview type definition: removed as it conflicts with env.
// We will rely on existing types or @ts-ignore
import { matchRule } from "../metadataExtractor";
import { WebviewUtils } from "@/libs/WebviewUtils";
import { HTML_TO_MARKDOWN_SCRIPT, CLEAN_URL_SCRIPT } from "../webviewScripts";
import { defaultGeneric } from "../rules/generic";

interface BrowserModalProps {
  visible: boolean;
  onClose: () => void;
  initialUrl: string;
  rules: Rule[]; // Pass all rules to allow client-side matching
  quickLinks: { name: string; url: string }[];
  onExtract: (properties: MetadataProperty[], rule: Rule | null) => void;
  onSaveToDailyNote: (data: any, type?: string, rule?: Rule | null) => void;
  initialDocked?: boolean;
}

// Mobile UA for iPhone 15 Pro
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function BrowserModal({
  visible,
  onClose,
  initialUrl,
  rules,
  quickLinks,
  onExtract,
  onSaveToDailyNote,
  initialDocked = false,
}: BrowserModalProps) {
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [activeUrl, setActiveUrl] = useState(initialUrl); // Actual webview URL
  // Track the *current* rule based on the current URL
  const [currentRule, setCurrentRule] = useState<Rule | null>(null);
  const webviewRef = useRef<any>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
    type?: "text" | "image";
  } | null>(null);

  const [isDocked, setIsDocked] = useState(initialDocked);
  const [prevInitialDocked, setPrevInitialDocked] = useState(initialDocked);
  const [isMobileMode, setIsMobileMode] = useState(initialDocked);

  // Sync state with props during render to avoid flickering
  if (initialDocked !== prevInitialDocked) {
    setPrevInitialDocked(initialDocked);
    setIsDocked(initialDocked);
    setIsMobileMode(initialDocked);
  }

  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

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

  const Button = orca.components.Button;
  const Input = orca.components.Input;
  const ModalOverlay = orca.components.ModalOverlay;

  // Reload webview when UA changes
  useEffect(() => {
    if (webviewRef.current) {
      const targetUA = isMobileMode ? MOBILE_UA : DESKTOP_UA;
      // Explicitly set User Agent on the instance to ensure it sticks
      // Wrap in try-catch because on initial mount, the webview might not be ready yet.
      // The 'useragent' prop handles the initial load, this is mostly for runtime switching.
      if (webviewRef.current.setUserAgent) {
        try {
          webviewRef.current.setUserAgent(targetUA);
        } catch (e) {
          // Ignore "The WebView must be attached to the DOM" error on initial load
          console.debug("Failed to set UA (likely not ready yet):", e);
        }
      }

      // Small delay to ensure prop update propagates before reload
      setTimeout(() => {
        try {
          webviewRef.current.reload();
        } catch (e) {
          // Ignore if not ready
        }
      }, 50);
    }
  }, [isMobileMode]);

  useEffect(() => {
    if (initialUrl) {
      setInputUrl(initialUrl);
      setActiveUrl(initialUrl);
      const rule = matchRule(initialUrl, rules);
      setCurrentRule(rule || null);
    }
  }, [initialUrl]);

  // Setup navigation listeners
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleNavigate = (e: any) => {
      // Update rule when navigation happens
      if (e.url) {
        setInputUrl(e.url);
        // We DO NOT set activeUrl here because it would create a feedback loop
        // with the <webview src={activeUrl}> prop, which can cause the webview
        // to reset or ignore the value. activeUrl should only be set when
        // we want to *trigger* a navigation from the host.

        const rule = matchRule(e.url, rules);
        setCurrentRule(rule || null);
      }
      updateNavigationState();
    };

    const handleDomReady = () => {
      // Force all links with target="_blank" to open in the current window
      // by intercepting the click and manually setting window.location.href
      // using the capture phase to ensure we handle it first.
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

    webview.addEventListener("did-navigate", handleNavigate);
    webview.addEventListener("did-navigate-in-page", handleNavigate); // For SPA
    webview.addEventListener("dom-ready", handleDomReady);
    webview.addEventListener("new-window", handleNewWindow);

    const handleContextMenu = (e: any) => {
      // e.params.selectionText
      const params = e.params;
      if (params.mediaType === "image" && params.srcURL) {
        setContextMenu({
          visible: true,
          x: params.x,
          y: params.y,
          text: params.srcURL,
          type: "image",
        });
      } else if (params && params.selectionText) {
        // Show custom menu
        setContextMenu({
          visible: true,
          x: params.x,
          y: params.y,
          text: params.selectionText,
          type: "text",
        });
      }
    };
    webview.addEventListener("context-menu", handleContextMenu);

    return () => {
      webview.removeEventListener("did-navigate", handleNavigate);
      webview.removeEventListener("did-navigate-in-page", handleNavigate);
      webview.removeEventListener("dom-ready", handleDomReady);
      webview.removeEventListener("new-window", handleNewWindow);
      webview.removeEventListener("context-menu", handleContextMenu);
    };
  }, [visible]); // Re-bind if visible changes; webview is stable now with fixed key

  const handleGo = () => {
    // Navigate to the input URL
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

    // Always calculate match again just in case state is lagging slightly behind webview actual URL,
    // though state should be sync via events.
    // Better: use currentRule if available, or try to match current webview URL.
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
      // 1. Prepare Shim Script
      // We need to inject PropType and baseMeta calculation into the webview context
      // so the rule script can use them.
      const shimScript = `
        (() => {
          const PropType = ${JSON.stringify(PropType)};
          
          // cleanUrl is injected via CLEAN_URL_SCRIPT
          const url = window.location.href;
          const doc = document;
          
          // Re-implement getGenericMetadata logic for client-side
          const getBaseMeta = () => {
            const title =
              doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim() ||
              doc.querySelector("title")?.textContent?.trim() ||
              "";

            const thumbnail =
              doc.querySelector("meta[property='og:image']")?.getAttribute("content") ||
              doc.querySelector("meta[name='og:image']")?.getAttribute("content") ||
              doc.querySelector("link[rel='icon']")?.getAttribute("href") ||
              "";
             const description = doc.querySelector("meta[property='og:description']")?.getAttribute("content") || doc.querySelector("meta[name='description']")?.getAttribute("content") || "";
             return { title, thumbnail, description, url }; 
          };
          
          const baseMeta = getBaseMeta();

          // User Rule Script Body
          const userScriptBody = ${JSON.stringify(ruleToUse.script.join("\n"))};
          
          try {
              // Create and execute the function
              // Signature: (doc, url, PropType, cleanUrl, baseMeta)
              const extractorFn = new Function(
                "doc",
                "url",
                "PropType",
                "cleanUrl",
                "baseMeta",
                userScriptBody
              );
              
              return extractorFn(doc, url, PropType, cleanUrl, baseMeta);
          } catch(err) {
              return { error: err.toString() };
          }
        })()
      `;

      // Prepend dependencies
      const fullScript = `
        ${CLEAN_URL_SCRIPT}
        ${shimScript}
      `;

      const properties = await webviewRef.current.executeJavaScript(fullScript);

      if (properties && properties.error) {
        throw new Error(properties.error);
      }

      if (Array.isArray(properties)) {
        if (onExtract) {
          onExtract(properties, ruleToUse);
        }
        // TODO: close modal after extraction
        // onClose();
      } else {
        console.error("Extraction returned non-array:", properties);
        orca.notify("error", t("Script returned invalid data"));
      }
    } catch (e: any) {
      orca.notify(
        "error",
        t("Failed to extract metadata: ${msg}", { msg: e.message }),
      );
      console.error(e);
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
      // 1. Prepare Shim Script
      const shimScript = `
        (() => {
          const PropType = ${JSON.stringify(PropType)};
          // cleanUrl is injected via CLEAN_URL_SCRIPT
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
              if (contentScriptBody) {
                  content = runScript(contentScriptBody) || [];
              }
              
              if (Array.isArray(metadata) && Array.isArray(content)) {
                  return [...metadata, ...content];
              }
              return metadata;
          } catch(err) {
              return { error: err.toString() };
          }
        })()
      `;

      // Prepend dependencies
      const fullScript = `
        ${CLEAN_URL_SCRIPT}
        ${HTML_TO_MARKDOWN_SCRIPT}
        ${shimScript}
      `;

      const properties = await webviewRef.current.executeJavaScript(fullScript);

      if (properties && properties.error) {
        throw new Error(properties.error);
      }

      if (Array.isArray(properties)) {
        const contentProp = properties.find(
          (p: any) => p.name === "正文" || p.name === "Content",
        );
        if (contentProp && contentProp.value) {
          onSaveToDailyNote(properties, "markdown", ruleToUse);
          orca.notify("success", t("Content clipped to Daily Note"));
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

  // if (!visible) return null; // Removed to keep state alive

  return (
    <ModalOverlay
      visible={true} // Always keep internal visible true to prevent unmounting if it controls it
      onClose={onClose}
      blurred={!isDocked}
      style={{
        backgroundColor: isDocked ? "transparent" : "rgba(255, 255, 255, 0.9)",
        display: visible ? "flex" : "none",
        alignItems: "center",
        justifyContent: isDocked ? "flex-end" : "center",
        pointerEvents: isDocked ? "none" : "auto", // Allow clicking through overlay when docked
      }}
      onClick={() => setContextMenu(null)} // Close menu on outside click
    >
      <div
        style={{
          backgroundColor:
            "var(--b3-theme-background, var(--orca-color-bg-main, #ffffff))",
          color: "var(--b3-theme-on-background)",
          padding: "20px",
          borderRadius: isDocked ? "0" : "8px",
          width: isDocked ? "40vw" : "80vw",
          minWidth: isDocked ? "400px" : "auto",
          height: isDocked ? "100vh" : "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
          borderLeft: isDocked ? "1px solid var(--orca-color-border)" : "none",
          pointerEvents: "auto", // Re-enable pointer events for the modal content
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <div style={{ fontSize: "1.2rem", fontWeight: "bold", flex: 1 }}>
            {/* {t("Browser Extraction")} - {currentRule?.name || "Generic"} */}
            {currentRule?.name || "Generic"}
          </div>
          <Button
            variant="plain"
            onClick={() => setIsMobileMode(!isMobileMode)}
            style={{ marginRight: "8px" }}
            title={
              isMobileMode ? t("Switch to Desktop") : t("Switch to Mobile")
            }
          >
            <i
              className={
                isMobileMode ? "ti ti-device-desktop" : "ti ti-device-mobile"
              }
              style={{ fontSize: "20px" }}
            ></i>
          </Button>
          <Button
            variant="plain"
            onClick={() => setIsDocked(!isDocked)}
            style={{ marginRight: "8px" }}
            title={isDocked ? t("Center Object") : t("Dock to Side")}
          >
            <i
              className={
                isDocked
                  ? "ti ti-layout-sidebar-left-collapse"
                  : "ti ti-layout-sidebar-right"
              }
              style={{ fontSize: "20px" }}
            ></i>
          </Button>
          <Button variant="plain" onClick={onClose}>
            <i className="ti ti-x" style={{ fontSize: "20px" }}></i>
          </Button>
        </div>
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "12px",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: "4px" }}>
            <Button
              variant="plain"
              onClick={handleGoBack}
              disabled={!canGoBack}
              style={{ minWidth: "32px", padding: "0 4px", height: "32px" }}
              title={t("Back")}
            >
              <i
                className="ti ti-chevron-left"
                style={{ fontSize: "18px" }}
              ></i>
            </Button>
            <Button
              variant="plain"
              onClick={handleGoForward}
              disabled={!canGoForward}
              style={{ minWidth: "32px", padding: "0 4px", height: "32px" }}
              title={t("Forward")}
            >
              <i
                className="ti ti-chevron-right"
                style={{ fontSize: "18px" }}
              ></i>
            </Button>
          </div>
          <Input
            value={inputUrl}
            onChange={(e: any) => setInputUrl(e.target.value)}
            placeholder="URL"
            style={{ flex: 1 }}
          />
          <Button variant="outline" onClick={handleGo}>
            {t("Go")}
          </Button>
          <orca.components.Tooltip
            text={t(
              "Extract the main content of the page and save it to the Daily Note",
            )}
          >
            <Button
              variant="outline"
              onClick={handleClip}
              style={{ minWidth: "32px", height: "32px", padding: 0 }}
            >
              <i className="ti ti-news" style={{ fontSize: "18px" }}></i>
            </Button>
          </orca.components.Tooltip>
          <orca.components.Tooltip
            text={t("Extract page metadata and apply it to the current block")}
          >
            <Button
              variant="solid"
              onClick={handleExtract}
              style={{ minWidth: "32px", height: "32px", padding: 0 }}
            >
              <i className="ti ti-link" style={{ fontSize: "18px" }}></i>
            </Button>
          </orca.components.Tooltip>
        </div>
        {/* Quick Links */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          {quickLinks.map((link) => (
            <Button
              key={link.name || link.url}
              variant="plain"
              onClick={() => {
                const targetUrl = link.url;
                setInputUrl(targetUrl);
                setActiveUrl(targetUrl);
              }}
              style={{
                fontSize: "0.85rem",
                padding: "2px 8px",
                height: "24px",
                backgroundColor: "var(--orca-color-bg-2)",
              }}
            >
              {link.name || link.url}
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
          {(() => {
            const getSitePartition = (url: string) => {
              try {
                const hostname = new URL(url).hostname;
                const parts = hostname.split(".");
                // Attempt to get the main domain name (e.g. 'pixiv' from 'www.pixiv.net')
                const domain =
                  parts.length >= 2 ? parts[parts.length - 2] : parts[0];
                if (domain) return `persist:${domain}`;
              } catch (e) {}
              return "persist:metadata-browser";
            };
            const getSiteReferrer = (url: string) => {
              try {
                if (url.startsWith("http")) {
                  return new URL(url).origin + "/";
                }
              } catch (e) {}
              return undefined;
            };

            // 对于插件内置浏览器这种需要频繁处理“登录-提取数据”流程的场景，固定 Partition 是更标准、更稳妥的做法。它能确保登录跳转不丢失状态，且避免了 Electron 属性更改的限制。
            const partition = "persist:metadata-browser";

            return (
              /* @ts-ignore */
              <webview
                key="metadata-browser"
                ref={webviewRef}
                src={activeUrl}
                useragent={isMobileMode ? MOBILE_UA : DESKTOP_UA}
                style={{ width: "100%", height: "100%", display: "flex" }}
                partition={partition}
                httpreferrer={getSiteReferrer(activeUrl)}
                allowpopups={true}
              />
            );
          })()}
        </div>
        {contextMenu && contextMenu.visible && (
          <>
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 10000,
              }}
              onClick={() => setContextMenu(null)}
            />
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
                        onSaveToDailyNote(
                          {
                            type: "image",
                            src: contextMenu.text,
                            download: true,
                          },
                          "image",
                          currentRule,
                        );
                        setContextMenu(null);
                        orca.notify("success", t("Saved Image to Daily Note"));
                      }}
                    />
                    {/* <orca.components.MenuText
                      title={t("Save Image Link")}
                      preIcon="ti ti-link"
                      onClick={() => {
                        onSaveToDailyNote(
                          {
                            type: "image",
                            src: contextMenu.text,
                            download: false,
                          },
                          "image",
                        );
                        setContextMenu(null);
                        orca.notify("success", t("Saved Image Link"));
                      }}
                    /> */}
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

                        if (success) {
                          orca.notify(
                            "success",
                            t("Image copied to clipboard"),
                          );
                        } else {
                          orca.notify("error", t("Failed to capture image"));
                        }
                      }}
                    />
                  </>
                ) : (
                  <orca.components.MenuText
                    title={t("Save to Daily Note")}
                    preIcon="ti ti-notes"
                    onClick={() => {
                      onSaveToDailyNote(contextMenu.text, "text", currentRule);
                      setContextMenu(null);
                      orca.notify("success", t("Saved to Daily Note"));
                    }}
                  />
                )}
              </orca.components.Menu>
            </div>
          </>
        )}
      </div>
    </ModalOverlay>
  );
}
