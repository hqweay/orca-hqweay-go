import React from "react";
import { Logger } from "./logger";
import { t } from "./l10n";

export abstract class BasePlugin {
  protected mainPluginName: string;
  protected logger: Logger;
  protected name: string;
  protected isLoaded: boolean = false;

  constructor(mainPluginName: string, name: string) {
    this.mainPluginName = mainPluginName;
    this.name = name;
    this.logger = new Logger(name);
  }

  public abstract load(): Promise<void>;

  public abstract unload(): Promise<void>;

  public async safeLoad() {
    if (this.isLoaded) return;
    await this.load();
    this.isLoaded = true;
    this.logger.info("Sub-plugin loaded");
  }

  public async safeUnload() {
    if (!this.isLoaded) return;
    await this.unload();
    this.isLoaded = false;
    this.logger.info("Sub-plugin unloaded");
  }

  public getSettingsSchema(): any {
    return {
      [this.name]: {
        label: t("Enable ${name}", { name: this.name }),
        description: t("Enable ${name}", { name: this.name }),
        type: "boolean",
        defaultValue: false,
      },
    };
  }

  protected _config: any = {};

  /**
   * Loaded settings from persistent storage
   */
  public async initializeSettings(): Promise<void> {
    const rawData = await orca.plugins.getData(this.mainPluginName, this.name);
    if (rawData && typeof rawData === "string") {
      try {
        this._config = JSON.parse(rawData);
      } catch (e) {
        this.logger.error("Failed to parse settings", e);
        this._config = {};
      }
    } else {
      this._config = rawData || {};
    }
  }

  /**
   * Get the settings scoped to this sub-plugin
   */
  protected getSettings(): any {
    return this._config;
  }

  /**
   * Update settings for this sub-plugin.
   * Supports partial object update OR (key, value) for deep properties (e.g. "imageBed.owner").
   */
  public async updateSettings(pathOrPartial: any, value?: any) {
    let nextSubSettings;
    if (typeof pathOrPartial === "string") {
      nextSubSettings = this.setDeepProperty(
        this._config,
        pathOrPartial,
        value,
      );
    } else {
      nextSubSettings = { ...this._config, ...pathOrPartial };
    }

    this._config = nextSubSettings;

    this.logger.info("Settings updated", this._config);
    await orca.plugins.setData(
      this.mainPluginName,
      this.name,
      JSON.stringify(this._config),
    );

    // Trigger real-time configuration change hook
    await this.onConfigChanged(this._config);
  }

  /**
   * Hook called when configuration is updated via updateSettings.
   * Default implementation does nothing.
   */
  protected async onConfigChanged(_newConfig: any): Promise<void> {
    // Override in sub-plugins
  }

  /**
   * Generic data storage for sub-plugins.
   * Uses mainPluginName as namespace and prefixes key with sub-plugin name.
   */
  public async setData(key: string, value: any): Promise<void> {
    await orca.plugins.setData(
      this.mainPluginName,
      `${this.name}.${key}`,
      value,
    );
  }

  /**
   * Generic data retrieval for sub-plugins.
   */
  public async getData(key: string): Promise<any> {
    return await orca.plugins.getData(
      this.mainPluginName,
      `${this.name}.${key}`,
    );
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

  /**
   * Override this property to return the React component for the settings UI.
   */
  protected settingsComponent: React.ComponentType<{ plugin: any }> | null =
    null;

  /**
   * Render the settings for this sub-plugin.
   * Default implementation uses this.settingsComponent.
   */
  public renderSettings(): React.ReactNode | null {
    if (!this.settingsComponent) return null;
    return React.createElement(this.settingsComponent, { plugin: this });
  }

  protected defineSetting(key: string, label: string, desc: string, def = "") {
    return {
      [`${this.name}.${key}`]: {
        label: t(`${this.name}.${label}`),
        description: t(desc),
        type: "string",
        defaultValue: def,
      },
    };
  }
}
