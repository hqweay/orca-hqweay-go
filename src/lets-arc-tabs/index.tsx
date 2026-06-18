import React from 'react';
import { BasePlugin } from '@/libs/BasePlugin';
import { t } from '@/libs/l10n';
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
          // Open as a split to the left of the active panel
          orca.nav.addTo(orca.state.activePanel, 'left', { view: 'arcTabs', viewArgs: {}, viewState: {} });
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
    return (
      <div
        className="headbar-button"
        title={t('arcTabs.description')}
        onClick={() => {
          orca.commands.invokeCommand('arcTabs.openSidebar');
        }}
      >
        <span className="icon">🗂️</span>
      </div>
    );
  }
}
