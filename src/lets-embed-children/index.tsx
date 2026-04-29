import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import React, { useState } from "react";

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

    const css = `
/* 1. 找到包含特定 span 的 .orca-repr-main */
.orca-repr-main:has(span[data-name="${tagName}"]) 
/* 2. 找到它紧邻的兄弟容器 .orca-repr-children */
+ .orca-repr-children 
/* 3. 找到该容器下第一层 block 里的主体内容 */
> .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-main {
  /* 在这里输入你的样式 */
  display: none;
}

.orca-repr-main:has(span[data-name="${tagName}"])
  + .orca-repr-children
  > .orca-block[data-type="mirror"]
  > .orca-repr
  > .orca-repr-children
  .orca-block[data-indent="3"] {
  --orca-block-indent: 2 !important;
}
.orca-repr-main:has(span[data-name="${tagName}"])
  + .orca-repr-children
  > .orca-block[data-type="mirror"]
  > .orca-repr
  > .orca-repr-children
  .orca-block[data-indent="4"] {
  --orca-block-indent: 3 !important;
}
.orca-repr-main:has(span[data-name="${tagName}"])
  + .orca-repr-children
  > .orca-block[data-type="mirror"]
  > .orca-repr
  > .orca-repr-children
  .orca-block[data-indent="5"] {
  --orca-block-indent: 4 !important;
}

/* 1. 找到包含特定 span 的 .orca-repr-main */
.orca-repr-main:has(span[data-name="${tagName}"]) 
/* 2. 找到它紧邻的兄弟容器 .orca-repr-children */
+ .orca-repr-children 
/* 3. 找到该容器下第一层 block 里的主体内容 */
> .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-children > .orca-block[data-type="ul"]  > .orca-repr
  > .orca-repr-main
  .orca-block-handle:not(:hover) {
  font-family: tabler-icons !important;
  /* speak: none; */
  font-style: normal;
  font-weight: 400;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.orca-repr-main:has(span[data-name="${tagName}"])
  + .orca-repr-children
  > .orca-block[data-type="mirror"]
  > .orca-repr
  > .orca-repr-children
  > .orca-block[data-type="ul"]
  > .orca-repr
  > .orca-repr-main
  .orca-block-handle:not(:hover) {
  --my-size-bullet: 16px;
  width: var(--my-size-bullet);
  height: var(--my-size-bullet);
  font-size: 19px;

  display: flex;
  justify-content: center;
  align-items: center;

  top: calc(0.5 * (var(--orca-block-line-height) - var(--my-size-bullet)));

  /* 统一icon、color、bg */
  &:before {
    content: "\\ff8d";
    font-size: unset;
    /* 覆盖掉ul的特殊颜色，采用默认颜色 */
    color: var(--orca-block-handle-passive-color);
  }
  &.orca-block-handle-collapsed:before {
    /* color: var(--my-color-mirror-block-handle); */
    width: unset;
    height: unset;
    background-color: unset;
  }
}

/* 【重定义】镜像块的缩进线 */
.orca-repr-main:has(span[data-name="${tagName}"])
  + .orca-repr-children
  > .orca-block[data-type="mirror"]
  > .orca-repr
  > .orca-repr-children
  > .orca-block[data-type="ul"]
  > .orca-repr
  > .orca-repr-main
  .orca-repr-scope-line {
  &:before {
    border-left: 2px dashed var(--orca-color-scope-line);
  }

  &:hover {
    background-color: unset;
  }

  &:hover:before {
    border-left-width: 3px;
  }
}
`;
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
