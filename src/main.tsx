import React from "react";
import { t, setupL10N } from "./libs/l10n";
import zhCN from "./translations/zhCN";
import { BasePlugin } from "./libs/BasePlugin";
import { SettingsBoard } from "./components/SettingsBoard";
import { DbId, QueryDescription2 } from "./orca";

// Auto-scan all sub-plugins in lets-* folders
const pluginModules = import.meta.glob("./lets-*/index.tsx", { eager: true });

export const pluginInstances: BasePlugin[] = [];

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
  const Button = orca.components.Button;
  orca.headbar.registerHeadbarButton("subplugins-settings", () =>
    React.createElement(
      Button,
      {
        variant: "plain",
        onClick: () => openSettingsBoard(_name),
        title: t("Open Sub-plugin Settings"),
      },
      React.createElement("i", {
        className: "ti ti-settings",
        style: { fontSize: "16px" },
      }),
    ),
  );

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

        // Initialize settings for all plugins (for the settings board to work even if not enabled)
        await pluginInstance.initializeSettings();

        // Load if enabled
        const settings = orca.state.plugins[_name]?.settings;
        if (!settings?.[`${pluginName}`]) {
          console.log(`Skipping sub-plugin (class) from ${path}`);
          continue;
        }

        await pluginInstance.load(_name);
      }
    } catch (e) {
      console.error(`Failed to load sub-plugin from ${path}`, e);
    }
  }

  await orca.plugins.setSettingsSchema(_name, settingsSchema);
}

export async function unload() {
  // Unload class-based plugins
  for (const plugin of pluginInstances) {
    try {
      console.log(`Unloading sub-plugin (class) ${plugin["name"]}`);
      await plugin.unload();
    } catch (e) {
      console.error(`Failed to unload sub-plugin ${plugin["name"]}`, e);
    }
  }
  pluginInstances.length = 0; // Clear instances
  orca.commands.unregisterCommand("subplugins.settings");
  orca.headbar.unregisterHeadbarButton("subplugins-settings");

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
