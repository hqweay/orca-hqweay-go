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

export const getActiveBlocks = (panel: any, excludeIds?: Set<number>): string[] => {
  if ('children' in panel && Array.isArray(panel.children)) {
    return panel.children.flatMap(child => getActiveBlocks(child, excludeIds));
  } else if (panel.view === 'block' && panel.viewArgs?.blockId) {
    const id = Number(panel.viewArgs.blockId);
    if (excludeIds && excludeIds.has(id)) return [];
    return [panel.viewArgs.blockId];
  } else if (panel.view === 'journal' && panel.viewState) {
    const blockIds = Object.keys(panel.viewState)
      .filter(k => !isNaN(Number(k)))
      .filter(k => !excludeIds || !excludeIds.has(Number(k)));
    if (blockIds.length > 0) {
      return blockIds;
    }
  }
  return [];
};

export const getFocusedBlock = (panel: any, activePanelId: string | null, excludeIds?: Set<number>): number | null => {
  if (!activePanelId || !panel) return null;
  
  if (panel.id === activePanelId) {
    if (panel.view === 'block' && panel.viewArgs?.blockId) {
      const id = Number(panel.viewArgs.blockId);
      if (excludeIds && excludeIds.has(id)) return null;
      return id;
    }
    if (panel.view === 'journal' && panel.viewState) {
      const blockIds = Object.keys(panel.viewState)
        .filter(k => !isNaN(Number(k)))
        .filter(k => !excludeIds || !excludeIds.has(Number(k)));
      if (blockIds.length > 0) {
        return Number(blockIds[0]);
      }
    }
    return null;
  }
  
  if (panel.children) {
    for (const child of panel.children) {
      const id = getFocusedBlock(child, activePanelId, excludeIds);
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

