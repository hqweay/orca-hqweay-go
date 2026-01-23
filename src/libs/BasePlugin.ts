import React from "react";
import { Logger } from "./logger";
import { t } from "./l10n";

export abstract class BasePlugin {
  protected mainPluginName: string;
  protected logger: Logger;
  protected name: string;

  constructor(mainPluginName: string, name: string) {
    this.mainPluginName = mainPluginName;
    this.name = name;
    this.logger = new Logger(name);
  }

  public abstract load(): Promise<void>;

  public abstract unload(): Promise<void>;

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

  /**
   * Get the settings scoped to this sub-plugin
   */
  protected getSettings(): any {
    const allSettings = orca.state.plugins[this.mainPluginName]?.settings || {};
    return allSettings[`${this.name}_config`] || {};
  }

  /**
   * Update settings for this sub-plugin.
   * Supports partial object update OR (key, value) for deep properties (e.g. "imageBed.owner").
   */
  public async updateSettings(pathOrPartial: any, value?: any) {
    const allSettings = orca.state.plugins[this.mainPluginName]?.settings || {};
    const configKey = `${this.name}_config`;
    const currentSubSettings = allSettings[configKey] || {};

    let nextSubSettings;
    if (typeof pathOrPartial === "string") {
      nextSubSettings = this.setDeepProperty(
        currentSubSettings,
        pathOrPartial,
        value,
      );
    } else {
      nextSubSettings = { ...currentSubSettings, ...pathOrPartial };
    }

    const newSettings = {
      ...allSettings,
      [configKey]: nextSubSettings,
    };
    await orca.plugins.setSettings("app", this.mainPluginName, newSettings);
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
