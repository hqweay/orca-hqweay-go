import { BasePlugin } from "../libs/BasePlugin";
import { RoamSidebarRenderer } from "./components/RoamSidebarRenderer";
import applyCSSRule, { removeCSSRule } from "@/libs/styleUtil";
import "./styles.css";

const RENDERER_TYPE = "roam-sidebar";

export default class RoamSidebarPlugin extends BasePlugin {
  protected headbarButtonId = "lets-roam-sidebar.toggle";

  async load() {
    // Hide unnecessary editor UI for this renderer
    applyCSSRule(
      `
        div[repr="roam-sidebar"] .orca-block-editor-none-editable,
        div[repr="roam-sidebar"] .orca-block-editor-go-btns,
        div[repr="roam-sidebar"] ~ .orca-block-editor-go-btns,
        div[repr="roam-sidebar"] ~ .orca-block-editor-sidetools {
          display: none;
        }
        div[repr="roam-sidebar"] .orca-block-editor {
          padding-left: 0 !important;
          padding-right: 0 !important;
          max-width: 100% !important;
          margin: 0 !important;
        }
        `,
      { id: RENDERER_TYPE },
    );

    // Register block renderer
    if (!orca.state.blockRenderers[RENDERER_TYPE]) {
      orca.renderers.registerBlock(
        RENDERER_TYPE,
        false,
        RoamSidebarRenderer,
        [],
        false,
      );
    }

    orca.converters.registerBlock("plain", RENDERER_TYPE, (block, repr) => {
      return "[]";
    });

    // Register command to open roam sidebar in left panel
    orca.commands.registerCommand(
      "lets-roam-sidebar.toggle",
      async () => {
        // Find existing roam-sidebar panel
        const findPanelWithView = (panel: any, viewName: string, reprName: string): any => {
          if (panel.view === viewName && panel.viewArgs?.repr === reprName) return panel;
          if (panel.children) {
            for (const child of panel.children) {
              const found = findPanelWithView(child, viewName, reprName);
              if (found) return found;
            }
          }
          return null;
        };

        const existingPanel = findPanelWithView(
          orca.state.panels,
          "block",
          RENDERER_TYPE
        );
        if (existingPanel) {
          orca.nav.close(existingPanel.id);
          return;
        }

        // Find or create roam-sidebar block
        let targetBlockId: number | null = await orca.plugins.getData("lets-roam-sidebar", "globalBlockId");
        
        if (!targetBlockId) {
          const blocks = await orca.invokeBackend("get-blocks-with-tags", [
            RENDERER_TYPE,
          ]);

          if (blocks && blocks.length > 0) {
            targetBlockId = Number(blocks[0].id);
            await orca.plugins.setData("lets-roam-sidebar", "globalBlockId", targetBlockId);
          } else {
            targetBlockId = (await orca.commands.invokeEditorCommand(
              "core.editor.insertBlock",
              null,
              null,
              "lastChild",
              [{ t: "t", v: "Roam Sidebar" }],
              { type: "text" },
            )) as number;
          }

          if (targetBlockId) {
            await orca.plugins.setData("lets-roam-sidebar", "globalBlockId", targetBlockId);
            
            await orca.commands.invokeEditorCommand(
              "core.editor.createAlias",
              null,
              RENDERER_TYPE,
              targetBlockId,
              true,
            );

            await orca.commands.invokeEditorCommand(
              "core.editor.setProperties",
              null,
              [targetBlockId],
              [{ name: "_repr", type: 0, value: { type: RENDERER_TYPE } }],
            );
          }
        }

        if (targetBlockId) {
          // Open as left panel
          const activePanelId = orca.state.activePanel;
          const newPanelId = orca.nav.addTo(activePanelId, "right", {
            view: "block",
            viewArgs: { blockId: targetBlockId, repr: RENDERER_TYPE },
            viewState: {},
            locked: true,
          } as any);
        }
      },
      "Toggle Roam Sidebar",
    );

    // Register editor sidetool (right side button)
    orca.editorSidetools.registerEditorSidetool("lets-roam-sidebar.sidetool", {
      render: (_rootBlockId, _panelId) => {
        return (
          <orca.components.Button
            variant="plain"
            title="Roam Sidebar"
            onClick={() =>
              orca.commands.invokeCommand("lets-roam-sidebar.toggle")
            }
            className="orca-block-editor-sidetools-btn"
          >
            <i
              className="ti ti-layout-sidebar-right"
              style={{ fontSize: "16px" }}
            />
          </orca.components.Button>
        );
      },
    });
  }

  async unload() {
    orca.commands.unregisterCommand("lets-roam-sidebar.toggle");
    orca.editorSidetools.unregisterEditorSidetool("lets-roam-sidebar.sidetool");
    if (orca.state.blockRenderers[RENDERER_TYPE]) {
      orca.renderers.unregisterBlock(RENDERER_TYPE);
    }
    removeCSSRule(RENDERER_TYPE);
  }
}
