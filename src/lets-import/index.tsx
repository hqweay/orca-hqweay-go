import zhCN from "@/translations/zhCN";
import { type MarkdownFile } from "./markdown/markdownImporter";
import { scanDirectoryForMarkdownFiles } from "./markdown/fileSystem";
import { FolderSelector } from "./markdown/importUI";
import React from "react";
import { setupL10N, t } from "@/libs/l10n";
let pluginName: string;

// Store UI state
let isImportDialogOpen = false;
let isFolderSelectorOpen = false;

let thisPluginName = "import";
async function createPage(markdownFile: MarkdownFile) {
  // Get file content using browser APIs
  const file: any = markdownFile.file;
  const content = await file.text();

  const fileName = file.name.split(".")[0];
  const tagOfPath: any = markdownFile.directoryHandle;

  console.log(`Importing file: ${fileName}`);
  console.log(`Importing tagOfPath: ${tagOfPath}`);

  // const tagId = await queryTag(tagOfPath);

  const mainBlockId = 4;

  // console.log(`Importing tagId: ${tagId}`);
  // if (tagId == undefined || tagId == null) {
  //   const result = await orca.commands.invokeEditorCommand(
  //     "core.editor.insertBlock",
  //     null,
  //     orca.state.blocks[mainBlockId], // 使用指定的块ID或当前位置
  //     "lastChild",
  //     [{ t: "t", v: `${tagOfPath}` }],
  //     { type: "text" }
  //   );

  //   console.log(`Importing result: ${result}`);
  // }

  // const result = await matter(content);
  // const frontMatter = result.data;
  // console.log("Front-matter 数据:", frontMatter);

  // const contentWithoutFrontMatter = result.content;

  // console.log("正文内容:", content);
  // Create page block
  const pageBlockId = await orca.commands.invokeEditorCommand(
    "core.editor.insertBlock",
    null,
    null,
    // orca.state.blocks[3],
    // "lastChild",
    null,
    [{ t: "t", v: fileName }],
    { type: "text" },
    // null,
    // new Date(frontMatter.date)
  );
  console.log(`Created page block with ID: ${pageBlockId}`);

  const tagId = await orca.commands.invokeEditorCommand(
    "core.editor.insertTag",
    null,
    pageBlockId,
    tagOfPath,
  );

  console.log("tagid", tagId);

  // await orca.commands.invokeEditorCommand(
  //   "core.editor.insertBlock",
  //   null,
  //   orca.state.blocks[mainBlockId], // 参考block（插入位置）
  //   "lastChild", // 位置：作为最后一个子块
  //   [{ t: "t", v: `${tagOfPath}` }], // 空内容
  //   { type: "link", tagId: tagId } // repr参数指定为tag类型
  // );

  const result = await orca.commands.invokeEditorCommand(
    "core.editor.insertBlock",
    null,
    orca.state.blocks[tagId], // 使用指定的块ID或当前位置
    "firstChild",
    [{ t: "t", v: `${tagOfPath}` }],
    { type: "text" }
  );

  // Set as long form display
  await orca.commands.invokeEditorCommand(
    "core.editor.toggleShowAsLongForm",
    null, // cursor can be null for this operation
    pageBlockId,
  );

  // Create alias to make it a page
  // const error = await orca.commands.invokeEditorCommand(
  //   "core.editor.createAlias",
  //   null,
  //   fileName,
  //   pageBlockId,
  //   true // asPage: true 创建为页面
  // );
  // if (error) {
  //   console.warn("Failed to create page alias:", error);
  // }

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

  console.log(`Successfully imported file: ${fileName}`);
  orca.notify("success", `Successfully imported: ${fileName}`);
}

