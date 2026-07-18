import { t } from "@/libs/l10n";

interface EmptyStateProps {
  isDragOver: boolean;
}

export const EmptyState = ({ isDragOver }: EmptyStateProps) => {
  return (
    <div
      className={`roam-sidebar-empty ${isDragOver ? "roam-sidebar-empty-active" : ""}`}
      contentEditable={false}
    >
      <div className="roam-sidebar-empty-icon">
        {isDragOver ? (
          <i className="ti ti-download" />
        ) : (
          <i className="ti ti-layout-sidebar-right" />
        )}
      </div>
      <div className="roam-sidebar-empty-text">
        {isDragOver
          ? t("roam-sidebar.drop-to-add")
          : t("roam-sidebar.drag-here")}
      </div>
      <div className="roam-sidebar-empty-hint">
        {isDragOver
          ? t("roam-sidebar.release-mouse")
          : t("roam-sidebar.split-view")}
      </div>
    </div>
  );
};
