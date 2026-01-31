import React, { useState } from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { BrowserModal } from "./BrowserModal";

export default class BrowserDemoPlugin extends BasePlugin {
  public async load(): Promise<void> {
    this.logger.info(`${this.name} loaded.`);

    const commandId = `${this.name}.open`;
    orca.commands.registerCommand(
      commandId,
      () => {
        this.openBrowserModal();
      },
      t("Browser Demo: Open Douban"),
    );
  }

  public async unload(): Promise<void> {
    const commandId = `${this.name}.open`;
    orca.commands.unregisterCommand(commandId);
    this.closeBrowserModal();
    this.logger.info(`${this.name} unloaded.`);
  }

  private modalRoot: any = null;
  private modalContainer: HTMLElement | null = null;

  private openBrowserModal() {
    // Ensure only one instance
    if (this.modalContainer) return;

    this.modalContainer = document.createElement("div");
    document.body.appendChild(this.modalContainer);

    const { createRoot } = window as any;
    this.modalRoot = createRoot(this.modalContainer);

    const handleClose = () => {
      this.closeBrowserModal();
    };

    this.modalRoot.render(
      <BrowserModal visible={true} onClose={handleClose} />,
    );
  }

  private closeBrowserModal() {
    if (this.modalRoot) {
      this.modalRoot.unmount();
      this.modalRoot = null;
    }
    if (this.modalContainer) {
      this.modalContainer.remove();
      this.modalContainer = null;
    }
  }
}
