import React, { useState, useRef, useEffect } from "react";
import { t } from "@/libs/l10n";

interface BrowserModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BrowserModal({ visible, onClose }: BrowserModalProps) {
  const [url, setUrl] = useState(
    "https://search.douban.com/book/subject_search?search_text=&cat=1001",
  );
  const webviewRef = useRef<any>(null);

  const Button = orca.components.Button;
  const Input = orca.components.Input;
  const ModalOverlay = orca.components.ModalOverlay;

  const handleGo = () => {
    if (webviewRef.current) {
      webviewRef.current.loadURL(url);
    }
  };

  const handleExtract = async () => {
    if (webviewRef.current) {
      try {
        // Execute JavaScript in the webview to get the title or other metadata
        const script = `
          (() => {
            const findElementByText = (text) => {
              const elements = document.querySelectorAll("span.pl");
              for (const el of elements) {
                if (el.textContent.includes(text)) return el;
              }
              return null;
            };

            const meta = { url: window.location.href };
            const url = meta.url;

            // 提取书籍ID
            const match = url.match(/\\/subject\\/(\\d+)/);
            meta.id = (match && match[1]) || "";

            // 提取书名
            const titleElement = document.querySelector("h1 span");
            meta.title = (titleElement && titleElement.textContent.trim()) || "";

            const coverElement = document.querySelector("#mainpic img");
            meta.cover =
              (coverElement && coverElement.getAttribute("src").trim()) || "";

            // 提取作者
            const authorElement = document.querySelector("#info span:first-child a");
            meta.author = (authorElement && authorElement.textContent.trim()) || "";

            // 提取出版社
            const publisherElement = findElementByText("出版社");
            meta.publisher =
              (publisherElement &&
                publisherElement.nextElementSibling &&
                publisherElement.nextElementSibling.textContent.trim()) ||
              "";

            // 提取出品方
            const producerElement = findElementByText("出品方");
            meta.producer =
              (producerElement &&
                producerElement.nextElementSibling &&
                producerElement.nextElementSibling.textContent.trim()) ||
              "";

            // 提取副标题
            const subtitleElement = findElementByText("副标题");
            meta.subtitle =
              (subtitleElement &&
                subtitleElement.nextSibling &&
                subtitleElement.nextSibling.textContent.trim()) ||
              "";

            // 提取出版年
            const publishDateElement = findElementByText("出版年");
            meta.publishDate =
              (publishDateElement &&
                publishDateElement.nextSibling &&
                publishDateElement.nextSibling.textContent.trim()) ||
              "";

            // 提取页数
            const pagesElement = findElementByText("页数");
            meta.pages =
              (pagesElement &&
                pagesElement.nextSibling &&
                pagesElement.nextSibling.textContent.trim()) ||
              "";

            // 提取定价
            const priceElement = findElementByText("定价");
            meta.price =
              (priceElement &&
                priceElement.nextSibling &&
                priceElement.nextSibling.textContent.trim()) ||
              "";

            // 提取装帧
            const bindingElement = findElementByText("装帧");
            meta.binding =
              (bindingElement &&
                bindingElement.nextSibling &&
                bindingElement.nextSibling.textContent.trim()) ||
              "";

            // 提取ISBN
            const isbnElement = findElementByText("ISBN");
            meta.isbn =
              (isbnElement &&
                isbnElement.nextSibling &&
                isbnElement.nextSibling.textContent.trim()) ||
              "";

            // 确保URL是干净的（去除查询参数）
            if (meta.id) {
               meta.url = \`https://book.douban.com/subject/\${meta.id}/\`;
            }

            return meta;
          })()
        `;

        const metadata = await webviewRef.current.executeJavaScript(script);
        orca.notify(
          "success",
          t("Extracted Title: ${title}", { title: metadata.title }),
        );
        console.log("Extracted metadata:", metadata);
      } catch (e) {
        orca.notify("error", t("Failed to extract metadata"));
        console.error(e);
      }
    }
  };

  useEffect(() => {
    const webview = webviewRef.current;
    if (webview) {
      const handleConsole = (e: any) => {
        // console.log("Webview console:", e.message);
      };
      webview.addEventListener("console-message", handleConsole);
      return () => {
        webview.removeEventListener("console-message", handleConsole);
      };
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <ModalOverlay
      visible={visible}
      onClose={onClose}
      style={{
        zIndex: 9999,
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
          width: "90%",
          height: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
            {t("Browser Demo")}
          </div>
          <Button variant="plain" onClick={onClose}>
            <i className="ti ti-x" style={{ fontSize: "20px" }}></i>
          </Button>
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <Input
            value={url}
            onChange={(e: any) => setUrl(e.target.value)}
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
            src={url}
            style={{ width: "100%", height: "100%", display: "flex" }}
            partition="persist:douban"
            httpreferrer="https://www.douban.com/"
          />
        </div>
      </div>
    </ModalOverlay>
  );
}
