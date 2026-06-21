import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { BlockNavPanel } from "./components/BlockNavPanel";
import applyCSSRule, { removeCSSRule } from "@/libs/styleUtil";
import "./styles.css";

const PLUGIN_NAME = "lets-block-nav";
const PANEL_WIDTH = 250;

export default class BlockNavPlugin extends BasePlugin {
  protected headbarButtonId = `${this.name}.block-nav`;

  async load() {
    applyCSSRule(
      `
        .block-nav-panel-wrapper {
          width: ${PANEL_WIDTH}px !important;
          min-width: ${PANEL_WIDTH}px !important;
          max-width: ${PANEL_WIDTH}px !important;
        }
      `,
      { id: PLUGIN_NAME }
    );

    orca.panels.registerPanel("blockNav", BlockNavPanel);

    orca.commands.registerCommand(
      `${this.name}.open`,
      () => {
        const existingPanel = this.findNavPanel();
        if (existingPanel) {
          orca.nav.close(existingPanel.id);
          return;
        }

        const activePanelId = orca.state.activePanel;
        if (!activePanelId) return;

        const newPanelId = orca.nav.addTo(activePanelId, "left", {
          view: "blockNav",
          viewArgs: {},
          viewState: {},
          locked: true,
        } as any);

        if (newPanelId) {
          const width = PANEL_WIDTH;
          orca.nav.changeSizes(newPanelId, [width, window.innerWidth - width]);
        }
      },
      t(`${this.name}.description`)
    );

    orca.editorSidetools.registerEditorSidetool(`${this.name}.sidetool`, {
      render: (_rootBlockId, _panelId) => {
        return (
          <orca.components.Button
            variant="plain"
            title={t(this.name)}
            onClick={() => orca.commands.invokeCommand(`${this.name}.open`)}
            className="orca-block-editor-sidetools-btn"
          >
            <i className="ti ti-tree" style={{ fontSize: "16px" }} />
          </orca.components.Button>
        );
      },
    });

    this.logger.info(`${this.name} loaded.`);
  }

  async unload() {
    orca.commands.unregisterCommand(`${this.name}.open`);
    orca.editorSidetools.unregisterEditorSidetool(`${this.name}.sidetool`);
    orca.panels.unregisterPanel("blockNav");
    removeCSSRule(PLUGIN_NAME);
    this.logger.info(`${this.name} unloaded.`);
  }

  renderHeadbarButton() {
    const Button = orca.components.Button;
    return (
      <Button
        variant="plain"
        title={t(`${this.name}.description`)}
        onClick={() => orca.commands.invokeCommand(`${this.name}.open`)}
      >
        <i className="ti ti-tree" style={{ fontSize: "16px" }} />
      </Button>
    );
  }

  private findNavPanel(): any | null {
    const findPanel = (panel: any): any | null => {
      if (panel.view === "blockNav") return panel;
      if (panel.children) {
        for (const child of panel.children) {
          const found = findPanel(child);
          if (found) return found;
        }
      }
      return null;
    };
    return findPanel(orca.state.panels);
  }
}
