import * as React from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { gatherAndInsertRefs } from "./logic";

export default class GatherRefsPlugin extends BasePlugin {
  constructor(mainPluginName: string, name: string) {
    super(mainPluginName, name);
  }

  override async load() {
    const commandId = "gather-refs-command";
    const fullId = `${this.mainPluginName}.${commandId}`;
    
    orca.commands.registerEditorCommand(
      fullId,
      async ([_panelId, _rootBlockId, _cursor]) => {
        try {
          await gatherAndInsertRefs((key, args) => this.t(key, args));
          return null;
        } catch (error) {
          console.error("[lets-gather-refs] Error:", error);
          orca.notify("error", this.t("gather-refs.error"));
          return null;
        }
      },
      ([_panelId, _rootBlockId, _cursor]) => {}, // Empty undo since batchInsertText pushes its own undo states
      { label: this.t("gather-refs"), hasArgs: false }
    );

    // 注册 Slash Command
    orca.slashCommands.registerSlashCommand("gather-refs-slash", {
      icon: "ti ti-link",
      group: "Insert",
      title: this.t("gather-refs"),
      command: fullId
    });

    // 注册块右键菜单命令
    this.registerBlockMenuCommand("gather-refs-block-menu", {
      worksOnMultipleBlocks: false,
      render: (blockId: number, _rootBlockId: number, close: () => void) => {
        const MenuText = orca.components.MenuText;
        return (
          <MenuText
            preIcon="ti ti-link"
            title={this.t("gather-refs")}
            onClick={async () => {
              close();
              try {
                await gatherAndInsertRefs((key, args) => this.t(key, args));
              } catch (error) {
                console.error("[lets-gather-refs] Error:", error);
                orca.notify("error", this.t("gather-refs.error"));
              }
            }}
          />
        );
      },
    });
  }

  override async unload() {
    const fullId = `${this.mainPluginName}.gather-refs-command`;
    orca.commands.unregisterEditorCommand(fullId);
    orca.slashCommands.unregisterSlashCommand("gather-refs-slash");
    super.unload();
  }
}
