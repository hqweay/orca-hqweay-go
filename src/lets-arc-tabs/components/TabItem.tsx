import React, { useState } from 'react';
import { pinBlock, unpinBlock, renamePinnedBlock, removeRecentBlock } from '../utils/data';

interface TabItemProps {
  blockId: number;
  title: string;
  isActive: boolean;
  isPinned: boolean;
  activeSpace: string;
  onClick: (blockId: number) => void;
  icon?: string;
  displayMode?: 'grid' | 'list';
}

export const TabItem: React.FC<TabItemProps> = ({ 
  blockId, 
  title, 
  isActive, 
  isPinned, 
  activeSpace, 
  onClick,
  icon,
  displayMode = 'list'
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handlePinClick = async () => {
    if (!isPinned) {
      await pinBlock(blockId, activeSpace);
    }
  };

  const handleUnpinClick = async () => {
    if (isPinned) {
      await unpinBlock(blockId);
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
  };

  const ContextMenu = orca.components.ContextMenu;
  const Menu = orca.components.Menu;
  const MenuText = orca.components.MenuText;
  const Tooltip = orca.components.Tooltip;
  const Input = orca.components.Input;

  if (displayMode === 'grid') {
    const hasCustomIcon = icon && icon !== '📄';
    const displayIcon = hasCustomIcon ? icon : null;
    const initialText = title ? String(title).trim().substring(0, 1).toUpperCase() : '?';

    return (
      <ContextMenu
        menu={(close) => (
          <Menu>
            <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--orca-color-border-2)", minWidth: "140px" }}>
              <Input
                defaultValue={title}
                autoFocus
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = e.currentTarget.value.trim();
                    if (val) {
                      renamePinnedBlock(blockId, val);
                    }
                    close();
                  } else if (e.key === 'Escape') {
                    close();
                  }
                }}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val) {
                    renamePinnedBlock(blockId, val);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="Rename tab..."
                style={{ width: "100%" }}
              />
            </div>
            <MenuText 
              title="Unpin" 
              preIcon="ti ti-pin-off" 
              onClick={() => { close(); handleUnpinClick(); }} 
            />
          </Menu>
        )}
      >
        {(openMenu: any) => (
          <Tooltip text={title}>
            <div 
              className={`arc-tab-grid-item ${isActive ? 'active' : ''}`}
              onClick={() => onClick(blockId)}
              onContextMenu={(e: any) => {
                e.preventDefault();
                e.stopPropagation();
                openMenu(e);
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {displayIcon ? displayIcon : <span className="arc-tab-initial">{initialText}</span>}
            </div>
          </Tooltip>
        )}
      </ContextMenu>
    );
  }

  return (
    <ContextMenu
      menu={(close) => (
        <Menu>
          {isPinned ? (
            <>
              <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--orca-color-border-2)", minWidth: "140px" }}>
                <Input
                  defaultValue={title}
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = e.currentTarget.value.trim();
                      if (val) {
                        renamePinnedBlock(blockId, val);
                      }
                      close();
                    } else if (e.key === 'Escape') {
                      close();
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val) {
                      renamePinnedBlock(blockId, val);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Rename tab..."
                  style={{ width: "100%" }}
                />
              </div>
              <MenuText 
                title="Unpin" 
                preIcon="ti ti-pin-off" 
                onClick={() => { close(); handleUnpinClick(); }} 
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
        <Tooltip text={title}>
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
          >
            <span className="arc-tab-icon">{icon || '📄'}</span>
            <span className="arc-tab-title">{title}</span>
            
            {/* Show active dot if active */}
            {isActive && <div className="arc-tab-active-dot" />}
          </div>
        </Tooltip>
      )}
    </ContextMenu>
  );
};
