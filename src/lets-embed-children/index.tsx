import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import React, { useState } from "react";
import rawCss from "./style.css?raw";

export default class EmbedChildrenPlugin extends BasePlugin {
  protected settingsComponent = EmbedChildrenSettings;
  private styleElement: HTMLStyleElement | null = null;

  public getDefaultSettings(): any {
    return {
      tagName: "块嵌入子项",
    };
  }

  public async load(): Promise<void> {
    this.updateStyle();
    this.logger.debug(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    if (this.styleElement && this.styleElement.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement);
    }
    this.styleElement = null;
    this.logger.debug(`${this.name} unloaded.`);
  }

  protected async onConfigChanged(newConfig: any): Promise<void> {
    await super.onConfigChanged(newConfig);
    this.updateStyle();
  }

  private updateStyle() {
    if (!this.styleElement) {
      this.styleElement = document.createElement("style");
      this.styleElement.id = `orca-plugin-${this.name}-style`;
      document.head.appendChild(this.styleElement);
    }

    const settings = this.getSettings();
    const tagName = settings.tagName || "块嵌入子项";

    const css = rawCss.replace(/\{\{tagName\}\}/g, tagName);
    this.styleElement.textContent = css;
  }
}

function EmbedChildrenSettings({ plugin }: { plugin: EmbedChildrenPlugin }) {
  const settings = plugin["getSettings"]();
  const [config, setConfig] = useState(settings);

  const updateConfig = async (path: string, value: any) => {
    const keys = path.split(".");
    const newConfig = { ...config };
    let current = newConfig;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...current[keys[i]] };
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    setConfig(newConfig);
    await plugin["updateSettings"](newConfig);
  };

  const Input = orca.components.Input;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      <SettingsSection title={t("Embed Children Settings")}>
        <SettingsItem
          label={t("Tag Name")}
          description={t("The tag name to trigger the embed children style")}
        >
          <Input
            value={config.tagName || ""}
            onChange={(e: any) => updateConfig("tagName", e.target.value)}
          />
        </SettingsItem>
      </SettingsSection>
    </div>
  );
}
