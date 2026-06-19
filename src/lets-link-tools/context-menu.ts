import {
  hasBlockReference,
  hasBlockLink,
  executeRefToLink,
  executeLinkToRef,
  executeRefToTextPin,
  executeRefToPin,
} from "./logic";

interface ContextMenuInjector {
  disconnect: () => void;
}

export function injectContextMenu(logger: any): ContextMenuInjector {
  let injectedMenu: HTMLElement | null = null;

  const handleContextMenu = async (e: MouseEvent) => {
    setTimeout(async () => {
      const menu = document.querySelector(".orca-context-menu") as HTMLElement;
      if (!menu || injectedMenu === menu) return;

      if (injectedMenu && injectedMenu !== menu) {
        injectedMenu = null;
      }

      const target = e.target as HTMLElement;

      // 检测类型：块链接 或 块引用
      const blockLinkElement = findBlockLinkElement(target);
      const blockRefElement = findBlockReferenceElement(target);

      if (!blockLinkElement && !blockRefElement) {
        logger?.debug?.("[Context Menu] Not a block link or reference, skipping");
        return;
      }

      logger?.debug?.("[Context Menu] Found:", blockLinkElement ? "block link" : "block reference");

      const targetBlock = findTargetBlock(target);
      if (!targetBlock) {
        logger?.debug?.("[Context Menu] No target block found");
        return;
      }

      const blockId = getBlockIdFromElement(targetBlock);
      if (!blockId) {
        logger?.debug?.("[Context Menu] No block ID found");
        return;
      }

      const block = orca.state.blocks[blockId];
      if (!block || !block.content) {
        logger?.debug?.("[Context Menu] Block not found or no content:", blockId);
        return;
      }

      logger?.debug?.("[Context Menu] Block content:", block.content);

      const hasRef = block.content.some((f) => f.t === "r");
      const hasLink = block.content.some(
        (f) => f.t === "l" && typeof f.l === "string"
      );

      if (!hasRef && !hasLink) return;

      // 查找锚点菜单项
      const menuTexts = menu.querySelectorAll(".orca-menu-text");
      let anchorItem: HTMLElement | null = null;
      for (const item of menuTexts) {
        if (item.textContent?.includes("转换为文本")) {
          anchorItem = item as HTMLElement;
          break;
        }
      }

      if (!anchorItem) return;
      const parentNode = anchorItem.parentNode as ParentNode | null;
      if (!parentNode) return;

      // 清除已注入的菜单项
      const existingInjected = menu.querySelectorAll(
        '[data-orca-context-inject]'
      );
      existingInjected.forEach((el) => el.remove());

      const fragment = document.createDocumentFragment();

      // 关闭菜单的辅助函数
      const closeMenu = () => {
        menu.style.display = "none";
        injectedMenu = null;
      };

      // 注入菜单项
      if (hasRef) {
        const refToLink = createMenuItem(
          "ti ti-link",
          "转换为块链接",
          async () => {
            await executeRefToLink([blockId]);
            closeMenu();
          }
        );
        fragment.appendChild(refToLink);

        const refToTextPin = createMenuItem(
          "ti ti-pin",
          "转换为文本📌",
          async () => {
            await executeRefToTextPin([blockId]);
            closeMenu();
          }
        );
        fragment.appendChild(refToTextPin);

        const refToPin = createMenuItem(
          "ti ti-pin-filled",
          "转换为📌",
          async () => {
            await executeRefToPin([blockId]);
            closeMenu();
          }
        );
        fragment.appendChild(refToPin);
      }

      if (hasLink) {
        const linkToRef = createMenuItem(
          "ti ti-blockquote",
          "转换为块引用",
          async () => {
            await executeLinkToRef([blockId]);
            closeMenu();
          }
        );
        fragment.appendChild(linkToRef);
      }

      parentNode.insertBefore(fragment, anchorItem.nextSibling);
      injectedMenu = menu;

      logger?.info?.("[Context Menu] Injected conversion options");
    }, 50);
  };

  document.addEventListener("contextmenu", handleContextMenu, true);

  const handleMenuClose = () => {
    if (injectedMenu) {
      const items = injectedMenu.querySelectorAll("[data-orca-context-inject]");
      items.forEach((el) => el.remove());
      injectedMenu = null;
    }
  };

  document.addEventListener("click", handleMenuClose, true);
  document.addEventListener("mousedown", (e) => {
    if (!(e.target as HTMLElement).closest(".orca-context-menu")) {
      handleMenuClose();
    }
  }, true);

  return {
    disconnect: () => {
      document.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("click", handleMenuClose, true);
    },
  };
}

function createMenuItem(
  iconClass: string,
  text: string,
  onClick: () => Promise<void>
): HTMLElement {
  const item = document.createElement("div");
  item.className = "orca-menu-text";
  item.setAttribute("data-orca-context-inject", "true");
  item.style.cursor = "pointer";

  item.innerHTML = `
    <i class="${iconClass} orca-menu-text-icon orca-menu-text-pre"></i>
    <div class="orca-menu-text-text">${text}</div>
  `;

  item.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });

  item.addEventListener("mouseenter", () => {
    item.style.backgroundColor = "var(--orca-menu-hover-bg, rgba(0,0,0,0.05))";
  });

  item.addEventListener("mouseleave", () => {
    item.style.backgroundColor = "";
  });

  return item;
}

function findTargetBlock(element: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = element;
  while (el && el !== document.body) {
    if (el.getAttribute("data-id")) {
      return el;
    }
    if (el.getAttribute("data-block-id")) {
      return el;
    }
    if (el.id && /^block-\d+$/.test(el.id)) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

function getBlockIdFromElement(element: HTMLElement): number | null {
  const blockIdAttr =
    element.getAttribute("data-id") ||
    element.getAttribute("data-block-id") ||
    element.id?.replace("block-", "");
  if (blockIdAttr) {
    const id = parseInt(blockIdAttr, 10);
    return isNaN(id) ? null : id;
  }
  return null;
}

function findBlockLinkElement(element: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = element;
  while (el && el !== document.body) {
    if (el.tagName === "A") {
      const href = el.getAttribute("href") || "";
      const dataL = el.getAttribute("data-l") || "";
      if (/^orca-note:\/\/.+\/block\?blockId=\d+$/.test(href) ||
          /^orca-note:\/\/.+\/block\?blockId=\d+$/.test(dataL)) {
        return el;
      }
    }
    el = el.parentElement;
  }
  return null;
}

function findBlockReferenceElement(element: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = element;
  while (el && el !== document.body) {
    // 块引用标识: data-type="r"
    if (el.getAttribute("data-type") === "r") {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}
