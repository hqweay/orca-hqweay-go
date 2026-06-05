import React from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { MoveInfo, PushMode } from "./types";
import {
  executePush,
  hasBlockReference,
  hasBlockLink,
  executeRefToLink,
  executeLinkToRef,
  executeRefToTextPin,
  executeRefToPin,
  getRefLabelSync,
} from "./logic";
import { BlockToolsSettings } from "./settings";

export default class BlockToolsPlugin extends BasePlugin {
  public async load(): Promise<void> {
    this.registerPushCommand("default");
    this.registerPushCommand("delete");
    this.registerPushCommand("trace");
    this.registerMoveWithinParentCommand();
    this.registerConvertRefLinkCommand();
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
            alias: getRefLabelSync(block.content![0], block) || "Pushed Content",
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

  private registerMoveWithinParentCommand() {
    if (!orca.blockMenuCommands?.registerBlockMenuCommand) return;

    orca.blockMenuCommands.registerBlockMenuCommand(
      `${this.name}.move-within-parent`,
      {
        worksOnMultipleBlocks: true,
        render: (blockIds, _rootBlockId, close) => {
          const settings = this.getSettings();
          if (settings.enableMoveWithinParent === false) return null;

          if (!blockIds || blockIds.length === 0) return null;

          const idArray = typeof blockIds === "number" ? [blockIds] : blockIds;
          
          // Group blocks by parent. If any block has no parent, ignore it.
          const parentMap = new Map<number, number[]>();
          let hasValidBlocks = false;
          
          for (const blockId of idArray) {
            const block = orca.state.blocks[blockId];
            if (!block || !block.parent) continue;
            hasValidBlocks = true;
            
            if (!parentMap.has(block.parent)) {
              parentMap.set(block.parent, []);
            }
            parentMap.get(block.parent)!.push(blockId);
          }

          if (!hasValidBlocks) return null;

          const handleMove = async (position: "firstChild" | "lastChild") => {
            close();
            for (const [parentId, ids] of parentMap.entries()) {
              await orca.commands.invokeEditorCommand(
                "core.editor.moveBlocks",
                null,
                ids,
                parentId,
                position
              );
            }
          };

          const MenuText = orca.components.MenuText;
          return (
            <React.Fragment>
              <MenuText
                preIcon="ti ti-arrow-bar-to-up"
                title={t("Move to Top of Parent")}
                onClick={() => handleMove("firstChild")}
              />
              <MenuText
                preIcon="ti ti-arrow-bar-to-down"
                title={t("Move to Bottom of Parent")}
                onClick={() => handleMove("lastChild")}
              />
            </React.Fragment>
          );
        },
      }
    );
  }

  private registerConvertRefLinkCommand() {
    if (!orca.blockMenuCommands?.registerBlockMenuCommand) return;

    orca.blockMenuCommands.registerBlockMenuCommand(
      `${this.name}.convert-ref-link`,
      {
        worksOnMultipleBlocks: true,
        render: (blockIds, _rootBlockId, close) => {
          const settings = this.getSettings();
          const enableRefLink = settings.enableConvertRefLink !== false;
          const enablePinAlias = settings.enableConvertPinAlias !== false;

          if (!enableRefLink && !enablePinAlias) return null;

          if (!blockIds || blockIds.length === 0) return null;

          const idArray = typeof blockIds === "number" ? [blockIds] : blockIds;

          const hasRef = hasBlockReference(idArray);
          const hasLink = hasBlockLink(idArray);

          if (!hasRef && !hasLink) return null;

          const showRefToLink = hasRef && enableRefLink;
          const showPinRefs = hasRef && enablePinAlias;
          const showLinkToRef = hasLink && enableRefLink;

          if (!showRefToLink && !showPinRefs && !showLinkToRef) return null;

          const MenuText = orca.components.MenuText;
          return (
            <React.Fragment>
              {showRefToLink && (
                <MenuText
                  preIcon="ti ti-link"
                  title={t("Convert Block Reference to Block Link")}
                  onClick={async () => {
                    close();
                    await executeRefToLink(idArray);
                  }}
                />
              )}
              {showPinRefs && (
                <React.Fragment>
                  <MenuText
                    preIcon="ti ti-pin"
                    title={t("Convert Block Reference to Text Pin Reference")}
                    onClick={async () => {
                      close();
                      await executeRefToTextPin(idArray);
                    }}
                  />
                  <MenuText
                    preIcon="ti ti-pin-filled"
                    title={t("Convert Block Reference to Pin Reference")}
                    onClick={async () => {
                      close();
                      await executeRefToPin(idArray);
                    }}
                  />
                </React.Fragment>
              )}
              {showLinkToRef && (
                <MenuText
                  preIcon="ti ti-blockquote"
                  title={t("Convert Block Link to Block Reference")}
                  onClick={async () => {
                    close();
                    await executeLinkToRef(idArray);
                  }}
                />
              )}
            </React.Fragment>
          );
        },
      }
    );
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
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.move-within-parent`,
    );
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.convert-ref-link`,
    );
    this.logger.info(`${this.name} unloaded.`);
  }

  protected settingsComponent = BlockToolsSettings;

  protected async onConfigChanged(_newConfig: any): Promise<void> {
    // Block menu items are re-rendered each time the menu is opened.
  }
}
