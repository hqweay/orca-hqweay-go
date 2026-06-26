import React, { useState } from "react";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import { t } from "@/libs/l10n";

export function PublishSettings({ plugin }: { plugin: any }) {
  const settings = plugin["getSettings"]();
  const [config, setConfig] = useState(settings);

  const updateConfig = async (path: string, value: any) => {
    const keys = path.split(".");
    const newConfig = { ...config };
    let current = newConfig;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...current[keys[i]] };
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    setConfig(newConfig);
    await plugin["updateSettings"](newConfig);
  };

  const Input = orca.components.Input;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      <SettingsSection title={t("Image Bed")}>
        <SettingsItem
          label={t("Owner")}
          description={t("GitHub Username/Org for Image Bed")}
        >
          <Input
            value={config.imageBed?.owner || ""}
            onChange={(e: any) =>
              updateConfig("imageBed.owner", e.target.value)
            }
          />
        </SettingsItem>
        <SettingsItem
          label={t("Repository")}
          description={t("Repository Name for Image Bed")}
        >
          <Input
            value={config.imageBed?.repo || ""}
            onChange={(e: any) => updateConfig("imageBed.repo", e.target.value)}
          />
        </SettingsItem>
        <SettingsItem
          label={t("Branch")}
          description={t("Branch for Image Bed")}
        >
          <Input
            value={config.imageBed?.branch || "master"}
            onChange={(e: any) =>
              updateConfig("imageBed.branch", e.target.value)
            }
          />
        </SettingsItem>
        <SettingsItem
          label={t("Path")}
          description={t("Path prefix (e.g. img/)")}
        >
          <Input
            value={config.imageBed?.path || "img/"}
            onChange={(e: any) => updateConfig("imageBed.path", e.target.value)}
          />
        </SettingsItem>
        <SettingsItem
          label={t("Token")}
          description={t("GitHub Token for Image Bed")}
        >
          <Input
            type="password"
            value={config.imageBed?.token || ""}
            onChange={(e: any) =>
              updateConfig("imageBed.token", e.target.value)
            }
          />
        </SettingsItem>
      </SettingsSection>

      <SettingsSection title={t("Blog")}>
        <SettingsItem
          label={t("Owner")}
          description={t("GitHub Username/Org for Blog")}
        >
          <Input
            value={config.blog?.owner || ""}
            onChange={(e: any) => updateConfig("blog.owner", e.target.value)}
          />
        </SettingsItem>
        <SettingsItem
          label={t("Repository")}
          description={t("Repository Name for Blog")}
        >
          <Input
            value={config.blog?.repo || ""}
            onChange={(e: any) => updateConfig("blog.repo", e.target.value)}
          />
        </SettingsItem>
        <SettingsItem label={t("Branch")} description={t("Branch for Blog")}>
          <Input
            value={config.blog?.branch || "main"}
            onChange={(e: any) => updateConfig("blog.branch", e.target.value)}
          />
        </SettingsItem>
        <SettingsItem
          label={t("Path")}
          description={t("Path prefix (e.g. source/_posts/)")}
        >
          <Input
            value={config.blog?.path || "source/_posts/"}
            onChange={(e: any) => updateConfig("blog.path", e.target.value)}
          />
        </SettingsItem>
        <SettingsItem
          label={t("Domain")}
          description={t("Domain for Blog URL (e.g. https://leay.net)")}
        >
          <Input
            value={config.blog?.domain || ""}
            onChange={(e: any) => updateConfig("blog.domain", e.target.value)}
          />
        </SettingsItem>
        <SettingsItem
          label={t("Token")}
          description={t("GitHub Token (Can be same as Image Bed)")}
        >
          <Input
            type="password"
            value={config.blog?.token || ""}
            onChange={(e: any) => updateConfig("blog.token", e.target.value)}
          />
        </SettingsItem>
      </SettingsSection>

      <SettingsSection title={t("Other")}>
        <SettingsItem
          label={t("Tag Label")}
          description={t("Tag name to mark as published (default: 已发布)")}
        >
          <Input
            value={config.tagLabel || "已发布"}
            onChange={(e: any) => updateConfig("tagLabel", e.target.value)}
          />
        </SettingsItem>

        <SettingsItem
          label={t("Poetry Tag")}
          description={t("Tag name to trigger poetry mode (compact newlines)")}
        >
          <Input
            value={config.poetryTag || ""}
            onChange={(e: any) => updateConfig("poetryTag", e.target.value)}
          />
        </SettingsItem>
      </SettingsSection>

      <SettingsSection title={t("Committer")}>
        <SettingsItem
          label={t("Committer Name")}
          description={t("Name for git commits")}
        >
          <Input
            value={config.committer?.name || "orca-hqweay-go-bot"}
            onChange={(e: any) =>
              updateConfig("committer.name", e.target.value)
            }
          />
        </SettingsItem>
        <SettingsItem
          label={t("Committer Email")}
          description={t("Email for git commits")}
        >
          <Input
            value={config.committer?.email || "bot@leay.net"}
            onChange={(e: any) =>
              updateConfig("committer.email", e.target.value)
            }
          />
        </SettingsItem>
      </SettingsSection>
    </div>
  );
}
