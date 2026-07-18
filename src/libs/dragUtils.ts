export const parseBlockDragData = (e: React.DragEvent): number[] => {
  const types = Array.from(e.dataTransfer.types);

  const orcaRepoType = types.find((t) => {
    const parts = t.split("/");
    return parts.length === 2 && parts[0] === "orca";
  });
  const orcaRepoData = orcaRepoType
    ? e.dataTransfer.getData(orcaRepoType)
    : "";

  const textData = e.dataTransfer.getData("text/plain");
  const data = orcaRepoData || textData;
  if (!data) return [];

  let ids: number[] = [];
  let parsed: any;

  try {
    parsed = JSON.parse(data);
  } catch {
    parsed = data;
  }

  if (typeof parsed === "object" && parsed !== null) {
    if (parsed.id) ids.push(Number(parsed.id));
    else if (Array.isArray(parsed.blockIds))
      ids = parsed.blockIds.map(Number);
    else if (Array.isArray(parsed.blocks)) ids = parsed.blocks.map(Number);
    else if (Array.isArray(parsed) && parsed[0]?.id)
      ids = parsed.map((b: any) => Number(b.id));
  } else if (typeof parsed === "string") {
    const numId = Number(parsed);
    if (!isNaN(numId) && numId > 0) ids.push(numId);
  }

  return ids.filter((id) => !isNaN(id) && id > 0);
};
