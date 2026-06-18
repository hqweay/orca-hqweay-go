import React, { useState } from 'react';
import { pinBlock } from '../utils/data';

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

  const handlePinClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPinned) {
      await pinBlock(blockId, activeSpace);
      if (onPinStateChange) onPinStateChange();
    }
  };

  return (
    <div 
      className={`arc-tab-item ${isActive ? 'active' : ''}`}
      onClick={() => onClick(blockId)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={title}
    >
      <span className="arc-tab-icon">{isPinned ? '📌' : '📄'}</span>
      <span className="arc-tab-title">{title}</span>
      
      {/* Show active dot if active */}
      {isActive && <div className="arc-tab-active-dot" />}
      
      {/* Show hover pin button if not pinned and hovered */}
      {!isPinned && isHovered && (
        <div 
          className="arc-tab-pin-action"
          onClick={handlePinClick}
          title="Pin to space"
          style={{ cursor: 'pointer', opacity: 0.7, padding: '0 4px', fontSize: '12px' }}
        >
          📌
        </div>
      )}
    </div>
  );
};
