import type { Block, BlockProperty } from "../../orca.d.ts";
import { PropType } from "@/libs/consts";

export let CARD_TAG_ALIAS = "Card";

export function setCardTagAlias(alias: string) {
  CARD_TAG_ALIAS = alias;
}

export const CARD_PROPERTIES: BlockProperty[] = [
  {
    name: "due",
    type: PropType.DateTime,
  },
  {
    name: "type",
    type: PropType.TextChoices,
    typeArgs: {
      choices: ["Topic", "Item"],
      subType: "single",
      defaultEnabled: true,
      default: "Topic",
    },
  },
  {
    name: "fsrsData",
    type: PropType.Text,
  },
  {
    name: "status",
    type: PropType.TextChoices,
    typeArgs: {
      choices: ["suspend", "archived", "marked", "leech"],
      subType: "multi",
      defaultEnabled: false,
      default: [""],
    },
  },
  {
    name: "remark",
    type: PropType.Text,
  },
];

let isInitialized = false;
let isInitializing = false;

/**
 * 确保 #Card 标签块存在必要的属性定义
 */
export async function ensureCardTagSchema(pluginName: string): Promise<void> {
  if (isInitialized || isInitializing) {
    return;
  }
  isInitializing = true;

  try {
    const cardTagBlock = (await orca.invokeBackend(
      "get-block-by-alias",
      CARD_TAG_ALIAS,
    )) as Block | null;

    let currentTagBlock = cardTagBlock;
    if (!currentTagBlock) {
      console.log(`[${pluginName}] #Card tag not found, creating...`);
      const newBlockId = (await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        null,
        "lastChild",
        [{ t: "t", v: CARD_TAG_ALIAS }],
        { type: "text" },
      )) as number;

      if (newBlockId) {
        await orca.commands.invokeEditorCommand(
          "core.editor.createAlias",
          null,
          CARD_TAG_ALIAS,
          newBlockId,
          true,
        );
        // Refetch to get the block object
        currentTagBlock = (await orca.invokeBackend(
          "get-block",
          newBlockId,
        )) as Block | null;
      }

      if (!currentTagBlock) {
        console.error(`[${pluginName}] Failed to create #Card tag block.`);
        return;
      }
      orca.notify("success", `${CARD_TAG_ALIAS} srs tag created successfully.`);
    }

    const existingProps =
      currentTagBlock.properties && Array.isArray(currentTagBlock.properties)
        ? currentTagBlock.properties
        : [];
    const existingPropNames = new Set(existingProps.map((p) => p.name));
    const missingProps = CARD_PROPERTIES.filter(
      (prop) => !existingPropNames.has(prop.name),
    );
    console.log("Missing properties:", missingProps);
    if (missingProps.length === 0) {
      isInitialized = true;
      return;
    }

    // Add missing properties
    try {
      await orca.commands.invokeEditorCommand(
        "core.editor.setProperties",
        null,
        [currentTagBlock.id],
        missingProps,
      );
    } catch (err) {
      console.error(
        `[${pluginName}] Failed to inject missing properties for #Card schema.`,
        err,
      );
    }

    isInitialized = true;
  } catch (error) {
    console.error(
      `[${pluginName}] Failed to initialize #Card tag schema:`,
      error,
    );
  } finally {
    isInitializing = false;
  }
}
