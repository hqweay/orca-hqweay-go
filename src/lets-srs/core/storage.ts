import { SrsCardData } from "./query";
import { FsrsGrade, calculateNextReview } from "./fsrs";

/**
 * 保存卡片的复习结果进度
 * 封装了从评级到计算再到持久化的完整链路
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

  if (card.cardRef) {
    try {
      await orca.commands.invokeEditorCommand(
        "core.editor.setRefData",
        null,
        card.cardRef,
        tagProperties,
      );
    } catch (e) {
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