// Inject CSS styles
function injectStyles() {
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

/**
 * Open folder selector
 */
function openFolderSelector() {
  if (isFolderSelectorOpen) return;
  isFolderSelectorOpen = true;

  const container = document.createElement("div");
  container.id = "folder-selector-dialog";
  document.body.appendChild(container);

  const root = (window as any).createRoot(container);

  const handleClose = () => {
    isFolderSelectorOpen = false;
    root.unmount();
    container.remove();
  };

  const handleFolderSelect = async (folderHandle: any) => {
    try {
      console.log("Scanning folder:", folderHandle);

      // Scan the selected folder for markdown files
      const files = await scanDirectoryForMarkdownFiles(folderHandle);

      console.log("Found markdown files:", files);
      // return;
      if (files.length === 0) {
        orca.notify("warn", "No markdown files found in the selected folder");
        handleClose();
        return;
      }

      console.log(`Found ${files.length} markdown files`);
      handleClose();

      for (const markdownFile of files) {
        if (markdownFile.file) {
          await createPage(markdownFile);
        }
      }
    } catch (error) {
      console.error("Failed to scan folder:", error);
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

export async function load(_name: string) {
  pluginName = _name;

  setupL10N(orca.state.locale, { "zh-CN": zhCN });
  injectStyles();

  // await orca.commands.invokeEditorCommand(
  //   "core.editor.insertLink",
  //   orca.state.cursor,
  //   true,
  //   4,
  //   "Referenced Block"
  // );

  // const someBlock = orca.state.blocks[4];
  // const newBlockId = await orca.commands.invokeEditorCommand(
  //   "core.editor.insertBlock",
  //   null, // cursor data (can be null if not needed for context)
  //   someBlock,
  //   "lastChild",
  //   [{ t: "t", v: "New block content" }]
  // );

  // console.log("result", newBlockId);

  try {
    orca.commands.registerCommand(
      `${thisPluginName}.importMarkdownFromFolder`,
      () => openFolderSelector(),
      "Import Markdown from Folder",
    );

    // orca.headbar.registerHeadbarButton(
    //   `${pluginName}.importMarkdownFromFolder`,
    //   () => {
    //     const Button = orca.components.Button;
    //     return React.createElement(
    //       Button,
    //       {
    //         variant: "plain",
    //         onClick: () =>
    //           orca.commands.invokeCommand(
    //             `${pluginName}.importMarkdownFromFolder`,
    //           ),
    //       },
    //       React.createElement("i", { className: "ti ti-file-import" }),
    //     );
    //   },
    // );
    const Button = orca.components.Button;
    const HoverContextMenu = orca.components.HoverContextMenu;
    const MenuText = orca.components.MenuText;

    orca.headbar.registerHeadbarButton("import", () => (
      <HoverContextMenu
        menu={(closeMenu: () => void) => (
          <>
            <MenuText
              title={t("Import Markdown from Folder")}
              onClick={async () => {
                closeMenu();
                await orca.commands.invokeCommand(
                  `${thisPluginName}.importMarkdownFromFolder`,
                );
              }}
            />
            <MenuText
              title={t("Import CSV")}
              onClick={async () => {
                closeMenu();
                await orca.commands.invokeCommand(
                  `${thisPluginName}.importCSV`,
                );
              }}
            />
          </>
        )}
      >
        <Button variant="plain">
          <i className="ti ti-file-import"></i>
        </Button>
      </HoverContextMenu>
    ));

    setupL10N(orca.state.locale, { "zh-CN": zhCN });

    // 方法2：直接创建页面别名
    const aliasName = "项目文档";
    const pageBlockId = await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock",
      null,
      null,
      null,
      [{ t: "t", v: aliasName }],
    );

    const error = await orca.commands.invokeEditorCommand(
      "core.editor.createAlias",
      null,
      aliasName,
      pageBlockId,
      true, // asPage: true 创建为页面
    );

    // const newBlockId = await orca.commands.invokeEditorCommand(
    //   "core.editor.insertBlock",
    //   null, // cursor data (can be null if not needed for context)
    //   null,
    //   "after",
    //   [{ t: "t", v: "New block content" }]
    // );

    // const someBlock = orca.state.blocks[532];
    // const multiLineText = "Firs4t line\n\nSec3ond line\n\n2Third line";
    // await orca.commands.invokeEditorCommand(
    //   "core.editor.batchInsertText",
    //   null,
    //   someBlock,
    //   "lastChild",
    //   multiLineText,
    //   false, // skipMarkdown
    //   false // skipTags
    // );

    // const propertiesToSet = [
    //   { name: "status1", value: "completed", type: PropType.Text },
    //   { name: "priority", value: 1, type: PropType.Number },
    //   { name: "archived", value: 2, type: PropType.Number },
    //   {
    //     name: "test112",
    //     typeArgs: {
    //       choices: [{ n: "Wo2rk" }, { n: "Personal" }, { n: "Proj2ect" }],
    //       subType: "multi",
    //     },
    //     type: 6,
    //     pos: 0,
    //     value: "Work",
    //   },
    // ];
    // await orca.commands.invokeEditorCommand(
    //   "core.editor.setProperties",
    //   null,
    //   [343],
    //   propertiesToSet
    // );

    // 注册CSV导入命令
    orca.commands.registerCommand(
      `${thisPluginName}.importCSV`,
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
                  console.error("CSV import failed:", error);
                  orca.notify("error", t("csv.import.error"));
                  throw error;
                }
              },
            }),
          );
        } catch (error) {
          console.error("Failed to open CSV import:", error);
          orca.notify("error", t("csv.import.error"));
        }
      },
      t("csv.import.selectFile"),
    );

    // // 注册工具栏按钮
    // orca.toolbar.registerToolbarButton("letsgo.importCSV", {
    //   icon: "ti ti-file-spreadsheet",
    //   tooltip: t("csv.import.selectFile"),
    //   command: "letsgo.importCSV",
    // });

    // // 注册slash命令
    // orca.slashCommands.registerSlashCommand("letsgo.importCSV", {
    //   icon: "ti ti-file-spreadsheet",
    //   group: "Import",
    //   title: t("csv.import.selectFile"),
    //   command: "letsgo.importCSV",
    // });

    // 注册headbar按钮
    // orca.headbar.registerHeadbarButton("letsgo.importCSV", () => {
    //   const Button = orca.components.Button;
    //   return React.createElement(
    //     Button,
    //     {
    //       variant: "plain",
    //       onClick: () => orca.commands.invokeCommand("letsgo.importCSV"),
    //     },
    //     React.createElement("i", { className: "ti ti-file-spreadsheet" }),
    //   );
    // });

    console.log(`${thisPluginName} loaded with CSV import functionality.`);
  } catch (error) {
    console.error("Failed to load Markdown Import Plugin:", error);
  }
}

