import { Logger } from "@/libs/logger.ts";
import type { DbId, Block, QueryDescription2 } from "../../orca.d.ts";
import { CARD_TAG_ALIAS } from "./tagSchema";

const logger = new Logger("lets-srs");

export interface SrsCardData {
  blockId: number;
  due: number | null;
  type: "Auto" | "Topic" | "Item";
  fsrsData: any | null;
  block: any;
  isNew: boolean;
  cardRef?: any; // The BlockRef object for the Card tag
}

/**
 * 核心查询：找出所有需要复习的卡片。
 * 条件：带有 #Card 标签，且 Due <= Today 或 Due 尚未设置 (New Card)
 */
export async function fetchDueCards(): Promise<SrsCardData[]> {
  const now = Date.now();
  const query: QueryDescription2 = {
    q: {
      kind: 101 as any, // QueryKindSelfOr
      conditions: [
        {
          kind: 4, // QueryKindTag
          name: CARD_TAG_ALIAS,
          properties: [
            {
              name: "due",
              op: 10, // QueryLe (LessEqual)
              value: now,
            },
          ],
          selfOnly: true,
        },
        {
          kind: 4, // QueryKindTag
          name: CARD_TAG_ALIAS,
          properties: [
            {
              name: "due",
              op: 11, // QueryNull (Is null or undefined)
            },
          ],
          selfOnly: true,
        },
      ],
    },
    pageSize: 1000,
  };

  try {
    const resultIds = (await orca.invokeBackend("query", query)) as DbId[];

    logger.debug(`[lets-srs] query result:`, resultIds);

    if (!resultIds || !Array.isArray(resultIds)) {
      return [];
    }

    const dueCards: SrsCardData[] = [];

    for (const blockId of resultIds) {
      if (!blockId) continue;

      // 获取或加载块数据
      let block = orca.state.blocks[blockId];
      if (!block) {
        block = await orca.invokeBackend("get-block", blockId);
      }
      if (!block) {
        logger.warn(`[lets-srs] failed to find block: ${blockId}`);
        continue;
      }

      // 🛡️ 强制数据归一化 (直接作用于 orca.state 以确保全局一致)
      // 这能彻底解决 "ur is not iterable" 错误，因为该错误通常源于 children/refs 为 null
      if (!Array.isArray(block.children)) block.children = [];
      if (!Array.isArray(block.refs)) block.refs = [];
      if (!Array.isArray(block.properties)) block.properties = [];

      let typeProp: { name: string; value?: any } | undefined;
      let fsrsProp: { name: string; value?: any } | undefined;
      let dueDate: string | number | null = null;
      let cardRef: any = null;

      // 提取标签数据
      const refs = block.refs || [];
      cardRef = refs.find(
        (ref: any) => ref.type === 2 && ref.alias === CARD_TAG_ALIAS,
      );
      
      if (cardRef && cardRef.data && Array.isArray(cardRef.data)) {
        for (const prop of cardRef.data) {
          if (prop.name === "due") dueDate = prop.value;
          else if (prop.name === "type") typeProp = prop;
          else if (prop.name === "fsrsData") fsrsProp = prop;
        }
      }

      // 备选方案：检查顶层属性
      if (!dueDate && block.properties) {
        for (const prop of block.properties) {
          if (prop.name === "due") dueDate = prop.value;
          else if (prop.name === "type") typeProp = prop;
          else if (prop.name === "fsrsData") fsrsProp = prop;
        }
      }

      // 提取 FSRS 数据
      const srsDataRaw = fsrsProp?.value;
      let srsData = null;
      if (typeof srsDataRaw === "string" && srsDataRaw) {
        try { srsData = JSON.parse(srsDataRaw); } catch (e) {}
      } else if (typeof srsDataRaw === "object" && srsDataRaw !== null) {
        srsData = srsDataRaw;
      }

      const parsedDue = dueDate != null ? new Date(dueDate).getTime() : null;
      const blockValue = typeProp?.value;
      const blockType = (Array.isArray(blockValue) ? blockValue[0] : blockValue) || "Auto";

      dueCards.push({
        blockId,
        due: parsedDue,
        type: blockType as "Auto" | "Topic" | "Item",
        fsrsData: srsData,
        block, // 保留引用
        isNew: parsedDue === null,
        cardRef: cardRef,
      });
    } // 结束 resultIds 遍历

    logger.debug(`[lets-srs] fetched ${dueCards.length} due cards`);

    // 默认排序：先复习旧卡片（按到期日排序），再复习新卡片
    dueCards.sort((a, b) => {
      if (a.isNew && !b.isNew) return 1;
      if (!a.isNew && b.isNew) return -1;
      if (!a.isNew && !b.isNew) return a.due! - b.due!;
      return 0;
    });

    return dueCards;
  } catch (err) {
    console.error(`[lets-srs] failed to fetch cards`, err);
    return [];
  }
}
