import React from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { BazaarModal } from "./BazaarModal";

export default class BazaarPlugin extends BasePlugin {
  protected headbarButtonId = `${this.name}.bazaar`;

  public async load(): Promise<void> {
    orca.commands.registerCommand(
      "open-bazaar",
      this.openBazaar.bind(this),
      t("Open Bazaar"),
    );
  }

  public renderHeadbarButton(): React.ReactNode {
    const Button = orca.components.Button;
    return (
      <Button
        variant="plain"
        onClick={() => this.openBazaar()}
        title={t("Open Bazaar")}
      >
        <i className="ti ti-shopping-bag" style={{ fontSize: "16px" }} />
      </Button>
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
  }
}
