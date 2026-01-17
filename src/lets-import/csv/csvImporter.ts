import { CSVImportConfig } from "./CSVImportModal";

// 定义属性类型常量
export const PropType = {
  JSON: 0,
  Text: 1,
  BlockRefs: 2,
  Number: 3,
  Boolean: 4,
  DateTime: 5,
  TextChoices: 6,
} as const;

export interface CSVRowData {
  [key: string]: string;
}

export class CSVImporter {
  private parseCSV(csvContent: string): string[][] {
    const lines = csvContent.split("\n").filter((line) => line.trim());
    const rows: string[][] = [];

    for (const line of lines) {
      const row: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          row.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      row.push(current.trim());
      rows.push(row);
    }

    return rows;
  }

  private convertToObjects(
    rows: string[][],
    headers: string[],
    skipHeader: boolean
  ): CSVRowData[] {
    const dataRows = skipHeader ? rows.slice(1) : rows;
    return dataRows.map((row) => {
      const obj: CSVRowData = {};
      headers.forEach((header, index) => {
        const key = header || `column_${index}`;
        obj[key] = row[index] || "";
      });
      return obj;
    });
  }

  async importFromConfig(
    config: CSVImportConfig
  ): Promise<{ success: number; failed: number }> {
    try {
      const fileContent = await this.readFileContent(config.file);
      const rows = this.parseCSV(fileContent);

      if (rows.length === 0) {
        throw new Error("CSV文件为空");
      }

      const headers = rows[0];
      const dataObjects = this.convertToObjects(
        rows,
        headers,
        config.skipHeader
      );

      let success = 0;
      let failed = 0;

      for (const data of dataObjects) {
        try {
          await this.createBlockFromData(data, config);
          success++;
        } catch (error) {
          console.error("Failed to create block:", error);
          failed++;
        }
      }

      return { success, failed };
    } catch (error) {
      console.error("CSV import failed:", error);
      throw error;
    }
  }

  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsText(file);
    });
  }

  private async findExistingBlockByContent(
    content: string
  ): Promise<number | null> {
    try {
      // 使用search-blocks-by-text API搜索已存在的块
      const searchResults = await orca.invokeBackend(
        "search-blocks-by-text",
        content
      );

      console.log("Search results:");
      console.log(searchResults);

      if (searchResults && Array.isArray(searchResults)) {
        // 检查是否有完全匹配的内容
        for (const blockResult of searchResults) {
          for (const blockItem of blockResult) {
            console.log(blockItem);
            if (blockItem.block?.content[0].v?.trim() === content) {
              return blockItem.block?.id || 11;
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error("Error searching for existing blocks:", error);
      // 如果搜索失败，返回null继续创建新块
      return null;
    }
  }

  // 如果用户没有配置映射，则直接使用CSV列名作为属性名
  private generateAutoMappingsFromHeaders(headers: string[]): {
    [columnIndex: number]: string;
  } {
    const autoMappings: { [columnIndex: number]: string } = {};

    headers.forEach((header, index) => {
      if (header && header.trim()) {
        autoMappings[index] = header.trim();
      }
    });

    return autoMappings;
  }

  // 合并用户配置和自动映射
  private mergeMappings(
    userMappings: { [columnIndex: number]: string },
    autoMappings: { [columnIndex: number]: string }
  ): { [columnIndex: number]: string } {
    const merged = { ...autoMappings };

    // 用户的显式配置优先
    for (const [index, propertyName] of Object.entries(userMappings)) {
      if (propertyName && propertyName.trim()) {
        merged[parseInt(index)] = propertyName.trim();
      }
    }

    return merged;
  }

  public createTagDataFromMappings(
    data: CSVRowData,
    mappings: { [columnIndex: number]: string },
    columnTypes: { [columnIndex: number]: number } = {}
  ): { name: string; value: any; type?: number }[] {
    const tagData: { name: string; value: any; type?: number }[] = [];
    const headers = Object.keys(data);

    for (const [columnIndex, propertyName] of Object.entries(mappings)) {
      const index = parseInt(columnIndex);
      const value = data[headers[index]];

      if (value && value.trim()) {
        // 根据用户选择的属性类型处理
        const columnType = columnTypes[index] || PropType.Text;

        if (columnType === PropType.TextChoices) {
          // 多选属性：使用空格分隔，值为字符串数组
          const values = value
            .trim()
            .split(/\s+/)
            .map((v) => v.trim())
            .filter((v) => v.length > 0);
          tagData.push({
            name: propertyName,
            value: values,
            type: PropType.TextChoices,
          });
        } else if (columnType === PropType.DateTime) {
          tagData.push({
            name: propertyName,
            value: new Date(value),
            type: PropType.DateTime,
          });
        } else {
          // 单选属性：使用字符串类型
          tagData.push({
            name: propertyName,
            value: value.trim(),
            type: PropType.Text,
          });
        }
      }
    }

    console.log("Generated tag data:", tagData);
    return tagData;
  }

  private async createBlockFromData(
    data: CSVRowData,
    config: CSVImportConfig
  ): Promise<void> {
    // 获取内容列的值作为块内容
    const headers = Object.keys(data);
    const contentColumnKey = headers[config.contentColumnIndex];
    let content = data[contentColumnKey] || "";
    content = content.trim();
    if (!content) {
      throw new Error("块内容为空");
    }

    // 检查是否已存在相同内容的块
    const existingBlockId = await this.findExistingBlockByContent(content);
    if (existingBlockId) {
      // // 块已存在，跳过创建但仍添加标签和属性
      // console.log(`块内容 "${content}" 已存在，跳过创建`);

      // // 生成自动映射（使用CSV列名）
      // const autoMappings = this.generateAutoMappingsFromHeaders(headers);
      // const finalMappings = this.mergeMappings(
      //   config.columnMappings,
      //   autoMappings
      // );

      // // 添加标签（如果不存在）
      // if (config.tagBlockIds && config.tagBlockIds.length > 0) {
      //   for (const tagBlockId of config.tagBlockIds) {
      //     await this.addTagToExistingBlock(
      //       existingBlockId,
      //       tagBlockId,
      //       data,
      //       finalMappings,
      //       config.columnTypes
      //     );
      //   }
      // }

      return;
    }

    // 创建新块
    const blockContent = [{ t: "t", v: content }];
    let blockId: number;

    try {
      // 确定目标块ID，如果没有指定则在当前位置插入
      const targetBlockId = config.targetBlockId || null;

      const targetBlock = config.targetBlockId
        ? orca.state.blocks[config.targetBlockId]
        : null;

      const result = await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        targetBlock, // 使用指定的块ID或当前位置
        "lastChild",
        blockContent,
        { type: "text" }
      );

      if (!result) {
        throw new Error("块创建失败");
      }

      blockId = result;
    } catch (error) {
      throw new Error(`块创建失败: ${error}`);
    }

    const block = orca.state.blocks[blockId];
    if (!block) {
      throw new Error("无法获取创建的块");
    }

    // 生成自动映射（使用CSV列名）
    const autoMappings = this.generateAutoMappingsFromHeaders(headers);
    const finalMappings = this.mergeMappings(
      config.columnMappings,
      autoMappings
    );

    // console.log("自动生成的映射（使用CSV列名）:", autoMappings);
    // console.log("最终使用的映射:", finalMappings);

    // 添加标签（包含属性数据）
    if (config.tagBlockIds && config.tagBlockIds.length > 0) {
      for (const tagBlockId of config.tagBlockIds) {
        await this.addTagToBlock(
          blockId,
          tagBlockId,
          data,
          finalMappings,
          config.columnTypes
        );
      }
    }
  }

  private async addTagToExistingBlock(
    blockId: number,
    tagBlockId: number,
    data: CSVRowData,
    mappings: { [columnIndex: number]: string },
    columnTypes: { [columnIndex: number]: number } = {}
  ): Promise<void> {
    try {
      // 检查块是否已经有这个标签
      const block = orca.state.blocks[blockId];
      if (block && block.refs) {
        const existingTag = block.refs.find(
          (ref) => ref.type === 2 && ref.id === tagBlockId // 2 is RefType.Property
        );
        if (existingTag) {
          // 标签已存在，跳过
          return;
        }
      }

      // 标签不存在，添加它（包含属性数据）
      await this.addTagToBlock(
        blockId,
        tagBlockId,
        data,
        mappings,
        columnTypes
      );
    } catch (error) {
      console.error("Failed to add tag to existing block:", error);
      // 不抛出错误，因为这是可选操作
    }
  }

  private async addTagToBlock(
    blockId: number,
    tagBlockId: number,
    data: CSVRowData,
    mappings: { [columnIndex: number]: string },
    columnTypes: { [columnIndex: number]: number } = {}
  ): Promise<void> {
    try {
      // 验证标签块是否存在
      const tagBlock = orca.state.blocks[tagBlockId];
      if (!tagBlock) {
        throw new Error(`标签块不存在: ${tagBlockId}`);
      }

      // 根据列映射创建标签数据
      const tagData = this.createTagDataFromMappings(
        data,
        mappings,
        columnTypes
      );

      const propertiesToSet = [...tagData]
        .filter((prop) => prop.type === PropType.TextChoices)
        .map((prop) => ({
          name: prop.name,
          // value: prop.value,
          typeArgs: {
            choices: prop.value.map((item: any) => ({ n: item, c: "" })),
            subType: "multi",
          },
          pos: 0,
          type: prop.type,
        }));

      if (propertiesToSet.length > 0) {
        // console.log("propertiesToSet", propertiesToSet);
        const oldProperties = orca.state.blocks[tagBlockId]?.properties?.filter(
          (prop) => prop.type === PropType.TextChoices
        );
        const rawProperties = JSON.parse(JSON.stringify(oldProperties));

        let result = [];

        //遍历，将 rawProperties 与 propertiesToSet合并，主要是合并typeArgs.choices

        propertiesToSet.forEach((prop) => {
          const oldProp = rawProperties.find((p: any) => p.name === prop.name);
          // prop.typeArgs.choices = prop.typeArgs.choices.filter(
          //   (item: any, index: number, self: any) => self != undefined
          // );
          if (oldProp) {
            prop.typeArgs.choices = prop.typeArgs.choices.concat(
              oldProp.typeArgs.choices ? oldProp.typeArgs.choices : []
            );
          }

          //对 prop.typeArgs.choices 去空
          prop.typeArgs.choices = prop.typeArgs.choices.filter(
            (item: any) =>
              item != undefined &&
              item != null &&
              item.n != undefined &&
              item.n != null
          );
          prop.typeArgs.choices = prop.typeArgs.choices.filter(
            (item: any, index: number, self: any) =>
              index === self.findIndex((t: any) => t && t.n === item.n)
          );
        });

        // console.log("propertiesToSet", propertiesToSet);
        await orca.commands.invokeEditorCommand(
          "core.editor.setProperties",
          null,
          [tagBlockId],
          propertiesToSet
        );
      }

      // const textItemsToSet = [...tagData]
      //   .filter((prop) => prop.type !== PropType.TextChoices)
      //   .map((prop) => ({
      //     name: prop.name,
      //     type: prop.type,
      //   }));

      // await orca.commands.invokeEditorCommand(
      //   "core.editor.setProperties",
      //   null,
      //   [tagBlockId],
      //   textItemsToSet
      // );

      await orca.commands.invokeEditorCommand(
        "core.editor.insertTag",
        null,
        blockId,
        tagBlock.aliases[0].trim(),
        tagData
      );

      // console.log("singleChoiceProperties", tagData);
    } catch (error) {
      console.error("Failed to add tag:", error);
      throw error;
    }
  }

  // Method removed - now using direct block IDs instead of aliases

  // 验证CSV文件格式
  validateCSVFile(file: File): { valid: boolean; error?: string } {
    if (!file.name.endsWith(".csv")) {
      return { valid: false, error: "请选择CSV文件" };
    }

    if (file.size === 0) {
      return { valid: false, error: "文件不能为空" };
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB限制
      return { valid: false, error: "文件大小不能超过10MB" };
    }

    return { valid: true };
  }

  // 获取CSV文件的预览数据
  async getCSVPreview(
    file: File,
    maxRows: number = 5
  ): Promise<{
    headers: string[];
    rows: string[][];
    totalRows: number;
  }> {
    const content = await this.readFileContent(file);
    const rows = this.parseCSV(content);

    if (rows.length === 0) {
      throw new Error("CSV文件为空");
    }

    const headers = rows[0];
    const dataRows = rows.slice(1, maxRows + 1);

    return {
      headers,
      rows: dataRows,
      totalRows: rows.length - 1, // 减去标题行
    };
  }
}
