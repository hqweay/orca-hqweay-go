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
    this.registerPushGroupCommand();
    this.registerMoveWithinParentCommand();
    this.registerConvertRefLinkCommand();
    this.logger.info(`${this.name} loaded.`);
  }

  private registerPushGroupCommand() {
    if (!orca.blockMenuCommands?.registerBlockMenuCommand) return;

    orca.blockMenuCommands.registerBlockMenuCommand(`${this.name}.push-children`, {
      worksOnMultipleBlocks: true,
      render: (blockIds, _rootBlockId, close) => {
        const settings = this.getSettings();
        const enablePushToRef = settings.enablePushToRef !== false;
        const enablePushAndDelete = settings.enablePushAndDelete !== false;
        const enablePushAndTrace = settings.enablePushAndTrace !== false;

        if (!enablePushToRef && !enablePushAndDelete && !enablePushAndTrace) return null;
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
        const Menu = orca.components.Menu;
        if (!MenuText || !Menu) return null;

        const subMenuItems: React.ReactNode[] = [];

        if (enablePushToRef) {
          subMenuItems.push(
            <MenuText
              key="default"
              preIcon="ti ti-arrow-merge"
              title={t("Push Only")}
              onClick={async () => {
                close();
                await executePush(eligibleMoves, "default", this.logger);
              }}
            />
          );
        }

        if (enablePushAndDelete) {
          subMenuItems.push(
            <MenuText
              key="delete"
              preIcon="ti ti-trash-x"
              title={t("Push and Delete")}
              onClick={async () => {
                close();
                await executePush(eligibleMoves, "delete", this.logger);
              }}
            />
          );
        }

        if (enablePushAndTrace) {
          subMenuItems.push(
            <MenuText
              key="trace"
              preIcon="ti ti-history"
              title={t("Push and Keep Trace")}
              onClick={async () => {
                close();
                await executePush(eligibleMoves, "trace", this.logger);
              }}
            />
          );
        }

        if (subMenuItems.length === 0) return null;

        return (
          <MenuText
            preIcon="ti ti-arrow-merge"
            title={t("Push Children to Referenced Block")}
            postIcon="ti ti-chevron-right"
          >
            <Menu>{subMenuItems}</Menu>
          </MenuText>
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
      `${this.name}.push-children`,
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
