import { formatUtil } from "@/utils/format";
import { setupL10N, t } from "@/libs/l10n";
import { BasePlugin } from "@/libs/BasePlugin";

export default class FormatPlugin extends BasePlugin {
  public async onLoad(): Promise<void> {
    const Button = orca.components.Button;

    if (orca.state.headbarButtons[`${this.name}.format-block`] == null) {
      orca.headbar.registerHeadbarButton(`${this.name}.format-block`, () => (
        <Button
          variant="plain"
          onClick={async () =>
            orca.commands.invokeCommand(`${this.name}.format-block`)
          }
        >
          <i className="ti ti-refresh" />
        </Button>
      ));
    }

    orca.commands.registerCommand(
      `${this.name}.format-block`,
      async () => {
        // 1. Get active panel info
        const panel = orca.state.activePanel;
        if (!panel) return;

        const viewPanel = orca.nav.findViewPanel(panel, orca.state.panels);
        if (!viewPanel) return;

        const { viewArgs } = viewPanel;
        if (!viewArgs) return;

        let rootBlockId: number | null = null;

        // 2. Determine root block ID
        if (viewArgs.date) {
          // It's a journal page
          const journalBlock = await orca.invokeBackend(
            "get-journal-block",
            viewArgs.date,
          );
          if (journalBlock) {
            rootBlockId = journalBlock.id;
          }
        } else if (viewArgs.blockId) {
          // It's a regular block page
          rootBlockId = viewArgs.blockId;
        }

        if (rootBlockId === null) return;

        // 3. Fetch block tree
        // User requested "top 2 levels". get-block-tree returns the whole tree.
        // We will traverse and filter manually for depth <= 2.
        const blockTree = await orca.invokeBackend(
          "get-block-tree",
          rootBlockId,
        );

        if (!blockTree) return;

        const updates: { id: number; content: any[] }[] = [];

        // Helper to process a block
        const processBlock = (block: any) => {
          if (
            block.content &&
            block.content.length === 1 &&
            block.content[0].t === "t"
          ) {
            const originalText = block.content[0].v;
            const formattedText = formatUtil.formatContent(originalText);

            if (formattedText !== originalText) {
              updates.push({
                id: block.id,
                content: [{ t: "t", v: formattedText }],
              });
            }
          }
        };

        // 4. Traverse tree (Root + Children + Grandchildren)
        // Level 0: Root
        // processBlock(rootBlock);

        // if (rootBlock.childrenBlocks) {
        for (const child of blockTree) {
          // Level 1: Immediate children
          processBlock(child);

          // if (child.childrenBlocks) {
          //   for (const grandChild of child.childrenBlocks) {
          //     // Level 2: Grandchildren
          //     processBlock(grandChild);
          //   }
          // }
        }
        // }

        // 5. Apply updates
        if (updates.length > 0) {
          await orca.commands.invokeEditorCommand(
            "core.editor.setBlocksContent",
            null, // cursor data not strictly needed for batch content update if we don't care about restoring cursor exactly here
            updates,
            false, // setBackCursor
          );

          // Notify user
          orca.broadcasts.broadcast("core.notify", {
            type: "success",
            message: `Formatted ${updates.length} blocks.`,
          });
        } else {
          orca.broadcasts.broadcast("core.notify", {
            type: "info",
            message: "No blocks needed formatting.",
          });
        }

        orca.notify("info", t(`Formatted ${updates.length} blocks.`));
      },
      t("Format Block"),
    );

    this.logger.info(`${this.name} loaded.`);
  }

  public async onUnload(): Promise<void> {
    orca.commands.unregisterCommand(`${this.name}.format-block`);
    this.logger.info(`${this.name} unloaded.`);
  }
}
