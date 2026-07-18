import { t } from "@/libs/l10n";

interface DropZoneFooterProps {
  isDragOver: boolean;
}

export const DropZoneFooter = ({ isDragOver }: DropZoneFooterProps) => {
  return (
    <div
      className={`roam-sidebar-dropzone-footer ${isDragOver ? "roam-sidebar-dropzone-active" : ""}`}
      contentEditable={false}
    >
      <div className="roam-sidebar-dropzone-icon">
        {isDragOver ? (
          <i className="ti ti-plus" />
        ) : (
          <i className="ti ti-dots" />
        )}
      </div>
      <span>
        {isDragOver
          ? t("roam-sidebar.drop-to-append")
          : t("roam-sidebar.continue-adding")}
      </span>
    </div>
  );
};
