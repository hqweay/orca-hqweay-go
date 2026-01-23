import zhCN from "@/translations/zhCN";
import { type MarkdownFile } from "./markdown/markdownImporter";
import { scanDirectoryForMarkdownFiles } from "./markdown/fileSystem";
import { FolderSelector } from "./markdown/importUI";
import React from "react";
import { setupL10N, t } from "@/libs/l10n";
import { BasePlugin } from "@/libs/BasePlugin";
import { formatUtil } from "@/libs/format";

export default class ImportPlugin extends BasePlugin {
  private isFolderSelectorOpen = false;

  private async createPage(markdownFile: MarkdownFile) {
    // Get file content using browser APIs
    const file: any = markdownFile.file;
    let content = await file.text();

    // todo 导入前格式化一下
    content = formatUtil.formatContent(content);
    content = content.replace("(assets/", "(./");

    const fileName = file.name.split(".")[0];
    const tagOfPath: any = markdownFile.directoryHandle;

    this.logger.info(`Importing file: ${fileName}`);
    this.logger.info(`Importing tagOfPath: ${tagOfPath}`);

    // Create page block
    const pageBlockId = await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock",
      null,
      null,
      null,
      [{ t: "t", v: fileName }],
      { type: "text" },
    );
    this.logger.info(`Created page block with ID: ${pageBlockId}`);

    const tagId = await orca.commands.invokeEditorCommand(
      "core.editor.insertTag",
      null,
      pageBlockId,
      tagOfPath,
    );

    this.logger.info("tagid", tagId);

    // const result = await orca.commands.invokeEditorCommand(
    //   "core.editor.insertBlock",
    //   null,
    //   orca.state.blocks[tagId], // 使用指定的块ID或当前位置
    //   "firstChild",
    //   [{ t: "t", v: `${tagOfPath}` }],
    //   { type: "text" },
    // );

    // Set as long form display
    await orca.commands.invokeEditorCommand(
      "core.editor.toggleShowAsLongForm",
      null, // cursor can be null for this operation
      pageBlockId,
    );

    // Insert content as text blocks
    const someBlock = orca.state.blocks[pageBlockId];
    await orca.commands.invokeEditorCommand(
      "core.editor.batchInsertText",
      null, // cursor
      someBlock,
      "lastChild",
      content,
      false, // skipMarkdown
      false, // skipTags
    );

