import React from "react";
import { t, setupL10N } from "./libs/l10n";
import zhCN from "./translations/zhCN";
import { BasePlugin } from "./libs/BasePlugin";
import { SettingsBoard } from "./components/SettingsBoard";
import { UpdateModal } from "./components/UpdateModal";
import { getChangesSince } from "./changelog";
import cloneDeep from "lodash.clonedeep";
import { Logger, LogLevel } from "./libs/logger";
import pkg from "../package.json";

// Auto-scan sub-plugins. Test plugins (lets-test-*) are only included in development.
const pluginModules: Record<string, any> =
  import.meta.env.MODE === "development"
    ? import.meta.glob("./lets-*/index.tsx", { eager: true })
    : import.meta.glob(["./lets-*/index.tsx", "!./lets-test-*/index.tsx"], {
        eager: true,
      });

export const pluginInstances: BasePlugin[] = [];
let unsubscribeSettings: (() => void) | null = null;
let updateModalContainer: HTMLElement | null = null;
let updateModalRoot: any = null;

function showUpdateModal(entries: any[]) {
  if (!updateModalContainer) {
    updateModalContainer = document.createElement("div");
    document.body.appendChild(updateModalContainer);
    const { createRoot } = window as any;
    updateModalRoot = createRoot(updateModalContainer);
  }

  const handleClose = () => {
    updateModalRoot?.render(null);
  };

  updateModalRoot?.render(
    React.createElement(UpdateModal, {
      visible: true,
      onClose: handleClose,
      entries,
    })
  );
}

async function fixData() {
  // 修复脏数据 (Fix dirty data for block 27074)
  const targetBlock = orca.state.blocks[27074];
  if (targetBlock && targetBlock.properties) {
    targetBlock.properties
      .filter((item: any) => item.type === 6)
      .forEach((item: any) => {
        if (item.typeArgs && Array.isArray(item.typeArgs.choices)) {
          item.typeArgs.choices = item.typeArgs.choices.map((choice: any) =>
            typeof choice === "string" ? choice : choice.n,
          );
        }
      });
    await orca.commands.invokeEditorCommand(
      "core.editor.setProperties",
      null,
      [27074],
      cloneDeep(targetBlock.properties),
    );
  }
}

export async function load(_name: string) {
  setupL10N(orca.state.locale, { "zh-CN": zhCN });
  // fixData();

  const currentVersion = pkg.version;
  const lastSeenVersion = await orca.plugins.getData(_name, "lastSeenVersion");
  if (lastSeenVersion !== currentVersion) {
    const changes = getChangesSince(lastSeenVersion || "0.0.0");
    orca.notify(
      "info",
      `恐龙工具箱已更新至版本 v${currentVersion}，共 ${changes.length} 个版本更新。点击查看详情`,
      {
        title: "🎉 新版本更新",
        action: () => showUpdateModal(changes),
      },
    );
    await orca.plugins.setData(_name, "lastSeenVersion", currentVersion);
  }

  orca.commands.registerCommand(
    "subplugins.settings",
    () => openSettingsBoard(_name),
    t("Open Sub-plugin Settings"),
  );

  // Register headbar button

  let settingsSchema: any = {
    enableLogging: {
      label: t("Enable Logging"),
      description: t("Print debug logs to the console"),
      type: "boolean",
      defaultValue: false,
    },
  };

  const initialSettings = orca.state.plugins[_name]?.settings;
  if (initialSettings && initialSettings.enableLogging !== undefined) {
    Logger.setGlobalLevel(
      initialSettings.enableLogging ? LogLevel.DEBUG : LogLevel.ERROR,
    );
  } else {
    Logger.setGlobalLevel(LogLevel.ERROR);
  }

  for (const path in pluginModules) {
    const module: any = pluginModules[path];
    try {
      // Extract name from path e.g. "./lets-format/index.tsx" -> "lets-format"
      const folderName = path.split("/")[1];
      const pluginName = folderName.replace("lets-", "");

      // Check if the module exports a default class extending BasePlugin
      if (module.default && module.default.prototype instanceof BasePlugin) {
        // It's a BasePlugin class
        const pluginInstance = new module.default(_name, pluginName);
        pluginInstances.push(pluginInstance);

        // console.log(`Loading sub-plugin (class) from ${path}`);

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

      if (settings.enableLogging !== undefined) {
        Logger.setGlobalLevel(
          settings.enableLogging ? LogLevel.DEBUG : LogLevel.ERROR,
        );
      }

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

    // If no sub-plugins are enabled, do not show the button.
    if (activePlugins.length === 0) return React.createElement(React.Fragment);

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
          // Add a separator if there are any active plugins with menu items
          activePlugins.some(
            (p) => p.getHeadbarMenuItems(() => {}).length > 0,
          ) &&
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
