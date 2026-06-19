import { useSnapshot } from "valtio";
import { roamSidebarState, addStackedBlock, toggleBlockCollapse, removeStackedBlock } from "../utils/state";

interface RendererProps {
  panelId: string;
  blockId: number;
  rndId: string;
  blockLevel: number;
  indentLevel: number;
}

export const RoamSidebarRenderer = (props: RendererProps) => {
  const { panelId } = props;
  const state = useSnapshot(roamSidebarState);
  const Block = orca.components.Block;

  const handleDrop = (e: React.DragEvent) => {
    try {
      const types = Array.from(e.dataTransfer.types);
      
      // Try multiple data formats
      const textData = e.dataTransfer.getData("text/plain");
      const jsonData = e.dataTransfer.getData("application/json");
      const orcaBlocks = e.dataTransfer.getData("application/x-orca-blocks");
      const orcaCustomType = types.find(t => t.startsWith("orca/"));
      const orcaCustomData = orcaCustomType ? e.dataTransfer.getData(orcaCustomType) : "";

      const data = jsonData || orcaBlocks || orcaCustomData || textData;
      if (!data) return;

      e.preventDefault();
      e.stopPropagation();

      let ids: number[] = [];

      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        parsed = data;
      }

      if (typeof parsed === "object" && parsed !== null) {
        if (parsed.id) ids.push(Number(parsed.id));
        else if (Array.isArray(parsed.blockIds)) ids = parsed.blockIds.map(Number);
        else if (Array.isArray(parsed.blocks)) ids = parsed.blocks.map(Number);
        else if (Array.isArray(parsed) && parsed[0]?.id) ids = parsed.map((b: any) => Number(b.id));
      } else if (typeof parsed === "string") {
        const numId = Number(parsed);
        if (!isNaN(numId) && numId > 0) ids.push(numId);
      }

      if (ids.length > 0) {
        ids.forEach(id => {
          if (!isNaN(id) && id > 0) addStackedBlock(id);
        });
      }
    } catch (err) {
      console.error("Failed to parse dragged block data:", err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  return (
    <div
      className="roam-sidebar-renderer"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {state.stackedBlocks.length === 0 ? (
        <div className="roam-sidebar-empty">
          Drag and drop blocks here to open in split view
        </div>
      ) : (
        <div className="roam-sidebar-stack">
          {state.stackedBlocks.map((b) => (
            <div key={b.id} className="roam-sidebar-item">
              <div className="roam-sidebar-item-header">
                <div
                  className="roam-sidebar-item-toggle"
                  onClick={() => toggleBlockCollapse(b.id)}
                >
                  {b.collapsed ? "▶" : "▼"}
                </div>
                <div
                  className="roam-sidebar-item-title"
                  onClick={() => toggleBlockCollapse(b.id)}
                >
                  {orca.state.blocks[b.id]?.text || `Block ${b.id}`}
                </div>
                <div
                  className="roam-sidebar-item-close"
                  onClick={() => removeStackedBlock(b.id)}
                >
                  ✕
                </div>
              </div>
              {!b.collapsed && (
                <div className="roam-sidebar-item-content" data-orca-block-root="true">
                  <Block
                    key={`roam-block-${b.id}`}
                    panelId={panelId}
                    blockId={b.id}
                    blockLevel={0}
                    indentLevel={0}
                    renderingMode="normal"
                    initiallyCollapsed={false}
                  />
                </div>
              )}
            </div>
          ))}
          <div className="roam-sidebar-dropzone-footer">
            Drop more blocks here
          </div>
        </div>
      )}
    </div>
  );
};
