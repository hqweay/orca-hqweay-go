import React, { useMemo, useState } from 'react';
import { useSnapshot } from 'valtio';
import { t } from '@/libs/l10n';
import styles from '../styles.css?inline';

// We inject styles here if using the ?inline approach to avoid require errors
const StyleInjector = () => (
  <style dangerouslySetInnerHTML={{ __html: styles }} />
);

export const ArcSidebar: React.FC = () => {
  const state = useSnapshot(orca.state);
  
  // A simple way to manage Space state locally for now
  // Ideally this would be saved in the Plugin settings
  const [activeSpace, setActiveSpace] = useState('default');
  
  // Extract currently active blocks from panels tree
  const activeBlockIds = useMemo(() => {
    const getActiveBlocks = (panel: any): string[] => {
      if ('children' in panel && Array.isArray(panel.children)) {
        return panel.children.flatMap(getActiveBlocks);
      } else if (panel.view === 'block' && panel.viewArgs?.blockId) {
        return [panel.viewArgs.blockId];
      }
      return [];
    };
    return getActiveBlocks(state.panels);
  }, [state.panels]);

  // Extract Today Tabs from panel history
  const todayTabs = useMemo(() => {
    const historyBlocks: string[] = [];
    
    // Add current active blocks first
    activeBlockIds.forEach(id => {
      if (!historyBlocks.includes(id)) {
        historyBlocks.push(id);
      }
    });
    
    // Add from back history
    [...state.panelBackHistory].reverse().forEach(history => {
      if (history.view === 'block' && history.viewArgs?.blockId) {
        const id = history.viewArgs.blockId;
        if (!historyBlocks.includes(id)) {
          historyBlocks.push(id);
        }
      }
    });
    
    // For now we limit to 10 recent tabs
    return historyBlocks.slice(0, 10);
  }, [state.panelBackHistory, activeBlockIds]);

  const handleTabClick = (blockId: string) => {
    // Find a main editor panel (block or journal view) to open the tab in
    const findMainPanelId = (panel: any): string | null => {
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

    const mainPanelId = findMainPanelId(state.panels);
    
    if (mainPanelId) {
      orca.nav.goTo('block', { blockId }, mainPanelId);
    } else {
      // Fallback: if no main panel exists, maybe add to the right of the sidebar
      const sidebarPanelId = orca.state.activePanel; // Assuming clicking here makes it active
      orca.nav.addTo(sidebarPanelId, 'right', { view: 'block', viewArgs: { blockId } });
    }
  };

  return (
    <div className="arc-sidebar-container">
      <StyleInjector />
      
      <div className="arc-sidebar-header">
        <input 
          className="arc-sidebar-search" 
          placeholder={t("arcTabs.search")} 
          onClick={() => {
            // Open global search or command palette
            orca.commands.invokeCommand('core.toggleCommandPalette');
          }}
          readOnly
        />
      </div>

      <div className="arc-sidebar-content">
        {/* Pinned Tabs Section - Placeholder for now, could be loaded from plugin settings */}
        <div className="arc-sidebar-section">
          <div className="arc-sidebar-section-title">{t("arcTabs.pinned")}</div>
          <div className="arc-tab-item">
            <span className="arc-tab-icon">📌</span>
            <span className="arc-tab-title">Welcome Note</span>
          </div>
        </div>

        {/* Today Tabs Section */}
        <div className="arc-sidebar-section">
          <div className="arc-sidebar-section-title">{t("arcTabs.today")}</div>
          {todayTabs.map(blockId => {
            const block = state.blocks[blockId];
            const isActive = activeBlockIds.includes(blockId);
            // Rough title extraction, a real implementation might use an Orca helper to format block title
            const title = block?.text || `Block ${blockId.substring(0, 8)}`;
            
            return (
              <div 
                key={blockId} 
                className={`arc-tab-item ${isActive ? 'active' : ''}`}
                onClick={() => handleTabClick(blockId)}
              >
                <span className="arc-tab-icon">📄</span>
                <span className="arc-tab-title">{title}</span>
                {isActive && <div className="arc-tab-active-dot" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="arc-sidebar-footer">
        <div 
          className={`arc-space-item ${activeSpace === 'default' ? 'active' : ''}`}
          title={t("arcTabs.defaultSpace")}
          onClick={() => setActiveSpace('default')}
        >
          P
        </div>
        <div className="arc-space-item" title={t("arcTabs.newSpace")}>
          +
        </div>
      </div>
    </div>
  );
};
