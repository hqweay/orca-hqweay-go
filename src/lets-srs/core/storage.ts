import { SrsCardData } from "./query";
import { FsrsGrade, calculateNextReview } from "./fsrs";

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
 * 内部工具：更新或插入卡片标签数据
 */
async function updateCardProperties(
  card: SrsCardData,
  tagProperties: any[],
): Promise<void> {
  if (card.cardRef) {
    try {
      await orca.commands.invokeEditorCommand(
        "core.editor.setRefData",
        null,
        card.cardRef,
        tagProperties,
      );
    } catch (e) {
      // 容错：如果 Ref 已失效，尝试重新插入标签
      await orca.commands.invokeEditorCommand(
        "core.editor.insertTag",
        null,
        card.blockId,
        "Card",
        tagProperties,
      );
    }
  }
}
