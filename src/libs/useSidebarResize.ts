import { useEffect, useState, useRef } from "react";

export interface SidebarResizeOptions {
  pluginInstance: any;
  containerRef: React.RefObject<HTMLDivElement>;
  wrapperClassName: string;
}

export function useSidebarResize({
  pluginInstance,
  containerRef,
  wrapperClassName,
}: SidebarResizeOptions) {
  const [isResizing, setIsResizing] = useState(false);
  const [hoveringResizer, setHoveringResizer] = useState(false);
  const currentWidthRef = useRef<number>(250);
  
  const sidebarPosition = pluginInstance?.getSettings()?.sidebarPosition || "left";

  // 1. Guard the class against React re-renders
  useEffect(() => {
    if (!containerRef.current) return;

    const parent =
      (containerRef.current.closest(".orca-panel") as HTMLElement) ||
      containerRef.current.parentElement;
    if (!parent) return;

    const wrapper = (parent.closest(".SplitPane") as HTMLElement) || parent;

    const enforceClass = () => {
      if (wrapper && !wrapper.classList.contains(wrapperClassName)) {
        wrapper.classList.add(wrapperClassName);
      }
      if (parent && parent !== wrapper && !parent.classList.contains(wrapperClassName)) {
        parent.classList.add(wrapperClassName);
      }
    };

    enforceClass();

    const observer = new MutationObserver(() => {
      enforceClass();
    });

    observer.observe(wrapper, { attributes: true, attributeFilter: ["class"] });
    if (parent !== wrapper) {
      observer.observe(parent, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    return () => {
      observer.disconnect();
      if (wrapper) wrapper.classList.remove(wrapperClassName);
      if (parent && parent !== wrapper) parent.classList.remove(wrapperClassName);
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

    const parent = containerRef.current?.closest(".orca-panel") as HTMLElement;
    const wrapper = parent?.closest(".SplitPane") as HTMLElement;

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
      
      applyTo(parent);
      applyTo(wrapper);
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
