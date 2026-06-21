import { BasePlugin } from "@/libs/BasePlugin";
import { injectContextMenu } from "./context-menu";
import { t } from "@/libs/l10n";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";

export default class LinkToolsPlugin extends BasePlugin {
  private contextMenuInjector: ReturnType<typeof injectContextMenu> | null = null;

  public async load(): Promise<void> {
    this.contextMenuInjector = injectContextMenu(this.logger, this);
    this.logger.info(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    this.contextMenuInjector?.disconnect();
    this.contextMenuInjector = null;
    this.logger.info(`${this.name} unloaded.`);
  }

  public renderCustomSettings(settings: any, updateSettings: (newSettings: any) => void) {
    return (
      <div className="orca-settings-panel">
        <SettingsSection title={t("link-tools.settings") || "Link Tools Settings"}>
          <SettingsItem
            label={t("link-tools.enableRefToLink") || "Enable Ref to Link"}
            description={t("link-tools.enableRefToLinkDesc") || "Show option to convert reference to link in context menu."}
          >
            <orca.components.Switch
              on={settings.enableRefToLink ?? true}
              onChange={(checked: boolean) =>
                updateSettings({ enableRefToLink: checked })
              }
            />
          </SettingsItem>
          <SettingsItem
            label={t("link-tools.enableRefToPin") || "Enable Ref to Pin"}
            description={t("link-tools.enableRefToPinDesc") || "Show option to convert reference to pin in context menu."}
          >
            <orca.components.Switch
              on={settings.enableRefToPin ?? true}
              onChange={(checked: boolean) =>
                updateSettings({ enableRefToPin: checked })
              }
            />
          </SettingsItem>
          <SettingsItem
            label={t("link-tools.enableRefToTextPin") || "Enable Ref to Text Pin"}
            description={t("link-tools.enableRefToTextPinDesc") || "Show option to convert reference to text pin in context menu."}
          >
            <orca.components.Switch
              on={settings.enableRefToTextPin ?? true}
              onChange={(checked: boolean) =>
                updateSettings({ enableRefToTextPin: checked })
              }
            />
          </SettingsItem>
          <SettingsItem
            label={t("link-tools.enableLinkToRef") || "Enable Link to Ref"}
            description={t("link-tools.enableLinkToRefDesc") || "Show option to convert link to reference in context menu."}
          >
            <orca.components.Switch
              on={settings.enableLinkToRef ?? true}
              onChange={(checked: boolean) =>
                updateSettings({ enableLinkToRef: checked })
              }
            />
          </SettingsItem>
        </SettingsSection>
      </div>
    );
  }
}
