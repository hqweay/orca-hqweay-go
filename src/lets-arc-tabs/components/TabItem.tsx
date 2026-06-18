import React, { useState } from 'react';
import { pinBlock, unpinBlock, renamePinnedBlock, removeRecentBlock } from '../utils/data';

interface TabItemProps {
  blockId: number;
  title: string;
  isActive: boolean;
  isPinned: boolean;
  activeSpace: string;
  onClick: (blockId: number) => void;
  onPinStateChange?: () => void;
  icon?: string;
}

export const TabItem: React.FC<TabItemProps> = ({ 
  blockId, 
  title, 
  isActive, 
  isPinned, 
  activeSpace, 
  onClick,
  onPinStateChange,
  icon
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handlePinClick = async () => {
    if (!isPinned) {
      await pinBlock(blockId, activeSpace);
      if (onPinStateChange) onPinStateChange();
    }
  };

  const handleUnpinClick = async () => {
    if (isPinned) {
      await unpinBlock(blockId);
      if (onPinStateChange) onPinStateChange();
    }
  };

  const handleCloseClick = () => {
    // 1. Remove from history
    removeRecentBlock(blockId);
    
    // 2. Find if it is open in any editor panel and close it
    const panels = orca.state.panels;
    const findPanelIdByBlockId = (panel: any): string | null => {
      if (panel.view === 'block' && Number(panel.viewArgs?.blockId) === blockId) {
        return panel.id;
      }
      if (panel.children) {
        for (const child of panel.children) {
          const found = findPanelIdByBlockId(child);
          if (found) return found;
        }
      }
      return null;
    };
    
    const panelId = findPanelIdByBlockId(panels);
    if (panelId) {
      orca.nav.close(panelId);
    }
    
    if (onPinStateChange) onPinStateChange();
  };

  const handleRenameClick = () => {
    const newName = window.prompt("Enter new display name for this tab:", title);
    if (newName !== null && newName.trim() !== "") {
      renamePinnedBlock(blockId, newName.trim()).then(() => {
        if (onPinStateChange) onPinStateChange();
      });
    }
  };

  const ContextMenu = orca.components.ContextMenu;
  const Menu = orca.components.Menu;
  const MenuText = orca.components.MenuText;

  return (
    <ContextMenu
      menu={(close) => (
        <Menu>
          {isPinned ? (
            <>
              <MenuText 
                title="Unpin" 
                preIcon="ti ti-pin-off" 
                onClick={() => { close(); handleUnpinClick(); }} 
              />
              <MenuText 
                title="Rename" 
                preIcon="ti ti-edit" 
                onClick={() => { close(); handleRenameClick(); }} 
              />
            </>
          ) : (
            <>
              <MenuText 
                title="Pin to Arc Tabs" 
                preIcon="ti ti-pin" 
                onClick={() => { close(); handlePinClick(); }} 
              />
              <MenuText 
                title="Close Tab" 
                preIcon="ti ti-x" 
                onClick={() => { close(); handleCloseClick(); }} 
              />
            </>
          )}
        </Menu>
      )}
    >
      {(openMenu: any) => (
        <div 
          className={`arc-tab-item ${isActive ? 'active' : ''}`}
          onClick={() => onClick(blockId)}
          onContextMenu={(e: any) => {
            e.preventDefault();
            e.stopPropagation();
            openMenu(e);
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          title={title}
        >
          <span className="arc-tab-icon">{icon || '📄'}</span>
          <span className="arc-tab-title">{title}</span>
          
          {/* Show active dot if active */}
          {isActive && <div className="arc-tab-active-dot" />}
        </div>
      )}
    </ContextMenu>
  );
};
