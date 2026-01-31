import { BasePlugin } from "@/libs/BasePlugin";
import { setupL10N, t } from "@/libs/l10n";
import Settings from "./Settings";
import { LinkMetadataSettings, Rule, MetadataProperty } from "./types";
import { extractMetadata, matchRule } from "./metadataExtractor";
import { PropType } from "@/libs/consts";
import { DEFAULT_RULES } from "./defaultRules";
import { DataImporter, BlockData } from "@/libs/DataImporter";
import { BrowserModal } from "./components/BrowserModal";
import React from "react";

export default class LinkMetadataPlugin extends BasePlugin {
  protected headbarButtonId = "link-metadata-browser-btn";
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

        // Open browser. Target is NULL to enforce insertion into Daily Note (Global Mode)
        // We only use the block to pre-fill the browser URL if available.
        await this.handleOpenBrowser(url, null);
        return null;
      },
      () => {}, // No undo action needed for opening modal
      { label: t("Metadata: Open Browser") },
    );

    // Register editor sidetool
    orca.editorSidetools.registerEditorSidetool(
      `${this.name}.browser-sidetool`,
      {
        render: (_rootBlockId, _panelId) => {
          const Tooltip =
            orca.components.Tooltip || (({ children }: any) => <>{children}</>);
          // Use Button directly, assuming it handles basic styling
          // Or wrap in a way consistent with other sidetools if needed.
          // Usually sidetools just return a button.
          return (
            <Tooltip text={t("Web Assistant (Docked)")} placement="horizontal">
              <orca.components.Button
                variant="plain"
                onClick={() => this.handleOpenBrowser("", null, true)}
                style={{
                  width: "30px",
                  height: "30px",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i className="ti ti-world" style={{ fontSize: "16px" }} />
              </orca.components.Button>
            </Tooltip>
          );
        },
      },
    );

    this.logger.info(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.extract-metadata`,
    );
    orca.commands.unregisterCommand(`${this.name}.extract-metadata`);
    orca.commands.unregisterEditorCommand(`${this.name}.open-browser`);
    this.destroyBrowserModal();
    this.logger.info(`${this.name} unloaded.`);
  }

  protected renderCustomSettings(): React.ReactNode {
    return React.createElement(Settings, { plugin: this });
  }

  public renderHeadbarButton(): React.ReactNode {
    return (
      <orca.components.Button
        variant="plain"
        title={t("Metadata: Open Browser")}
        onClick={async () => await this.handleOpenBrowser("", null)}
      >
        <i className="ti ti-world" style={{ fontSize: "16px" }} />
      </orca.components.Button>
    );
  }

  protected renderHeadbarMenuItems(closeMenu: () => void): React.ReactNode[] {
    const MenuText = orca.components.MenuText;
    return [
      React.createElement(MenuText, {
        key: "open-browser",
        preIcon: "ti ti-world",
        title: t("Metadata: Open Browser"),
        onClick: async () => {
          closeMenu();
          await this.handleOpenBrowser("", null);
        },
      }),
      React.createElement(orca.components.MenuSeparator, {
        key: "sep-link-metadata",
      }),
    ];
  }

  private findUrlInBlock(block: any): string | null {
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
    const matchedRule = matchRule(targetUrl, rules);
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

  private async handleOpenBrowser(
    url: string,
    targetBlock: any,
    initialDocked: boolean = false,
  ) {
    const settings = this.getSettings() as LinkMetadataSettings;
    const rules = settings.rules || DEFAULT_RULES;
    // Default quick links if not set
    const quickLinks = settings.quickLinks || [
      {
        name: "Douban Search",
        url: "https://www.douban.com/search",
      },
      {
        name: "VoiceNotes",
        url: "https://voicenotes.com/app",
      },
      {
        name: "ChatGPT",
        url: "https://chatgpt.com/",
      },
    ];

    let initialRule = null;
    if (url) {
      initialRule = matchRule(url, rules) || null;
    }

    this.openBrowserModal(
      url,
      rules,
      quickLinks,
      async (properties, rule) => {
        if (targetBlock) {
          // Check if block is empty (no content or single empty text fragment)
          const isEmpty =
            !targetBlock.content ||
            targetBlock.content.length === 0 ||
            (targetBlock.content.length === 1 &&
              targetBlock.content[0].t === "t" &&
              !targetBlock.content[0].v.trim());

          if (isEmpty) {
            // Construct Content (Link)
            const titleProp = properties.find(
              (p) => p.name === "标题" || p.name === "Title",
            );
            const linkProp = properties.find(
              (p) => p.name === "链接" || p.name === "Link",
            );
            const title = titleProp?.value || "Untitled";
            const linkUrl = linkProp?.value || url;

            const content = [{ t: "l", v: title, l: linkUrl }];

            try {
              await orca.commands.invokeEditorCommand(
                "core.editor.setBlocksContent",
                null,
                [{ id: targetBlock.id, content: content }],
                false,
              );
            } catch (e) {
              console.error("Failed to update block content", e);
            }
          }

          const ruleToUse = rule || initialRule;
          this.logger.info("Rule to use:", ruleToUse);

          await this.applyMetadataToBlock(
            targetBlock.id,
            ruleToUse?.tagName || "Bookmark",
            properties,
            ruleToUse?.downloadCover || false,
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
              const ruleToUse = rule || initialRule;
              const processedProps = await this.processProperties(
                properties,
                ruleToUse?.downloadCover || false,
              );

              const tagsData = [
                {
                  name: ruleToUse?.tagName || "Bookmark",
                  properties: processedProps,
                },
              ];

              const blockData: BlockData = {
                content: content,
                tags: tagsData,
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
      },
      async (text: string) => {
        // Save to Daily Note Callback
        try {
          const journalBlock = await orca.invokeBackend(
            "get-journal-block",
            new Date(),
          );
          if (journalBlock) {
            await DataImporter.importBlock(
              {
                content: [{ t: "t", v: text }],
              },
              {
                type: "block",
                blockId: journalBlock.id,
                position: "lastChild",
              },
            );
          } else {
            orca.notify("error", t("Could not find Daily Note"));
          }
        } catch (e) {
          console.error("Failed to save selection to Daily Note", e);
          orca.notify("error", t("Failed to save to Daily Note"));
        }
      },
      initialDocked,
    );
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

  private currentBrowserProps: any = null;

  private openBrowserModal(
    initialUrl: string,
    rules: Rule[],
    quickLinks: { name: string; url: string }[],
    onExtract: (props: any[], rule: Rule | null) => void,
    onSaveToDailyNote: (text: string) => void,
    initialDocked: boolean = false,
  ) {
    // If container doesn't exist, create it
    if (!this.modalContainer) {
      this.modalContainer = document.createElement("div");
      document.body.appendChild(this.modalContainer);

      const { createRoot } = window as any;
      this.modalRoot = createRoot(this.modalContainer);
    }

    const handleClose = () => {
      this.hideBrowserModal();
    };

    this.currentBrowserProps = {
      onClose: handleClose,
      initialUrl,
      rules,
      quickLinks,
      onExtract,
      onSaveToDailyNote,
      initialDocked,
    };

    this.renderBrowserModal(true);
  }

  private renderBrowserModal(visible: boolean) {
    if (!this.modalRoot || !this.currentBrowserProps) return;

    this.modalRoot.render(
      <BrowserModal visible={visible} {...this.currentBrowserProps} />,
    );
  }

  private hideBrowserModal() {
    this.renderBrowserModal(false);
  }

  // Renamed from closeBrowserModal to reflect it destroys the instance
  private destroyBrowserModal() {
    if (this.modalRoot) {
      this.modalRoot.unmount();
      this.modalRoot = null;
    }
    if (this.modalContainer) {
      this.modalContainer.remove();
      this.modalContainer = null;
    }
    this.currentBrowserProps = null;
  }
}
