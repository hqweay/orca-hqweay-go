import React from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { BazaarModal } from "./BazaarModal";

export default class BazaarPlugin extends BasePlugin {
  public async load(): Promise<void> {
    orca.commands.registerCommand(
      "open-bazaar",
      this.openBazaar.bind(this),
      t("Open Bazaar"),
    );

    // Optional: Register a headbar button if desired
    // orca.headbar.registerHeadbarButton(...)
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

    root.render(React.createElement(BazaarModal, { onClose: handleClose }));
  }

  public async unload(): Promise<void> {
    const container = document.getElementById("bazaar-modal-container");
    if (container) {
      container.remove();
    }
    orca.commands.unregisterCommand("open-bazaar");
  }
}
