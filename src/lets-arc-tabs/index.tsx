import React from 'react';
import { BasePlugin } from '@/libs/BasePlugin';
import { t } from '@/libs/l10n';
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import type { Block } from "../orca.d.ts";
import { ArcSidebar } from './components/ArcSidebar';
import { arcTabsState } from './utils/data';

export let arcTabsPluginInstance: ArcTabsPlugin;

export default class ArcTabsPlugin extends BasePlugin {
  protected headbarButtonId = 'arc-tabs.openSidebar';

  async load() {
    arcTabsPluginInstance = this;
    
    // Register the native panel
    orca.panels.registerPanel('arcTabs', ArcSidebar);

    // Register a command to open the panel
    orca.commands.registerCommand(
      'arc-tabs.openSidebar',
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

        const existingPanel = findPanelWithView(orca.state.panels, 'arcTabs');
        if (existingPanel) {
          // If already open, close it (toggle behavior)
          orca.nav.close(existingPanel.id);
        } else {
          const newPanelId = orca.nav.addTo(orca.state.activePanel, "left", {
            view: "arcTabs",
            viewArgs: {},
            viewState: {},
            locked: true, // Prevent this panel from being replaced by other blocks
          } as any);
          
          if (newPanelId) {
            // Wait for the panel to be mounted in the DOM, then resize it
            setTimeout(() => {
              // 250px for sidebar, the rest for the main panel
              orca.nav.changeSizes(newPanelId, [250, window.innerWidth - 250]);
            }, 50);
          }
        }
      },
      t('arc-tabs') // Display name in command palette
    );

    // Bind a default shortcut if desired (optional)
    // orca.commands.bindShortcut('arc-tabs.openSidebar', 'cmd+shift+a');

    const settings = this.getSettings();
    arcTabsState.pinnedDisplayMode = settings.pinnedDisplayMode || 'grid';

    this.ensurePinTagSchema();
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
    const pinTagName = settings.pinTagName || 'ArcTab';
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
        const hasDisplayNameProp = existingProps.some((p: any) => p.name === "displayName");
        
        const propsToAdd: any[] = [];
        if (!hasSpaceProp) {
          propsToAdd.push({
            name: "Space",
            type: 6,
            typeArgs: { subType: "multi", choices: ["default"] },
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
    // Unregister everything
    orca.panels.unregisterPanel('arcTabs');
    orca.commands.unregisterCommand('arc-tabs.openSidebar');
  }

  // Render the headbar button
  renderHeadbarButton() {
    const Button = orca.components.Button;
    return (
      <Button
        variant="plain"
        title={t('arc-tabs.description')}
        onClick={() => orca.commands.invokeCommand('arc-tabs.openSidebar')}
      >
        <i className="ti ti-folders" style={{ fontSize: "16px" }} />
      </Button>
    );
  }

  getDefaultSettings() {
    return {
      ...super.getDefaultSettings(),
      pinTagName: 'ArcTab',
      pinnedDisplayMode: 'grid'
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
              value={settings.pinTagName || 'ArcTab'}
              onChange={(e) => updateSettings({ pinTagName: e.target.value })}
              placeholder="ArcTab"
            />
          </SettingsItem>
          <SettingsItem
            label={t("arc-tabs.pinnedLayout")}
            description={t("arc-tabs.layoutDescription")}
          >
            <orca.components.Select
              selected={[settings.pinnedDisplayMode || 'grid']}
              options={[
                { value: 'grid', label: t('arc-tabs.layoutGrid') },
                { value: 'list', label: t('arc-tabs.layoutList') }
              ]}
              onChange={(selected) => updateSettings({ pinnedDisplayMode: selected[0] })}
              width="100%"
            />
          </SettingsItem>
        </SettingsSection>
      </div>
    );
  }
}
