import { proxy } from "valtio";

export const sessionState = proxy({
  isRecording: true, // Auto-record by default
  footprints: [] as number[],
  timeEdges: [] as { source: number; target: number }[],
  expandedNodes: [] as number[], // For local manual expansion
  filters: {
    showTags: true,
    showStructure: true,
    showReferences: true,
  },
});

export const toggleRecording = (currentBlockId?: number | null) => {
  sessionState.isRecording = !sessionState.isRecording;
  if (sessionState.isRecording && currentBlockId != null) {
    addFootprint(currentBlockId);
  }
};

export const clearFootprints = () => {
  sessionState.footprints = [];
  sessionState.timeEdges = [];
  sessionState.expandedNodes = [];
};

export const addFootprint = (blockId: number) => {
  if (!sessionState.isRecording) return;
  
  const lastBlock = sessionState.footprints.length > 0 
    ? sessionState.footprints[sessionState.footprints.length - 1] 
    : null;

  if (!sessionState.footprints.includes(blockId)) {
    sessionState.footprints.push(blockId);
  }

  // If jumping to a new block (even if already visited), record the time edge
  if (lastBlock && lastBlock !== blockId) {
    // Check if edge already exists to prevent dupes
    const edgeExists = sessionState.timeEdges.some(
      (e) => e.source === lastBlock && e.target === blockId
    );
    if (!edgeExists) {
      sessionState.timeEdges.push({ source: lastBlock, target: blockId });
    }
  }
};
