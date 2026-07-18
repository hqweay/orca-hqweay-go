import { useState, useCallback } from "react";
import { t } from "@/libs/l10n";

interface NewTabModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export const NewTabModal = ({ visible, onClose, onSubmit }: NewTabModalProps) => {
  const [name, setName] = useState("");

  const handleSubmit = useCallback(() => {
    if (name.trim()) {
      onSubmit(name.trim());
    }
    setName("");
    onClose();
  }, [name, onSubmit, onClose]);

  if (!visible) return null;

  return (
    <orca.components.ModalOverlay
      visible={visible}
      onClose={() => {
        setName("");
        onClose();
      }}
      blurred={true}
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--orca-color-bg-1)",
          color: "var(--orca-text-color)",
          padding: "20px",
          borderRadius: "12px",
          width: "320px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
          border: "1px solid var(--orca-color-border-2)",
        }}
      >
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "15px",
            fontWeight: 600,
          }}
        >
          {t("roam-sidebar.tab-name-prompt")}
        </h3>
        <orca.components.Input
          value={name}
          onChange={(e: any) => setName(e.target.value)}
          onKeyDown={(e: any) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") {
              setName("");
              onClose();
            }
          }}
          placeholder={t("roam-sidebar.tab-name-placeholder") || "Tab name"}
          autoFocus
          width="100%"
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "16px",
          }}
        >
          <orca.components.Button
            variant="plain"
            onClick={() => {
              setName("");
              onClose();
            }}
          >
            {t("common.cancel")}
          </orca.components.Button>
          <orca.components.Button
            variant="solid"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            {t("common.confirm")}
          </orca.components.Button>
        </div>
      </div>
    </orca.components.ModalOverlay>
  );
};
