import { BasePlugin } from "@/libs/BasePlugin";
import { injectContextMenu } from "./context-menu";

export default class LinkToolsPlugin extends BasePlugin {
  private contextMenuInjector: ReturnType<typeof injectContextMenu> | null = null;



  public async load(): Promise<void> {
    this.contextMenuInjector = injectContextMenu(this.logger);
    this.logger.info(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    this.contextMenuInjector?.disconnect();
    this.contextMenuInjector = null;
    this.logger.info(`${this.name} unloaded.`);
  }
}
