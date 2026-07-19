import { useState, useEffect, useRef, useCallback } from "react";
import { useSnapshot } from "valtio";
import { t } from "@/libs/l10n";
import {
  roamSidebarState,
  deleteTab,
  renameTab,
  duplicateTab,
  setActiveTab,
  moveTab,
} from "../utils/state";
import React from "react";

interface TabBarProps {
  onRequestNewTab: () => void;
}

export const TabBar = ({ onRequestNewTab }: TabBarProps) => {
  const state = useSnapshot(roamSidebarState);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabIndex: number;
  } | null>(null);

  const [renamingTabIndex, setRenamingTabIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [draggedTabIndex, setDraggedTabIndex] = useState<number | null>(null);
  const [tabInsertionIndex, setTabInsertionIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [contextMenu]);

  useEffect(() => {
    if (renamingTabIndex !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingTabIndex]);

  const handleContextRename = useCallback((index: number) => {
    setRenamingTabIndex(index);
    setRenameValue(state.tabs[index]?.name || "");
    setContextMenu(null);
  }, [state.tabs]);

  const handleRenameSubmit = useCallback(() => {
    if (renamingTabIndex !== null && renameValue.trim()) {
      renameTab(renamingTabIndex, renameValue.trim());
    }
    setRenamingTabIndex(null);
  }, [renamingTabIndex, renameValue]);

  const handleTabDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.stopPropagation();
    setDraggedTabIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }, []);

  const handleTabDragEnd = useCallback(() => {
    setDraggedTabIndex(null);
    setTabInsertionIndex(null);
  }, []);

  const handleTabDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedTabIndex === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const insertAt = e.clientX < midX ? index : index + 1;
    setTabInsertionIndex(insertAt);
  }, [draggedTabIndex]);

  const handleTabDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedTabIndex !== null && tabInsertionIndex !== null) {
      moveTab(draggedTabIndex, tabInsertionIndex);
    }
    setDraggedTabIndex(null);
    setTabInsertionIndex(null);
  }, [draggedTabIndex, tabInsertionIndex]);

  const handleTabContextMenu = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tabIndex: index });
  }, []);

  const hasContent = (state.tabs[state.activeTabIndex]?.stackedBlocks?.length || 0) > 0;
  if (!hasContent && state.tabs.length <= 1) return null;

  return (
    <>
      <div className="roam-sidebar-tab-bar" contentEditable={false}>
        {state.tabs.map((tab, index) => (
          <React.Fragment key={tab.id}>
            {draggedTabIndex !== null && tabInsertionIndex === index && (
              <div className="roam-sidebar-tab-insertion-line" />
            )}
            <div
              className={`roam-sidebar-tab ${state.activeTabIndex === index ? "roam-sidebar-tab-active" : ""} ${draggedTabIndex === index ? "roam-sidebar-tab-dragging" : ""}`}
              draggable={true}
              onDragStart={(e) => handleTabDragStart(e, index)}
              onDragEnd={handleTabDragEnd}
              onDragOver={(e) => handleTabDragOver(e, index)}
              onDrop={handleTabDrop}
              onClick={() => setActiveTab(index)}
              onContextMenu={(e) => handleTabContextMenu(e, index)}
            >
              {renamingTabIndex === index ? (
                <input
                  ref={renameInputRef}
                  className="roam-sidebar-tab-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSubmit();
                    if (e.key === "Escape") setRenamingTabIndex(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="roam-sidebar-tab-name">{tab.name}</span>
              )}
            </div>
          </React.Fragment>
        ))}
        {draggedTabIndex !== null && tabInsertionIndex === state.tabs.length && (
          <div className="roam-sidebar-tab-insertion-line" />
        )}
        <div
          className="roam-sidebar-tab roam-sidebar-tab-add"
          onClick={onRequestNewTab}
          title={t("roam-sidebar.new-tab")}
        >
          <i className="ti ti-plus" />
        </div>
      </div>

      {contextMenu && (
        <div
          className="roam-sidebar-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          contentEditable={false}
        >
          <div
            className="roam-sidebar-context-menu-item"
            onClick={() => handleContextRename(contextMenu.tabIndex)}
          >
            <i className="ti ti-pencil" /> {t("roam-sidebar.rename-tab")}
          </div>
          <div
            className="roam-sidebar-context-menu-item"
            onClick={() => {
              duplicateTab(contextMenu.tabIndex);
              setContextMenu(null);
            }}
          >
            <i className="ti ti-copy" /> {t("roam-sidebar.duplicate-tab")}
          </div>
          <div className="roam-sidebar-context-menu-separator" />
          <div
            className="roam-sidebar-context-menu-item roam-sidebar-context-menu-danger"
            onClick={() => {
              deleteTab(contextMenu.tabIndex);
              setContextMenu(null);
            }}
          >
            <i className="ti ti-trash" /> {t("roam-sidebar.delete-tab")}
          </div>
        </div>
      )}
    </>
  );
};
