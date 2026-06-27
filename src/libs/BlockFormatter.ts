import { Block } from "../orca";

export function getRepr(block: Block): any {
  let repr: any = { type: "text" };

  if (block.properties) {
    const reprProp = block.properties.find((p) => p.name === "_repr");
    if (reprProp && reprProp.value) {
      repr = reprProp.value;
    }
  }
  return repr;
}

export const getConvertedRepr = (block: Block, level: number): any => {
  const rep = getRepr(block);
  const newRep = { ...rep };

  if (level === 0) {
    newRep.type = "text";
    delete newRep.level;
  } else if (level === -1) {
    newRep.type = "heading";
    newRep.level = -1;
  }

  return newRep;
};

export const getBlockTitle = (
  block: any,
  fallbackId: string | number,
  maxLength: number = 20
): string => {
  if (!block) return `Block ${String(fallbackId).substring(0, 8)}`;

  const displayName = block.properties?.find((p: any) => p.name === "displayName")?.value;
  if (displayName) return String(displayName);

  const reprProp = block.properties?.find((p: any) => p.name === "_repr");
  if (reprProp && reprProp.value?.type === "journal" && reprProp.value?.date) {
    const d = new Date(reprProp.value.date);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  if (block.aliases && block.aliases.length > 0) return String(block.aliases[0]);
  if (block.text && block.text.trim().length > 0) {
    let text = block.text.trim();
    if (maxLength > 0 && text.length > maxLength) {
      return text.substring(0, maxLength) + "...";
    }
    return text;
  }
  return `Block ${String(fallbackId).substring(0, 8)}`;
};

export const getBlockIcon = (block: any) => {
  if (!block) return "ti ti-cube";

  const iconProp = block.properties?.find((p: any) => p.name === "_icon");
  if (iconProp && iconProp.value) {
    return String(iconProp.value);
  }

  const reprProp = block.properties?.find((p: any) => p.name === "_repr");
  if (reprProp && reprProp.value) {
    const reprType =
      typeof reprProp.value === "string" ? reprProp.value : reprProp.value.type;

    if (reprType === "journal" && reprProp.value.date) {
      return `__journal__:${reprProp.value.date}`;
    }
    if (reprType === "table2") {
      return "ti ti-table";
    }
    if (reprType === "query") {
      return "ti ti-search";
    }
    if (reprType === "epub") {
      return "ti ti-book";
    }
    if (reprType === "image") {
      return "ti ti-photo";
    }
  }

  if (block.aliases && block.aliases.length > 0) {
    return "ti ti-file";
  }

  return "ti ti-cube";
};

export const getBlockColor = (block: any): string | undefined => {
  if (!block) return undefined;
  const colorProp = block.properties?.find((p: any) => p.name === "_color");
  if (colorProp && colorProp.value) {
    return String(colorProp.value);
  }
  return undefined;
};
