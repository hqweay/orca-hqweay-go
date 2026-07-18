import { t } from "@/libs/l10n";

interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export const ConfirmModal = ({
  visible,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  danger = false,
}: ConfirmModalProps) => {
  if (!visible) return null;

  return (
    <orca.components.ModalOverlay
      visible={visible}
      onClose={onClose}
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
          {title}
        </h3>
        {description && (
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", opacity: 0.7 }}>
            {description}
          </p>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          <orca.components.Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </orca.components.Button>
          <orca.components.Button
            variant="solid"
            onClick={onConfirm}
            style={
              danger
                ? { backgroundColor: "var(--orca-color-danger-5, #ef4444)" }
                : undefined
            }
          >
            {confirmLabel || t("common.confirm")}
          </orca.components.Button>
        </div>
      </div>
    </orca.components.ModalOverlay>
  );
};
