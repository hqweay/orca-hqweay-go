import type { Block, BlockProperty } from "../../orca.d.ts";
import { PropType } from "@/libs/consts";

export const CARD_TAG_ALIAS = "Card";

export const CARD_PROPERTIES: BlockProperty[] = [
  {
    name: "due",
    type: PropType.DateTime,
    value: null as any, // 留空，由 FSRS 算法填入
  },
  {
    name: "type",
    type: PropType.TextChoices,
    value: ["Auto"], // 默认为 Auto，依靠层级关系判断
    typeArgs: {
      choices: ["Auto", "Topic", "Item"],
      subType: "single",
    },
  },
  {
    name: "fsrsData",
    type: PropType.JSON,
    value: null as any, // 存储完整 FSRS 对象的序列化内容
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

    if (!cardTagBlock) {
      // TODO: If block doesn't exist, we might need to tell user to create it first,
      // or we just wait for the first insertTag action.
      // Usually Orca users will type #Card which creates the tag.
      return;
    }

    const existingProps =
      cardTagBlock.properties && Array.isArray(cardTagBlock.properties)
        ? cardTagBlock.properties
        : [];
    const existingPropNames = new Set(existingProps.map((p) => p.name));
    const missingProps = CARD_PROPERTIES.filter(
      (prop) => !existingPropNames.has(prop.name),
    );

    if (missingProps.length === 0) {
      isInitialized = true;
      return;
    }

    // Add missing properties
    for (const prop of missingProps) {
      try {
        await orca.commands.invokeEditorCommand(
          "core.editor.setProperties",
          null,
          [cardTagBlock.id],
          [prop],
        );
      } catch (err) {
        console.error(
          `[${pluginName}] Failed to inject property "${prop.name}" for #Card schema.`,
          err,
        );
      }
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
