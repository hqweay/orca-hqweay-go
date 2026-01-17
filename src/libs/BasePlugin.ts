import { Logger } from "./logger";

export abstract class BasePlugin {
  protected mainPluginName: string;
  protected logger: Logger;
  protected name: string;

  constructor(mainPluginName: string, name: string) {
    this.mainPluginName = mainPluginName;
    this.name = name;
    this.logger = new Logger(name);
  }

  public abstract onLoad(): Promise<void>;

  public abstract onUnload(): Promise<void>;

  public getSettingsSchema(): any {
    return {};
  }
}
