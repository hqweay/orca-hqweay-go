import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import { BlockNavPanel } from "./components/BlockNavPanel";
import applyCSSRule, { removeCSSRule } from "@/libs/styleUtil";
import "./styles.css";
import { blockNavState } from "./utils/state";

import { injectLeftHeadbarButton, removeLeftHeadbarButton } from "@/libs/utils";

const PLUGIN_NAME = "lets-block-nav";
export const TOC_CSS_ID = `${PLUGIN_NAME}-hide-toc`;

export let blockNavPluginInstance: BlockNavPlugin | null = null;

export default class BlockNavPlugin extends BasePlugin {
  constructor(orca: any, initSettings?: any) {
    super(orca, initSettings);
    blockNavPluginInstance = this;
  }

  // protected headbarButtonId = `${this.name}.block-nav`;

  async load() {
    blockNavState.hideBuiltInToc = this.getSettings()?.hideBuiltInToc ?? false;
    const initialWidth = this.getSettings()?.sidebarWidth || 250;
    applyCSSRule(
      `
        .block-nav-panel-wrapper {
          width: ${initialWidth}px !important;
          min-width: ${initialWidth}px !important;
          max-width: ${initialWidth}px !important;
        }
      `,
      { id: PLUGIN_NAME },
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

        const getTargetPanelId = (
          panel: any,
          targetSide: "left" | "right",
        ): string => {
          if (panel.view) return panel.id;
          if (panel.children && panel.children.length > 0) {
            const childIndex =
              targetSide === "left" ? 0 : panel.children.length - 1;
            return getTargetPanelId(panel.children[childIndex], targetSide);
          }
          return panel.id;
        };

        const targetPanelId = orca.state.panels
          ? getTargetPanelId(orca.state.panels, side)
          : orca.state.activePanel;
        if (!targetPanelId) return;

        const newPanelId = orca.nav.addTo(targetPanelId, side, {
          view: "blockNav",
          viewArgs: {},
          viewState: {},
          locked: true,
        } as any);

        if (newPanelId) {
          const width = this.getSettings()?.sidebarWidth || 250;
          orca.nav.changeSizes(
            newPanelId,
            side === "left"
              ? [width, window.innerWidth - width]
              : [window.innerWidth - width, width],
          );
        }
      },
      t(`${this.name}.description`),
    );

    injectLeftHeadbarButton(
      this.name,
      "ti ti-list-details",
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
      },
    );

    this.logger.info(`${this.name} loaded.`);
  }

  protected syncHeadbar() {
    // Override BasePlugin to avoid registering on the right side
  }

  getDefaultSettings() {
    return {
      sidebarPosition: "left",
      sidebarWidth: 250,
      hideBuiltInToc: false,
    };
  }

  protected async onConfigChanged(newConfig: any) {
    await super.onConfigChanged(newConfig);
    blockNavState.hideBuiltInToc = newConfig.hideBuiltInToc ?? false;
  }

  async unload() {
    removeLeftHeadbarButton(this.name);
    orca.commands.unregisterCommand(`${this.name}.open`);

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
        <i className="ti ti-list-details" style={{ fontSize: "16px" }} />
      </Button>
    );
  }

  renderCustomSettings(settings: any, updateSettings: (val: any) => void) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <SettingsSection
          title={t(`${this.name}.settings`) || "Block Nav Settings"}
        >
          <SettingsItem
            label={t(`${this.name}.sidebarPosition`) || "Sidebar Position"}
            description={
              t(`${this.name}.sidebarPositionDesc`) ||
              "Default side to open the Block Nav panel. Right-click the button to open on the opposite side."
            }
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
          <SettingsItem
            label={t(`${this.name}.sidebarWidth`) || "Sidebar Width"}
            description={
              t(`${this.name}.sidebarWidthDesc`) ||
              "Width of the Block Nav sidebar in pixels."
            }
          >
            <orca.components.Input
              type="number"
              value={settings.sidebarWidth || 250}
              onChange={(e: any) =>
                updateSettings({ sidebarWidth: Number(e.target.value) })
              }
            />
          </SettingsItem>
          <SettingsItem
            label={t(`${this.name}.hideBuiltInToc`) || "Hide Built-in TOC"}
            description={
              t(`${this.name}.hideBuiltInTocDesc`) ||
              "Hide Orca's built-in TOC panel and its trigger button when block-nav is open."
            }
          >
            <orca.components.Switch
              on={settings.hideBuiltInToc ?? false}
              onChange={(checked: boolean) =>
                updateSettings({ hideBuiltInToc: checked })
              }
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
