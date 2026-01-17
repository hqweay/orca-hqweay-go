import { Logger } from "./logger";

export abstract class BasePlugin {
  protected logger: Logger;
  protected name: string;

  constructor(name: string) {
    this.name = name;
    this.logger = new Logger(name);
  }

  public abstract onLoad(pluginName: string): Promise<void>;

  public abstract onUnload(): Promise<void>;

  public getSettingsSchema(): any {
    return {};
  }
}
