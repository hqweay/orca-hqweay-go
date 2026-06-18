import React from 'react';
import { BasePlugin } from '@/libs/BasePlugin';
import { t } from '@/libs/l10n';
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import { ArcSidebar } from './components/ArcSidebar';

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
      pinTagName: 'ArcTab'
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
        </SettingsSection>
      </div>
    );
  }
}
