import { BasePlugin } from "@/libs/BasePlugin";
import { setupL10N, t } from "@/libs/l10n";
import Settings from "./Settings";
import { LinkMetadataSettings, Rule } from "./types";
import { extractMetadata } from "./metadataExtractor";
import { PropType } from "@/libs/consts";
import { DEFAULT_RULES } from "./defaultRules";

export default class LinkMetadataPlugin extends BasePlugin {
  protected settingsComponent = Settings;

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
            );
          },
        },
      );
    }

    orca.commands.registerCommand(
      `${this.name}.extract-metadata`,
      async (blockId: number) => {
        const block = await orca.invokeBackend("get-block", blockId);
        if (!block) {
          orca.notify("error", t("Block not found"));
          return;
        }
        await this.handleBlockExtraction(block);
      },
      t("Extract Link Metadata"),
    );

    this.logger.info(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.extract-metadata`,
    );
    orca.commands.unregisterCommand(`${this.name}.extract-metadata`);
    this.logger.info(`${this.name} unloaded.`);
  }

  private async handleBlockExtraction(block: any) {
    const settings = this.getSettings() as LinkMetadataSettings;
    const rules = settings.rules || DEFAULT_RULES;

    let targetUrl = "";
    if (block.content) {
      for (const fragment of block.content) {
        if (fragment.t === "a" && fragment.url) {
          targetUrl = fragment.url;
          break;
        }
        if (typeof fragment.v === "string" && fragment.v.includes("http")) {
          const match = fragment.v.match(/https?:\/\/[^\s]+/);
          if (match) {
            targetUrl = match[0];
            break;
          }
        }
      }
    }

    if (!targetUrl) {
      orca.notify("warn", t("No URL found in block"));
      return;
    }

    this.logger.info(`Found URL: ${targetUrl}`);

    // Match Rule
    const matchedRule = rules.find((rule: Rule) => {
      if (!rule.enabled) return false;
      try {
        const regex = new RegExp(rule.urlPattern, "i");
        return regex.test(targetUrl);
      } catch (e) {
        this.logger.error(`Invalid regex for rule ${rule.name}`, e);
        return false;
      }
    });
    this.logger.info(`Matched Rule: ${matchedRule?.name}`);

    if (!matchedRule) {
      orca.notify("warn", t("No matching rule found for this URL"));
      return;
    }

    this.logger.info(`Matched Rule: ${matchedRule.name}`);

    // Extract Metadata
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
      orca.notify("error", t(`Extraction failed: ${e.message}`));
      this.logger.error("Extraction failed", e);
    }
  }

  private async applyMetadataToBlock(
    blockId: number,
    tagName: string,
    properties: any[],
    downloadCover: boolean = false,
  ) {
    // Format properties for insertTag/setProperties
    // Process properties (Download Check)
    const formattedProperties = [];
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
            // Determine mime type or default
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
          } else {
            this.logger.warn(`Failed to download cover: ${response.status}`);
          }
        } catch (e) {
          this.logger.error("Error downloading cover image", e);
        }
      }

      if (prop.type === PropType.TextChoices) {
        formattedProperties.push({
          name: prop.name,
          type: prop.type,
          value: finalValue,
          typeArgs: {
            choices: Array.isArray(finalValue)
              ? finalValue.map((item: any) => ({ n: item, c: "" }))
              : [],
            subType: "multi",
          },
          pos: 0,
        });
      } else {
        formattedProperties.push({
          name: prop.name,
          value: finalValue,
          type: prop.type,
          typeArgs: prop.typeArgs,
        });
      }
    }

    // 1. Insert Tag with properties (Values)
    // This returns the ID of the Tag Block (either new or existing)
    const tagBlockId = await orca.commands.invokeEditorCommand(
      "core.editor.insertTag",
      null,
      blockId,
      tagName,
      formattedProperties,
    );

    // 2. Ensure Schema Exists on the Tag Block
    // If the tag is new, or if we are adding new properties to an existing tag,
    // we need to make sure the Tag Block defines these properties.
    if (tagBlockId) {
      const tagBlock = await orca.invokeBackend("get-block", tagBlockId);
      if (tagBlock) {
        const existingProps = tagBlock.properties || [];
        const propsToAdd = [];

        for (const prop of formattedProperties) {
          const existingProp = existingProps.find(
            (p: any) => p.name === prop.name,
          );

          if (!existingProp) {
            // Case 1: Property does not exist at all -> Add it
            propsToAdd.push({
              name: prop.name,
              type: prop.type,
              typeArgs: prop.typeArgs,
            });
          } else if (
            prop.type === PropType.TextChoices &&
            existingProp.type === PropType.TextChoices
          ) {
            // Case 2: Property exists and is multi-select -> Merge new choices
            // Extract existing choices
            const existingChoices = existingProp.typeArgs?.choices || [];
            const existingChoiceValues = new Set(
              existingChoices.map((c: any) => c.n),
            );

            // Checking new choices from the formatted property we constructed
            const newChoices = prop.typeArgs?.choices || [];
            let hasNew = false;

            for (const choice of newChoices) {
              if (!existingChoiceValues.has(choice.n)) {
                existingChoices.push(choice);
                hasNew = true;
              }
            }

            if (hasNew) {
              // We need to update the existing property definition
              // setProperties will overwrite the property definition if name matches?
              // Yes, usually setProperties handles updates.
              propsToAdd.push({
                name: existingProp.name,
                type: existingProp.type,
                typeArgs: {
                  ...existingProp.typeArgs,
                  choices: existingChoices,
                },
              });
            }
          }
        }

        if (propsToAdd.length > 0) {
          this.logger.info(
            "Updating tag schema with new properties/choices",
            propsToAdd,
          );
          await orca.commands.invokeEditorCommand(
            "core.editor.setProperties",
            null,
            [tagBlockId],
            propsToAdd,
          );
        }
      }
    }
  }
}
