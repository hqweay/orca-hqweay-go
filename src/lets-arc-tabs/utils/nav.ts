export const findMainPanelId = (panel: any): string | null => {
  if (panel.view === 'block' || panel.view === 'journal') {
    return panel.id;
  }
  if (panel.children) {
    for (const child of panel.children) {
      const id = findMainPanelId(child);
      if (id) return id;
    }
  }
  return null;
};

export const getActiveBlocks = (panel: any): string[] => {
  if ('children' in panel && Array.isArray(panel.children)) {
    return panel.children.flatMap(getActiveBlocks);
  } else if (panel.view === 'block' && panel.viewArgs?.blockId) {
    return [panel.viewArgs.blockId];
  } else if (panel.view === 'journal' && panel.viewState) {
    // For journal views, the active blockId is often stored as a numeric key in viewState
    const blockIds = Object.keys(panel.viewState).filter(k => !isNaN(Number(k)));
    if (blockIds.length > 0) {
      return blockIds;
    }
  }
  return [];
};

export const getFocusedBlock = (panel: any, activePanelId: string | null): number | null => {
  if (!activePanelId || !panel) return null;
  
  if (panel.id === activePanelId) {
    if (panel.view === 'block' && panel.viewArgs?.blockId) {
      return Number(panel.viewArgs.blockId);
    }
    if (panel.view === 'journal' && panel.viewState) {
      const blockIds = Object.keys(panel.viewState).filter(k => !isNaN(Number(k)));
      if (blockIds.length > 0) {
        return Number(blockIds[0]);
      }
    }
    return null;
  }
  
  if (panel.children) {
    for (const child of panel.children) {
      const id = getFocusedBlock(child, activePanelId);
      if (id) return id;
    }
  }
  
  return null;
};

export const findArcTabsPanelId = (panel: any): string | null => {
  if (panel.view === 'arcTabs') {
    return panel.id;
  }
  if (panel.children) {
    for (const child of panel.children) {
      const id = findArcTabsPanelId(child);
      if (id) return id;
    }
  }
  return null;
};

export const findArcTabsPanelWidth = (panel: any): number | null => {
  if (panel.view === 'arcTabs') {
    return panel.width || null;
  }
  if (panel.children) {
    for (const child of panel.children) {
      const w = findArcTabsPanelWidth(child);
      if (w) return w;
    }
  }
  return null;
};

