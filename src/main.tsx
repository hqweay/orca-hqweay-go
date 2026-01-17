import { t } from "./libs/l10n";

// Auto-scan all sub-plugins in lets-* folders
const pluginModules = import.meta.glob("./lets-*/index.tsx", { eager: true });

export async function load(_name: string) {
  let settingsSchema: any = {};
  for (const path in pluginModules) {
    const plugin: any = pluginModules[path];
    try {
      if (plugin.getSettingsSchema) {
        settingsSchema = {
          ...settingsSchema,
          ...plugin.getSettingsSchema(),
        };
      }
      if (plugin.load) {
        console.log(`Loading sub-plugin from ${path}`);
        await plugin.load(_name);
      }
    } catch (e) {
      console.error(`Failed to load sub-plugin from ${path}`, e);
    }
  }

  await orca.plugins.setSettingsSchema(_name, settingsSchema);
}

export async function unload() {
  for (const path in pluginModules) {
    const plugin: any = pluginModules[path];
    try {
      if (plugin.unload) {
        console.log(`Unloading sub-plugin from ${path}`);
        plugin.unload();
      }
    } catch (e) {
      console.error(`Failed to unload sub-plugin from ${path}`, e);
    }
  }
}