    this.logger.info(`Successfully imported file: ${fileName}`);
    orca.notify("success", `Successfully imported: ${fileName}`);
  }

  private injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
    .import-dialog-overlay,
    .folder-selector-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .import-dialog,
    .folder-selector {
      background: var(--orca-color-bg-1, #ffffff);
      border: 1px solid var(--orca-color-border, #e0e0e0);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      min-width: 500px;
      max-width: 700px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }

    .dialog-header,
    .selector-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--orca-color-border, #e0e0e0);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .dialog-header h2,
    .selector-header h3 {
      margin: 0;
      color: var(--orca-color-text-1, #333);
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--orca-color-text-2, #666);
      padding: 0;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }

    .close-btn:hover {
      background: var(--orca-color-bg-2, #f5f5f5);
      color: var(--orca-color-text-1, #333);
    }

    .dialog-content {
      padding: 20px;
      flex: 1;
      overflow-y: auto;
    }

    .select-files-btn,
    .browse-btn {
      background: var(--orca-color-primary-5, #007bff);
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }

    .select-files-btn:hover,
    .browse-btn:hover {
      background: var(--orca-color-primary-6, #0056b3);
    }

    .dialog-footer,
    .selector-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--orca-color-border, #e0e0e0);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .cancel-btn,
    .import-btn,
    .confirm-btn {
      padding: 8px 16px;
      border: 1px solid var(--orca-color-border, #e0e0e0);
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }

    .cancel-btn {
      background: var(--orca-color-bg-1, #ffffff);
      color: var(--orca-color-text-1, #333);
    }

    .cancel-btn:hover {
      background: var(--orca-color-bg-2, #f8f9fa);
    }

    .import-btn,
    .confirm-btn {
      background: var(--orca-color-primary-5, #007bff);
      color: white;
      border-color: var(--orca-color-primary-5, #007bff);
    }

    .import-btn:hover,
    .confirm-btn:hover {
      background: var(--orca-color-primary-6, #0056b3);
    }

    .folder-selector .selector-content {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .folder-path-input {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .folder-path-input label {
      font-weight: 500;
      color: var(--orca-color-text-1, #333);
    }

    .folder-path-input input {
      padding: 8px 12px;
      border: 1px solid var(--orca-color-border, #e0e0e0);
      border-radius: 4px;
      font-size: 14px;
    }

    .folder-path-input input:focus {
      outline: none;
      border-color: var(--orca-color-primary-5, #007bff);
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }
  `;
    style.setAttribute("data-plugin", "import-markdown");
    document.head.appendChild(style);
  }

  private openFolderSelector() {
    if (this.isFolderSelectorOpen) return;
    this.isFolderSelectorOpen = true;

    const container = document.createElement("div");
    container.id = "folder-selector-dialog";
    document.body.appendChild(container);

    const root = (window as any).createRoot(container);

    const handleClose = () => {
      this.isFolderSelectorOpen = false;
      root.unmount();
      container.remove();
    };

    const handleFolderSelect = async (folderHandle: any) => {
      try {
        this.logger.info("Scanning folder:", folderHandle);

        // Scan the selected folder for markdown files
        const files = await scanDirectoryForMarkdownFiles(folderHandle);

        this.logger.info("Found markdown files:", files);
        if (files.length === 0) {
          orca.notify("warn", "No markdown files found in the selected folder");
          handleClose();
          return;
        }

        this.logger.info(`Found ${files.length} markdown files`);
        handleClose();

        for (const markdownFile of files) {
          if (markdownFile.file) {
            await this.createPage(markdownFile);
          }
        }
      } catch (error) {
        this.logger.error("Failed to scan folder:", error);
        orca.notify(
          "error",
          `Failed to scan folder: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
        handleClose();
      }
    };

    root.render(
      window.React.createElement(FolderSelector, {
        onFolderSelect: handleFolderSelect,
        onCancel: handleClose,
      }),
    );
  }

  public async load(): Promise<void> {
    setupL10N(orca.state.locale, { "zh-CN": zhCN });
    this.injectStyles();

    try {
      orca.commands.registerCommand(
        `${this.name}.importMarkdownFromFolder`,
        () => this.openFolderSelector(),
        t("Import Markdown from Folder"),
      );

      // 方法2：直接创建页面别名
      const aliasName = "项目文档";
      const pageBlockId = await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        null,
        null,
        [{ t: "t", v: aliasName }],
      );

      await orca.commands.invokeEditorCommand(
        "core.editor.createAlias",
        null,
        aliasName,
        pageBlockId,
        true, // asPage: true 创建为页面
      );

      // 注册CSV导入命令
      orca.commands.registerCommand(
        `${this.name}.importCSV`,
        async () => {
          try {
            // 直接创建弹窗容器并显示CSV导入模态框
            const { createRoot } = window;
            const modalContainer = document.createElement("div");
            modalContainer.id = "csv-import-modal-container";
            document.body.appendChild(modalContainer);

            const root = createRoot(modalContainer);
            const { CSVImportModal } = await import("./csv/CSVImportModal");
            const { CSVImporter } = await import("./csv/csvImporter");
            const csvImporter = new CSVImporter();

            root.render(
              React.createElement(CSVImportModal, {
                visible: true,
                onClose: () => {
                  root.unmount();
                  modalContainer.remove();
                },
                onImport: async (config: any) => {
                  try {
                    const result = await csvImporter.importFromConfig(config);

                    if (result.failed > 0) {
                      orca.notify(
                        "warn",
                        t("csv.import.error") +
                          `: ${result.success} 成功, ${result.failed} 失败`,
                      );
                    } else {
                      orca.notify(
                        "success",
                        t("csv.import.success") +
                          `: 成功导入 ${result.success} 个块`,
                      );
                    }

                    // 关闭弹窗
                    root.unmount();
                    modalContainer.remove();
                  } catch (error) {
                    this.logger.error("CSV import failed:", error);
                    orca.notify("error", t("csv.import.error"));
                    throw error;
                  }
                },
              }),
            );
          } catch (error) {
            this.logger.error("Failed to open CSV import:", error);
            orca.notify("error", t("csv.import.error"));
          }
        },
        t("csv.import.selectFile"),
      );

      this.logger.info(`${this.name} loaded with CSV import functionality.`);
    } catch (error) {
      this.logger.error("Failed to load Markdown Import Plugin:", error);
    }
  }

  public async unload(): Promise<void> {
    try {
      // Close any open dialogs
      [
        "import-markdown-dialog",
        "folder-selector-dialog",
        "import-markdown-dialog-with-files",
      ].forEach((id) => {
        const container = document.getElementById(id);
        if (container) container.remove();
      });

      // Reset state
      this.isFolderSelectorOpen = false;

      // Unregister commands
      orca.commands.unregisterCommand(`${this.name}.importMarkdown`);
      orca.commands.unregisterCommand(`${this.name}.importSingleMarkdown`);
      orca.commands.unregisterCommand(`${this.name}.importMarkdownFromFolder`);

      // Unregister UI elements
      orca.toolbar.unregisterToolbarButton(`${this.name}.importButton`);

      this.logger.info(`${this.name} unloaded successfully`);
    } catch (error) {
      this.logger.error("Error during plugin unload:", error);
    }

    // 清理资源
    try {
      orca.commands.unregisterCommand(`${this.name}.importCSV`);
      orca.toolbar.unregisterToolbarButton(`${this.name}.importCSV`);
      orca.slashCommands.unregisterSlashCommand(`${this.name}.importCSV`);
      orca.headbar.unregisterHeadbarButton(`${this.name}.importCSV`);

      // 清理modal容器
      const modalContainer = document.getElementById(
        "csv-import-modal-container",
      );
      if (modalContainer) {
        modalContainer.remove();
      }
    } catch (error) {
      this.logger.error("Error during plugin unload:", error);
    }
  }

  public getHeadbarMenuItems(closeMenu: () => void): React.ReactNode[] {
    const MenuText = orca.components.MenuText;
    return [
      React.createElement(MenuText, {
        preIcon: "ti ti-folder",
        key: "import-markdown",
        title: t("Import Markdown from Folder"),
        onClick: async () => {
          closeMenu();
          await orca.commands.invokeCommand(
            `${this.name}.importMarkdownFromFolder`,
          );
        },
      }),
      React.createElement(MenuText, {
        preIcon: "ti ti-file-spreadsheet",
        key: "import-csv",
        title: t("Import CSV"),
        onClick: async () => {
          closeMenu();
          await orca.commands.invokeCommand(`${this.name}.importCSV`);
        },
      }),
    ];
  }
}
