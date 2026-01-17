import * as VoiceNotesSync from "./lets-voicenotes-sync";

// List of sub-plugins
const subPlugins = [VoiceNotesSync];

export async function load(_name: string) {
  for (const plugin of subPlugins) {
    try {
      if (plugin.load) {
        plugin.load(_name);
      }
    } catch (e) {
      console.error("Failed to load sub-plugin", e);
    }
  }
}

export async function unload() {
  for (const plugin of subPlugins) {
    try {
      if (plugin.unload) {
        plugin.unload();
      }
    } catch (e) {
      console.error("Failed to unload sub-plugin", e);
    }
  }
}
