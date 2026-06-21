import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { BlockNavPanel } from "./components/BlockNavPanel";
import applyCSSRule, { removeCSSRule } from "@/libs/styleUtil";
import "./styles.css";

import { injectLeftHeadbarButton, removeLeftHeadbarButton } from "@/libs/utils";

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
      (overrideSide?: "left" | "right") => {
        const existingPanel = this.findNavPanel();
        if (existingPanel) {
          orca.nav.close(existingPanel.id);
          return;
        }

        const defaultSide = this.getSettings()?.sidebarPosition || "left";
        const side = overrideSide || defaultSide;

        const getTargetPanelId = (panel: any, targetSide: "left" | "right"): string => {
          if (panel.view) return panel.id;
          if (panel.children && panel.children.length > 0) {
            const childIndex = targetSide === "left" ? 0 : panel.children.length - 1;
            return getTargetPanelId(panel.children[childIndex], targetSide);
          }
          return panel.id;
        };

        const targetPanelId = orca.state.panels ? getTargetPanelId(orca.state.panels, side) : orca.state.activePanel;
        if (!targetPanelId) return;

        const newPanelId = orca.nav.addTo(targetPanelId, side, {
          view: "blockNav",
          viewArgs: {},
          viewState: {},
          locked: true,
        } as any);

        if (newPanelId) {
          const width = PANEL_WIDTH;
          orca.nav.changeSizes(newPanelId, side === "left" ? [width, window.innerWidth - width] : [window.innerWidth - width, width]);
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

    injectLeftHeadbarButton(
      this.name,
      "ti ti-tree",
      t(`${this.name}.description`),
      (e: MouseEvent) => {
        const defaultSide = this.getSettings()?.sidebarPosition || "left";
        const oppositeSide = defaultSide === "left" ? "right" : "left";
        if (e.shiftKey) {
          orca.commands.invokeCommand(`${this.name}.open`, oppositeSide);
        } else {
          orca.commands.invokeCommand(`${this.name}.open`);
        }
      },
      (e: MouseEvent) => {
        const defaultSide = this.getSettings()?.sidebarPosition || "left";
        const oppositeSide = defaultSide === "left" ? "right" : "left";
        orca.commands.invokeCommand(`${this.name}.open`, oppositeSide);
      }
    );

    this.logger.info(`${this.name} loaded.`);
  }

  protected syncHeadbar() {
    // Override BasePlugin to avoid registering on the right side
  }

  async unload() {
    removeLeftHeadbarButton(this.name);
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

  renderCustomSettings(settings: any, updateSettings: (val: any) => void) {
    const { SettingsSection, SettingsItem } = orca.components;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <SettingsSection title={t(`${this.name}.settings`) || "Block Nav Settings"}>
          <SettingsItem
            label={t(`${this.name}.sidebarPosition`) || "Sidebar Position"}
            description={t(`${this.name}.sidebarPositionDesc`) || "Default side to open the Block Nav panel. Right-click the button to open on the opposite side."}
          >
            <orca.components.Select
              selected={[settings.sidebarPosition || "left"]}
              options={[
                { value: "left", label: "Left" },
                { value: "right", label: "Right" },
              ]}
              onChange={(selected) =>
                updateSettings({ sidebarPosition: selected[0] })
              }
              width="100%"
            />
          </SettingsItem>
        </SettingsSection>
      </div>
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
