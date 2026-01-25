import { Logger } from "./logger";
import { PropType } from "./consts";

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
  blockId?: number; // Only for "block" type
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
    let blockId: number | null = null;

    // 1. Resolve or Create Block
    if (data.content !== undefined) {
      if (target.type === "cursor") {
        const fragments = this.normalizeContent(data.content);
        await orca.commands.invokeEditorCommand(
          "core.editor.insertFragments",
          target.cursor || null,
          fragments,
        );
        const { anchor } = target.cursor;
        blockId = anchor.blockId;
      } else {
        const parentId = target.blockId;
        if (!parentId) return null;

        const parentBlock = orca.state.blocks[parentId];
        const fragments = this.normalizeContent(data.content);

        blockId = await orca.commands.invokeEditorCommand(
          "core.editor.insertBlock",
          target.cursor || null,
          parentBlock,
          target.position || "lastChild",
          fragments,
          { type: "text" },
        );
      }
    } else {
      // No content provided, resolve existing block to tag
      if (target.type === "block") {
        blockId = target.blockId || null;
      } else {
        // Cursor-based target, tag the block at anchor
        blockId = target.cursor?.anchor?.blockId || null;
      }
    }
    console.log("Block created with data:", data);

    if (!blockId) return null;

    console.log("Block created with ID:", blockId);
    console.log("Tags:", data.tags);
    // 2. Apply Tags
    if (data.tags && data.tags.length > 0) {
      for (const tag of data.tags) {
        await this.applyTag(blockId, tag);
      }
    }

    return blockId;
  }

  /**
   * Apply a single tag with properties to a block and sync its schema.
   */
  static async applyTag(blockId: number, tag: TagData) {
    const tagName = tag.name.trim();
    if (!tagName) return;
    console.log("Applying tag", tagName);
    // Format properties for insertTag
    const formattedProperties = tag.properties.map((p) => {
      let val = p.value;

      // 1. Handle parsing for standard types
      if (p.type === PropType.DateTime && typeof val === "string") {
        const d = new Date();
        if (!isNaN(d.getTime())) val = d;
      } else if (p.type === PropType.Number && typeof val === "string") {
        val = parseFloat(val);
      } else if (p.type === PropType.Boolean && typeof val === "string") {
        val = ["true", "yes", "1", "ok"].includes(val.toLowerCase());
      }

      // 2. Format based on type
      if (p.type === PropType.TextChoices) {
        let choicesValues: string[] = [];
        if (Array.isArray(val)) {
          choicesValues = val;
        } else if (typeof val === "string") {
          choicesValues = val
            .split(" ")
            .map((v) => v.trim())
            .filter((v) => v);
        }

        return {
          name: p.name,
          type: p.type,
          value: choicesValues,
          typeArgs: {
            choices: choicesValues.map((v) => ({ n: v, c: "" })),
            subType: "multi",
          },
          pos: 0,
        };
      }

      const typeArgs = p.typeArgs || {};
      let pos = p.pos || undefined;

      if (p.type === PropType.DateTime) {
        if (!typeArgs.subType) {
          typeArgs.subType = "datetime";
        }
        // subType: 'time' pos:0, 'date' pos:1, 'datetime' pos:2
        // if (typeArgs.subType === "time") pos = 0;
        // else if (typeArgs.subType === "date") pos = 1;
        // else if (typeArgs.subType === "datetime") pos = 2;
        // else pos = 2; // default
        pos = undefined;
      }

      return {
        name: p.name,
        value: val,
        type: p.type,
        typeArgs: Object.keys(typeArgs).length > 0 ? typeArgs : undefined,
        // pos: pos,
      };
    });

    console.log("Formatted properties:", formattedProperties);
    // 1. Insert Tag
    const tagBlockId = await orca.commands.invokeEditorCommand(
      "core.editor.insertTag",
      null,
      blockId,
      tagName,
      // Stripping Proxy markers
      formattedProperties,
    );
    console.log("Tag block ID:", tagBlockId);
    // 2. Sync Schema
    if (tagBlockId) {
      await this.syncTagSchema(tagBlockId, formattedProperties);
    }
  }

  /**
   * Sync property definitions and choices to a Tag Block.
   */
  private static async syncTagSchema(tagBlockId: number, props: any[]) {
    const tagBlock = await orca.invokeBackend("get-block", tagBlockId);
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
        // Merge choices
        const existingChoices = existingProp.typeArgs?.choices || [];
        const existingNames = new Set(existingChoices.map((c: any) => c.n));
        let hasNew = false;

        const newChoices = prop.typeArgs?.choices || [];
        for (const nc of newChoices) {
          if (!existingNames.has(nc.n)) {
            existingChoices.push(nc);
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
              subType: "multi",
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
        JSON.parse(JSON.stringify(propsToUpdate)),
      );
    }
  }

  private static normalizeContent(content: string | any[] | undefined): any[] {
    if (!content) return [{ t: "t", v: "" }];
    if (typeof content === "string") return [{ t: "t", v: content }];
    return content;
  }
}
