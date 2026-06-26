import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { Block } from "../orca";
import { DemoPluginSettings } from "./settings";
import { executeDemoPluginLogic } from "./logic";

export default class DemoPlugin extends BasePlugin {
  // Uncomment and implement settings.tsx if your plugin needs configuration
  // protected settingsComponent = DemoPluginSettings;

  public async load(): Promise<void> {
    // Register Block Menu Command (Appears in block's ... menu)
    // this.registerBlockMenuCommand("some-action", {
    //   worksOnMultipleBlocks: false,
    //   render: (blockId: number, rootBlockId: number, close: any) => {
    //     const MenuText = orca.components.MenuText;
    //     if (!MenuText) return null;
    //     return (
    //       <MenuText
    //         preIcon="ti ti-star"
    //         title={t("Do Something")}
    //         onClick={() => {
    //           close();
    //           orca.commands.invokeCommand(`${this.name}.some-action`, blockId);
    //         }}
    //       />
    //     );
    //   },
    // });

    // Register Editor Command (Can be invoked via hotkey or Slash Command)
    // this.registerCommand(
    //   "some-action",
    //   async (blockId: number) => {
    //     const block = (await orca.invokeBackend("get-block", blockId)) as Block;
    //     if (!block) return;
    //     await executeDemoPluginLogic(block, this.logger);
    //   },
    //   t("Execute DemoPlugin Action")
    // );

    this.logger.debug(`${this.name} loaded.`);
  }
}
