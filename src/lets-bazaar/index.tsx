import React, { useState } from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { BazaarModal } from "./BazaarModal";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";

function BazaarSettings({ plugin }: { plugin: BazaarPlugin }) {
  const settings = plugin["getSettings"]();
  const [headbarMode, setHeadbarMode] = useState(
    settings.headbarMode || "both",
  );

  const updateMode = async (value: string) => {
    setHeadbarMode(value);
    await plugin.updateSettings({ headbarMode: value });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SettingsSection title={t("Headbar Display Mode")}>
        <SettingsItem label={t("Display Mode")}>
          <orca.components.Select
            selected={[headbarMode]}
            options={[
              { value: "actions", label: t("Actions Menu") },
              { value: "standalone", label: t("Standalone Button") },
              { value: "both", label: t("Both") },
            ]}
            onChange={(selected) => updateMode(selected[0])}
          />
        </SettingsItem>
      </SettingsSection>
    </div>
  );
}

export default class BazaarPlugin extends BasePlugin {
  public async load(): Promise<void> {
    orca.commands.registerCommand(
      "open-bazaar",
      this.openBazaar.bind(this),
      t("Open Bazaar"),
    );

    this.registerHeadbar();
  }

  renderSettings() {
    return React.createElement(BazaarSettings, { plugin: this });
  }

  async onConfigChanged(_newConfig: any) {
    this.registerHeadbar();
  }

  private registerHeadbar() {
    const settings = this.getSettings();
    const mode = settings.headbarMode || "both";

    if (mode === "standalone" || mode === "both") {
      orca.headbar.registerHeadbarButton("bazaar-open", () =>
        this.renderHeadbarButton(),
      );
    } else {
      orca.headbar.unregisterHeadbarButton("bazaar-open");
    }
  }

  renderHeadbarButton() {
    const Button = orca.components.Button;
    return React.createElement(
      Button,
      {
        variant: "plain",
        onClick: () => this.openBazaar(),
        title: t("Open Bazaar"),
      },
      React.createElement("i", {
        className: "ti ti-shopping-bag",
        style: { fontSize: "16px" },
      }),
    );
  }

  public getHeadbarMenuItems(closeMenu: () => void): React.ReactNode[] {
    const settings = this.getSettings();
    const mode = settings.headbarMode || "actions";

    if (mode === "standalone") {
      return [];
    }

    const MenuText = orca.components.MenuText;
    return [
      React.createElement(MenuText, {
        key: "open-bazaar",
        title: t("Open Bazaar"),
        preIcon: "ti ti-shopping-bag",
        onClick: () => {
          closeMenu();
          this.openBazaar();
        },
      }),
      React.createElement(orca.components.MenuSeparator, {
        key: "sep-settings",
      }),
    ];
  }

  private openBazaar() {
    const container = document.createElement("div");
    container.id = "bazaar-modal-container";
    document.body.appendChild(container);

    const { createRoot } = window as any;
    const root = createRoot(container);

    const handleClose = () => {
      root.unmount();
      container.remove();
    };

    root.render(
      React.createElement(BazaarModal, {
        onClose: handleClose,
        pluginName: this.name,
      }),
    );
  }

  public async unload(): Promise<void> {
    const container = document.getElementById("bazaar-modal-container");
    if (container) {
      container.remove();
    }
    orca.commands.unregisterCommand("open-bazaar");
    orca.headbar.unregisterHeadbarButton("bazaar-open");
  }
}
