import { BasePlugin } from "@/libs/BasePlugin";
import { setupL10N, t } from "@/libs/l10n";
import Settings from "./Settings";
import { LinkMetadataSettings, Rule, MetadataProperty } from "./types";
import { extractMetadata } from "./metadataExtractor";
import { PropType } from "@/libs/consts";
import { DEFAULT_RULES } from "./defaultRules";
import { DataImporter, BlockData } from "@/libs/DataImporter";
import { BrowserModal } from "./components/BrowserModal";
import React from "react";

export default class LinkMetadataPlugin extends BasePlugin {
  protected settingsComponent = Settings;
  private modalRoot: any = null;
  private modalContainer: HTMLElement | null = null;

  public async load(): Promise<void> {
    if (orca.blockMenuCommands.registerBlockMenuCommand) {
      orca.blockMenuCommands.registerBlockMenuCommand(
        `${this.name}.extract-metadata`,
        {
          worksOnMultipleBlocks: false,
          render: (blockId: number, rootBlockId: number, close: any) => {
            const MenuText = orca.components.MenuText;
            if (!MenuText) return null;
            return (
              <>
                <MenuText
                  preIcon="ti ti-link"
                  title={t("Extract Link Metadata")}
                  onClick={() => {
                    close();
                    orca.commands.invokeCommand(
                      `${this.name}.extract-metadata`,
                      blockId,
                    );
                  }}
                />
                <MenuText
                  preIcon="ti ti-world"
                  title={t("Metadata: Browser Mode")}
                  onClick={async () => {
                    close();
                    const block = await orca.invokeBackend(
                      "get-block",
                      blockId,
                    );
                    const url = this.findUrlInBlock(block) || "";
                    await this.handleOpenBrowser(url, block);
                  }}
                />
              </>
            );
          },
        },
      );
    }

    // Auto/Static Command
    orca.commands.registerCommand(
      `${this.name}.extract-metadata`,
      async (blockId: number) => {
        const block = await orca.invokeBackend("get-block", blockId);
        if (!block) {
          orca.notify("error", t("Block not found"));
          return;
        }
        await this.handleBlockExtraction(block, false);
      },
      t("Extract Link Metadata"),
    );

    // Browser/Manual Command
    orca.commands.registerEditorCommand(
      `${this.name}.open-browser`,
      async ([_panelId, _rootBlockId, cursor]) => {
        let blockId = cursor?.anchor?.blockId;

        let url = "";
        let block = null;
        if (blockId) {
          block = await orca.invokeBackend("get-block", blockId);
          url = this.findUrlInBlock(block) || "";
        }

        // Open browser, passing block context if available for auto-fill and auto-apply
        await this.handleOpenBrowser(url, block);
        return null;
      },
      () => {}, // No undo action needed for opening modal
      { label: t("Metadata: Open Browser") },
    );

    this.logger.info(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.extract-metadata`,
    );
    orca.commands.unregisterCommand(`${this.name}.extract-metadata`);
    orca.commands.unregisterEditorCommand(`${this.name}.open-browser`);
    this.closeBrowserModal();
    this.logger.info(`${this.name} unloaded.`);
  }

  private findUrlInBlock(block: any): string {
    if (!block || !block.content) return "";
    for (const fragment of block.content) {
      if (fragment.t === "a" && fragment.url) {
        return fragment.url;
      }
      if (typeof fragment.v === "string" && fragment.v.includes("http")) {
        const match = fragment.v.match(/https?:\/\/[^\s]+/);
        if (match) {
          return match[0];
        }
      }
    }
    return "";
  }

  private async handleBlockExtraction(block: any, forceBrowser: boolean) {
    const settings = this.getSettings() as LinkMetadataSettings;
    const rules = settings.rules || DEFAULT_RULES;

    const targetUrl = this.findUrlInBlock(block);

    if (!targetUrl) {
      if (forceBrowser) {
        this.handleOpenBrowser("", block);
        return;
      }
      orca.notify("warn", t("No URL found in block"));
      return;
    }

    this.logger.info(`Found URL: ${targetUrl}`);

    // Match Rule
    const matchedRule = this.matchRule(targetUrl, rules);
    this.logger.info(`Matched Rule: ${matchedRule?.name}`);

    if (!matchedRule) {
      // If no rule matches, we can still fall back to generic or browser
      // For now warn
      orca.notify("warn", t("No matching rule found for this URL"));
      return;
    }

    // Try Static Extraction
    try {
      const properties = await extractMetadata(targetUrl, matchedRule.script);
      this.logger.info("Extracted Metadata:", properties);

      await this.applyMetadataToBlock(
        block.id,
        matchedRule.tagName,
        properties,
        matchedRule.downloadCover,
      );
      orca.notify("success", t("Metadata extracted and applied"));
    } catch (e: any) {
      this.logger.error("Extraction failed", e);
      // Fallback prompt
      orca.notify("error", t("Fetch failed. Try Browser Mode?"));
    }
  }

  private matchRule(url: string, rules: Rule[]) {
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

        return regex.test(url);
      } catch (e) {
        this.logger.error(`Invalid regex for rule ${rule.name}`, e);
        return false;
      }
    });
  }

  private async handleOpenBrowser(url: string, targetBlock: any) {
    const settings = this.getSettings() as LinkMetadataSettings;
    const rules = settings.rules || DEFAULT_RULES;
    let initialRule = null;
    if (url) {
      initialRule = this.matchRule(url, rules);
    }

    this.openBrowserModal(url, rules, async (properties) => {
      if (targetBlock) {
        await this.applyMetadataToBlock(
          targetBlock.id,
          initialRule?.tagName || "Bookmark",
          properties,
          initialRule?.downloadCover || false,
        );
        orca.notify("success", t("Metadata applied to block"));
      } else {
        // Global Mode: Insert into Daily Note
        try {
          const journalBlock = await orca.invokeBackend(
            "get-journal-block",
            new Date(),
          );

          if (journalBlock) {
            // 1. Construct Content (Link)
            const titleProp = properties.find(
              (p) => p.name === "标题" || p.name === "Title",
            );
            const linkProp = properties.find(
              (p) => p.name === "链接" || p.name === "Link",
            );
            const title = titleProp?.value || "Untitled";
            const linkUrl = linkProp?.value || url;

            const content = [{ t: "l", v: title, l: linkUrl }];

            this.logger.info("Content:", content);

            // 2. Prepare Tags logic
            const processedProps = await this.processProperties(
              properties,
              initialRule?.downloadCover || false,
            );

            const blockData: BlockData = {
              content: content,
              tags: [
                {
                  name: initialRule?.tagName || "Bookmark",
                  properties: processedProps,
                },
              ],
            };

            await DataImporter.importBlock(blockData, {
              type: "block",
              blockId: journalBlock.id,
              position: "lastChild",
            });

            orca.notify("success", t("Saved to Daily Note"));
          } else {
            orca.notify("error", t("Could not find Daily Note"));
          }
        } catch (e) {
          console.error("Failed to save to Daily Note", e);
          orca.notify("error", t("Failed to save to Daily Note"));
        }
      }
    });
  }

  private async processProperties(properties: any[], downloadCover: boolean) {
    const finalProperties = [];
    for (const prop of properties) {
      let finalValue = prop.value;

      // Check if this is an image property and download is enabled
      if (
        downloadCover &&
        prop.typeArgs?.subType === "image" &&
        typeof prop.value === "string" &&
        prop.value.startsWith("http")
      ) {
        try {
          this.logger.info(`Downloading cover image: ${prop.value}`);
          const response = await fetch(prop.value);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const contentType =
              response.headers.get("content-type") || "image/png";

            const assetPath = await orca.invokeBackend(
              "upload-asset-binary",
              contentType,
              arrayBuffer,
            );

            if (assetPath) {
              this.logger.info(`Cover downloaded to: ${assetPath}`);
              finalValue = assetPath;
            }
          }
        } catch (e) {
          this.logger.error("Error downloading cover image", e);
        }
      }

      finalProperties.push({
        name: prop.name,
        type: prop.type,
        value: finalValue,
        typeArgs: prop.typeArgs,
      });
    }
    return finalProperties;
  }

  private async applyMetadataToBlock(
    blockId: number,
    tagName: string,
    properties: any[],
    downloadCover: boolean = false,
  ) {
    const finalProperties = await this.processProperties(
      properties,
      downloadCover,
    );

    await DataImporter.applyTag(blockId, {
      name: tagName,
      properties: finalProperties,
    });
  }

  private openBrowserModal(
    initialUrl: string,
    rules: Rule[],
    onExtract: (props: any[]) => void,
  ) {
    if (this.modalContainer) {
      this.closeBrowserModal(); // Close existing
    }

    this.modalContainer = document.createElement("div");
    document.body.appendChild(this.modalContainer);

    const { createRoot } = window as any;
    this.modalRoot = createRoot(this.modalContainer);

    const handleClose = () => {
      this.closeBrowserModal();
    };

    this.modalRoot.render(
      <BrowserModal
        visible={true}
        onClose={handleClose}
        initialUrl={initialUrl}
        rules={rules}
        onExtract={onExtract}
      />,
    );
  }

  private closeBrowserModal() {
    if (this.modalRoot) {
      this.modalRoot.unmount();
      this.modalRoot = null;
    }
    if (this.modalContainer) {
      this.modalContainer.remove();
      this.modalContainer = null;
    }
  }
}
