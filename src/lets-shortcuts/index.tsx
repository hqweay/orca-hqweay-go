import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";

interface TagShortcutConfig {
  tag: string;
  shortcut: string;
}

export default class TagShortcutsPlugin extends BasePlugin {
  private registeredCommands: Set<string> = new Set();

  public getSettingsSchema(): any {
    return {
      ...this.defineSetting(
        "tags",
        "Tag Shortcuts Config",
        'JSON array of tag configurations. Format: [{"tag":"碎碎念","shortcut":"ctrl+shift+t"}]',
        JSON.stringify([
          {
            tag: "碎碎念",
            shortcut: "ctrl+shift+t",
          },
        ]),
      ),
    };
  }

  public async load(): Promise<void> {
    await this.reloadShortcuts();
    this.logger.info(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    for (const commandId of this.registeredCommands) {
      try {
        await orca.shortcuts.assign("", commandId);
        orca.commands.unregisterCommand(commandId);
      } catch (e) {
        this.logger.warn(`Failed to unregister ${commandId}`, e);
      }
    }
    this.registeredCommands.clear();
    this.logger.info(`${this.name} unloaded.`);
  }

  private async reloadShortcuts(): Promise<void> {
    for (const commandId of this.registeredCommands) {
      try {
        await orca.shortcuts.assign("", commandId);
        orca.commands.unregisterCommand(commandId);
      } catch (e) {
        this.logger.warn(`Failed to unregister ${commandId}`, e);
      }
    }
    this.registeredCommands.clear();

    const settings = orca.state.plugins[this.mainPluginName]?.settings || {};
    const tagsConfigStr =
      settings[`${this.name}.tags`] ||
      JSON.stringify([
        {
          tag: "碎碎念",
          shortcut: "ctrl+shift+t",
        },
      ]);

    let tags: TagShortcutConfig[] = [];
    try {
      tags = JSON.parse(tagsConfigStr);
      if (!Array.isArray(tags)) {
        this.logger.error("Tags config must be an array");
        return;
      }
    } catch (e) {
      this.logger.error("Failed to parse tags config", e);
      orca.notify("error", t("Failed to parse tags configuration."));
      return;
    }

    for (const config of tags) {
      if (!config.tag || !config.shortcut) continue;

      const commandId = `${this.name}.insert-tag-${config.tag}`;

      orca.commands.registerEditorCommand(
        commandId,
        async ([_panelId, _rootBlockId, cursor]) => {
          if (!cursor || !cursor.anchor) {
            orca.notify("warn", t("Please place cursor in editor first."));
            return null;
          }

          const { anchor } = cursor;
          const tags = config.tag
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);

          for (const tag of tags) {
            await orca.commands.invokeEditorCommand(
              "core.editor.insertTag",
              null,
              anchor.blockId,
              tag,
            );
          }

          return null;
        },
        () => {},
        { label: `插入标签: ${config.tag}` },
      );

      try {
        await orca.shortcuts.assign(config.shortcut, commandId);
        this.registeredCommands.add(commandId);
      } catch (e) {
        this.logger.error(`Failed to assign shortcut ${config.shortcut}`, e);
      }
    }
  }
}
