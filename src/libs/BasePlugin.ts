import React from "react";
import { Logger } from "./logger";
import { t } from "./l10n";
import { PluginSettings } from "@/components/PluginSettings";

export abstract class BasePlugin {
  protected mainPluginName: string;
  protected logger: Logger;
  protected name: string;
  protected headbarButtonId: string | null = null;
  protected isLoaded: boolean = false;

  constructor(mainPluginName: string, name: string) {
    this.mainPluginName = mainPluginName;
    this.name = name;
    this.logger = new Logger(name);
  }

  public getDisplayName(): string {
    return t(this.name);
  }

  public getDescription(): string {
    return t(`${this.name}.description`);
  }

  public abstract load(): Promise<void>;

  public abstract unload(): Promise<void>;

  /**
   * Render headbar button for this plugin.
   * Return null if no button needed.
   */
  public renderHeadbarButton(): React.ReactNode {
    return null;
  }

  public async safeLoad() {
    if (this.isLoaded) return;
    await this.load();
    this.isLoaded = true;

    // Auto register headbar if needed
    this.syncHeadbar();

    this.logger.info("Sub-plugin loaded");
  }

  public async safeUnload() {
    if (!this.isLoaded) return;
    await this.unload();
    this.isLoaded = false;

    // Auto unregister headbar
    this.unregisterHeadbar();

    this.logger.info("Sub-plugin unloaded");
  }

  protected syncHeadbar() {
    if (!this.headbarButtonId) return;

    const settings = this.getSettings();
    const mode = settings.headbarMode || "both";

    const needsButton = mode === "standalone" || mode === "both";
    const isRegistered = !!orca.state.headbarButtons[this.headbarButtonId];

    if (needsButton) {
      if (!isRegistered) {
        orca.headbar.registerHeadbarButton(
          this.headbarButtonId,
          () => this.renderHeadbarButton() as React.ReactElement,
        );
      }
    } else {
      this.unregisterHeadbar();
    }
  }

  protected unregisterHeadbar() {
    if (this.headbarButtonId) {
      orca.headbar.unregisterHeadbarButton(this.headbarButtonId);
    }
  }

  public getSettingsSchema(): any {
    const displayName = this.getDisplayName();
    const description = this.getDescription();
    return {
      [this.name]: {
        label: t("Enable ${name}", { name: displayName }),
        description:
          description !== `${this.name}.description`
            ? description
            : t("Enable ${name}", { name: displayName }),
        type: "boolean",
        defaultValue: false,
      },
    };
  }

  protected _config: any = {};
  private _saveTimer: any = null;

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
  public getSettings(): any {
    return this._config;
  }

  /**
   * Update settings for this sub-plugin.
   * Supports partial object update OR (key, value) for deep properties (e.g. "imageBed.owner").
   * This method uses debouncing (default 500ms) for persistence and hook triggering.
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

    // 1. Update in-memory state immediately for UI responsiveness
    this._config = nextSubSettings;

    // 2. Debounce persistence and side-effects
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
    }

    this._saveTimer = setTimeout(async () => {
      this.logger.info("Persisting settings after debounce", this._config);

      // Persistence
      await orca.plugins.setData(
        this.mainPluginName,
        this.name,
        JSON.stringify(this._config),
      );

      // Trigger real-time configuration change hook
      await this.onConfigChanged(this._config);

      this._saveTimer = null;
      // 防抖时间长点，性能好些，没必要太快
    }, 2000);
  }

  /**
   * Hook called when configuration is updated via updateSettings.
   * Default implementation handles headbar visibility syncing.
   */
  protected async onConfigChanged(_newConfig: any): Promise<void> {
    this.syncHeadbar();
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

  /**
   * 返回要在顶部栏“三个点”动作菜单中显示的菜单项。
   *
   * @param _closeMenu 调用此函数以在点击项后关闭菜单
   * @returns React 节点数组 (例如 MenuText, MenuSeparator)
   *
   * 场景：
   * 1. 当 headbarMode 为 'actions' 或 'both' 时使用。
   * 2. 适用于不适合作为独立按钮显示的次要操作。
   */
  public getHeadbarMenuItems(_closeMenu: () => void): React.ReactNode[] {
    return [];
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
   * Internal use, please use renderCustomSettings for simpler customization.
   */
  protected settingsComponent: React.ComponentType<{ plugin: any }> | null =
    null;

  /**
   * Render custom settings UI for this sub-plugin.
   * Override this instead of renderSettings for standard layout.
   */
  protected renderCustomSettings(): React.ReactNode {
    return null;
  }

  /**
   * Check if this sub-plugin has any settings to display.
   */
  public hasSettings(): boolean {
    if (this.settingsComponent) return true;
    if (this.headbarButtonId) return true;
    if (this.renderCustomSettings() !== null) return true;
    return false;
  }

  /**
   * 渲染插件的设置界面。
   *
   * 场景：
   * 1. 框架自动调用，用于在设置中心展示该子插件的配置项。
   * 2. 默认会自动包裹 PluginSettings (包含顶部栏显示模式切换)。
   *
   * 注意：
   * - 如果只需要增加简单的业务配置，请优先覆盖 renderCustomSettings()。
   * - 只有在需要完全接管整个设置页渲染逻辑时，才手动赋值 settingsComponent。
   */
  public renderSettings(): React.ReactNode | null {
    // 如果覆盖 settingsComponent，展示自定义的子插件配置面板
    if (this.settingsComponent) {
      return React.createElement(this.settingsComponent, { plugin: this });
    }

    // 默认展示 PluginSettings，包含顶部栏显示模式切换
    return React.createElement(PluginSettings, {
      plugin: this as any,
      customSettings: this.renderCustomSettings(),
    });
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
