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
    return allSettings[this.name] || {};
  }

  /**
   * Update settings for this sub-plugin
   */
  protected async updateSettings(partial: any) {
    const allSettings = orca.state.plugins[this.mainPluginName]?.settings || {};
    const currentSubSettings = allSettings[this.name] || {};
    const newSettings = {
      ...allSettings,
      [this.name]: {
        ...currentSubSettings,
        ...partial,
      },
    };
    await orca.plugins.setSettings("app", this.mainPluginName, newSettings);
  }

  /**
   * Render the settings for this sub-plugin.
   * Override this to provide a custom settings UI.
   */
  public renderSettings(): React.ReactNode | null {
    return null;
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
