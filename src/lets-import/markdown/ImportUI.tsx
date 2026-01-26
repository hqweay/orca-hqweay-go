import { useState } from "react";
import type {
  ImportOptions,
  ImportResult,
  MarkdownFile,
} from "./markdownImporter";
import { selectFolder } from "./fileSystem";

interface ImportDialogProps {
  onImport: (
    files: MarkdownFile[],
    options: ImportOptions,
  ) => Promise<ImportResult>;
  onClose: () => void;
}

export function ImportDialog({ onImport, onClose }: ImportDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<MarkdownFile[]>([]);
  const [options, setOptions] = useState<ImportOptions>({
    createFolderBlocks: true,
    preserveFileNameAsTitle: true,
    folderAsPageTitle: false,
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleFileSelect = async () => {
    try {
      // Simple file selection for now
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = ".md,.markdown,.mdx,text/markdown,text/plain";
      input.style.display = "none";

      input.onchange = async (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          const markdownFiles: MarkdownFile[] = [];
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name.match(/\.(md|markdown|mdx)$/i)) {
              const content = await file.text();
              markdownFiles.push({
                path: file.name,
                name: file.name,
                content: content,
                relativePath: file.webkitRelativePath || file.name,
                file: file,
              });
            }
          }
          setSelectedFiles((prev) => [...prev, ...markdownFiles]);
        }
        document.body.removeChild(input);
      };

      document.body.appendChild(input);
      input.click();
    } catch (error) {
      console.error("Failed to select files:", error);
      orca.notify("error", "Failed to select files");
    }
  };

  const handleImport = async () => {
    if (selectedFiles.length === 0) {
      orca.notify("warn", "Please select at least one markdown file");
      return;
    }

    setIsImporting(true);
    try {
      const result = await onImport(selectedFiles, options);
      setImportResult(result);

      if (result.success) {
        orca.notify("success", result.message);
      } else {
        orca.notify("error", result.message);
      }
    } catch (error) {
      const errorMsg = "Import failed with unexpected error";
      orca.notify("error", errorMsg);
      setImportResult({
        success: false,
        message: errorMsg,
        importedFiles: 0,
        createdBlocks: 0,
        errors: [errorMsg],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      onClose();
    }
  };

  return (
    <div className="import-dialog-overlay">
      <div className="import-dialog">
        <div className="dialog-header">
          <h2>Import Markdown Files</h2>
          <button
            className="close-btn"
            onClick={handleClose}
            disabled={isImporting}
          >
            ×
          </button>
        </div>

        <div className="dialog-content">
          <div className="file-selection-section">
            <h3>Select Files</h3>
            <button
              className="select-files-btn"
              onClick={handleFileSelect}
              disabled={isImporting}
            >
              Select Markdown Files
            </button>

            {selectedFiles.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <h4>Selected Files ({selectedFiles.length})</h4>
                <div
                  style={{
                    maxHeight: "200px",
                    overflowY: "auto",
                    border: "1px solid var(--orca-color-border, #e0e0e0)",
                    borderRadius: "4px",
                    padding: "8px",
                  }}
                >
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      style={{
                        padding: "4px 0",
                        borderBottom:
                          index < selectedFiles.length - 1
                            ? "1px solid #eee"
                            : "none",
                      }}
                    >
                      {file.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="dialog-footer">
            <button
              className="cancel-btn"
              onClick={handleClose}
              disabled={isImporting}
            >
              Cancel
            </button>
            <button
              className="import-btn"
              onClick={handleImport}
              disabled={selectedFiles.length === 0 || isImporting}
            >
              {isImporting ? "Importing..." : "Import Files"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Folder selection component
 */
interface FolderSelectorProps {
  onFolderSelect: (folderHandle: any) => void;
  onCancel: () => void;
}

export function FolderSelector({
  onFolderSelect,
  onCancel,
}: FolderSelectorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFolderHandle, setSelectedFolderHandle] = useState<any>(null);

  const handleSelectFolder = async () => {
    setIsLoading(true);
    try {
      const folderHandle = await selectFolder();
      if (folderHandle) {
        setSelectedFolderHandle(folderHandle);
        // Auto-trigger folder select after selection
        onFolderSelect(folderHandle);
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
      orca.notify("error", "Failed to select folder");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="folder-selector-overlay">
      <div className="folder-selector">
        <div className="selector-header">
          <h3>Select Folder</h3>
          <button className="close-btn" onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="selector-content">
          <div className="folder-path-input">
            <label>
              Choose a folder containing markdown files, folder will be assigned
              as tag:
            </label>
          </div>

          <button
            className="browse-btn"
            onClick={handleSelectFolder}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Browse Folder..."}
          </button>
        </div>

        <div className="selector-footer">
          <button className="cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="confirm-btn"
            onClick={onCancel}
            disabled={isLoading}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
