import { Logger } from "./logger";

export class PluginSettingsAdapter {
  private config: any = {};
  private saveTimer: any = null;

  constructor(
    private mainPluginName: string,
    private name: string,
    private getDefaults: () => any,
    private onConfigChanged: (config: any) => Promise<void>,
    private logger: Logger
  ) {}

  public async initializeSettings(): Promise<void> {
    const rawData = await orca.plugins.getData(this.mainPluginName, this.name);
    let diskConfig = {};

    if (rawData && typeof rawData === "string") {
      try {
        diskConfig = JSON.parse(rawData);
      } catch (e) {
        this.logger.error("Failed to parse settings", e);
      }
    } else if (rawData && typeof rawData === "object") {
      diskConfig = rawData;
    }

    // Merge with defaults
    this.config = { ...this.getDefaults(), ...diskConfig };
  }

  public getSettings(): any {
    return this.config;
  }

  public async restoreDefaultSettings(): Promise<void> {
    const defaults = this.getDefaults();
    // Replacing entirely, not merging
    this.config = { ...defaults };

    // Persist immediately
    await orca.plugins.setData(
      this.mainPluginName,
      this.name,
      JSON.stringify(this.config),
    );

    // Trigger effects
    await this.onConfigChanged(this.config);
    this.logger.info("Settings restored to defaults");
  }

  public async updateSettings(pathOrPartial: any, value?: any) {
    let nextSubSettings;
    if (typeof pathOrPartial === "string") {
      nextSubSettings = this.setDeepProperty(
        this.config,
        pathOrPartial,
        value,
      );
    } else {
      nextSubSettings = { ...this.config, ...pathOrPartial };
    }

    // 1. Update in-memory state immediately for UI responsiveness
    this.config = nextSubSettings;

    // 2. Debounce persistence and side-effects
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(async () => {
      this.logger.info(
        "Persisting settings after debounce",
        this.name,
        this.config,
      );

      // Persistence
      await orca.plugins.setData(
        this.mainPluginName,
        this.name,
        JSON.stringify(this.config),
      );

      // Trigger real-time configuration change hook
      await this.onConfigChanged(this.config);

      this.saveTimer = null;
    }, 2000);
  }

  public dispose() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  private setDeepProperty(obj: any, path: string, value: any): any {
    const keys = path.split(".");
    const newObj = { ...obj };
    let current = newObj;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...current[keys[i]] };
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return newObj;
  }
}
