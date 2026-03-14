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
  status: string[]; // multi-select options: suspend, archived, marked, leech
  remark?: string;
  snapshotProps?: any[]; // Original property values for Undo
  isVirtual?: boolean; // If true, it means it doesn't have a #Card tag yet
}

/**
 * 核心查询：找出所有需要复习的卡片。
 * 条件：带有 #Card 标签，且 Due <= Today 或 Due 尚未设置 (New Card)
 */
export async function fetchDueCards(): Promise<SrsCardData[]> {
  const now = Date.now();
  // 1. 查询所有带有 #Card 标签的块。
  // 注意：我们先查出所有，然后在内存中过滤，以确保对比精度和逻辑的一致性。
  const query: QueryDescription2 = {
    q: {
      kind: 101, // QueryKindSelfOr
      conditions: [
        {
          kind: 4, // QueryKindTag
          name: "Card",
          properties: [
            {
              name: "due",
              type: 5,
              op: 10, // QueryLe (LessEqual)
              value: new Date(),
            },
          ],
          selfOnly: true,
        },
        {
          kind: 4, // QueryKindTag
          name: "Card",
          properties: [
            {
              name: "due",
              type: 5,
              op: 11, // QueryNull
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
      const card = await normalizeBlockToCard(blockId);
      if (card) {
        // 过滤掉已暂停或已归档的卡片
        if (card.status.includes("suspend") || card.status.includes("archived")) {
          continue;
        }
        dueCards.push(card);
      }
    } // 结束 resultIds 遍历

    // 3. 进入内存过滤阶段：只保留 Due <= 现在 或 新卡 (Due 为空) 的内容
    const filteredCards = dueCards.filter((card) => {
      // 如果没有到期时间，视为新卡，直接加入
      if (card.due === null) return true;
      // 否则，对比时间戳
      return card.due <= now;
    });

    console.log(
      `[lets-srs] total found: ${dueCards.length}, due/new: ${filteredCards.length}`,
    );

    // 默认排序：先复习旧卡片（按到期日从小到大），再复习新卡片
    filteredCards.sort((a, b) => {
      if (a.isNew && !b.isNew) return 1;
      if (!a.isNew && b.isNew) return -1;
      if (!a.isNew && !b.isNew) return a.due! - b.due!;
      return 0;
    });

    return filteredCards;
  } catch (err) {
    console.error(`[lets-srs] failed to fetch cards`, err);
    return [];
  }
}

/**
 * 将任意 Block 标准化为 SrsCardData
 */
export async function normalizeBlockToCard(
  blockId: number,
): Promise<SrsCardData | null> {
  if (!blockId) return null;

  // 获取或加载块数据
  let block = orca.state.blocks[blockId];
  if (!block) {
    block = await orca.invokeBackend("get-block", blockId);
  }
  if (!block) {
    logger.warn(`[lets-srs] failed to find block: ${blockId}`);
    return null;
  }

  // 🛡️ 强制数据归一化
  if (!Array.isArray(block.children)) block.children = [];
  if (!Array.isArray(block.refs)) block.refs = [];
  if (!Array.isArray(block.properties)) block.properties = [];

  let typeProp: { name: string; value?: any } | undefined;
  let fsrsProp: { name: string; value?: any } | undefined;
  let statusProp: { name: string; value?: any } | undefined;
  let remarkProp: { name: string; value?: any } | undefined;
  let dueDate: string | number | null = null;
  let cardRef: any = null;

  // 提取标签数据
  const refs = block.refs || [];
  cardRef = refs.find(
    (ref: any) => ref.type === 2 && ref.alias === CARD_TAG_ALIAS,
  );

  const srsPropNames = ["due", "type", "fsrsData", "status", "remark"];
  let snapshotProps: any[] = [];

  if (cardRef && cardRef.data && Array.isArray(cardRef.data)) {
    for (const prop of cardRef.data) {
      if (srsPropNames.includes(prop.name)) {
        snapshotProps.push({ ...prop });
      }
      if (prop.name === "due") dueDate = prop.value;
      else if (prop.name === "type") typeProp = prop;
      else if (prop.name === "fsrsData") fsrsProp = prop;
      else if (prop.name === "status") statusProp = prop;
      else if (prop.name === "remark") remarkProp = prop;
    }
  }

  // 备选方案：检查顶层属性
  if (!dueDate && block.properties) {
    for (const prop of block.properties) {
      if (srsPropNames.includes(prop.name)) {
        snapshotProps.push({ ...prop });
      }
      if (prop.name === "due") dueDate = prop.value;
      else if (prop.name === "type") typeProp = prop;
      else if (prop.name === "fsrsData") fsrsProp = prop;
      else if (prop.name === "status") statusProp = prop;
      else if (prop.name === "remark") remarkProp = prop;
    }
  }

  // 解析多选状态
  let currentStatus: string[] = [];
  const rawStatus = statusProp?.value;
  if (Array.isArray(rawStatus)) {
    currentStatus = rawStatus.filter((s) => typeof s === "string");
  } else if (typeof rawStatus === "string" && rawStatus) {
    currentStatus = [rawStatus];
  }

  // 提取 FSRS 数据
  const srsDataRaw = fsrsProp?.value;
  let srsData = null;
  if (typeof srsDataRaw === "string" && srsDataRaw) {
    try {
      srsData = JSON.parse(srsDataRaw);
    } catch (e) {}
  } else if (typeof srsDataRaw === "object" && srsDataRaw !== null) {
    srsData = srsDataRaw;
  }

  const parsedDue = dueDate != null ? new Date(dueDate).getTime() : null;
  const blockValue = typeProp?.value;
  let blockType = Array.isArray(blockValue) ? blockValue[0] : blockValue;

  if (!blockType) {
    const hasChildren = block.children && block.children.length > 0;
    blockType = hasChildren ? "Item" : "Topic";
  }

  return {
    blockId,
    due: parsedDue,
    type: blockType as "Auto" | "Topic" | "Item",
    fsrsData: srsData,
    block,
    isNew: parsedDue === null,
    cardRef: cardRef,
    status: currentStatus,
    remark: remarkProp?.value || "",
    snapshotProps: snapshotProps,
    isVirtual: !cardRef, // 没有 #Card 标签即为虚构卡片
  };
}
