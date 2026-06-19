import React from "react";
import { t } from "@/libs/l10n";
import { ChangelogEntry } from "../changelog";

interface UpdateModalProps {
  visible: boolean;
  onClose: () => void;
  entries: ChangelogEntry[];
}

export function UpdateModal({ visible, onClose, entries }: UpdateModalProps) {
  if (!visible || entries.length === 0) return null;

  return (
    <orca.components.ModalOverlay
      visible={visible}
      onClose={onClose}
      blurred={true}
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--orca-color-bg-1)",
          color: "var(--orca-text-color)",
          padding: "24px",
          borderRadius: "12px",
          width: "420px",
          maxHeight: "70vh",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.25)",
          border: "1px solid var(--orca-color-border-2)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 标题 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
            }}
          >
            🎉 {t("What's New")}
          </h3>
          <orca.components.Button
            variant="plain"
            onClick={onClose}
            style={{ padding: "4px", minWidth: "auto" }}
          >
            <i className="ti ti-x" style={{ fontSize: "16px" }} />
          </orca.components.Button>
        </div>

        {/* 更新日志内容 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            paddingRight: "8px",
          }}
        >
          {entries.map((entry) => (
            <div key={entry.version} style={{ marginBottom: "20px" }}>
              {/* 版本号和日期 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                <span
                  style={{
                    background: "var(--orca-color-primary-5)",
                    color: "white",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  v{entry.version}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    opacity: 0.5,
                  }}
                >
                  {entry.date}
                </span>
              </div>

              {/* 变更列表 */}
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "20px",
                  fontSize: "13px",
                  lineHeight: "1.6",
                }}
              >
                {entry.changes.map((change, idx) => (
                  <li key={idx} style={{ marginBottom: "4px" }}>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 底部按钮 */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid var(--orca-color-border)",
          }}
        >
          <orca.components.Button
            variant="solid"
            onClick={onClose}
          >
            {t("Got it")}
          </orca.components.Button>
        </div>
      </div>
    </orca.components.ModalOverlay>
  );
}
