import { toggleBlockCollapse, removeStackedBlock } from "../utils/state";

export const RoamSidebarItem = ({ blockId, collapsed, panelId: propsPanelId }: { blockId: number; collapsed: boolean; panelId?: string }) => {
  const panelId = propsPanelId || orca.state.activePanel;
  
  const block = orca.state.blocks[blockId];
  const title = block ? (block.text || "Untitled Block") : "Loading...";

  return (
    <div className="roam-sidebar-item">
      <div className="roam-sidebar-item-header">
        <div className="roam-sidebar-item-toggle" onClick={() => toggleBlockCollapse(blockId)}>
          {collapsed ? "▶" : "▼"}
        </div>
        <div className="roam-sidebar-item-title" onClick={() => toggleBlockCollapse(blockId)}>
          {title}
        </div>
        <div className="roam-sidebar-item-close" onClick={() => removeStackedBlock(blockId)}>
          ✕
        </div>
      </div>
      {!collapsed && (
        <div 
          className="roam-sidebar-item-content"
          data-orca-block-root="true"
        >
          <orca.components.Block
            key={`sidebar-block-${blockId}`}
            panelId={panelId}
            blockId={blockId}
            blockLevel={0}
            indentLevel={0}
            renderingMode="normal"
            initiallyCollapsed={false}
          />
        </div>
      )}
    </div>
  );
};
