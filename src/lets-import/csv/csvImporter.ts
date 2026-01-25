import { CSVImportConfig, TagConfig } from "./CSVImportModal";
import { DataImporter, BlockData, TagData } from "@/libs/DataImporter";

export interface CSVRowData {
  [key: string]: string;
}

export class CSVImporter {
  /**
   * More robust CSV parser that handles quotes and multiple commas
   */
  private parseCSV(csvContent: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = "";
    let inQuotes = false;

    // Normalize line endings
    const content = csvContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Double quote inside quotes = escaped quote
          currentCell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\n" && !inQuotes) {
        currentRow.push(currentCell.trim());
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }

    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
    }

    return rows;
  }

  private convertToObjects(
    rows: string[][],
    headers: string[],
    skipHeader: boolean,
  ): CSVRowData[] {
    const dataRows = skipHeader ? rows.slice(1) : rows;
    return dataRows.map((row) => {
      const obj: CSVRowData = {};
      headers.forEach((header, index) => {
        const key = header || `col_${index + 1}`;
        obj[key] = row[index] || "";
      });
      return obj;
    });
  }

  async importFromConfig(
    config: CSVImportConfig,
  ): Promise<{ success: number; failed: number }> {
    try {
      const fileContent = await this.readFileContent(config.file);
      const rows = this.parseCSV(fileContent);

      if (rows.length === 0) {
        throw new Error("CSV file is empty");
      }

      const headers = rows[0];
      const dataObjects = this.convertToObjects(
        rows,
        headers,
        config.skipHeader,
      );

      // 1. Resolve Target Parent Block
      const targetParentId = await this.resolveTargetId(config);
      if (!targetParentId) {
        throw new Error("Could not resolve target destination");
      }

      console.log("Target parent ID:", targetParentId);

      let success = 0;
      let failed = 0;

      // 2. Process rows using DataImporter
      for (const data of dataObjects) {
        try {
          const importData = this.mapRowToBlockData(data, config, headers);
          console.log("Importing block:", importData);
          await DataImporter.importBlock(importData, {
            type: "block",
            blockId: targetParentId,
            position: "lastChild",
          });
          success++;
        } catch (error) {
          console.error("Failed to import row:", error);
          failed++;
        }
      }

      return { success, failed };
    } catch (error) {
      console.error("CSV import failed:", error);
      throw error;
    }
  }

  private async resolveTargetId(
    config: CSVImportConfig,
  ): Promise<number | null> {
    if (config.targetType === "block") {
      return config.targetBlockId || null;
    } else {
      try {
        const journalBlock = await orca.invokeBackend(
          "get-journal-block",
          new Date(),
        );
        return journalBlock?.id || null;
      } catch (e) {
        console.error("Failed to get daily note block:", e);
        return null;
      }
    }
  }

  private mapRowToBlockData(
    data: CSVRowData,
    config: CSVImportConfig,
    headers: string[],
  ): BlockData {
    const contentColumnKey = headers[config.contentColumnIndex];
    let content = (data[contentColumnKey] || "").trim();
    let contentFragment: any[] = [];
    if (content.startsWith("http://") || content.startsWith("https://")) {
      contentFragment = [{ t: "l", v: `${content}`, l: `${content}` }];
    } else {
      contentFragment = [{ t: "t", v: `${content}` }];
    }

    const tags: TagData[] = config.tags.map((tagConfig) => {
      return {
        name: tagConfig.name,
        properties: Object.entries(tagConfig.columnConfigs)
          .filter(([_, col]) => col.enabled)
          .map(([colIdxStr, col]) => {
            const colIdx = parseInt(colIdxStr);
            return {
              name: col.propertyName,
              type: col.type,
              value: data[headers[colIdx]],
              typeArgs: col.subType ? { subType: col.subType } : undefined,
            };
          }),
      };
    });

    return { content: contentFragment, tags };
  }

  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsText(file);
    });
  }
}
