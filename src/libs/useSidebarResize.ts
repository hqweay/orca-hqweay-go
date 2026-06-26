import { useEffect, useState, useRef } from "react";

export interface SidebarResizeOptions {
  pluginInstance: any;
  containerRef: React.RefObject<HTMLDivElement>;
  wrapperClassName: string;
}

const findHorizontalColumn = (startNode: HTMLElement): HTMLElement | null => {
  const panel = startNode.closest(".orca-panel");
  if (!panel) return null;
  
  let el: HTMLElement | null = panel as HTMLElement;
  while (el && el.parentElement) {
    if (el.parentElement.classList.contains("orca-panels-row") || el.parentElement.classList.contains("SplitPane")) {
      return el;
    }
    el = el.parentElement;
  }
  return panel as HTMLElement;
};

export function useSidebarResize({
  pluginInstance,
  containerRef,
  wrapperClassName,
}: SidebarResizeOptions) {
  const sidebarPosition = pluginInstance?.getSettings()?.sidebarPosition || "left";

  const [isResizing, setIsResizingLocal] = useState(false);
  const [hoveringResizer, setHoveringLocal] = useState(false);
  const currentWidthRef = useRef<number>(250);

  // Sync state across all panels in the same column
  useEffect(() => {
    const onHover = (e: any) => setHoveringLocal(e.detail);

    window.addEventListener(`orca-sidebar-hover-${sidebarPosition}`, onHover);

    return () => {
      window.removeEventListener(`orca-sidebar-hover-${sidebarPosition}`, onHover);
    };
  }, [sidebarPosition]);

  const setHoveringResizer = (isHovering: boolean) => {
    setHoveringLocal(isHovering);
    window.dispatchEvent(new CustomEvent(`orca-sidebar-hover-${sidebarPosition}`, { detail: isHovering }));
  };

  const setIsResizing = (resizing: boolean) => {
    setIsResizingLocal(resizing);
  };


  // 1. Guard the class against React re-renders
  useEffect(() => {
    if (!containerRef.current) return;

    const enforceClass = () => {
      if (!containerRef.current) return;
      const column = findHorizontalColumn(containerRef.current);
      if (column && !column.classList.contains("orca-sidebar-column")) {
        column.classList.add("orca-sidebar-column");
      }
    };

    enforceClass();

    const observer = new MutationObserver(() => {
      enforceClass();
    });

    const column = findHorizontalColumn(containerRef.current);
    if (column) {
      observer.observe(column, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    return () => {
      observer.disconnect();
      if (!containerRef.current) return;
      const col = findHorizontalColumn(containerRef.current);
      if (col) col.classList.remove("orca-sidebar-column");
    };
  }, [containerRef, wrapperClassName]);

  // 2. Custom drag handler
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = containerRef.current?.getBoundingClientRect().width || 250;
    currentWidthRef.current = startWidth;

    const column = containerRef.current
      ? findHorizontalColumn(containerRef.current)
      : null;

    // Apply global cursor and text selection protection
    document.body.style.setProperty("cursor", "col-resize", "important");
    document.body.style.setProperty("user-select", "none", "important");

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newWidth = sidebarPosition === "left" ? startWidth + deltaX : startWidth - deltaX;
      newWidth = Math.max(100, Math.min(newWidth, 800));
      currentWidthRef.current = newWidth;

      const applyTo = (el: HTMLElement | null) => {
        if (!el) return;
        el.style.setProperty("flex", `0 0 ${newWidth}px`, "important");
        el.style.setProperty("width", `${newWidth}px`, "important");
        el.style.setProperty("min-width", `${newWidth}px`, "important");
        el.style.setProperty("max-width", `${newWidth}px`, "important");
      };
      
      applyTo(column);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setIsResizing(false);

      // Restore global body styles
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");

      const currentSettings = pluginInstance?.getSettings();
      if (currentSettings) {
        pluginInstance?.updateSettings({ 
          ...currentSettings, 
          sidebarWidth: Math.round(currentWidthRef.current) 
        });
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return {
    isResizing,
    hoveringResizer,
    setHoveringResizer,
    startDrag,
    sidebarPosition,
  };
}
