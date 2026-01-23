import { t, setupL10N } from "./libs/l10n";
import zhCN from "./translations/zhCN";
import { BasePlugin } from "./libs/BasePlugin";
import { DbId, QueryDescription2 } from "./orca";

// Auto-scan all sub-plugins in lets-* folders
const pluginModules = import.meta.glob("./lets-*/index.tsx", { eager: true });

const pluginInstances: BasePlugin[] = [];

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
  setupL10N(orca.state.locale, { "zh-CN": zhCN });
  // test();
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

        // Collect settings
        settingsSchema = {
          [pluginName]: {
            label: t("Enable ${name}", { name: pluginName }),
            description: t("Enable ${name}", { name: pluginName }),
            type: "boolean",
            defaultValue: false,
          },
          ...settingsSchema,
          ...pluginInstance.getSettingsSchema(),
        };

        // Load
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

  // Unload legacy plugins
  for (const path in pluginModules) {
    const module: any = pluginModules[path];
    // If it was NOT a class plugin, try legacy unload (rough check, strictly we should track legacy separately too but this might be enough for migration)
    if (!(module.default && module.default.prototype instanceof BasePlugin)) {
      try {
        if (module.unload) {
          console.log(`Unloading sub-plugin (legacy) from ${path}`);
          module.unload();
        }
      } catch (e) {
        console.error(`Failed to unload sub-plugin from ${path}`, e);
      }
    }
  }
}
