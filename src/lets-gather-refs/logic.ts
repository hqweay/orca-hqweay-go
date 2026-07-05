import { ensureBlockInState } from "@/libs/BlockCache";
import { getCurrentBlockId } from "@/libs/navUtils";
import { getBlockTitle } from "@/libs/BlockFormatter";
import type { Block } from "@/orca";

/**
 * 遍历查找最顶层节点（根节点），返回找到的节点
 */
async function findRootBlock(blockId: number): Promise<Block | null> {
  let currentBlock = await ensureBlockInState(blockId);
  if (!currentBlock) return currentBlock;

  let parentId = currentBlock.parent;
  while (parentId) {
    const parentBlock = await ensureBlockInState(parentId);
    if (!parentBlock) {
      break;
    }
    // 继续往上找
    parentId = parentBlock.parent;
    currentBlock = parentBlock;
  }
  
  // 返回能找到的最顶层块
  return currentBlock;
}

export async function gatherAndInsertRefs(t: (key: string, args?: any) => string, cursorData?: any) {
  // A: 当前面板打开的块 (Page)
  const pageBlockId = getCurrentBlockId();
  if (!pageBlockId) {
    orca.notify("warn", t("gather-refs.noContext"));
    return;
  }

  const pageBlock = await ensureBlockInState(pageBlockId);
  if (!pageBlock) {
    orca.notify("warn", t("gather-refs.noContext"));
    return;
  }

  // B: 确定插入目标
  const insertTargetId = cursorData?.focus?.blockId;
  const insertTargetBlock = insertTargetId 
    ? await ensureBlockInState(insertTargetId) 
    : pageBlock;

  if (!insertTargetBlock) {
    orca.notify("warn", t("gather-refs.noContext"));
    return;
  }

  const backRefs = pageBlock.backRefs || [];
  if (backRefs.length === 0) {
    orca.notify("info", t("gather-refs.noRefsFound"));
    return;
  }

  // 如果数量较多，提示用户正在处理
  if (backRefs.length > 20) {
    orca.notify("info", t("gather-refs.processing"));
  }

  const uniqueParents = new Map<number, Block>();

  for (const ref of backRefs) {
    if (!ref.from) continue;
    
    // 获取语义父块
    const semanticParent = await findRootBlock(ref.from);
    if (!semanticParent) continue;
    
    if (!uniqueParents.has(semanticParent.id)) {
      uniqueParents.set(semanticParent.id, semanticParent);
    }
  }

  if (uniqueParents.size === 0) {
    orca.notify("info", t("gather-refs.noRefsFound"));
    return;
  }

  const repo = orca.state.repo || "";
  const markdownLines: string[] = [];
  for (const [id, parentBlock] of uniqueParents.entries()) {
    const parentTitle = getBlockTitle(parentBlock, id, 30);
    markdownLines.push(`[${parentTitle}](orca-note://${repo}/block?blockId=${id})`);
  }

  const markdownContent = markdownLines.join("\n");

  await orca.commands.invokeEditorCommand(
    "core.editor.batchInsertText",
    cursorData || null, // 传递 cursor，保持语义完整
    insertTargetBlock,  // 必填项，作为新块追加的锚点
    "after",            // 必填项，追加在目标块的下方
    markdownContent
  );

  orca.notify("success", t("gather-refs.success", { count: uniqueParents.size.toString() }));
}
