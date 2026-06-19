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

      const menuTexts = menu.querySelectorAll(".orca-menu-text");
      let isLinkMenu = false;
      menuTexts.forEach((item) => {
        if (item.textContent?.includes("编辑链接")) {
          isLinkMenu = true;
        }
      });

      if (!isLinkMenu) {
        logger?.debug?.("[Context Menu] Not a link menu, skipping");
        return;
      }

      logger?.debug?.("[Context Menu] Found link menu, looking for block...");

      // 检查是否是块链接 (orca-note://xxx/block?blockId=xxx)
      const linkElement = findBlockLinkElement(e.target as HTMLElement);
      if (!linkElement) {
        logger?.debug?.("[Context Menu] Not a block link, skipping");
        return;
      }

      const targetBlock = findTargetBlock(e.target as HTMLElement);
      if (!targetBlock) {
        logger?.debug?.("[Context Menu] No target block found for", e.target);
        return;
      }

      const blockId = getBlockIdFromElement(targetBlock);
      if (!blockId) {
        logger?.debug?.("[Context Menu] No block ID found for element", targetBlock);
        return;
      }

      const block = orca.state.blocks[blockId];
      if (!block || !block.content) {
        logger?.debug?.("[Context Menu] Block not found or no content:", blockId);
        return;
      }

      logger?.debug?.("[Context Menu] Found block:", blockId, block.content);

      const hasRef = block.content.some((f) => f.t === "r");
      const hasLink = block.content.some(
        (f) => f.t === "l" && typeof f.l === "string"
      );

      if (!hasRef && !hasLink) return;

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

      const existingInjected = menu.querySelectorAll(
        '[data-orca-context-inject]'
      );
      existingInjected.forEach((el) => el.remove());

      const fragment = document.createDocumentFragment();

      if (hasRef) {
        const refToLink = createMenuItem(
          "ti ti-link",
          "转换为块链接",
          () => executeRefToLink([blockId])
        );
        fragment.appendChild(refToLink);

        const refToTextPin = createMenuItem(
          "ti ti-pin",
          "转换为文本📌",
          () => executeRefToTextPin([blockId])
        );
        fragment.appendChild(refToTextPin);

        const refToPin = createMenuItem(
          "ti ti-pin-filled",
          "转换为📌",
          () => executeRefToPin([blockId])
        );
        fragment.appendChild(refToPin);
      }

      if (hasLink) {
        const linkToRef = createMenuItem(
          "ti ti-blockquote",
          "转换为块引用",
          () => executeLinkToRef([blockId])
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
    // 检查 data-id 属性 (虎鲸笔记使用)
    if (el.getAttribute("data-id")) {
      return el;
    }
    // 检查 data-block-id 属性
    if (el.getAttribute("data-block-id")) {
      return el;
    }
    // 检查 id 属性 (格式: block-{id})
    if (el.id && /^block-\d+$/.test(el.id)) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

function getBlockIdFromElement(element: HTMLElement): number | null {
  // 支持 data-id 和 data-block-id
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
    // 检查是否是 a 标签且包含块链接
    if (el.tagName === "A") {
      const href = el.getAttribute("href") || "";
      const dataL = el.getAttribute("data-l") || "";
      // 块链接格式: orca-note://xxx/block?blockId=xxx
      if (/^orca-note:\/\/.+\/block\?blockId=\d+$/.test(href) ||
          /^orca-note:\/\/.+\/block\?blockId=\d+$/.test(dataL)) {
        return el;
      }
    }
    el = el.parentElement;
  }
  return null;
}
