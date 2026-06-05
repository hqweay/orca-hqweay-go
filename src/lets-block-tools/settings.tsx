import React, { useState } from "react";
import { t } from "@/libs/l10n";
import { SettingsSection } from "@/components/SettingsItem";
import type BlockToolsPlugin from "./index";

export function BlockToolsSettings({ plugin }: { plugin: BlockToolsPlugin }) {
  const settings = plugin["getSettings"]();
  const [enablePushToRef, setEnablePushToRef] = useState<boolean>(
    settings.enablePushToRef !== false,
  );
  const [enablePushAndDelete, setEnablePushAndDelete] = useState<boolean>(
    settings.enablePushAndDelete !== false,
  );
  const [enablePushAndTrace, setEnablePushAndTrace] = useState<boolean>(
    settings.enablePushAndTrace !== false,
  );
  const [enableMoveWithinParent, setEnableMoveWithinParent] = useState<boolean>(
    settings.enableMoveWithinParent !== false,
  );
  const [enableConvertRefLink, setEnableConvertRefLink] = useState<boolean>(
    settings.enableConvertRefLink !== false,
  );
 
  const handleToggle = async (field: string, val: boolean) => {
    if (field === "enablePushToRef") setEnablePushToRef(val);
    if (field === "enablePushAndDelete") setEnablePushAndDelete(val);
    if (field === "enablePushAndTrace") setEnablePushAndTrace(val);
    if (field === "enableMoveWithinParent") setEnableMoveWithinParent(val);
    if (field === "enableConvertRefLink") setEnableConvertRefLink(val);
    await plugin["updateSettings"]({ ...settings, [field]: val });
  };
 
  const Checkbox = orca.components.Checkbox;
 
  return (
    <SettingsSection title={t("Block Tools")}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <Checkbox
          checked={enablePushToRef}
          onChange={(e: { checked: boolean }) =>
            handleToggle("enablePushToRef", e.checked)
          }
        />
        <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
          {t("Enable Push Children to Referenced Block")}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <Checkbox
          checked={enablePushAndDelete}
          onChange={(e: { checked: boolean }) =>
            handleToggle("enablePushAndDelete", e.checked)
          }
        />
        <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
          {t("Enable Push Children and Delete")}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <Checkbox
          checked={enablePushAndTrace}
          onChange={(e: { checked: boolean }) =>
            handleToggle("enablePushAndTrace", e.checked)
          }
        />
        <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
          {t("Enable Push Children and Keep Trace")}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <Checkbox
          checked={enableMoveWithinParent}
          onChange={(e: { checked: boolean }) =>
            handleToggle("enableMoveWithinParent", e.checked)
          }
        />
        <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
          {t("Enable Move to Top/Bottom of Parent")}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <Checkbox
          checked={enableConvertRefLink}
          onChange={(e: { checked: boolean }) =>
            handleToggle("enableConvertRefLink", e.checked)
          }
        />
        <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
          {t("Enable Reference & Link Conversions")}
        </div>
      </div>
    </SettingsSection>
  );
}

