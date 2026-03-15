import { SrsCardData } from "./query";
import { CARD_TAG_ALIAS, CARD_PROPERTIES } from "./tagSchema";
import { Logger } from "@/libs/logger";
import { FsrsGrade, calculateNextReview } from "./fsrs";
import cloneDeep from "lodash.clonedeep";

/**
 * 保存卡片的复习结果进度
 */
export async function saveCardReview(
  card: SrsCardData,
  grade: FsrsGrade,
): Promise<void> {
  const { nextState, nextDue } = calculateNextReview(card.fsrsData, grade);

  const tagProperties = [
    { name: "due", value: nextDue },
    { name: "fsrsData", value: JSON.stringify(nextState) },
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
async function updateCardProperties(
  card: SrsCardData,
  tagProperties: any[],
): Promise<void> {
  // 1. 如果已有 cardRef，优先尝试更新现有标签

  if (card.cardRef) {
    try {
      console.log("updateCardProperties", card.cardRef, tagProperties);
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
      // card.fsrsData =
        // tagProperties.find((p) => p.name === "fsrsData")?.value || "";
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
  const tagBlock = await orca.invokeBackend("get-block", tabBlockId);
  if (tagBlock) {
    card.cardRef = {
      id: tabBlockId,
      type: 2,
      alias: CARD_TAG_ALIAS,
      data: tagBlock.properties || [],
    };
    card.isVirtual = false;
  }
}
