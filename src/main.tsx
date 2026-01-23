import React from "react";
import { t, setupL10N } from "./libs/l10n";
import zhCN from "./translations/zhCN";
import { BasePlugin } from "./libs/BasePlugin";
import { SettingsBoard } from "./components/SettingsBoard";
import { DbId, QueryDescription2 } from "./orca";

// Auto-scan all sub-plugins in lets-* folders
const pluginModules = import.meta.glob("./lets-*/index.tsx", { eager: true });

export const pluginInstances: BasePlugin[] = [];
let unsubscribeSettings: (() => void) | null = null;

const test = async () => {
  const resultIds = (await orca.invokeBackend("query", {
    q: {
      kind: 100,
      conditions: [
        {
          kind: 4,
          name: "VoiceNote",
          properties: [{ name: "ID", op: 1, value: "H24u0iyL" }],
          selfOnly: true,
        },
      ],
    },
    pageSize: 12,
  } as QueryDescription2)) as DbId[];

  console.log(resultIds);
};
export async function load(_name: string) {
  // test();

  setupL10N(orca.state.locale, { "zh-CN": zhCN });

  orca.commands.registerCommand(
    "subplugins.settings",
    () => openSettingsBoard(_name),
    t("Open Sub-plugin Settings"),
  );

  // Register headbar button

  let settingsSchema: any = {};

  for (const path in pluginModules) {
    const module: any = pluginModules[path];
    try {
      // Check if the module exports a default class extending BasePlugin
      if (module.default && module.default.prototype instanceof BasePlugin) {
        // It's a BasePlugin class
        // Extract name from path e.g. "./lets-format/index.tsx" -> "lets-format"
        const folderName = path.split("/")[1];
        const pluginName = folderName.replace("lets-", "");
        const pluginInstance = new module.default(_name, pluginName);
        pluginInstances.push(pluginInstance);

        console.log(`Loading sub-plugin (class) from ${path}`);

        // Collect settings from plugin instance
        settingsSchema = {
          ...settingsSchema,
          ...pluginInstance.getSettingsSchema(),
        };

        await pluginInstance.initializeSettings();

        // Load if enabled
        const settings = orca.state.plugins[_name]?.settings;
        if (settings?.[`${pluginName}`]) {
          await pluginInstance.safeLoad();
        }
      }
    } catch (e) {
      console.error(`Failed to load sub-plugin from ${path}`, e);
    }
  }

  // Subscribe to settings changes for dynamic load/unload
  const pluginState = orca.state.plugins[_name];
  if (pluginState) {
    const { subscribe } = (window as any).Valtio;
    unsubscribeSettings = subscribe(pluginState, async () => {
      const settings = orca.state.plugins[_name]?.settings;
      if (!settings) return;

      for (const plugin of pluginInstances) {
        const pluginName = plugin["name"];
        const isEnabled = !!settings[pluginName];
        if (isEnabled) {
          await plugin.safeLoad();
        } else {
          await plugin.safeUnload();
        }
      }
    });
  }

  orca.headbar.registerHeadbarButton("subplugins-actions", () => {
    const isEnabled = (pName: string) =>
      orca.state.plugins[_name]?.settings?.[pName];
    const activePlugins = pluginInstances.filter((p) => isEnabled(p["name"]));

    // If no active plugins have menu items, we still show the button but with an empty or limited menu?
    // Actually, let's just render the button and the menu will show active items.
    const hasItems = activePlugins.some(
      (p) => p.getHeadbarMenuItems(() => {}).length > 0,
    );

    if (!hasItems) return React.createElement(React.Fragment);

    return React.createElement(orca.components.HoverContextMenu, {
      menu: (closeMenu: () => void) => {
        // Add settings at the top
        const items: React.ReactNode[] = [
          React.createElement(orca.components.MenuText, {
            key: "sub-plugin-settings",
            preIcon: "ti ti-settings",
            title: t("Sub-plugin Settings"),
            onClick: () => {
              closeMenu();
              openSettingsBoard(_name);
            },
          }),
          React.createElement(orca.components.MenuSeparator, {
            key: "sep-settings",
          }),
        ];

        activePlugins.forEach((p) => {
          items.push(...p.getHeadbarMenuItems(closeMenu));
        });

        return React.createElement(React.Fragment, null, ...items);
      },
      children: React.createElement(
        orca.components.Button,
        {
          variant: "plain",
          title: t("Actions"),
          onClick: () => openSettingsBoard(_name),
        },
        React.createElement("i", {
          className: "ti ti-apps",
          style: { fontSize: "16px" },
        }),
      ),
    });
  });

  await orca.plugins.setSettingsSchema(_name, settingsSchema);
}

export async function unload() {
  // Unload class-based plugins
  for (const plugin of pluginInstances) {
    try {
      console.log(`Unloading sub-plugin (class) ${plugin["name"]}`);
      await plugin.safeUnload();
    } catch (e) {
      console.error(`Failed to unload sub-plugin ${plugin["name"]}`, e);
    }
  }
  pluginInstances.length = 0; // Clear instances
  if (unsubscribeSettings) {
    unsubscribeSettings();
    unsubscribeSettings = null;
  }
  orca.commands.unregisterCommand("subplugins.settings");
  orca.headbar.unregisterHeadbarButton("subplugins-actions");

  const container = document.getElementById("sub-plugin-settings-container");
  if (container) {
    container.remove();
  }
}

function openSettingsBoard(mainPluginName: string) {
  let container = document.getElementById("sub-plugin-settings-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "sub-plugin-settings-container";
    document.body.appendChild(container);
  }

  const { createRoot } = window as any;
  const root = createRoot(container);

  const handleClose = () => {
    root.unmount();
    container?.remove();
  };

  root.render(
    React.createElement(SettingsBoard, {
      onClose: handleClose,
      mainPluginName: mainPluginName,
    }),
  );
}
