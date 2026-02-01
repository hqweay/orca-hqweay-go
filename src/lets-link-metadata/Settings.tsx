import React, { useState, useEffect } from "react";
import { SettingsSection, SettingsItem } from "@/components/SettingsItem";
import { setupL10N, t } from "@/libs/l10n";
import { LinkMetadataSettings, Rule } from "./types";

import { DEFAULT_RULES } from "./defaultRules";
import { PropType } from "@/libs/consts";

interface LinkMetadataPlugin {
  getSettings(): LinkMetadataSettings;
  updateSettings(settings: Partial<LinkMetadataSettings>): Promise<void>;
}

// Sub-component: Edit a single rule
function RuleEditor({
  rule,
  onSave,
  onCancel,
}: {
  rule: Rule;
  onSave: (rule: Rule) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(rule.name);
  const [urlPattern, setUrlPattern] = useState(rule.urlPattern);
  const [tagName, setTagName] = useState(rule.tagName);
  // Flatten script array to string for editing
  const [scriptBody, setScriptBody] = useState(
    Array.isArray(rule.script) ? rule.script.join("\n") : rule.script,
  );
  const [enabled, setEnabled] = useState(rule.enabled);
  const [downloadCover, setDownloadCover] = useState(
    rule.downloadCover || false,
  );

  const handleSave = () => {
    onSave({
      ...rule,
      name,
      urlPattern,
      tagName,
      script: scriptBody.split("\n"), // Split back to array for storage
      enabled,
      downloadCover,
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        border: "1px solid var(--orca-color-border)",
        padding: "16px",
        borderRadius: "8px",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
        {t("Edit Rule")}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <label>{t("Rule Name")}</label>
        <orca.components.CompositionInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. YouTube Video"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <label>{t("URL Regex Pattern")}</label>
        <orca.components.CompositionInput
          value={urlPattern}
          onChange={(e) => setUrlPattern(e.target.value)}
          placeholder="e.g. youtube\.com"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <label>{t("Target Tag Name")}</label>
        <orca.components.CompositionInput
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          placeholder="e.g. Video"
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <orca.components.Checkbox
            checked={enabled}
            onChange={({ checked }) => setEnabled(checked)}
          />
          <label>{t("Enabled")}</label>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <orca.components.Checkbox
            checked={downloadCover}
            onChange={({ checked }) => setDownloadCover(checked)}
          />
          <label>{t("Download Cover to Local")}</label>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          flex: 1,
        }}
      >
        <label>{t("Extraction Script (JavaScript)")}</label>
        <div
          style={{
            fontSize: "0.85em",
            color: "var(--orca-color-text-2)",
            marginBottom: "4px",
          }}
        >
          {t("Available variables: doc, url, cleanUrl, PropType, baseMeta")}
        </div>
        <orca.components.CompositionTextArea
          value={scriptBody}
          onChange={(e) => setScriptBody(e.target.value)}
          style={{
            minHeight: "300px",
            fontFamily: "monospace",
            whiteSpace: "pre",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "12px",
          marginTop: "12px",
        }}
      >
        <orca.components.Button variant="outline" onClick={onCancel}>
          {t("Cancel")}
        </orca.components.Button>
        <orca.components.Button variant="solid" onClick={handleSave}>
          {t("Save Rule")}
        </orca.components.Button>
      </div>
    </div>
  );
}

export default function Settings({ plugin }: { plugin: LinkMetadataPlugin }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [quickLinks, setQuickLinks] = useState<{ name: string; url: string }[]>(
    [],
  );
  const [homepage, setHomepage] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    const settings = plugin.getSettings();
    setRules(settings.rules);
    setQuickLinks(settings.quickLinks);
    setHomepage(settings.homepage || "");
  }, []);

  const saveHomepage = async (newHomepage: string) => {
    setHomepage(newHomepage);
    await plugin.updateSettings({ homepage: newHomepage });
  };

  const saveRules = async (newRules: Rule[]) => {
    setRules(newRules);
    await plugin.updateSettings({ rules: newRules });
  };

  const saveQuickLinks = async (newLinks: { name: string; url: string }[]) => {
    setQuickLinks(newLinks);
    await plugin.updateSettings({ quickLinks: newLinks });
  };

  const handleAddRule = () => {
    const newRule: Rule = {
      id: Date.now().toString(),
      name: "New Rule",
      urlPattern: "",
      tagName: "Bookmark",
      script: ["// Return metadata properties array", "return baseMeta;"],
      enabled: true,
    };
    const newRules = [...rules, newRule];
    saveRules(newRules);
    setEditingIndex(newRules.length - 1); // Open editor for new rule
  };

  const handleEditRule = (index: number) => {
    setEditingIndex(index);
  };

  const handleDeleteRule = (index: number) => {
    const newRules = rules.filter((_, i) => i !== index);
    saveRules(newRules);
    if (editingIndex === index) setEditingIndex(null);
  };

  const handleSaveRule = (updatedRule: Rule) => {
    if (editingIndex === null) return;
    const newRules = [...rules];
    newRules[editingIndex] = updatedRule;
    saveRules(newRules);
    setEditingIndex(null);
    orca.notify("success", t("Rule saved"));
  };



  if (editingIndex !== null && rules[editingIndex]) {
    return (
      <RuleEditor
        rule={rules[editingIndex]}
        onSave={handleSaveRule}
        onCancel={() => setEditingIndex(null)}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SettingsSection title={t("General Settings")}>
        <SettingsItem
          label={t("Homepage")}
          description={t("Default URL when browser opens")}
          vertical
        >
          <orca.components.Input
            value={homepage}
            onChange={(e: any) => saveHomepage(e.target.value)}
            placeholder="https://..."
          />
        </SettingsItem>
      </SettingsSection>

      <SettingsSection title={t("Quick Links")}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {quickLinks.map((link, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <orca.components.CompositionInput
                value={link.name}
                onChange={(e) => {
                  const newLinks = [...quickLinks];
                  newLinks[index].name = e.target.value;
                  saveQuickLinks(newLinks);
                }}
                placeholder="Name"
                style={{ width: "150px" }}
              />
              <orca.components.CompositionInput
                value={link.url}
                onChange={(e) => {
                  const newLinks = [...quickLinks];
                  newLinks[index].url = e.target.value;
                  saveQuickLinks(newLinks);
                }}
                placeholder="URL"
                style={{ flex: 2 }}
              />
              <orca.components.Button
                variant="plain"
                title={t("Set as Homepage")}
                onClick={() => saveHomepage(link.url)}
                style={{
                  color:
                    homepage === link.url
                      ? "var(--orca-color-primary)"
                      : "inherit",
                }}
              >
                <i className="ti ti-home" style={{ fontSize: "16px" }}></i>
              </orca.components.Button>
              <orca.components.Button
                variant="plain"
                onClick={() => {
                  const newLinks = quickLinks.filter((_, i) => i !== index);
                  saveQuickLinks(newLinks);
                }}
              >
                ×
              </orca.components.Button>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <orca.components.Button
              variant="solid"
              onClick={() => {
                const newLinks = [...quickLinks, { name: "", url: "" }];
                saveQuickLinks(newLinks);
              }}
            >
              {t("Add Link")}
            </orca.components.Button>
          </div>
        </div>
      </SettingsSection>
      <SettingsSection title={t("Extraction Rules")}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {rules.map((rule, index) => (
            <div
              key={rule.id || index}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px",
                border: "1px solid var(--orca-color-border)",
                borderRadius: "4px",
                backgroundColor: "var(--orca-color-bg-2)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontWeight: "bold" }}>{rule.name}</div>
                <div
                  style={{
                    fontSize: "0.85em",
                    color: "var(--orca-color-text-2)",
                  }}
                >
                  {rule.urlPattern}
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <orca.components.Button
                  variant="outline"
                  onClick={() => handleEditRule(index)}
                >
                  {t("Edit")}
                </orca.components.Button>
                <orca.components.Button
                  variant="dangerous"
                  onClick={() => handleDeleteRule(index)}
                >
                  {t("Delete")}
                </orca.components.Button>
              </div>
            </div>
          ))}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "12px",
            }}
          >
            <orca.components.Button variant="solid" onClick={handleAddRule}>
              {t("Add Rule")}
            </orca.components.Button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
