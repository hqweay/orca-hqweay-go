import React from 'react';
import { BasePlugin } from '@/libs/BasePlugin';
import { t } from '@/libs/l10n';
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import { DataImporter } from "@/libs/DataImporter";
import { PropType } from "@/libs/consts";
import type { Block } from "../orca.d.ts";
import { ArcSidebar } from './components/ArcSidebar';
import { arcTabsState } from './utils/data';

export let arcTabsPluginInstance: ArcTabsPlugin;

export default class ArcTabsPlugin extends BasePlugin {
  protected headbarButtonId = 'arcTabs.openSidebar';

  async load() {
    arcTabsPluginInstance = this;
    
    // Register the native panel
    orca.panels.registerPanel('arcTabs', ArcSidebar);

    // Register a command to open the panel
    orca.commands.registerCommand(
      'arcTabs.openSidebar',
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
      t('arcTabs') // Display name in command palette
    );

    // Bind a default shortcut if desired (optional)
    // orca.commands.bindShortcut('arcTabs.openSidebar', 'cmd+shift+a');

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
        await DataImporter.syncTagSchema(tagBlock, [
          {
            name: "displayName",
            type: PropType.Text,
          },
        ]);
      }
    } catch (e) {
      this.logger.error("Failed to ensure pin tag schema", e);
    }
  }

  async unload() {
    // Unregister everything
    orca.panels.unregisterPanel('arcTabs');
    orca.commands.unregisterCommand('arcTabs.openSidebar');
  }

  // Render the headbar button
  renderHeadbarButton() {
    const Button = orca.components.Button;
    return (
      <Button
        variant="plain"
        title={t('arcTabs.description')}
        onClick={() => orca.commands.invokeCommand('arcTabs.openSidebar')}
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
        <SettingsSection title="Arc Tabs Settings">
          <SettingsItem
            label="Pinned Tab Tag Name"
            description="The tag used to mark a block as pinned in Arc Tabs."
          >
            <orca.components.Input
              value={settings.pinTagName || 'ArcTab'}
              onChange={(e) => updateSettings({ pinTagName: e.target.value })}
              placeholder="ArcTab"
            />
          </SettingsItem>
          <SettingsItem
            label={t("arcTabs.pinnedLayout")}
            description="Choose the visual layout for pinned tabs in the sidebar."
          >
            <orca.components.Select
              selected={[settings.pinnedDisplayMode || 'grid']}
              options={[
                { value: 'grid', label: t('arcTabs.layoutGrid') },
                { value: 'list', label: t('arcTabs.layoutList') }
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
