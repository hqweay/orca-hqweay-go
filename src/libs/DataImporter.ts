import { Logger } from "./logger";
import { PropType } from "./consts";
import type { Block } from "../orca.d.ts";
import cloneDeep from "lodash.clonedeep";
import { getMirrorId } from "./block-utils";

export interface PropertyData {
  name: string;
  type: number;
  value: any;
  typeArgs?: any;
  pos?: number;
}

export interface TagData {
  name: string;
  properties: PropertyData[];
}

export interface BlockData {
  content?: string | any[]; // string for plain text, or Fragments array
  tags?: TagData[];
}

export interface InsertTarget {
  type: "block" | "cursor";
  blockId?: number | null; // Only for "block" type
  position?: "firstChild" | "lastChild" | "before" | "after";
  cursor?: any; // CursorData from editor command
}

export class DataImporter {
  /**
   * Universal method to insert data into the editor.
   * Handles block creation, fragment insertion, tagging, and schema syncing.
   */
  static async importBlock(
    data: BlockData,
    target: InsertTarget,
  ): Promise<number | null> {
    // 1. Resolve or Create Block
    const blockId = await this.ensureBlock(data, target);
    if (!blockId) return null;

    // 🛡️ 镜像转换：如果 blockId 是镜像块，则转为原始块 ID
    const originalId = getMirrorId(blockId);

    // 2. Apply Tags
    for (const tag of data.tags || []) {
      await this.applyTag(originalId, tag);
    }

    return blockId;
  }

  /**
   * Resolves an existing block ID or creates a new one based on the target.
   */
  private static async ensureBlock(
    data: BlockData,
    target: InsertTarget,
  ): Promise<number | null> {
    const { content } = data;
    const { type, cursor, blockId, position } = target;

    // Case A: Just tagging an existing block (no content provided)
    if (content === undefined) {
      return type === "cursor" ? cursor?.anchor?.blockId : blockId || null;
    }

    // Case B: Inserting content at the current cursor
    const fragments = this.normalizeContent(content);
    if (type === "cursor") {
      await orca.commands.invokeEditorCommand(
        "core.editor.insertFragments",
        cursor || null,
        fragments,
      );
      return cursor?.anchor?.blockId || null;
    }

    // Case C: Creating a new block at a specific target
    const parentBlock = blockId ? orca.state.blocks[blockId] : null;
    return await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock",
      cursor || null,
      parentBlock,
      position || "lastChild",
      fragments,
      { type: "text" },
    );
  }

  /**
   * Apply a single tag with properties to a block and sync its schema.
   */
  static async applyTag(blockId: number, tag: TagData) {
    const tagName = tag.name.trim();
    if (!tagName) return;

    const formattedProperties = tag.properties.map((p) =>
      this.formatProperty(p),
    );

    // 1. Insert Tag
    const tagBlockId = await orca.commands.invokeEditorCommand(
      "core.editor.insertTag",
      null,
      blockId,
      tagName,
      formattedProperties,
    );

    // 2. Sync Schema
    if (tagBlockId) {
      await this.syncTagSchema(tagBlockId, formattedProperties);
    }
  }

  /**
   * Formats raw property data into the structure expected by Orca.
   */
  private static formatProperty(p: PropertyData): any {
    let { name, type, value, typeArgs = {} } = p;

    // 1. Parse string values based on type
    if (typeof value === "string") {
      if (type === PropType.DateTime) {
        const d = new Date(value);
        if (!isNaN(d.getTime())) value = d;
      } else if (type === PropType.Number) {
        value = parseFloat(value);
      } else if (type === PropType.Boolean) {
        value = ["true", "yes", "1", "ok"].includes(value.toLowerCase());
      }
    }

    // 2. Handle Multi-select (TextChoices) specific structure
    if (type === PropType.TextChoices) {
      const choices = Array.isArray(value)
        ? value
        : typeof value === "string"
          ? value
              .split(" ")
              .map((v) => v.trim())
              .filter(Boolean)
          : [];

      return {
        name,
        type,
        value: choices,
        typeArgs: {
          ...typeArgs,
          choices,
          subType: typeArgs.subType || "multi",
        },
        pos: 0,
      };
    }

    // 3. Handle DateTime subType default
    if (type === PropType.DateTime && !typeArgs.subType) {
      typeArgs.subType = "datetime";
    }

    return {
      name,
      type,
      value,
      typeArgs: Object.keys(typeArgs).length > 0 ? typeArgs : undefined,
    };
  }

  /**
   * Sync property definitions and choices to a Tag Block.
   * Can be used to initialize or update a tag's schema.
   * @param target Block ID or the Block object itself to avoid redundant backend calls.
   */
  public static async syncTagSchema(target: number | Block, props: any[]) {
    let tagBlock: Block | null = null;
    let tagBlockId: number;

    if (typeof target === "number") {
      tagBlockId = target;
      tagBlock = await orca.invokeBackend("get-block", tagBlockId);
    } else {
      tagBlock = target;
      tagBlockId = target.id;
    }

    if (!tagBlock) return;

    const existingProps = tagBlock.properties || [];
    const propsToUpdate: any[] = [];

    for (const prop of props) {
      const existingProp = existingProps.find((p: any) => p.name === prop.name);

      if (!existingProp) {
        propsToUpdate.push({
          name: prop.name,
          type: prop.type,
          typeArgs: prop.typeArgs,
        });
      } else if (
        prop.type === PropType.TextChoices &&
        existingProp.type === PropType.TextChoices
      ) {
        // 合并多选选项（使用纯字符串数组格式）
        const existingChoices = (existingProp.typeArgs?.choices ||
          []) as string[];
        const existingNames = new Set(existingChoices);
        let hasNew = false;

        const newChoices = (prop.typeArgs?.choices || []) as string[];

        for (const choice of newChoices) {
          if (!existingNames.has(choice)) {
            existingChoices.push(choice);
            hasNew = true;
          }
        }

        if (hasNew) {
          propsToUpdate.push({
            name: prop.name,
            type: prop.type,
            typeArgs: {
              ...existingProp.typeArgs,
              choices: existingChoices,
              subType: existingProp.typeArgs?.subType || "multi",
            },
          });
        }
      }
    }

    if (propsToUpdate.length > 0) {
      await orca.commands.invokeEditorCommand(
        "core.editor.setProperties",
        null,
        [tagBlockId],
        cloneDeep(propsToUpdate),
      );
    }
  }

  private static normalizeContent(content: string | any[] | undefined): any[] {
    if (typeof content === "string") return [{ t: "t", v: content }];
    return content || [{ t: "t", v: "" }];
  }
}
