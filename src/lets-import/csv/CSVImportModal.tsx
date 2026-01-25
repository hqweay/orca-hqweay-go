import React, { useState, useRef } from "react";
import { t } from "@/libs/l10n";
import { PropType } from "@/libs/consts";

interface CSVImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (config: CSVImportConfig) => Promise<void>;
}

export type TargetType = "block" | "daily";

export interface ColumnConfig {
  enabled: boolean;
  propertyName: string;
  type: (typeof PropType)[keyof typeof PropType];
  subType?: string;
}

export interface TagConfig {
  name: string;
  columnConfigs: { [columnIndex: number]: ColumnConfig };
}

export interface CSVImportConfig {
  file: File;
  targetType: TargetType;
  targetBlockId?: number | null;
  contentColumnIndex: number;
  tags: TagConfig[];
  skipHeader: boolean;
}

export function CSVImportModal({
  visible,
  onClose,
  onImport,
}: CSVImportModalProps) {
  const [step, setStep] = useState<"file" | "target" | "mapping" | "importing">(
    "file",
  );
  const [config, setConfig] = useState<CSVImportConfig | null>(null);
  const [currentTagIndex, setCurrentTagIndex] = useState<number>(0);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const Button = orca.components.Button;
  const Select = orca.components.Select;
  const BlockSelect = orca.components.BlockSelect;
  const Checkbox = orca.components.Checkbox;
  const Input = orca.components.Input;

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

      if (lines.length === 0) {
        orca.notify("error", t("csv.import.emptyFile"));
        return;
      }

      // Simple CSV parser for headers
      const headers = parseCSVLine(lines[0]);

      const initialColumnConfigs: { [index: number]: ColumnConfig } = {};
      headers.forEach((header, index) => {
        initialColumnConfigs[index] = {
          enabled: true,
          propertyName: header || `prop_${index + 1}`,
          type: PropType.Text,
        };
      });

      setCsvHeaders(headers);
      setCurrentTagIndex(0);
      setConfig({
        file,
        targetType: "block",
        targetBlockId: null,
        contentColumnIndex: 0,
        tags: [{ name: "Import", columnConfigs: initialColumnConfigs }],
        skipHeader: true,
      });
      setStep("target");

      // Reset input value to allow re-selecting the same file if needed
      if (event.target) {
        event.target.value = "";
      }
    };;
    reader.readAsText(file);
  };

  const parseCSVLine = (line: string): string[] => {
    const row: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) {
        row.push(current.trim());
        current = "";
      } else current += char;
    }
    row.push(current.trim());
    return row;
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
      setStep("mapping");
    }
  };

  const renderFileSelection = () => (
    <div
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div
        style={{
          background: "var(--b3-theme-surface-lighter)",
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid var(--b3-theme-surface-lighter)",
          lineHeight: "1.6",
        }}
      >
        <h3
          style={{
            margin: "0 0 12px 0",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <i
            className="ti ti-info-circle"
            style={{ color: "var(--b3-theme-primary)" }}
          ></i>
          {t("How to Use")}
        </h3>
        <p style={{ margin: 0, opacity: 0.8, fontSize: "0.95em" }}>
          {t("csv.import.description")}
        </p>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 20px",
          border: "1px solid var(--b3-theme-surface-lighter)",
          borderRadius: "8px",
          background: "var(--b3-theme-surface)",
          cursor: "pointer",
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "40px",
            background: "var(--b3-theme-surface-lighter)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "24px",
          }}
        >
          <i
            className="ti ti-cloud-upload"
            style={{ fontSize: "40px", color: "var(--b3-theme-primary)" }}
          ></i>
        </div>
        <h4 style={{ margin: "0 0 8px 0" }}>{t("Select CSV File")}</h4>
        <p style={{ margin: "0 0 24px 0", opacity: 0.5, fontSize: "0.9em" }}>
          {t("csv.import.supportedFormat")}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        <Button variant="solid">
          <i className="ti ti-plus" style={{ marginRight: "8px" }}></i>
          {t("Choose File")}
        </Button>
      </div>
    </div>
  );

  const renderTargetConfig = () => (
    <div
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div>
        <h4
          style={{
            marginBottom: "12px",
            fontSize: "0.85em",
            fontWeight: "bold",
            textTransform: "uppercase",
            opacity: 0.6,
          }}
        >
          {t("Insertion Destination")}
        </h4>
        <div style={{ display: "flex", gap: "12px" }}>
          <Button
            variant={config?.targetType === "block" ? "solid" : "outline"}
            onClick={() =>
              config && setConfig({ ...config, targetType: "block" })
            }
            style={{ flex: 1 }}
          >
            {t("To Specific Block")}
          </Button>
          <Button
            variant={config?.targetType === "daily" ? "solid" : "outline"}
            onClick={() =>
              config && setConfig({ ...config, targetType: "daily" })
            }
            style={{ flex: 1 }}
          >
            {t("To Daily Notes")}
          </Button>
        </div>
      </div>

      {config?.targetType === "block" && (
        <div>
          <h4
            style={{
              marginBottom: "8px",
              fontSize: "0.85em",
              fontWeight: "bold",
              textTransform: "uppercase",
              opacity: 0.6,
            }}
          >
            {t("Target Parent Block")}
          </h4>
          <BlockSelect
            mode="block"
            selected={config?.targetBlockId ? [config.targetBlockId] : []}
            onChange={(selected) => {
              if (config)
                setConfig({
                  ...config,
                  targetBlockId:
                    selected.length > 0 ? parseInt(selected[0]) : null,
                });
            }}
          />
        </div>
      )}

      <div>
        <h4
          style={{
            marginBottom: "8px",
            fontSize: "0.85em",
            fontWeight: "bold",
            textTransform: "uppercase",
            opacity: 0.6,
          }}
        >
          {t("Block Text Column")}
        </h4>
        <Select
          selected={[config?.contentColumnIndex.toString() || "0"]}
          options={csvHeaders.map((header, index) => ({
            value: index.toString(),
            label: header || `Col ${index + 1}`,
          }))}
          onChange={(selected) => {
            if (config)
              setConfig({
                ...config,
                contentColumnIndex: parseInt(selected[0]),
              });
          }}
          width="100%"
        />
        <p style={{ marginTop: "4px", fontSize: "0.8em", opacity: 0.5 }}>
          {t("Choose which column contains the main text of the block.")}
        </p>
      </div>

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <h4
            style={{
              margin: 0,
              fontSize: "0.85em",
              fontWeight: "bold",
              textTransform: "uppercase",
              opacity: 0.6,
            }}
          >
            {t("Target Tags")}
          </h4>
          <Button
            variant="outline"
            onClick={() => {
              if (config) {
                const newTags = [
                  ...config.tags,
                  {
                    name: "",
                    columnConfigs: Object.fromEntries(
                      csvHeaders.map((header, index) => [
                        index,
                        {
                          enabled: true,
                          propertyName: header || `prop_${index + 1}`,
                          type: PropType.Text,
                        },
                      ]),
                    ),
                  },
                ];
                setConfig({ ...config, tags: newTags });
              }
            }}
            style={{ fontSize: "0.8em", padding: "4px 8px" }}
          >
            <i className="ti ti-plus" style={{ marginRight: "4px" }}></i>
            {t("Add Tag")}
          </Button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {config?.tags.map((tag, index) => (
            <div
              key={index}
              style={{ display: "flex", gap: "8px", alignItems: "center" }}
            >
              <div style={{ flex: 1 }}>
                <Input
                  value={tag.name}
                  onChange={(e) => {
                    if (config) {
                      const newTags = [...config.tags];
                      newTags[index] = {
                        ...newTags[index],
                        name: e.target.value,
                      };
                      setConfig({ ...config, tags: newTags });
                    }
                  }}
                  placeholder={t("Tag Name (e.g. Movies)")}
                />
              </div>
              {config.tags.length > 1 && (
                <Button
                  variant="plain"
                  onClick={() => {
                    const newTags = config.tags.filter((_, i) => i !== index);
                    setConfig({ ...config, tags: newTags });
                    if (currentTagIndex >= newTags.length) {
                      setCurrentTagIndex(Math.max(0, newTags.length - 1));
                    }
                  }}
                >
                  <i className="ti ti-trash" style={{ opacity: 0.6 }}></i>
                </Button>
              )}
            </div>
          ))}
        </div>
        <p style={{ marginTop: "8px", fontSize: "0.8em", opacity: 0.5 }}>
          {t(
            "Blocks will be tagged with these labels. Each tag can have different property mappings in the next step.",
          )}
        </p>
      </div>
    </div>
  );

  const renderMappingConfig = () => {
    if (!config || config.tags.length === 0) return null;

    // Safety check for currentTagIndex
    const safeTagIndex = Math.min(currentTagIndex, config.tags.length - 1);
    const currentTag = config.tags[safeTagIndex];
    if (!currentTag) return null;

    return (
      <div
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {/* Tag Selector (Tabs) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h4
            style={{
              margin: 0,
              fontSize: "0.85em",
              fontWeight: "bold",
              textTransform: "uppercase",
              opacity: 0.6,
            }}
          >
            {t("Configuring Tag:")}
          </h4>
          <div
            style={{
              display: "flex",
              gap: "8px",
              overflowX: "auto",
              paddingBottom: "4px",
            }}
          >
            {config.tags.map((tag, index) => (
              <Button
                key={index}
                variant={index === safeTagIndex ? "solid" : "outline"}
                onClick={() => setCurrentTagIndex(index)}
                style={{
                  whiteSpace: "nowrap",
                  padding: "6px 16px",
                  fontSize: "0.9em",
                  border:
                    index === safeTagIndex
                      ? "none"
                      : "1px solid var(--b3-theme-surface-lighter)",
                }}
              >
                {tag.name || `${t("Tag")} ${index + 1}`}
              </Button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            borderBottom: "1px solid var(--b3-theme-surface-lighter)",
            paddingBottom: "12px",
          }}
        >
          <Checkbox
            checked={config.skipHeader}
            onChange={(e) => {
              if (config) setConfig({ ...config, skipHeader: e.checked });
            }}
          />
          <span style={{ fontSize: "0.95em", fontWeight: "600" }}>
            {t("Skip first row (Header)")}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            maxHeight: "400px",
            overflowY: "auto",
            paddingRight: "4px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: "0.85em",
                fontWeight: "bold",
                textTransform: "uppercase",
                opacity: 0.6,
              }}
            >
              {t("Column Mappings for")} "{currentTag.name || "..."}"
            </h4>
            {config.tags.length > 1 && (
              <Button
                variant="plain"
                onClick={() => {
                  if (config) {
                    const prevIdx = safeTagIndex === 0 ? 1 : 0;
                    const prevTag = config.tags[prevIdx];
                    const nextTags = [...config.tags];
                    nextTags[safeTagIndex] = {
                      ...currentTag,
                      columnConfigs: JSON.parse(
                        JSON.stringify(prevTag.columnConfigs),
                      ),
                    };
                    setConfig({ ...config, tags: nextTags });
                    orca.notify("success", t("Copied from another tag"));
                  }
                }}
                style={{ fontSize: "0.8em", opacity: 0.6 }}
              >
                <i className="ti ti-copy" style={{ marginRight: "4px" }}></i>
                {t("Copy from others")}
              </Button>
            )}
          </div>

          {csvHeaders.map((header, index) => {
            const colConfig = currentTag.columnConfigs[index];
            if (!colConfig) return null;

            return (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns: "30px 1fr 1.5fr 1.2fr",
                  gap: "12px",
                  alignItems: "center",
                  padding: "12px",
                  background: colConfig.enabled
                    ? "var(--b3-theme-surface)"
                    : "transparent",
                  borderRadius: "6px",
                  border: "1px solid var(--b3-theme-surface-lighter)",
                  opacity: colConfig.enabled ? 1 : 0.4,
                }}
              >
                <Checkbox
                  checked={colConfig.enabled}
                  onChange={(e) => {
                    if (config) {
                      const nextTags = [...config.tags];
                      nextTags[safeTagIndex] = {
                        ...currentTag,
                        columnConfigs: {
                          ...currentTag.columnConfigs,
                          [index]: { ...colConfig, enabled: e.checked },
                        },
                      };
                      setConfig({ ...config, tags: nextTags });
                    }
                  }}
                />

                <div
                  style={{
                    fontSize: "0.9em",
                    fontWeight: "bold",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={header}
                >
                  {header || `Col ${index + 1}`}
                </div>

                <Input
                  value={colConfig.propertyName || ""}
                  disabled={!colConfig.enabled}
                  onChange={(e) => {
                    if (config) {
                      const nextTags = [...config.tags];
                      nextTags[safeTagIndex] = {
                        ...currentTag,
                        columnConfigs: {
                          ...currentTag.columnConfigs,
                          [index]: {
                            ...colConfig,
                            propertyName: e.target.value,
                          },
                        },
                      };
                      setConfig({ ...config, tags: nextTags });
                    }
                  }}
                  placeholder={t("Property Name")}
                />

                <div style={{ display: "flex", gap: "6px" }}>
                  <Select
                    selected={[
                      colConfig.type.toString() || PropType.Text.toString(),
                    ]}
                    disabled={!colConfig.enabled}
                    options={[
                      { value: PropType.Text.toString(), label: t("Text") },
                      { value: PropType.Number.toString(), label: t("Num") },
                      { value: PropType.Boolean.toString(), label: t("Bool") },
                      { value: PropType.DateTime.toString(), label: t("Date") },
                      {
                        value: PropType.TextChoices.toString(),
                        label: t("Multi"),
                      },
                    ]}
                    onChange={(selected) => {
                      if (config) {
                        const type = parseInt(selected[0]) as any;
                        const nextTags = [...config.tags];
                        nextTags[safeTagIndex] = {
                          ...currentTag,
                          columnConfigs: {
                            ...currentTag.columnConfigs,
                            [index]: { ...colConfig, type, subType: undefined },
                          },
                        };
                        setConfig({ ...config, tags: nextTags });
                      }
                    }}
                  />

                  {colConfig.type === PropType.Text && (
                    <Select
                      selected={[colConfig.subType || "default"]}
                      disabled={!colConfig.enabled}
                      options={[
                        { value: "default", label: "T" },
                        { value: "link", label: "🔗" },
                        { value: "image", label: "🖼️" },
                      ]}
                      onChange={(selected) => {
                        if (config) {
                          const nextTags = [...config.tags];
                          nextTags[safeTagIndex] = {
                            ...currentTag,
                            columnConfigs: {
                              ...currentTag.columnConfigs,
                              [index]: {
                                ...colConfig,
                                subType:
                                  selected[0] === "default"
                                    ? undefined
                                    : selected[0],
                              },
                            },
                          };
                          setConfig({ ...config, tags: nextTags });
                        }
                      }}
                      width={50}
                    />
                  )}
                  {colConfig.type === PropType.DateTime && (
                    <Select
                      selected={[colConfig.subType || "datetime"]}
                      disabled={!colConfig.enabled}
                      options={[
                        { value: "datetime", label: "DT" },
                        { value: "date", label: "D" },
                        { value: "time", label: "T" },
                      ]}
                      onChange={(selected) => {
                        if (config) {
                          const nextTags = [...config.tags];
                          nextTags[safeTagIndex] = {
                            ...currentTag,
                            columnConfigs: {
                              ...currentTag.columnConfigs,
                              [index]: {
                                ...colConfig,
                                subType: selected[0],
                              },
                            },
                          };
                          setConfig({ ...config, tags: nextTags });
                        }
                      }}
                      width={50}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderImporting = () => (
    <div
      style={{
        padding: "80px 40px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          height: "6px",
          background: "var(--b3-theme-surface-lighter)",
          borderRadius: "3px",
          marginBottom: "24px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            background: "var(--b3-theme-primary)",
            width: "40%",
            borderRadius: "3px",
            animation: "loading-slide 1.5s infinite ease-in-out",
          }}
        />
      </div>
      <h3 style={{ margin: "0 0 8px 0" }}>{t("Importing Data...")}</h3>
      <p style={{ opacity: 0.5, fontSize: "0.95em" }}>
        {t("csv.import.importingMessage")}
      </p>
      <style>{`@keyframes loading-slide { 0% { left: -40%; } 100% { left: 100%; } }`}</style>
    </div>
  );

  if (!visible) return null;

  return (
    <orca.components.ModalOverlay
      visible={visible}
      onClose={onClose}
      blurred={true}
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.9)", // slightly opaque
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--b3-theme-background)",
          color: "var(--b3-theme-on-background)",
          padding: "20px",
          borderRadius: "8px",
          width: "80%",
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                background: "var(--b3-theme-primary)",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyItems: "center",
                justifyContent: "center",
              }}
            >
              <i
                className="ti ti-table-import"
                style={{ fontSize: "20px" }}
              ></i>
            </div>
            <h2 style={{ margin: 0, fontSize: "1.25em", fontWeight: "600" }}>
              {t("Import CSV")}
            </h2>
          </div>
          <Button
            variant="plain"
            onClick={onClose}
            style={{ minWidth: "auto", padding: "4px" }}
          >
            <i
              className="ti ti-x"
              style={{ fontSize: "20px", opacity: 0.6 }}
            ></i>
          </Button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            borderTop: "1px solid var(--b3-theme-surface-lighter)",
          }}
        >
          {step === "file" && renderFileSelection()}
          {step === "target" && renderTargetConfig()}
          {step === "mapping" && renderMappingConfig()}
          {step === "importing" && renderImporting()}
        </div>

        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--b3-theme-surface-lighter)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            background: "var(--b3-theme-surface)",
          }}
        >
          {step === "target" && (
            <Button variant="outline" onClick={() => setStep("file")}>
              {t("Back")}
            </Button>
          )}
          {step === "mapping" && (
            <Button variant="outline" onClick={() => setStep("target")}>
              {t("Back")}
            </Button>
          )}

          {step === "target" && (
            <Button variant="solid" onClick={() => setStep("mapping")}>
              {t("Next")}
            </Button>
          )}
          {step === "mapping" && (
            <Button variant="solid" onClick={handleImport}>
              {t("Start Import")}
            </Button>
          )}
          {step === "file" && (
            <Button variant="outline" onClick={onClose}>
              {t("Cancel")}
            </Button>
          )}
        </div>
      </div>
    </orca.components.ModalOverlay>
  );
}
