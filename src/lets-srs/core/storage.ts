import { SrsCardData } from "./query";
import { CARD_TAG_ALIAS, CARD_PROPERTIES } from "./tagSchema";
import { Logger } from "@/libs/logger";
import { FsrsGrade, calculateNextReview } from "./fsrs";
import {
  TopicGrade,
  calculateTopicNextReview,
  isTopicState,
} from "./topic-scheduler";
import cloneDeep from "lodash.clonedeep";

/** 统一的评分类型 */
export type CardGrade = FsrsGrade | TopicGrade;

/**
 * 保存卡片的复习结果进度
 * 根据卡片类型自动选择调度算法：
 * - Topic → topic-scheduler（递增间隔）
 * - Item  → FSRS（遗忘曲线）
 */
export async function saveCardReview(
  card: SrsCardData,
  grade: CardGrade,
): Promise<void> {
  let nextDue: Date;
  let nextState: any;
  let nextPriority = card.priority ?? 3;

  if (card.type === "Topic") {
    // Topic 使用递增间隔调度器
    const topicGrade = grade as TopicGrade;
    const currentState = isTopicState(card.srsData) ? card.srsData : null;
    const result = calculateTopicNextReview(currentState, topicGrade);
    nextDue = result.nextDue;
    nextState = result.nextState;

    // Topic 卡根据评分自动调整优先级
    if (topicGrade === "soon") {
      nextPriority = Math.max(1, nextPriority - 1);
    } else if (topicGrade === "easy") {
      nextPriority = Math.min(5, nextPriority + 1);
    }
  } else {
    // Item 类型
    const fsrsGrades: FsrsGrade[] = ["again", "hard", "good", "easy"];
    const isTopicGrade = ["soon", "done", "easy"].includes(grade);

    if (isTopicGrade) {
      // 漫游模式下的“非破坏性”处理：不更新 FSRS，仅调整优先级和 Due Date
      const topicGrade = grade as TopicGrade;
      nextState = { ...card.srsData }; // 保持原样

      if (topicGrade === "soon") {
        nextPriority = Math.max(1, nextPriority - 1);
        nextDue = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // 设为明天
      } else if (topicGrade === "easy") {
        nextPriority = Math.min(5, nextPriority + 1);
        nextDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 设为一周后推迟
      } else {
        // done
        nextDue = new Date(Date.now() + 1 * 60 * 60 * 1000); // 暂时移出队列（1小时后）
      }
    } else {
      // 复习模式：严格走 FSRS 算法
      const result = calculateNextReview(card.srsData, grade as FsrsGrade);
      nextDue = result.nextDue;
      nextState = result.nextState;
    }
  }

  const tagProperties = [
    { name: "due", value: nextDue },
    { name: "interval", value: nextState.interval ?? 0 },
    { name: "reps", value: nextState.reps ?? 0 },
    { name: "priority", value: nextPriority },
    { name: "_srsData", type: 0, value: nextState },
    { name: "type", value: card.type },
  ];

  await updateCardProperties(card, tagProperties);
}

/**
 * 推迟卡片到明天
 */
export async function postponeCard(card: SrsCardData): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const tagProperties = [{ name: "due", value: tomorrow }];
  await updateCardProperties(card, tagProperties);
}

/**
 * 切换卡片的特定状态（多选）
 */
export async function toggleCardStatus(
  card: SrsCardData,
  statusToToggle: string,
): Promise<void> {
  const currentStatus = card.status || [];
  let newStatus: string[];

  if (currentStatus.includes(statusToToggle)) {
    newStatus = currentStatus.filter((s) => s !== statusToToggle);
  } else {
    newStatus = [...currentStatus, statusToToggle];
  }

  const tagProperties = [{ name: "status", value: newStatus }];
  await updateCardProperties(card, tagProperties);
}

/**
 * 保存卡片的备注 (Remark)
 */
export async function saveCardRemark(
  card: SrsCardData,
  remark: string,
): Promise<void> {
  const tagProperties = [{ name: "remark", value: remark }];
  await updateCardProperties(card, tagProperties);
}

/**
 * 确保块带有 #Card 标签（用于漫游模式下的“转化为闪卡”）
 */
export async function ensureCardTag(card: SrsCardData): Promise<void> {
  console.log("ensureCardTag", card);
  if (!card.isVirtual && card.cardRef) return;
  await updateCardProperties(card, []);
}

/**
 * 将卡片属性还原为初始状态（用于撤销）
 */
export async function revertCardToState(card: SrsCardData): Promise<void> {
  if (!card.snapshotProps || !Array.isArray(card.snapshotProps)) {
    console.warn("[lets-srs] No snapshot found for card undo", card.blockId);
    return;
  }
  await updateCardProperties(card, cloneDeep(card.snapshotProps));
}

/**
 * 内部工具：更新或插入卡片标签数据
 */
export async function updateCardProperties(
  card: SrsCardData,
  tagProperties: any[],
): Promise<void> {
  // 1. 如果已有 cardRef，优先尝试更新现有标签

  if (card.cardRef) {
    try {
      console.log("updateCardProperties11", card.cardRef, tagProperties);
      await orca.commands.invokeEditorCommand(
        "core.editor.setRefData",
        null,
        card.cardRef,
        tagProperties,
      );
      // 3. 更新内存中的状态

      card.cardRef = {
        ...card.cardRef,
        data: tagProperties,
      };
      card.status = tagProperties.find((p) => p.name === "status")?.value || [];
      // card.remark = tagProperties.find((p) => p.name === "remark")?.value || "";
      // card.srsData =
      // tagProperties.find((p) => p.name === "srsData")?.value || "";
      // card.due = tagProperties.find((p) => p.name === "due")?.value || "";
      // card.type = tagProperties.find((p) => p.name === "type")?.value || "";

      return;
    } catch (e) {
      // 容错：如果 Ref 已失效（标签被手动删了），进入下面的插入逻辑
      console.warn(
        "[lets-srs] setRefData failed, falling back to insertTag",
        e,
      );
    }
  }

  // 2. 如果是虚拟内容或者更新失败，执行插入/重新注入标签
  // 构造完整的属性列表，合并 默认值 与 传入的覆盖值
  const finalProps = CARD_PROPERTIES.map((p) => {
    const override = tagProperties.find((tp) => tp.name === p.name);
    return {
      name: p.name,
      value: override ? override.value : p.typeArgs?.default,
    };
  });

  const tabBlockId = (await orca.commands.invokeEditorCommand(
    "core.editor.insertTag",
    null,
    card.blockId,
    CARD_TAG_ALIAS,
    finalProps,
  )) as number;

  // 3. 更新内存中的状态
  const updatedBlock = await orca.invokeBackend("get-block", card.blockId);
  if (updatedBlock && updatedBlock.refs) {
    const cardRef = updatedBlock.refs.find(
      (ref: any) => ref.type === 2 && ref.alias === CARD_TAG_ALIAS,
    );
    if (cardRef) {
      card.cardRef = cardRef;
      card.status = tagProperties.find((p) => p.name === "status")?.value || [];
      card.isVirtual = false;
    }
  }
  console.log("updateCardProperties22", card);
}
