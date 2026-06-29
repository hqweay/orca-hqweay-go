import React from "react";
import { Logger } from "./logger";
import { t } from "./l10n";
import { PluginSettings } from "@/components/PluginSettings";
import { PluginSettingsAdapter } from "./PluginSettingsAdapter";

export abstract class BasePlugin {
  protected mainPluginName: string;
  protected logger: Logger;
  protected _name: string;
  get name(): string { return this._name; }
  protected headbarButtonId: string | null = null;
  protected isLoaded: boolean = false;

  protected _registeredCommandIds = new Set<string>();
  protected _registeredBlockMenuIds = new Set<string>();
  protected _cleanupFns: (() => void)[] = [];
  protected settingsAdapter: PluginSettingsAdapter;

  constructor(mainPluginName: string, name: string) {
    this.mainPluginName = mainPluginName;
    this._name = name;
    this.logger = new Logger(name);
    this.settingsAdapter = new PluginSettingsAdapter(
      this.mainPluginName,
      this._name,
      () => this.getDefaultSettings(),
      (config) => this.onConfigChanged(config),
      this.logger
    );
  }

  public getDisplayName(): string {
    return t(this._name);
  }

  public getDescription(): string {
    return t(`${this._name}.description`);
  }

  /**
   * Translates a key, automatically prefixing it with the plugin name.
   */
  public t(key: string, args?: { [key: string]: string }): string {
    return t(`${this._name}.${key}`, args);
  }

  public abstract load(): Promise<void>;

  /**
   * Called when the plugin is unloaded.
   * Override if you need to perform manual cleanup (e.g. intervals, DOM elements).
   * Note: Commands and Block Menus registered via helpers are cleaned up automatically.
   */
  public async unload(): Promise<void> {}

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

    // Auto unregister commands
    for (const fullId of this._registeredCommandIds) {
      try {
        orca.commands.unregisterCommand(fullId);
      } catch (e) {
        this.logger.error(`Error unregistering command ${fullId}`, e);
      }
    }
    this._registeredCommandIds.clear();

    // Auto unregister block menus
    if (orca.blockMenuCommands && orca.blockMenuCommands.unregisterBlockMenuCommand) {
      for (const fullId of this._registeredBlockMenuIds) {
        try {
          orca.blockMenuCommands.unregisterBlockMenuCommand(fullId);
        } catch (e) {
          this.logger.error(`Error unregistering block menu command ${fullId}`, e);
        }
      }
    }
    this._registeredBlockMenuIds.clear();

    // Execute arbitrary cleanup closures
    for (const fn of this._cleanupFns) {
      try {
        fn();
      } catch (e) {
        this.logger.error("Error during cleanup", e);
      }
    }
    this._cleanupFns = [];

    this.settingsAdapter.dispose();