export async function unload() {
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
    isImportDialogOpen = false;
    isFolderSelectorOpen = false;

    // Unregister commands
    orca.commands.unregisterCommand(`${thisPluginName}.importMarkdown`);
    orca.commands.unregisterCommand(`${thisPluginName}.importSingleMarkdown`);
    orca.commands.unregisterCommand(
      `${thisPluginName}.importMarkdownFromFolder`,
    );

    // Unregister UI elements
    orca.toolbar.unregisterToolbarButton(`${thisPluginName}.importButton`);

    console.log(`${thisPluginName} unloaded successfully`);
  } catch (error) {
    console.error("Error during plugin unload:", error);
  }

  // 清理资源
  try {
    orca.commands.unregisterCommand(`${thisPluginName}.importCSV`);
    orca.toolbar.unregisterToolbarButton(`${thisPluginName}.importCSV`);
    orca.slashCommands.unregisterSlashCommand(`${thisPluginName}.importCSV`);
    orca.headbar.unregisterHeadbarButton(`${thisPluginName}.importCSV`);

    // 清理modal容器
    const modalContainer = document.getElementById(
      "csv-import-modal-container",
    );
    if (modalContainer) {
      modalContainer.remove();
    }
  } catch (error) {
    console.error("Error during plugin unload:", error);
  }
}
