import { DbId } from "../../orca";

export async function getBlockText(blockId: any): Promise<string> {
  try {
    const block = orca.state.blocks[blockId] || await orca.invokeBackend("get-block", blockId);
    if (block && block.text) {
      return block.text.trim();
    }
  } catch (e) {
    console.error("Failed to fetch block text for alias", e);
  }
  return "";
}

export function isBlockLink(fragment: any): boolean {
  if (fragment.t !== "l" || typeof fragment.l !== "string") return false;
  const repo = orca.state.repo || "";
  const regex = new RegExp(`^orca-note:\\/\\/${repo}\\/block\\?blockId=(\\d+)$`);
  return regex.test(fragment.l);
}

export function getBlockIdFromLink(url: string): number | null {
  const repo = orca.state.repo || "";
  const regex = new RegExp(`^orca-note:\\/\\/${repo}\\/block\\?blockId=(\\d+)$`);
  const match = url.match(regex);
  if (match) {
    const id = parseInt(match[1], 10);
    return isNaN(id) ? null : id;
  }
  return null;
}

export function makeBlockLink(blockId: any): string {
  const repo = orca.state.repo || "";
  return `orca-note://${repo}/block?blockId=${blockId}`;
}

export function getRefLabelSync(fragment: any, block: any): string {
  const refId = fragment.v;
  const targetRef = block.refs?.find((r: any) => r.id === refId);
  const targetBlockId = targetRef ? targetRef.to : refId;

  let label = fragment.a || targetRef?.alias;
  if (!label && block.text) {
    const match = block.text.match(/^\[(.*)\]\(/);
    if (match) label = match[1];
  }
  if (!label) {
    const targetBlock = orca.state.blocks[targetBlockId];
    if (targetBlock && targetBlock.text) {
      label = targetBlock.text.trim();
    }
  }
  return label || "";
}

export async function getRefLabel(fragment: any, block: any): Promise<string> {
  let label = getRefLabelSync(fragment, block);
  if (!label) {
    const refId = fragment.v;
    const targetRef = block.refs?.find((r: any) => r.id === refId);
    const targetBlockId = targetRef ? targetRef.to : refId;
    label = await getBlockText(targetBlockId);
  }
  if (!label) {
    const refId = fragment.v;
    const targetRef = block.refs?.find((r: any) => r.id === refId);
    const targetBlockId = targetRef ? targetRef.to : refId;
    label = `Ref: ${targetBlockId}`;
  }
  return label;
}

export function hasBlockReference(blockIds: number[]): boolean {
  for (const blockId of blockIds) {
    const block = orca.state.blocks[blockId];
    if (block && block.content) {
      if (block.content.some((f) => f.t === "r")) {
        return true;
      }
    }
  }
  return false;
}

export function hasBlockLink(blockIds: number[]): boolean {
  for (const blockId of blockIds) {
    const block = orca.state.blocks[blockId];
    if (block && block.content) {
      if (block.content.some(isBlockLink)) {
        return true;
      }
    }
  }
  return false;
}
