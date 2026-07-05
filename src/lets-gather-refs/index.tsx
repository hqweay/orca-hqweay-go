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
          await gatherAndInsertRefs((key, args) => this.t(key, args), _cursor);
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


  }

  override async unload() {
    const fullId = `${this.mainPluginName}.gather-refs-command`;
    orca.commands.unregisterEditorCommand(fullId);
    orca.slashCommands.unregisterSlashCommand("gather-refs-slash");
    super.unload();
  }
}
