// Auto-scan all sub-plugins in lets-* folders
const pluginModules = import.meta.glob("./lets-*/index.tsx", { eager: true });

export async function load(_name: string) {
  for (const path in pluginModules) {
    const plugin: any = pluginModules[path];
    try {
      if (plugin.load) {
        console.log(`Loading sub-plugin from ${path}`);
        plugin.load(_name);
      }
    } catch (e) {
      console.error(`Failed to load sub-plugin from ${path}`, e);
    }
  }
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
