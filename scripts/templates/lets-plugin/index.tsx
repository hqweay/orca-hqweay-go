import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { Block } from "../orca";
import { __PLUGIN_CLASS_NAME__Settings } from "./settings";
import { execute__PLUGIN_CLASS_NAME__Logic } from "./logic";

export default class __PLUGIN_CLASS_NAME__ extends BasePlugin {
  // Uncomment and implement settings.tsx if your plugin needs configuration
  // protected settingsComponent = __PLUGIN_CLASS_NAME__Settings;

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
    //         title={this.t("Do Something")}
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
    //     await execute__PLUGIN_CLASS_NAME__Logic(block, this.logger);
    //   },
    //   this.t("Execute __PLUGIN_CLASS_NAME__ Action")
    // );

    this.logger.debug(`${this.name} loaded.`);
  }
}
