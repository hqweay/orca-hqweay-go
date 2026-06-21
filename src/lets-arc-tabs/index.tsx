import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import type { Block } from "../orca.d.ts";
import { ArcSidebar } from "./components/ArcSidebar";
import { arcTabsState, DEFAULT_SPACE } from "./utils/data";
import { injectLeftHeadbarButton, removeLeftHeadbarButton } from "@/libs/utils";

export let arcTabsPluginInstance: ArcTabsPlugin;

export default class ArcTabsPlugin extends BasePlugin {
  protected headbarButtonId = "arc-tabs.openSidebar";

  async load() {
    arcTabsPluginInstance = this;

    // Register the native panel
    orca.panels.registerPanel("arcTabs", ArcSidebar);

    // Register a command to open the panel
    orca.commands.registerCommand(
      "arc-tabs.openSidebar",
      (overrideSide?: "left" | "right") => {
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

        const existingPanel = findPanelWithView(orca.state.panels, "arcTabs");
        if (existingPanel) {
          orca.nav.close(existingPanel.id);
        } else {
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
            view: "arcTabs",
            viewArgs: {},
            viewState: {},
            locked: true, // Prevent this panel from being replaced by other blocks
          } as any);

          if (newPanelId) {
            const width = arcTabsPluginInstance?.getSettings()?.sidebarWidth || 250;
            // Synchronously update layout state to avoid initial flash 
            // from default equal-split calculation
            orca.nav.changeSizes(newPanelId, side === "left" ? [width, window.innerWidth - width] : [window.innerWidth - width, width]);
          }
        }
      },
      t("arc-tabs.description")
    );

    orca.editorSidetools.registerEditorSidetool(`${this.name}.sidetool`, {
      render: (_rootBlockId, _panelId) => {
        return (
          <orca.components.Button
            variant="plain"
            title={t(this.name)}
            onClick={() => orca.commands.invokeCommand("arc-tabs.openSidebar")}
            className="orca-arc-tabs-sidetools-btn"
          >
            <i className="ti ti-folders" style={{ fontSize: "16px" }} />
          </orca.components.Button>
        );
      },
    });

    injectLeftHeadbarButton(
      this.name,
      "ti ti-folders",
      t("arc-tabs.description"),
      (e: MouseEvent) => {
        const defaultSide = this.getSettings()?.sidebarPosition || "left";
        const oppositeSide = defaultSide === "left" ? "right" : "left";
        if (e.shiftKey) {
          orca.commands.invokeCommand("arc-tabs.openSidebar", oppositeSide);
        } else {
          orca.commands.invokeCommand("arc-tabs.openSidebar");
        }
      },
      (e: MouseEvent) => {
        const defaultSide = this.getSettings()?.sidebarPosition || "left";
        const oppositeSide = defaultSide === "left" ? "right" : "left";
        orca.commands.invokeCommand("arc-tabs.openSidebar", oppositeSide);
      }
    );

    const settings = this.getSettings();
    arcTabsState.pinnedDisplayMode = settings.pinnedDisplayMode || "grid";

    this.ensurePinTagSchema();
  }

  protected syncHeadbar() {
    // Override BasePlugin to avoid registering on the right side
  }

  protected async onConfigChanged(newConfig: any): Promise<void> {
    await super.onConfigChanged(newConfig);
    this.ensurePinTagSchema();
    if (newConfig.pinnedDisplayMode) {
      arcTabsState.pinnedDisplayMode = newConfig.pinnedDisplayMode;
    }
  }

  private async ensurePinTagSchema() {
    const settings = this.getSettings();
    const pinTagName = settings.pinTagName || "ArcTab";
    if (!pinTagName) return;
    try {
      let tagBlock = (await orca.invokeBackend(
        "get-block-by-alias",
        pinTagName,
      )) as Block | null;
      if (!tagBlock) {
        this.logger.debug(`Tag ${pinTagName} not found, creating...`);
        const newBlockId = (await orca.commands.invokeEditorCommand(
          "core.editor.insertBlock",
          null,
          null,
          "lastChild",
          [{ t: "t", v: pinTagName }],
          { type: "text" },
        )) as number;
        if (newBlockId) {
          await orca.commands.invokeEditorCommand(
            "core.editor.createAlias",
            null,
            pinTagName,
            newBlockId,
            true,
          );
          tagBlock = (await orca.invokeBackend(
            "get-block",
            newBlockId,
          )) as Block | null;
        }
      }

      if (tagBlock) {
        const existingProps = tagBlock.properties || [];
        const hasSpaceProp = existingProps.some((p: any) => p.name === "Space");
        const hasDisplayNameProp = existingProps.some(
          (p: any) => p.name === "displayName",
        );

        const propsToAdd: any[] = [];
        if (!hasSpaceProp) {
          propsToAdd.push({
            name: "Space",
            type: 6,
            typeArgs: { subType: "multi", choices: [DEFAULT_SPACE] },
          });
        }
        if (!hasDisplayNameProp) {
          propsToAdd.push({
            name: "displayName",
            type: 1,
          });
        }

        if (propsToAdd.length > 0) {
          await orca.commands.invokeEditorCommand(
            "core.editor.setProperties",
            null,
            [tagBlock.id],
            propsToAdd,
          );
        }
      }
    } catch (e) {
      this.logger.error("Failed to ensure pin tag schema", e);
    }
  }

  async unload() {
    removeLeftHeadbarButton(this.name);
    // Unregister everything
    orca.panels.unregisterPanel("arcTabs");
    orca.commands.unregisterCommand("arc-tabs.openSidebar");
  }

  // Render the headbar button
  renderHeadbarButton() {
    const Button = orca.components.Button;
    return (
      <Button
        variant="plain"
        title={t("arc-tabs.description")}
        onClick={() => orca.commands.invokeCommand("arc-tabs.openSidebar")}
      >
        <i className="ti ti-folders" style={{ fontSize: "16px" }} />
      </Button>
    );
  }

  getDefaultSettings() {
    return {
      ...super.getDefaultSettings(),
      pinTagName: "ArcTab",
      pinnedDisplayMode: "grid",
      sidebarWidth: 250,
      todayLimit: 30,
    };
  }

  renderCustomSettings(settings: any, updateSettings: (val: any) => void) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <SettingsSection title={t("arc-tabs.settings")}>
          <SettingsItem
            label={t("arc-tabs.tagName")}
            description={t("arc-tabs.tagDescription")}
          >
            <orca.components.Input
              value={settings.pinTagName || "ArcTab"}
              onChange={(e) => updateSettings({ pinTagName: e.target.value })}
              placeholder="ArcTab"
            />
          </SettingsItem>
          <SettingsItem
            label={t("arc-tabs.pinnedLayout")}
            description={t("arc-tabs.layoutDescription")}
          >
            <orca.components.Select
              selected={[settings.pinnedDisplayMode || "grid"]}
              options={[
                { value: "grid", label: t("arc-tabs.layoutGrid") },
                { value: "list", label: t("arc-tabs.layoutList") },
              ]}
              onChange={(selected) =>
                updateSettings({ pinnedDisplayMode: selected[0] })
              }
              width="100%"
            />
          </SettingsItem>
          <SettingsItem
            label={t("arc-tabs.sidebarPosition") || "Sidebar Position"}
            description={t("arc-tabs.sidebarPositionDesc") || "Default side to open the Arc Tabs panel. Right-click the button to open on the opposite side."}
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
            label={t("arc-tabs.sidebarWidth")}
            description={t("arc-tabs.sidebarWidthDesc")}
          >
            <orca.components.Input
              type="number"
              value={settings.sidebarWidth ?? 250}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) updateSettings({ sidebarWidth: val });
              }}
              style={{ width: "100px" }}
            />
          </SettingsItem>
          <SettingsItem
            label={t("arc-tabs.recentLimit")}
            description={t("arc-tabs.recentLimitDesc")}
          >
            <orca.components.Input
              type="number"
              value={settings.todayLimit ?? 30}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val > 0) updateSettings({ todayLimit: val });
              }}
              style={{ width: "100px" }}
            />
          </SettingsItem>
        </SettingsSection>
      </div>
    );
  }
}
