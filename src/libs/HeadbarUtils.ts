import React from "react";

let leftHeadbarRoots: Record<string, any> = {};

export const renderLeftHeadbarButton = (id: string, element: React.ReactNode) => {
  if (!element) return;
  const inject = () => {
    const toggleBtn = document.querySelector(".orca-headbar-sidebar-toggle");
    if (!toggleBtn || !toggleBtn.parentElement) {
      setTimeout(inject, 1000);
      return;
    }

    let wrapper = toggleBtn.parentElement.querySelector(".orca-left-plugins-wrapper") as HTMLElement;
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "orca-left-plugins-wrapper";
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.gap = "2px";
      wrapper.style.marginLeft = "4px";
      toggleBtn.insertAdjacentElement("beforebegin", wrapper);
    }

    let container = document.getElementById(`left-btn-container-${id}`);
    if (!container) {
      container = document.createElement("div");
      container.id = `left-btn-container-${id}`;
      wrapper.appendChild(container);
    }

    const { createRoot } = window as any;
    if (!leftHeadbarRoots[id]) {
      leftHeadbarRoots[id] = createRoot(container);
    }
    
    leftHeadbarRoots[id].render(element);
  };
  
  inject();
};

export const removeLeftHeadbarButton = (id: string) => {
  if (leftHeadbarRoots[id]) {
    leftHeadbarRoots[id].unmount();
    delete leftHeadbarRoots[id];
  }
  const container = document.getElementById(`left-btn-container-${id}`);
  if (container) {
    container.remove();
  }
};
