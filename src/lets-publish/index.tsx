import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { Block } from "../orca";
import { PublishSettings } from "./settings";
import { publishWorkflow } from "./logic";

export default class PublishPlugin extends BasePlugin {
  protected settingsComponent = PublishSettings;

  public async load(): Promise<void> {
    // Register Block Menu Command
    this.registerBlockMenuCommand("publish-block", {
      worksOnMultipleBlocks: false,
      render: (blockId: number, rootBlockId: number, close: any) => {
        const MenuText = orca.components.MenuText;
        if (!MenuText) return null;

        return (
          <MenuText
            preIcon="ti ti-book-upload"
            title={t("Publish to GitHub")}
            onClick={() => {
              close();
              orca.commands.invokeCommand(`${this.name}.publish-block`, blockId);
            }}
          />
        );
      },
    });

    // Register Command
    this.registerCommand(
      "publish-block",
      async (blockId: number) => {
        const block = (await orca.invokeBackend("get-block", blockId)) as Block;
        if (!block) {
          orca.notify("error", t("Block not found."));
          return;
        }

        orca.notify("info", t("Starting publish workflow..."));

        try {
          const settings = this.getSettings();
          await publishWorkflow(block, settings, this.logger);
          orca.notify("success", t("Published successfully!"));
        } catch (e: any) {
          this.logger.error("Publish failed", e);
          orca.notify("error", t(`Publish failed: ${e.message}`));
        }
      },
      t("Publish Block to GitHub"),
    );

    this.logger.debug(`${this.name} loaded.`);
  }
}
