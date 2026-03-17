import type { Block, BlockProperty } from "../../orca.d.ts";
import { PropType } from "@/libs/consts";
import { DataImporter } from "@/libs/DataImporter";

export let CARD_TAG_ALIAS = "Card";

export function setCardTagAlias(alias: string) {
  if (CARD_TAG_ALIAS !== alias) {
    CARD_TAG_ALIAS = alias;
    isInitialized = false;
  }
}

export const CARD_PROPERTIES: BlockProperty[] = [
  {
    name: "due",
    type: PropType.DateTime,
    typeArgs: { subType: "datetime" },
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
 * 获取或创建标签块
 */
export async function getOrCreateTagBlock(
  pluginName: string,
  alias: string,
): Promise<Block | null> {
  try {
    const cardTagBlock = (await orca.invokeBackend(
      "get-block-by-alias",
      alias,
    )) as Block | null;

    if (cardTagBlock) return cardTagBlock;

    console.log(`[${pluginName}] Tag ${alias} not found, creating...`);
    const newBlockId = (await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock",
      null,
      null,
      "lastChild",
      [{ t: "t", v: alias }],
      { type: "text" },
    )) as number;

    if (newBlockId) {
      await orca.commands.invokeEditorCommand(
        "core.editor.createAlias",
        null,
        alias,
        newBlockId,
        true,
      );
      // Refetch to get the block object
      const currentTagBlock = (await orca.invokeBackend(
        "get-block",
        newBlockId,
      )) as Block | null;

      if (currentTagBlock) {
        orca.notify(
          "success",
          `[${pluginName}] ${alias} srs tag created successfully.`,
        );
        return currentTagBlock;
      }
    }

    console.error(`[${pluginName}] Failed to create ${alias} tag block.`);
    return null;
  } catch (error) {
    console.error(`[${pluginName}] Failed to get/create tag ${alias}:`, error);
    return null;
  }
}

/**
 * 为标签块注入必要的属性定义
 */
export async function injectPropertiesToTag(
  pluginName: string,
  tagBlock: Block,
): Promise<void> {
  try {
    // 使用 DataImporter 统一的同步逻辑，支持属性补全和多选选项合并
    await DataImporter.syncTagSchema(tagBlock, CARD_PROPERTIES);
  } catch (err) {
    console.error(
      `[${pluginName}] Failed to inject missing properties for tag ${tagBlock.id}`,
      err,
    );
  }
}

/**
 * 确保 #Card 标签块存在必要的属性定义
 */
export async function ensureCardTagSchema(pluginName: string): Promise<void> {
  if (isInitialized || isInitializing) return;
  isInitializing = true;

  try {
    const currentTagBlock = await getOrCreateTagBlock(
      pluginName,
      CARD_TAG_ALIAS,
    );
    if (currentTagBlock) {
      await injectPropertiesToTag(pluginName, currentTagBlock);
    }
  } catch (error) {
    console.error(
      `[${pluginName}] Failed to initialize card tag schema:`,
      error,
    );
  } finally {
    isInitializing = false;
    isInitialized = true;
  }
}