    this.logger.info("Sub-plugin unloaded");
  }

  // --- Auto-Cleanup Registration Helpers ---

  protected registerCommand(id: string, callback: any, title: string = "") {
    const fullId = `${this._name}.${id}`;
    orca.commands.registerCommand(fullId, callback, title);
    this._registeredCommandIds.add(fullId);
  }

  protected unregisterCommand(id: string) {
    const fullId = `${this._name}.${id}`;
    orca.commands.unregisterCommand(fullId);
    this._registeredCommandIds.delete(fullId);
  }

  protected registerBlockMenuCommand(id: string, options: any) {
    const fullId = `${this._name}.${id}`;
    if (orca.blockMenuCommands && orca.blockMenuCommands.registerBlockMenuCommand) {
      orca.blockMenuCommands.registerBlockMenuCommand(fullId, options);
      this._registeredBlockMenuIds.add(fullId);
    }
  }

  protected unregisterBlockMenuCommand(id: string) {
    const fullId = `${this._name}.${id}`;
    if (orca.blockMenuCommands && orca.blockMenuCommands.unregisterBlockMenuCommand) {
      orca.blockMenuCommands.unregisterBlockMenuCommand(fullId);
      this._registeredBlockMenuIds.delete(fullId);
    }
  }

  // ----------------------------------------

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
      [this._name]: {
        label: t("Enable ${name}", { name: displayName }),
        description:
          description !== `${this._name}.description`
            ? description
            : t("Enable ${name}", { name: displayName }),
        type: "boolean",
        defaultValue: false,
      },
    };
  }

  /**
   * Loaded settings from persistent storage
   */
  public async initializeSettings(): Promise<void> {
    await this.settingsAdapter.initializeSettings();
  }

  /**
   * Get the settings scoped to this sub-plugin
   */
  public getSettings(): any {
    return this.settingsAdapter.getSettings();
  }

  /**
   * Return the default settings for this sub-plugin.
   * Override this in child classes to provide specific defaults.
   */
  public getDefaultSettings(): any {
    return {
      headbarMode: "both",
    };
  }

  /**
   * Restore settings to their default values.
   */
  public async restoreDefaultSettings(): Promise<void> {
    await this.settingsAdapter.restoreDefaultSettings();
  }

  /**
   * Update settings for this sub-plugin.
   * Supports partial object update OR (key, value) for deep properties (e.g. "imageBed.owner").
   * This method uses debouncing (default 500ms) for persistence and hook triggering.
   */
  public async updateSettings(pathOrPartial: any, value?: any) {
    await this.settingsAdapter.updateSettings(pathOrPartial, value);
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
      `${this._name}.${key}`,
      value,
    );
  }

  /**
   * Generic data retrieval for sub-plugins.
   */
  public async getData(key: string): Promise<any> {
    return await orca.plugins.getData(
      this.mainPluginName,
      `${this._name}.${key}`,
    );
  }

  /**
   * (系统调用) 获取要在顶部栏动作菜单中显示的项。
   * 默认会根据 headbarMode 设置自动决定是否调用 renderHeadbarMenuItems。
   */
  public getHeadbarMenuItems(closeMenu: () => void): React.ReactNode[] {
    const settings = this.getSettings();
    const headbarMode = settings.headbarMode || "both";

    // 如果设置为仅独立按钮，则不显示在动作菜单中
    if (headbarMode === "standalone") {
      return [];
    }

    return this.renderHeadbarMenuItems(closeMenu);
  }

  /**
   * 渲染子插件特有的顶部栏动作菜单项。
   *
   * 场景：
   * 1. 只有当 headbarMode 为 'actions' 或 'both' 时才会被调用。
   * 2. 子插件只需返回具体的菜单项数组。
   */
  protected renderHeadbarMenuItems(_closeMenu: () => void): React.ReactNode[] {
    return [];
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
  public renderCustomSettings(
    _settings: any,
    _updateSettings: (val: any) => void,
  ): React.ReactNode {
    return null;
  }

  /**
   * Check if this sub-plugin has any settings to display.
   */
  public hasSettings(): boolean {
    if (this.settingsComponent) return true;
    if (this.headbarButtonId) return true;
    // 检测子类是否覆盖了 renderCustomSettings
    return (
      this.renderCustomSettings !== BasePlugin.prototype.renderCustomSettings
    );
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
    const content = this.settingsComponent
      ? React.createElement(this.settingsComponent, {
          plugin: this,
          key: this._name,
        })
      : React.createElement(PluginSettings, {
          plugin: this as any,
          key: this._name,
        });

    return React.createElement(SettingWrapper, {
      plugin: this,
      children: content,
      key: this._name,
    });
  }

  protected defineSetting(key: string, label: string, desc: string, def = "") {
    return {
      [`${this._name}.${key}`]: {
        label: t(`${this._name}.${label}`),
        description: t(desc),
        type: "string",
        defaultValue: def,
      },
    };
  }
}

function SettingWrapper({
  plugin,
  children,
}: {
  plugin: BasePlugin;
  children: React.ReactNode;
}) {
  const [version, setVersion] = React.useState(0);

  const handleRestore = async () => {
    if (confirm(t("Are you sure you want to restore default settings?"))) {
      await plugin.restoreDefaultSettings();
      setVersion((v) => v + 1);
      orca.notify("success", t("Settings restored to defaults"));
    }
  };

  return React.createElement(
    "div",
    {
      key: version,
      style: { display: "flex", flexDirection: "column", gap: "24px" },
    },
    children,
    React.createElement(
      "div",
      {
        style: {
          marginTop: "16px",
          paddingTop: "16px",
          borderTop: "1px solid var(--orca-color-border)",
          display: "flex",
          justifyContent: "flex-end",
        },
      },
      React.createElement(
        orca.components.Button,
        {
          variant: "outline",
          onClick: handleRestore,
        },
        t("Restore to Defaults"),
      ),
    ),
  );
}
