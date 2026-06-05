import { Logger } from "@/libs/logger.ts";
import type { DbId, Block, QueryDescription2 } from "../../orca.d.ts";
import { CARD_TAG_ALIAS } from "./tagSchema";
import { getMirrorId } from "@/libs/block-utils";
import { ensureBlockInState, isValidId } from "@/libs/utils.ts";

const logger = new Logger("lets-srs");

export interface SrsCardData {
  blockId: number;
  due: number | null;
  type: "Auto" | "Topic" | "Item";
  interval: number;
  reps: number;
  priority: number;
  srsData: any | null;
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
export async function fetchDueCards(
  mode: "item" | "topic" | "mixed" = "mixed",
): Promise<SrsCardData[]> {
  const now = Date.now();
  // 1. 查询所有带有 #Card 标签的块。
  // 注意：我们先查出所有，然后在内存中过滤，以确保对比精度和逻辑的一致性。
  const query: QueryDescription2 = {
    q: {
      kind: 101, // QueryKindSelfOr
      conditions: [
        {
          kind: 4, // QueryKindTag
          name: CARD_TAG_ALIAS,
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
          name: CARD_TAG_ALIAS,
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
    const queryResultIds = (await orca.invokeBackend("query", query)) as DbId[];
    const resultIds = Array.from(
      new Set(await Promise.all(queryResultIds.map((id) => getMirrorId(id)))),
    );

    logger.debug(`[lets-srs] query result (deduped):`, resultIds);

    if (!resultIds.length) {
      return [];
    }

    const dueCards: SrsCardData[] = [];

    for (const blockId of resultIds) {
      const card = await normalizeBlockToCard(blockId);
      if (card) {
        // 过滤掉已暂停或已归档的卡片
        if (
          card.status.includes("suspend") ||
          card.status.includes("archived")
        ) {
          continue;
        }

        // --- Mode Filtering ---
        if (mode === "item" && card.type !== "Item") continue;
        if (mode === "topic" && card.type !== "Topic") continue;

        dueCards.push(card);
      }
    } // 结束 resultIds 遍历

    // 排序策略：优先级分组 + 局部洗牌
    // 1. 新卡固定排在最后
    // 2. 旧卡按 priority 分组（1=最高，5=最低）
    // 3. 同 priority 组内随机洗牌（局部洗牌）
    const oldCards = dueCards.filter((c) => !c.isNew);
    const newCards = dueCards.filter((c) => c.isNew);

    // 按 priority 分桶
    const buckets = new Map<number, SrsCardData[]>();
    for (const card of oldCards) {
      const p = card.priority;
      if (!buckets.has(p)) buckets.set(p, []);
      buckets.get(p)!.push(card);
    }

    // 每个桶内 Fisher-Yates 洗牌
    const shuffle = (arr: SrsCardData[]) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    // 按优先级从高到低（1→5）拼接，每组内已洗牌
    const sortedOld: SrsCardData[] = [];
    const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
    for (const key of sortedKeys) {
      sortedOld.push(...shuffle(buckets.get(key)!));
    }

    // 新卡也洗牌，放在最后
    shuffle(newCards);

    return [...sortedOld, ...newCards];
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

  // 🛡️ 镜像转换：如果 blockId 是镜像块，则转为原始块 ID
  const originalId = await getMirrorId(blockId);

  // 获取或加载块数据
  let block = await ensureBlockInState(originalId);
  if (!block) {
    logger.warn(`[lets-srs] failed to find block: ${originalId}`);
    return null;
  }

  // 🛡️ 强制数据归一化
  if (!Array.isArray(block.children)) block.children = [];
  if (!Array.isArray(block.refs)) block.refs = [];
  if (!Array.isArray(block.properties)) block.properties = [];

  let typeProp: { name: string; value?: any } | undefined;
  let srsProp: { name: string; value?: any } | undefined;
  let intervalProp: { name: string; value?: any } | undefined;
  let repsProp: { name: string; value?: any } | undefined;
  let priorityProp: { name: string; value?: any } | undefined;
  let statusProp: { name: string; value?: any } | undefined;
  let remarkProp: { name: string; value?: any } | undefined;
  let dueProp: { name: string; value?: any } | undefined;

  let dueDate: string | number | null = null;
  let cardRef: any = null;

  // 提取标签数据
  const refs = block.refs || [];
  cardRef = refs.find(
    (ref: any) => ref.type === 2 && ref.alias === CARD_TAG_ALIAS,
  );

  const srsPropNames = [
    "due",
    "type",
    "interval",
    "reps",
    "priority",
    "_srsData",
    "status",
    "remark",
  ];

  let snapshotProps: any[] = [];
  const srsProperties = cardRef?.data || [];

  for (const prop of srsProperties) {
    if (srsPropNames.includes(prop.name)) {
      snapshotProps.push({ ...prop });
    }
    if (prop.name === "due") dueProp = prop;
    else if (prop.name === "type") typeProp = prop;
    else if (prop.name === "interval") intervalProp = prop;
    else if (prop.name === "reps") repsProp = prop;
    else if (prop.name === "_srsData") srsProp = prop;
    else if (prop.name === "status") statusProp = prop;
    else if (prop.name === "priority") priorityProp = prop;
    else if (prop.name === "remark") remarkProp = prop;
  }

  // Parse attributes
  const type = typeProp?.value || "item";
  dueDate = dueProp?.value;

  // 解析多选状态
  let currentStatus: string[] = [];
  const rawStatus = statusProp?.value;
  if (Array.isArray(rawStatus)) {
    currentStatus = rawStatus.filter((s) => typeof s === "string");
  } else if (typeof rawStatus === "string" && rawStatus) {
    currentStatus = [rawStatus];
  }

  // 提取 SRS 调度数据
  const srsDataRaw = srsProp?.value;
  let srsData = null;
  if (typeof srsDataRaw === "object" && srsDataRaw !== null) {
    srsData = srsDataRaw;
  }

  const parsedDue = dueDate != null ? new Date(dueDate).getTime() : null;
  const blockValue = typeProp?.value;
  let blockType = Array.isArray(blockValue) ? blockValue[0] : blockValue;

  if (!blockType) {
    const hasChildren = block.children && block.children.length > 0;
    // 如果有子块且有 #Card 标签，则为 Item，否则为 Topic：随机浏览时默认都当作 Topic 处理
    blockType = hasChildren && cardRef ? "Item" : "Topic";
  }

  return {
    blockId: originalId,
    due: parsedDue,
    type: blockType as "Auto" | "Topic" | "Item",
    interval: intervalProp?.value ?? srsData?.interval ?? 0,
    reps: repsProp?.value ?? srsData?.reps ?? 0,
    priority: priorityProp?.value ?? 3,
    srsData: srsData,
    block,
    isNew: parsedDue === null,
    cardRef: cardRef,
    status: currentStatus,
    remark: remarkProp?.value || "",
    snapshotProps: snapshotProps,
    isVirtual: !cardRef, // 没有 #Card 标签即为虚构卡片
  };
}

/**
 * 漫游算法：基于 BFS 寻找关联块
 */
export async function getRelatedBlockIds(
  rootId: number,
  maxDepth: number = 3,
  hubCap: number = 50,
  excludeIds: Set<number> = new Set(),
): Promise<{ ids: number[]; weights: Record<number, number> }> {
  const weights: Record<number, number> = {};
  const addWeight = (id: number, weight: number) => {
    weights[id] = (weights[id] || 0) + weight;
  };

  const visitedHubs = new Set<number>();
  const queue: { id: number; depth: number }[] = [{ id: rootId, depth: 0 }];

  // 全局缓存，避免深搜时反复调接口 (在一次漫游调用中有效)
  const fetchedBlocks = new Map<number, any>();

  const fetchBlockSafely = async (id: number) => {
    if (!isValidId(id)) return null;
    if (fetchedBlocks.has(id)) return fetchedBlocks.get(id);
    const b = await ensureBlockInState(id);
    if (b) fetchedBlocks.set(id, b);
    return b;
  };

  // 广度优先搜索 (BFS) 遍历语义群组
  while (queue.length > 0) {
    const { id: currentHubId, depth } = queue.shift()!;

    if (!isValidId(currentHubId)) continue;
    if (depth >= maxDepth) continue;

    // 每深一层，关联程度减半（100 -> 50 -> 25）
    const currentWeight = 100 * Math.pow(0.5, depth);
    if (!excludeIds.has(currentHubId)) {
      addWeight(currentHubId, currentWeight);
    }

    if (visitedHubs.has(currentHubId)) continue;
    visitedHubs.add(currentHubId);

    if (depth >= maxDepth) continue;

    // --- 关键抽象：语义群组作为统一采集器 ---
    let treeBlocks: any[] = [];
    try {
      treeBlocks =
        (await orca.invokeBackend("get-block-tree", currentHubId)) || [];
    } catch (e) {
      logger.error("Failed to get block tree in smart roam", e);
    }

    if (treeBlocks && Array.isArray(treeBlocks)) {
      for (const b of treeBlocks) {
        if (b && isValidId(b.id)) {
          fetchedBlocks.set(b.id, b);
          if (!orca.state.blocks[b.id]) {
            orca.state.blocks[b.id] = b;
          }
        }
      }
    }

    const treeIds: number[] = (treeBlocks || [])
      .map((b: any) => b?.id)
      .filter(isValidId);

    if (isValidId(currentHubId)) {
      if (!treeIds.includes(currentHubId)) treeIds.push(currentHubId);
    }

    const outgoingRefs = new Set<number>();
    const incomingRefs = new Set<number>();

    for (const tId of treeIds) {
      const block = await fetchBlockSafely(tId);
      if (!block) continue;

      if (block.refs && Array.isArray(block.refs)) {
        block.refs.forEach((r: any) => {
          if (r.to) outgoingRefs.add(r.to);
        });
      }

      if (block.backRefs && Array.isArray(block.backRefs)) {
        block.backRefs.forEach((r: any) => {
          if (r.from) incomingRefs.add(r.from);
        });
      }
    }

    // --- 熔断保护：Hub 黑洞防御 ---
    let incomingArray = Array.from(incomingRefs);
    if (incomingArray.length > hubCap) {
      // Fisher-Yates 洗牌随机抽样
      for (let i = incomingArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [incomingArray[i], incomingArray[j]] = [
          incomingArray[j],
          incomingArray[i],
        ];
      }
      incomingArray = incomingArray.slice(0, hubCap);
    }

    for (const targetId of outgoingRefs) {
      if (isValidId(targetId)) {
        queue.push({ id: targetId, depth: depth + 1 });
      }
    }
    for (const targetId of incomingArray) {
      if (isValidId(targetId)) {
        queue.push({ id: targetId, depth: depth + 1 });
      }
    }
  }

  // 准备返回结果
  let candidateIds = Object.keys(weights)
    .map(Number)
    .filter(isValidId);
  if (rootId) {
    candidateIds = candidateIds.filter((id) => id !== rootId);
  }

  const finalIds: number[] = [];

  // 防空壳过滤
  for (const id of candidateIds) {
    if (excludeIds.has(id)) continue;

    const b = await fetchBlockSafely(id);
    if (!b) continue;

    const hasContent = !!(b.content && b.content.length > 0);
    const hasChildren = !!(b.children && b.children.length > 0);

    if (!hasContent && !hasChildren) continue;
    finalIds.push(id);
  }

  // 严谨排序与局部洗牌
  finalIds.sort((a, b) => {
    const wA = weights[a] || 0;
    const wB = weights[b] || 0;
    const diff = wB - wA;

    if (Math.abs(diff) <= 15) {
      return Math.random() - 0.5;
    }
    return diff;
  });

  return { ids: finalIds, weights };
}
