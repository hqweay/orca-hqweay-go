import React, { useState, useRef, useEffect } from "react";
import { t } from "@/libs/l10n";
import { Rule, MetadataProperty } from "../types";
import { PropType } from "@/libs/consts";

// Safe webview type definition: removed as it conflicts with env.
// We will rely on existing types or @ts-ignore

interface BrowserModalProps {
  visible: boolean;
  onClose: () => void;
  initialUrl: string;
  rules: Rule[]; // Pass all rules to allow client-side matching
  quickLinks: { name: string; url: string }[];
  onExtract: (properties: MetadataProperty[]) => void;
}

export function BrowserModal({
  visible,
  onClose,
  initialUrl,
  rules,
  quickLinks,
  onExtract,
}: BrowserModalProps) {
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [activeUrl, setActiveUrl] = useState(initialUrl); // Actual webview URL
  // Track the *current* rule based on the current URL
  const [currentRule, setCurrentRule] = useState<Rule | null>(null);
  const webviewRef = useRef<any>(null);

  const Button = orca.components.Button;
  const Input = orca.components.Input;
  const ModalOverlay = orca.components.ModalOverlay;

  const matchRule = (targetUrl: string) => {
    return rules.find((rule: Rule) => {
      if (!rule.enabled) return false;
      try {
        let regex: RegExp;
        const pattern = rule.urlPattern.trim();
        // Check if it's a regex literal string like "/pattern/i"
        if (pattern.startsWith("/") && pattern.lastIndexOf("/") > 0) {
          const lastSlashIndex = pattern.lastIndexOf("/");
          const body = pattern.substring(1, lastSlashIndex);
          const flags = pattern.substring(lastSlashIndex + 1);
          regex = new RegExp(body, flags);
        } else {
          // Legacy/Simple string support
          regex = new RegExp(pattern, "i");
        }
        return regex.test(targetUrl);
      } catch (e) {
        console.error(`Invalid regex for rule ${rule.name}`, e);
        return false;
      }
    });
  };

  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
      const rule = matchRule(initialUrl);
      setCurrentRule(rule || null);
    }
    if (initialUrl) {
      setInputUrl(initialUrl);
      setActiveUrl(initialUrl);
      const rule = matchRule(initialUrl);
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
        // We don't necessarily set activeUrl here to avoid re-triggering src update loop,
        // but typically webview.src matches e.url.
        // setActiveUrl(e.url);

        const rule = matchRule(e.url);
        setCurrentRule(rule || null);
      }
      // Note: 'currentRule' here is from the closure created when this listener was bound.
      // It will NOT show the updated value immediately. Use the useEffect below to track updates.
    };

    webview.addEventListener("did-navigate", handleNavigate);
    webview.addEventListener("did-navigate-in-page", handleNavigate); // For SPA

    return () => {
      webview.removeEventListener("did-navigate", handleNavigate);
      webview.removeEventListener("did-navigate-in-page", handleNavigate);
    };
  }, [visible]); // Re-bind if visible changes or webview ref changes (usually stable but good to be safe)

  const handleGo = () => {
    // Navigate to the input URL
    setActiveUrl(inputUrl);
  };

  const handleExtract = async () => {
    if (!webviewRef.current) return;

    // Always calculate match again just in case state is lagging slightly behind webview actual URL,
    // though state should be sync via events.
    // Better: use currentRule if available, or try to match current webview URL.
    let ruleToUse = currentRule;

    if (!ruleToUse) {
      const currentWebviewUrl = webviewRef.current.getURL();
      ruleToUse = matchRule(currentWebviewUrl) || null;
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
          
          const cleanUrl = (u) => u.split('?')[0].split('#')[0];
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
              
             return { title, thumbnail, url }; 
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

      const properties = await webviewRef.current.executeJavaScript(shimScript);

      if (properties && properties.error) {
        throw new Error(properties.error);
      }

      if (Array.isArray(properties)) {
        onExtract(properties);
        onClose();
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

  if (!visible) return null;

  return (
    <ModalOverlay
      visible={true}
      onClose={onClose}
      blurred={true}
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.9)", // slightly opaque
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--b3-theme-background)",
          color: "var(--b3-theme-on-background)",
          padding: "20px",
          borderRadius: "8px",
          width: "80%",
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
            {t("Browser Extraction")} - {currentRule?.name || "Generic"}
          </div>
          <Button variant="plain" onClick={onClose}>
            <i className="ti ti-x" style={{ fontSize: "20px" }}></i>
          </Button>
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <Input
            value={inputUrl}
            onChange={(e: any) => setInputUrl(e.target.value)}
            placeholder="URL"
            style={{ flex: 1 }}
          />
          <Button variant="outline" onClick={handleGo}>
            {t("Go")}
          </Button>
          <Button variant="solid" onClick={handleExtract}>
            {t("Extract Metadata")}
          </Button>
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
          {/* @ts-ignore */}
          <webview
            ref={webviewRef}
            src={activeUrl}
            style={{ width: "100%", height: "100%", display: "flex" }}
            partition="persist:douban" // Keep session
            httpreferrer="https://www.douban.com/" // Douban specific fix
          />
        </div>
      </div>
    </ModalOverlay>
  );
}
