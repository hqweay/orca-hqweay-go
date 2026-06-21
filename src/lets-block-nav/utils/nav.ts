export const findMainPanelId = (panel: any, activePanelId?: string | null): string | null => {
  if (!panel) return null;
  if (panel.locked) return null;
  if (activePanelId) {
    const findActive = (p: any): string | null => {
      if (!p) return null;
      if (p.locked) return null;
      if (p.id === activePanelId && (p.view === 'block' || p.view === 'journal')) return p.id;
      if (p.children && Array.isArray(p.children)) {
        for (const child of p.children) {
          const id = findActive(child);
          if (id) return id;
        }
      }
      return null;
    };
    const activeId = findActive(panel);
    if (activeId) return activeId;
  }

  if (panel.view === 'block' || panel.view === 'journal') {
    return panel.id;
  }
  
  if (panel.children && Array.isArray(panel.children)) {
    if ('activeChildIndex' in panel && typeof panel.activeChildIndex === 'number') {
      const activeChild = panel.children[panel.activeChildIndex];
      if (activeChild) {
        const id = findMainPanelId(activeChild, activePanelId);
        if (id) return id;
      }
    }
    
    for (let i = 0; i < panel.children.length; i++) {
      const id = findMainPanelId(panel.children[i], activePanelId);
      if (id) return id;
    }
  }
  return null;
};

export const isEditorPanel = (panel: any, panelId: string): boolean => {
  if (!panel) return false;
  if (panel.id === panelId) {
    return panel.view === 'block' || panel.view === 'journal';
  }
  if (panel.children && Array.isArray(panel.children)) {
    for (const child of panel.children) {
      if (isEditorPanel(child, panelId)) return true;
    }
  }
  return false;
};

export const getActiveBlocks = (panel: any): string[] => {
  if (panel.locked) return [];
  if ('children' in panel && Array.isArray(panel.children)) {
    return panel.children.flatMap(getActiveBlocks);
  } else if (panel.view === 'block' && panel.viewArgs?.blockId) {
    return [panel.viewArgs.blockId];
  } else if (panel.view === 'journal' && panel.viewState) {
    const blockIds = Object.keys(panel.viewState).filter(k => !isNaN(Number(k)));
    if (blockIds.length > 0) {
      return [blockIds[0]];
    }
  }
  return [];
};

export const getFocusedBlock = (panel: any, activePanelId: string | null): number | null => {
  if (!activePanelId || !panel) return null;
  if (panel.locked) return null;
  
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
