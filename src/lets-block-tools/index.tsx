import React from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { MoveInfo, PushMode } from "./types";
import { executePush } from "./logic";
import { BlockToolsSettings } from "./settings";

export default class BlockToolsPlugin extends BasePlugin {
  public async load(): Promise<void> {
    this.registerPushCommand("default");
    this.registerPushCommand("delete");
    this.registerPushCommand("trace");
    this.logger.info(`${this.name} loaded.`);
  }

  private registerPushCommand(mode: PushMode) {
    if (!orca.blockMenuCommands?.registerBlockMenuCommand) return;

    let commandId = `${this.name}.push-children-to-ref`;
    if (mode === "delete") commandId = `${this.name}.push-children-and-delete`;
    if (mode === "trace") commandId = `${this.name}.push-children-and-trace`;

    orca.blockMenuCommands.registerBlockMenuCommand(commandId, {
      worksOnMultipleBlocks: true,
      render: (blockIds, _rootBlockId, close) => {
        const settings = this.getSettings();
        let enabled = settings.enablePushToRef !== false;
        if (mode === "delete") enabled = settings.enablePushAndDelete !== false;
        if (mode === "trace") enabled = settings.enablePushAndTrace !== false;

        if (!enabled) return null;
        if (!blockIds || blockIds.length === 0) return null;

        const eligibleMoves: MoveInfo[] = [];
        const idArray = typeof blockIds === "number" ? [blockIds] : blockIds;

        for (const blockId of idArray) {
          const block = orca.state.blocks[blockId];
          if (!block) continue;

          const isRefOnly =
            block.content?.length === 1 && block.content[0].t === "r";
          if (!isRefOnly) continue;

          if (!block.children || block.children.length === 0) continue;

          const refId = block.content![0].v;
          const targetRef = block.refs?.find((r) => r.id === refId);
          if (!targetRef) continue;

          eligibleMoves.push({
            blockId,
            targetId: targetRef.to,
            children: [...block.children],
            alias:
              block.content![0].a ||
              targetRef.alias ||
              block.text?.match(/^\[(.+?)\]/)?.[1] ||
              "Pushed Content",
          });
        }

        if (eligibleMoves.length === 0) return null;

        const MenuText = orca.components.MenuText;
        let icon = "ti ti-arrow-merge";
        let title = t("Push Children to Referenced Block");

        if (mode === "delete") {
          icon = "ti ti-trash-x";
          title = t("Push Children and Delete");
        } else if (mode === "trace") {
          icon = "ti ti-history";
          title = t("Push Children and Keep Trace");
        }

        return (
          <MenuText
            preIcon={icon}
            title={title}
            onClick={async () => {
              close();
              await executePush(eligibleMoves, mode, this.logger);
            }}
          />
        );
      },
    });
  }

  public async unload(): Promise<void> {
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.push-children-to-ref`,
    );
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.push-children-and-delete`,
    );
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.push-children-and-trace`,
    );
    this.logger.info(`${this.name} unloaded.`);
  }

  protected settingsComponent = BlockToolsSettings;

  protected async onConfigChanged(_newConfig: any): Promise<void> {
    // Block menu items are re-rendered each time the menu is opened.
  }
}
