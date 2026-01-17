/**
 * File system utilities for Orca plugin
 * Handles file/folder selection and reading using modern web APIs
 */

import type { MarkdownFile } from "./markdownImporter";

/**
 * Open a folder selection dialog and return the selected path
 */
export async function selectFolder(): Promise<any> {
  try {
    // Modern File System Access API
    if ("showDirectoryPicker" in window) {
      const dirHandle = await (window as any).showDirectoryPicker();
      console.log("Selected directory:", dirHandle.name);
      return dirHandle;
    }
    // Fallback for older browsers
    else {
      console.warn("Directory picker not supported, using fallback");
      return await selectFolderFallback();
    }
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      console.log("Folder selection cancelled");
      return null;
    }
    console.error("Failed to open folder dialog:", error);
    return null;
  }
}

/**
 * Fallback folder selection using input element
 */
async function selectFolderFallback(): Promise<any> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.webkitdirectory = true;
    input.style.display = "none";

    input.onchange = (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        console.log("Selected folder (fallback):", files.length + " files");
        resolve(files);
      } else {
        resolve(null);
      }
      document.body.removeChild(input);
    };

    input.onabort = () => {
      resolve(null);
      document.body.removeChild(input);
    };

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Scan a directory recursively for markdown files
 */
export async function scanDirectoryForMarkdownFiles(
  directoryHandle: any
): Promise<MarkdownFile[]> {
  const files: MarkdownFile[] = [];

  // console.log("Starting directory scan...", directoryHandle);
  try {
    // Check if it's a FileList (fallback) or directory handle (modern)
    if (
      directoryHandle &&
      typeof directoryHandle.length === "number" &&
      directoryHandle.item
    ) {
      // FileList from fallback method
      // console.log(
      //   `Scanning ${directoryHandle.length} files from fallback selection`
      // );
      return await scanDirectoryForMarkdownFilesFallback(directoryHandle);
    } else if (
      directoryHandle &&
      directoryHandle.name &&
      directoryHandle.entries
    ) {
      // Directory handle from modern File System Access API
      // console.log("Scanning directory:", directoryHandle.name);
      await scanDirectoryRecursive(directoryHandle, "", files);
    } else {
      throw new Error("Invalid directory handle or file list provided");
    }

    console.log(`Found ${files.length} markdown files`);
    return files;
  } catch (error) {
    console.error("Failed to scan directory:", error);
    throw error;
  }
}

/**
 * Recursively scan directory for markdown files (modern API)
 */
async function scanDirectoryRecursive(
  dirHandle: any,
  relativePath: string,
  files: MarkdownFile[]
): Promise<void> {
  for await (const [name, handle] of dirHandle.entries()) {
    const currentPath = relativePath ? `${relativePath}/${name}` : name;

    if (handle.kind === "file") {
      if (isMarkdownFile(name)) {
        const file = await handle.getFile();
        const content = await file.text();

        files.push({
          path: currentPath,
          name: name,
          content: content,
          relativePath: currentPath,
          file: file,
          directoryHandle: dirHandle.name,
        });
      }
    } else if (handle.kind === "directory") {
      // Recursively scan subdirectories
      await scanDirectoryRecursive(handle, currentPath, files);
    }
  }
}

/**
 * Scan directory using fallback method (FileList)
 */
export async function scanDirectoryForMarkdownFilesFallback(
  inputFiles: FileList
): Promise<MarkdownFile[]> {
  const files: MarkdownFile[] = [];

  try {
    console.log(`Scanning ${inputFiles.length} files from fallback selection`);

    for (let i = 0; i < inputFiles.length; i++) {
      const file = inputFiles[i];

      if (isMarkdownFile(file.name)) {
        const content = await file.text();
        const relativePath = file.webkitRelativePath;

        files.push({
          path: file.name,
          name: file.name,
          content: content,
          relativePath: relativePath,
          file: file,
        });
      }
    }

    console.log(`Found ${files.length} markdown files`);
    return files;
  } catch (error) {
    console.error("Failed to scan directory (fallback):", error);
    throw error;
  }
}

/**
 * Check if a file is a markdown file based on extension
 */
export function isMarkdownFile(filename: string): boolean {
  const markdownExtensions = [".md", ".markdown", ".mdx"];
  const extension = filename.toLowerCase().substring(filename.lastIndexOf("."));
  return markdownExtensions.includes(extension);
}
