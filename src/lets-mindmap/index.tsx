import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import React, { useEffect, useRef, useState } from "react";
import { Markmap } from "markmap-view";

const RENDERER_TYPE = "lets-mindmap-view";

export default class MindmapPlugin extends BasePlugin {
  public async load(): Promise<void> {
    // 1. Register Renderer
    orca.renderers.registerBlock(RENDERER_TYPE, true, MindmapRenderer);

    // 2. Register Context Menu Action
    if (
      orca.blockMenuCommands &&
      orca.blockMenuCommands.registerBlockMenuCommand
    ) {
      orca.blockMenuCommands.registerBlockMenuCommand(
        `${this.name}.view-as-mindmap`,
        {
          worksOnMultipleBlocks: false,
          render: (
            blockId: number,
            rootBlockId: number,
            closeMenu: () => void,
          ) => {
            return (
              <orca.components.MenuText
                key="view-as-mindmap"
                preIcon="ti ti-sitemap"
                title={t("View as Mind Map")}
                onClick={async () => {
                  closeMenu();
                  const block: any = orca.state.blocks[blockId];
                  if (!block) return;
                  const repr = block._repr || {};

                  await orca.commands.invokeEditorCommand(
                    "core.editor.setProperties",
                    null,
                    [blockId],
                    [
                      {
                        name: "_repr",
                        type: 0, // Text/JSON type
                        value: { ...repr, type: RENDERER_TYPE },
                      },
                    ],
                  );
                }}
              />
            );
          },
        },
      );
    }

    this.logger.info("Mindmap Plugin loaded");
  }

  public async unload(): Promise<void> {
    orca.renderers.unregisterBlock(RENDERER_TYPE);
    if (
      orca.blockMenuCommands &&
      orca.blockMenuCommands.unregisterBlockMenuCommand
    ) {
      orca.blockMenuCommands.unregisterBlockMenuCommand(
        `${this.name}.view-as-mindmap`,
      );
    }
    this.logger.info("Mindmap Plugin unloaded");
  }
}

// Custom Renderer Component
function MindmapRenderer(props: any) {
  const { blockId, panelId, rndId, blockLevel, indentLevel } = props;
  const { useSnapshot } = (window as any).Valtio;
  const block = useSnapshot(orca.state.blocks[blockId]);

  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);

  const getBlockText = (block: any): string => {
    if (!block || !block.content) return "";
    if (typeof block.content === "string") return block.content;
    if (Array.isArray(block.content)) {
      return block.content.map((f: any) => f.v || "").join("");
    }
    return "";
  };

  // Helper to build the tree data for Markmap
  const buildTree = (id: number): any => {
    // We intentionally don't use the snapshot here for deep children to avoid excessive re-renders,
    // we just read the current state.
    const b = orca.state.blocks[id];
    if (!b) return null;

    let content = getBlockText(b);

    const children = [];
    if (b.children && b.children.length > 0) {
      for (const childId of b.children) {
        const childNode = buildTree(childId);
        if (childNode) children.push(childNode);
      }
    }

    return {
      content,
      payload: { id },
      children,
    };
  };

  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Proactively fetch the full block tree just in case the deep descendants haven't
    // been loaded into the global Valtio state yet (e.g., on fresh page load)
    const hydrateTree = async () => {
      try {
        const blocks = await orca.invokeBackend("get-block-tree", blockId);
        if (blocks && Array.isArray(blocks)) {
          // Ensure they are strictly present in Valtio state
          for (const b of blocks) {
            if (!orca.state.blocks[b.id]) {
              orca.state.blocks[b.id] = b;
            }
          }
        }
      } catch (err) {
        console.warn("Lets-Mindmap: Failed to fetch full block tree", err);
      } finally {
        setIsHydrated(true);
      }
    };
    hydrateTree();
  }, [blockId]);

  useEffect(() => {
    if (!isHydrated) return;

    if (svgRef.current) {
      if (!markmapRef.current) {
        markmapRef.current = Markmap.create(svgRef.current, {
          autoFit: true,
          fitRatio: 0.85,
          paddingX: 16,
        });
      }

      const rootNode = buildTree(blockId);
      if (rootNode) {
        markmapRef.current.setData(rootNode);
        markmapRef.current.fit();
      }
    }
  }, [blockId, block.children, block.content, isHydrated]); // Re-render if root block's children or content changes

  // Exit Mindmap mode
  const exitMindmap = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const repr = block._repr || {};
    // Remove the custom type to revert to text
    const newRepr = { ...repr };
    delete newRepr.type;

    await orca.commands.invokeEditorCommand(
      "core.editor.setProperties",
      null,
      [blockId],
      [
        {
          name: "_repr",
          type: 0,
          value: { ...repr, type: "text" },
        },
      ],
    );
  };

  const contentJsx = (
    <div
      onClick={(e) => {
        // Stop clicks from reaching the block shell and putting it into edit mode!
        e.stopPropagation();
      }}
      style={{
        position: "relative",
        width: "100%",
        height: "500px",
        background: "var(--b3-theme-surface)",
        border: "1px solid var(--b3-theme-surface-lighter)",
        borderRadius: "8px",
        overflow: "hidden",
        margin: "10px 0",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <svg
        ref={svgRef}
        style={{ width: "100%", height: "100%", cursor: "crosshair" }}
      />

      {/* Floating Action Button to Exit */}
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          right: "16px",
          zIndex: 10,
        }}
      >
        <orca.components.Button variant="solid" onClick={exitMindmap}>
          <i className="ti ti-edit" style={{ marginRight: "4px" }} />
          {t("Exit Mind Map")}
        </orca.components.Button>
      </div>
    </div>
  );

  return (
    <orca.components.BlockShell
      panelId={panelId}
      blockId={blockId}
      rndId={rndId}
      blockLevel={blockLevel}
      indentLevel={indentLevel}
      contentJsx={contentJsx}
      childrenJsx={<div />}
      contentAttrs={{ contentEditable: false }}
      // droppable={true}
      renderingMode="normal"
    />
  );
}
