import { useState, useRef, useCallback } from "react";

interface UseDragDropOptions {
  onDrop: (blockIds: number[]) => void;
  onDragMove?: (blockIds: number[], targetId: number) => void;
}

export const useDragDrop = ({ onDrop, onDragMove }: UseDragDropOptions) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const parseDragData = useCallback((e: React.DragEvent): number[] => {
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
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);

      try {
        const ids = parseDragData(e);
        if (ids.length > 0) {
          onDrop(ids);
        }
      } catch (err) {
        console.error("[BlockNav] Failed to parse dragged block data:", err);
      }
    },
    [parseDragData, onDrop]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
    },
    []
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  return {
    isDragOver,
    dragHandlers: {
      onDrop: handleDrop,
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
    },
  };
};
