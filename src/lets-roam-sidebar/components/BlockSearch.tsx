import { useState, useRef, useEffect } from "react";
import { t } from "@/libs/l10n";

interface BlockSearchProps {
  query: string;
  onSearch: (query: string) => void;
}

export const BlockSearch = ({ query, onSearch }: BlockSearchProps) => {
  const [active, setActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active && inputRef.current) {
      inputRef.current.focus();
    }
  }, [active]);

  const handleClear = () => {
    onSearch("");
    setActive(false);
  };

  if (!active && !query) {
    return (
      <div style={{ cursor: "pointer" }} onClick={() => setActive(true)} title={t("roam-sidebar.search")}>
        <i className="ti ti-search" />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        flex: 1,
        minWidth: 0,
      }}
    >
      <i className="ti ti-search" style={{ fontSize: "13px", opacity: 0.5, flexShrink: 0 }} />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") handleClear();
        }}
        placeholder={t("roam-sidebar.search-placeholder")}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: "13px",
          color: "inherit",
          fontFamily: "inherit",
        }}
      />
      <div
        style={{ cursor: "pointer", flexShrink: 0 }}
        onClick={handleClear}
        title={t("roam-sidebar.search-clear")}
      >
        <i className="ti ti-x" />
      </div>
    </div>
  );
};
