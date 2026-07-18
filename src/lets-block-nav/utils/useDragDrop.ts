import { useState, useRef, useCallback } from "react";
import { parseBlockDragData } from "@/libs/dragUtils";

interface UseDragDropOptions {
  onDrop: (blockIds: number[]) => void;
  onDragMove?: (blockIds: number[], targetId: number) => void;
}

export const useDragDrop = ({ onDrop, onDragMove }: UseDragDropOptions) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);

      try {
        const ids = parseBlockDragData(e);
        if (ids.length > 0) {
          onDrop(ids);
        }
      } catch (err) {
        console.error("[BlockNav] Failed to parse dragged block data:", err);
      }
    },
    [onDrop]
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
