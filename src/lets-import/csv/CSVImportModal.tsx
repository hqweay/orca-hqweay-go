import React, { useState, useRef } from "react";
import { t } from "@/libs/l10n";
import { PropType } from "@/libs/consts";
import "./csv-import.css";

interface CSVImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (config: CSVImportConfig) => Promise<void>;
}

export interface CSVImportConfig {
  file: File;
  contentColumnIndex: number;
  tagBlockIds: number[];
  columnMappings: { [columnIndex: number]: string };
  columnTypes: {
    [columnIndex: number]: (typeof PropType)[keyof typeof PropType];
  };
  skipHeader: boolean;
  targetBlockId?: number | null;
}

export function CSVImportModal({
  visible,
  onClose,
  onImport,
}: CSVImportModalProps) {
  const [step, setStep] = useState<"file" | "configure" | "importing">("file");
  const [config, setConfig] = useState<CSVImportConfig | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.name.endsWith(".csv")) {
      orca.notify("error", t("csv.import.invalidFile"));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const lines = content.split("\n").filter((line) => line.trim());
      const csvRows = lines.map((line) => {
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
        return row;
      });

      if (csvRows.length === 0) {
        orca.notify("error", t("csv.import.emptyFile"));
        return;
      }

      const headers = csvRows[0];
      const data = csvRows.slice(1);

      setCsvHeaders(headers);
      setCsvData(data);
      setConfig({
        file,
        contentColumnIndex: 0,
        tagBlockIds: [],
        columnMappings: {},
        columnTypes: {},
        skipHeader: true,
        targetBlockId: null,
      });
      setStep("configure");
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!config) return;

    setStep("importing");
    try {
      await onImport(config);
      orca.notify("success", t("csv.import.success"));
      onClose();
    } catch (error) {
      orca.notify("error", t("csv.import.error"));
      console.error("CSV import error:", error);
    }
  };

  const renderFileSelection = () => (
    <div className="csv-import-modal">
      <div className="modal-header">
        <h3>说明</h3>
        <span>
          csv导入功能说明：
          <br /> <br />
          该插件用于将结构化的数据导入虎鲸笔记，支持csv格式的文件导入。
          <br /> <br />
          示例：
          <br /> <br />
          小明之前使用其它笔记软件的数据库维护了一个观影列表，拥有
          片名、导演、上映时间、评分、评论等字段，现在想要将这些数据导入虎鲸笔记，以便于管理。
          <br /> <br />
          1. 首先将其它笔记软件的数据库导出为csv文件。
          <br /> <br />
          2. 然后在虎鲸笔记中新建标签，并配置属性
          片名、导演、上映时间、评分、评论……
          <br /> <br />
          3.
          使用该插件，（1）导入csv文件，（2）选择片名作为在虎鲸笔记中新建块的内容，（3-可选项）选择目标块作为新建块的父块，（4）选择标签，（5）并将csv文件的字段映射到标签的属性上。
          <br /> <br />
          点击导入，enjoy～
          <br /> <br />
        </span>
        <h3>{t("csv.import.selectFile")}</h3>
        <orca.components.Button
          variant="outline"
          onClick={onClose}
          className="close-btn"
        >
          关闭
        </orca.components.Button>
      </div>
      <div className="modal-content">
        <div className="file-upload-area">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          <orca.components.Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            {t("csv.import.chooseFile")}
          </orca.components.Button>
        </div>
        <div className="csv-info">
          <p>{t("csv.import.supportedFormat")}</p>
        </div>
      </div>
    </div>
  );

  const renderConfiguration = () => (
    <div className="csv-import-modal">
      <div className="modal-header">
        <h3>{t("csv.import.configure")}</h3>
        <button onClick={onClose} className="close-btn">
          &times;
        </button>
      </div>
      <div className="modal-content">
        <div className="config-section">
          <h4>{t("csv.import.preview")}</h4>
          <div className="csv-preview">
            <table>
              <thead>
                <tr>
                  {csvHeaders.map((header, index) => (
                    <th key={index}>{header || `列 ${index + 1}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* 预览3行 */}
                {csvData.slice(0, 3).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{cell.substring(0, 10)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="config-section">
          <h4>{t("csv.import.contentColumn")}</h4>
          <orca.components.Select
            selected={[config?.contentColumnIndex.toString() || "0"]}
            options={csvHeaders.map((header, index) => ({
              value: index.toString(),
              label: header || `列 ${index + 1}`,
            }))}
            onChange={(selected) => {
              if (config) {
                setConfig({
                  ...config,
                  contentColumnIndex: parseInt(selected[0]),
                });
              }
            }}
          />
        </div>

        <div className="config-section">
          <h4>{t("csv.import.targetBlock")}</h4>
          <orca.components.BlockSelect
            mode="block"
            selected={config?.targetBlockId ? [config.targetBlockId] : []}
            onChange={(selected) => {
              if (config) {
                setConfig({
                  ...config,
                  targetBlockId:
                    selected.length > 0 ? parseInt(selected[0]) : null,
                });
              }
            }}
          />
          {/* <p className="hint">{t("csv.import.targetBlockHint")}</p> */}
        </div>

        <div className="config-section">
          <h4>{t("csv.import.tags")}</h4>
          <orca.components.BlockSelect
            mode="block"
            selected={config?.tagBlockIds || []}
            onChange={(selected) => {
              if (config) {
                const tagBlockIds = selected
                  .map((id) => parseInt(id))
                  .filter((id) => !isNaN(id));
                setConfig({ ...config, tagBlockIds });
              }
            }}
          />
          <p className="hint">{t("csv.import.tagsHint")}</p>
        </div>

        <div className="config-section">
          <h4>{t("csv.import.columnMappings")}</h4>
          <div className="column-mappings">
            {csvHeaders.map((header, index) => (
              <div
                key={index}
                className="mapping-row"
                style={{
                  display: "flex",
                  flexDirection: "row",
                  padding: "10px",
                  alignItems: "center",
                  justifyContent: "space-evenly",
                }}
              >
                <span className="column-label">
                  {header || `列 ${index + 1}`}
                </span>
                <div
                  className="mapping-controls"
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    padding: "10px",
                  }}
                >
                  <div className="input-with-label">
                    <label>属性名</label>
                    <orca.components.CompositionInput
                      value={header}
                      onChange={(e) => {
                        const target = e.target as HTMLInputElement;
                        if (config) {
                          const newMappings = { ...config.columnMappings };
                          if (target.value) {
                            newMappings[index] = target.value;
                          } else {
                            delete newMappings[index];
                          }
                          setConfig({ ...config, columnMappings: newMappings });
                        }
                      }}
                    />
                  </div>
                  <div className="select-with-label">
                    <label>类型</label>
                    <orca.components.Select
                      selected={[
                        config?.columnTypes[index]?.toString() ||
                          PropType.Text.toString(),
                      ]}
                      options={[
                        { value: PropType.Text.toString(), label: "文本" },
                        {
                          value: PropType.TextChoices.toString(),
                          label: "多选",
                        },
                        {
                          value: PropType.DateTime.toString(),
                          label: "日期与时间",
                        },
                      ]}
                      onChange={(selected) => {
                        if (config) {
                          const newTypes = { ...config.columnTypes };
                          // 将字符串转换为对应的PropType常量
                          const selectedValue = selected[0];
                          if (
                            selectedValue === PropType.TextChoices.toString()
                          ) {
                            newTypes[index] = PropType.TextChoices;
                          } else if (
                            selectedValue === PropType.DateTime.toString()
                          ) {
                            newTypes[index] = PropType.DateTime;
                          } else {
                            newTypes[index] = PropType.Text;
                          }
                          setConfig({ ...config, columnTypes: newTypes });
                        }
                      }}
                      width={80}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="hint">{t("csv.import.columnMappingsHint")}</p>
        </div>

        <div className="config-section">
          <orca.components.Checkbox
            checked={config?.skipHeader}
            onChange={(e) => {
              if (config) {
                setConfig({ ...config, skipHeader: e.checked });
              }
            }}
          />
          <span>{t("csv.import.skipHeader")}</span>
        </div>
      </div>
      <div className="modal-actions">
        <orca.components.Button
          variant="outline"
          onClick={() => setStep("file")}
        >
          {t("common.back")}
        </orca.components.Button>
        <orca.components.Button variant="solid" onClick={handleImport}>
          {t("csv.import.startImport")}
        </orca.components.Button>
      </div>
    </div>
  );

  const renderImporting = () => (
    <div className="csv-import-modal">
      <div className="modal-header">
        <h3>{t("csv.import.importing")}</h3>
      </div>
      <div className="modal-content">
        <div className="import-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: "100%" }}></div>
          </div>
          <p>{t("csv.import.importingMessage")}</p>
        </div>
      </div>
    </div>
  );

  if (!visible) return null;

  return (
    <orca.components.ModalOverlay
      visible={visible}
      onClose={onClose}
      blurred={true}
      style={{
        backgroundColor: "aliceblue",
        overflowY: "auto",
        display: "unset",
        padding: "10%",
      }}
    >
      <div className="csv-import-overlay">
        {step === "file" && renderFileSelection()}
        {step === "configure" && renderConfiguration()}
        {step === "importing" && renderImporting()}
      </div>
    </orca.components.ModalOverlay>
  );
}
