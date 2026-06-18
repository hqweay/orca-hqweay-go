import React, { useState } from 'react';
import { pinBlock, unpinBlock, renamePinnedBlock } from '../utils/data';

interface TabItemProps {
  blockId: string;
  title: string;
  isActive: boolean;
  isPinned: boolean;
  activeSpace: string;
  onClick: (blockId: string) => void;
  onPinStateChange?: () => void; // Called when successfully pinned
}

export const TabItem: React.FC<TabItemProps> = ({ 
  blockId, 
  title, 
  isActive, 
  isPinned, 
  activeSpace, 
  onClick,
  onPinStateChange 
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
            <MenuText 
              title="Pin to Arc Tabs" 
              preIcon="ti ti-pin" 
              onClick={() => { close(); handlePinClick(); }} 
            />
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
          <span className="arc-tab-icon">{isPinned ? '📌' : '📄'}</span>
          <span className="arc-tab-title">{title}</span>
          
          {/* Show active dot if active */}
          {isActive && <div className="arc-tab-active-dot" />}
        </div>
      )}
    </ContextMenu>
  );
};
