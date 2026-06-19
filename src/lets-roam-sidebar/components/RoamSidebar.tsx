import { useSnapshot } from "valtio";
import { roamSidebarState, addStackedBlock } from "../utils/state";
import { RoamSidebarItem } from "./RoamSidebarItem";

export const RoamSidebar = ({ panel }: { panel?: any }) => {
  const state = useSnapshot(roamSidebarState);

  const handleDrop = (e: React.DragEvent) => {
    try {
      const types = Array.from(e.dataTransfer.types);
      const orcaCustomType = types.find(t => t.startsWith("orca/"));
      const orcaCustomData = orcaCustomType ? e.dataTransfer.getData(orcaCustomType) : "";
      
      if (!orcaCustomData) {
        // Not dragging an Orca block, let the child editor handle it normally
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      let ids: number[] = [];
      
      if (orcaCustomData) {
        try {
          const parsed = JSON.parse(orcaCustomData);
          if (parsed && Array.isArray(parsed.blocks)) {
            ids = parsed.blocks.map(Number);
          } else if (parsed && parsed.id) {
            ids.push(Number(parsed.id));
          } else if (parsed && parsed.blockId) {
            ids.push(Number(parsed.blockId));
          }
        } catch (e) {
          const numId = Number(orcaCustomData);
          if (!isNaN(numId) && numId > 0) ids.push(numId);
        }
      }
      
      if (ids.length > 0) {
        // Add the first block dragged
        addStackedBlock(ids[0]);
      }
    } catch (err) {
      console.error("Failed to parse dragged block data:", err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types);
    const hasOrcaBlock = types.some(t => t.startsWith("orca/"));
    
    if (hasOrcaBlock) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  return (
    <div
      className="roam-sidebar-container"
      onDropCapture={handleDrop}
      onDragOverCapture={handleDragOver}
    >
      {state.stackedBlocks.length === 0 ? (
        <div className="roam-sidebar-empty">
          <p>Drag and drop blocks here to open in split view</p>
        </div>
      ) : (
        <div className="roam-sidebar-stack">
          {state.stackedBlocks.map((b) => (
            <RoamSidebarItem key={b.id} blockId={b.id} collapsed={b.collapsed} panelId={panel?.id} />
          ))}
          <div className="roam-sidebar-dropzone-footer">
            <p>Drop more blocks here</p>
          </div>
        </div>
      )}
    </div>
  );
};


