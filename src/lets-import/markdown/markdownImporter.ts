import type { ContentFragment } from "../orca";

/**
 * Markdown import functionality for Orca Note plugin
 * Handles folder selection, markdown parsing, and block creation
 */

export interface MarkdownFile {
  path: string;
  name: string;
  content: string;
  relativePath: string;
  file?: File;
  directoryHandle?: string;
}

export interface ImportOptions {
  createFolderBlocks: boolean;
  preserveFileNameAsTitle: boolean;
  folderAsPageTitle: boolean;
}

export interface ImportResult {
  success: boolean;
  message: string;
  importedFiles: number;
  createdBlocks: number;
  errors?: string[];
}

/**
 * Parse markdown content into Orca content fragments
 */
export function parseMarkdownToContentFragments(
  markdown: string
): ContentFragment[] {
  const lines = markdown.split("\n");
  const fragments: ContentFragment[] = [];
  let currentContent = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle headers
    if (line.match(/^#{1,6}\s+/)) {
      // Add previous content if exists
      if (currentContent.trim()) {
        fragments.push({
          t: "t",
          v: currentContent.trim(),
        });
        currentContent = "";
      }

      const level = line.match(/^#{1,6}/)?.[0].length || 1;
      const text = line.replace(/^#{1,6}\s+/, "");

      fragments.push({
        t: "t",
        v: text,
        f: "heading",
        fa: { level },
      });
    }
    // Handle code blocks
    else if (line.match(/^```/)) {
      // Add previous content if exists
      if (currentContent.trim()) {
        fragments.push({
          t: "t",
          v: currentContent.trim(),
        });
        currentContent = "";
      }

      // Skip the opening ```
      i++;
      let codeContent = "";

      // Collect code content until closing ```
      while (i < lines.length && !lines[i].match(/^```/)) {
        codeContent += lines[i] + "\n";
        i++;
      }

      fragments.push({
        t: "t",
        v: codeContent.trim(),
        f: "code",
      });
    }
    // Handle lists
    else if (line.match(/^\s*[-*+]\s+/) || line.match(/^\s*\d+\.\s+/)) {
      // Add previous content if exists
      if (currentContent.trim()) {
        fragments.push({
          t: "t",
          v: currentContent.trim(),
        });
        currentContent = "";
      }

      const listItem = line
        .replace(/^\s*[-*+]\s+/, "")
        .replace(/^\s*\d+\.\s+/, "");
      fragments.push({
        t: "t",
        v: listItem,
        f: "list",
      });
    }
    // Handle blockquotes
    else if (line.match(/^\s*>\s+/)) {
      // Add previous content if exists
      if (currentContent.trim()) {
        fragments.push({
          t: "t",
          v: currentContent.trim(),
        });
        currentContent = "";
      }

      const quote = line.replace(/^\s*>\s+/, "");
      fragments.push({
        t: "t",
        v: quote,
        f: "quote",
      });
    }
    // Handle horizontal rules
    else if (line.match(/^\s*[-*_]{3,}\s*$/)) {
      // Add previous content if exists
      if (currentContent.trim()) {
        fragments.push({
          t: "t",
          v: currentContent.trim(),
        });
        currentContent = "";
      }

      fragments.push({
        t: "t",
        v: "---",
        f: "hr",
      });
    }
    // Regular content
    else {
      currentContent += line + "\n";
    }
  }

  // Add remaining content
  if (currentContent.trim()) {
    fragments.push({
      t: "t",
      v: currentContent.trim(),
    });
  }

  return fragments;
}

/**
 * Extract title from markdown content (first header or filename)
 */
export function extractTitleFromMarkdown(
  markdown: string,
  filename: string
): string {
  // Try to find first header
  const headerMatch = markdown.match(/^#{1,6}\s+(.+)$/m);
  if (headerMatch) {
    return headerMatch[1].trim();
  }

  // Fall back to filename without extension
  return filename.replace(/\.[^/.]+$/, "");
}

/**
 * Create folder structure from file paths
 */
export function createFolderStructure(files: MarkdownFile[]): Map<string, any> {
  const folderMap = new Map<string, any>();

  for (const file of files) {
    const pathParts = file.relativePath.split("/");
    let currentPath = "";
    let currentLevel = folderMap;

    // Build folder structure
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!currentLevel.has(part)) {
        currentLevel.set(part, {
          name: part,
          path: currentPath,
          children: new Map(),
          files: [],
        });
      }

      currentLevel = currentLevel.get(part).children;
    }

    // Add file to the final folder
    const finalFolder =
      pathParts.length > 1 ? pathParts[pathParts.length - 2] : "";
    const folderKey = finalFolder || "root";

    if (!folderMap.has(folderKey)) {
      folderMap.set(folderKey, {
        name: folderKey,
        path: "",
        children: new Map(),
        files: [],
      });
    }

    folderMap.get(folderKey).files.push(file);
  }

  return folderMap;
}

/**
 * Import markdown files into Orca
 */
export async function importMarkdownFiles(
  files: MarkdownFile[],
  options: ImportOptions,
  parentBlockId?: number
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    message: "",
    importedFiles: 0,
    createdBlocks: 0,
    errors: [],
  };

  try {
    // Group files by folder structure
    const folderStructure = createFolderStructure(files);

    // Process each folder
    for (const [folderName, folderData] of folderStructure) {
      await processFolder(folderData, options, parentBlockId, result);
    }

    result.message = `Successfully imported ${result.importedFiles} files and created ${result.createdBlocks} blocks`;
  } catch (error) {
    result.success = false;
    result.message = `Import failed: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
    result.errors?.push(result.message);
  }

  return result;
}

/**
 * Process a folder and its contents
 */
async function processFolder(
  folderData: any,
  options: ImportOptions,
  parentBlockId: number | undefined,
  result: ImportResult
): Promise<void> {
  let folderPageId: number | undefined;

  // Create folder page if option is enabled and not root
  if (options.createFolderBlocks && folderData.name !== "root") {
    folderPageId = await createFolderPage(folderData.name, parentBlockId);
    result.createdBlocks++;
    console.log(
      `Created folder page: ${folderData.name} (Page ID: ${folderPageId})`
    );
  }

  // Process subfolders
  for (const [subFolderName, subFolderData] of folderData.children) {
    await processFolder(
      subFolderData,
      options,
      folderPageId || parentBlockId,
      result
    );
  }

  // Process files in this folder
  for (const file of folderData.files) {
    await processFile(file, options, folderPageId || parentBlockId, result);
  }
}

/**
 * Process a single markdown file
 */
async function processFile(
  file: MarkdownFile,
  options: ImportOptions,
  parentBlockId: number | undefined,
  result: ImportResult
): Promise<void> {
  try {
    const title = options.preserveFileNameAsTitle
      ? extractTitleFromMarkdown(file.content, file.name)
      : file.name.replace(/\.[^/.]+$/, "");

    const fragments = parseMarkdownToContentFragments(file.content);

    // Create the main block for this file
    const blockId = await createBlock(title, fragments, parentBlockId);
    result.createdBlocks++;
    result.importedFiles++;

    console.log(`Imported file: ${file.name} (Block ID: ${blockId})`);
  } catch (error) {
    const errorMsg = `Failed to import ${file.name}: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
    result.errors?.push(errorMsg);
    console.error(errorMsg);
  }
}

/**
 * Create a folder page using the correct Orca API pattern
 */
async function createFolderPage(
  folderName: string,
  parentBlockId?: number
): Promise<number> {
  try {
    // First create a block with the folder name as title
    const pageBlockId = await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock",
      null, // cursor data
      parentBlockId ? orca.state.blocks[parentBlockId] : null, // reference block
      "lastChild", // position
      [{ t: "t", v: folderName }], // content
      { type: "text" } // repr
    );

    // Then create an alias to make it a page
    const aliasError = await orca.commands.invokeEditorCommand(
      "core.editor.createAlias",
      null, // cursor data
      folderName, // alias name
      pageBlockId, // block ID to alias
      true // asPage: true - create as page
    );

    if (aliasError) {
      console.warn(
        "Failed to create page alias, but block was created:",
        aliasError
      );
    }

    return pageBlockId;
  } catch (error) {
    console.error("Failed to create folder page:", error);
    throw error;
  }
}

/**
 * Create a block in Orca using the editor command
 * Based on the correct API signature from the documentation
 */
async function createBlock(
  title: string,
  content: ContentFragment[],
  parentBlockId?: number
): Promise<number> {
  try {
    // Use the core.editor.insertBlock command with correct parameter order
    const newBlockId = await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock",
      null, // cursor data (can be null if not needed for context)
      parentBlockId ? orca.state.blocks[parentBlockId] : null, // reference block
      "lastChild", // position
      content, // content
      { type: "text", title } // repr
    );

    return newBlockId;
  } catch (error) {
    console.error("Failed to create block:", error);
    throw error;
  }
}
