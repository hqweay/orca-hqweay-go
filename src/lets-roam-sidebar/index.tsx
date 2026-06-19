import { BasePlugin } from "../libs/BasePlugin";
import { RoamSidebar } from "./components/RoamSidebar";
import "./styles.css";

export default class RoamSidebarPlugin extends BasePlugin {
  protected headbarButtonId = "lets-roam-sidebar.toggle";

  async load() {
    // Register the native panel
    orca.panels.registerPanel("roamSidebar", RoamSidebar);

    // Register a command to open it
    orca.commands.registerCommand(
      "lets-roam-sidebar.toggle",
      () => {
        // Find if it's already open
        const findPanelWithView = (panel: any, viewName: string): any => {
          if (panel.view === viewName) return panel;
          if (panel.children) {
            for (const child of panel.children) {
              const found = findPanelWithView(child, viewName);
              if (found) return found;
            }
          }
          return null;
        };

        const existingPanel = findPanelWithView(orca.state.panels, "roamSidebar");
        if (existingPanel) {
          // If already open, close it
          orca.nav.close(existingPanel.id);
        } else {
          // Open it to the right of the active panel
          const newPanelId = orca.nav.addTo(orca.state.activePanel, "right", {
            view: "roamSidebar",
            viewArgs: {},
            viewState: {},
            locked: true,
          } as any);

          if (newPanelId) {
            setTimeout(() => {
              // Usually left panel 75%, right sidebar 25%
              orca.nav.changeSizes(newPanelId, [window.innerWidth - 300, 300]);
            }, 50);
          }
        }
      },
      "Toggle Roam Sidebar"
    );

    // Register the editor sidetool (button on the right of the editor)
    orca.editorSidetools.registerEditorSidetool("lets-roam-sidebar.sidetool", {
      render: (_rootBlockId, panelId) => {
        return (
          <orca.components.Button
            variant="plain"
            title="Toggle Roam Sidebar"
            onClick={() => orca.commands.invokeCommand("lets-roam-sidebar.toggle")}
            className="orca-block-editor-sidetools-btn"
          >
            <i className="ti ti-layout-sidebar-right" style={{ fontSize: "16px" }} />
          </orca.components.Button>
        );
      },
    });
  }

  async unload() {
    orca.commands.unregisterCommand("lets-roam-sidebar.toggle");
    orca.editorSidetools.unregisterEditorSidetool("lets-roam-sidebar.sidetool");
  }
}
