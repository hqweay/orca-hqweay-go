import { t } from "@/libs/l10n";

interface ContextMenuInjector {
  disconnect: () => void;
}

export function injectContextMenu(
  logger: any,
  openBrowser: (url: string, block: any) => Promise<void>
): ContextMenuInjector {
  let injectedMenu: HTMLElement | null = null;

  const handleContextMenu = async (e: MouseEvent) => {
    setTimeout(async () => {
      const menu = document.querySelector(".orca-context-menu") as HTMLElement;
      if (!menu || injectedMenu === menu) return;

      if (injectedMenu && injectedMenu !== menu) {
        injectedMenu = null;
      }

      const target = e.target as HTMLElement;

      // 查找块链接
      const linkElement = findBlockLinkElement(target);
      if (!linkElement) return;

      // 获取链接 URL
      const url = linkElement.getAttribute("href") || linkElement.getAttribute("data-l") || "";
      if (!url || !url.startsWith("http")) return;

      // 查找所在的 block
      const targetBlock = findTargetBlock(target);
      if (!targetBlock) return;

      const blockId = getBlockIdFromElement(targetBlock);
      if (!blockId) return;

      const block = orca.state.blocks[blockId];
      if (!block) return;

      logger?.debug?.("[Context Menu] Found link:", url);

      // 查找锚点菜单项（"转换为文本"）
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
        '[data-orca-context-inject="link-metadata"]'
      );
      existingInjected.forEach((el) => el.remove());

      // 创建菜单项
      const fragment = document.createDocumentFragment();

      const closeMenu = () => {
        menu.style.display = "none";
        injectedMenu = null;
      };

      const menuItem = createMenuItem(
        "ti ti-world",
        t("Metadata: Browser Mode"),
        async () => {
          await openBrowser(url, block);
          closeMenu();
        }
      );
      fragment.appendChild(menuItem);

      // 插入到锚点之前（在转换选项之前）
      parentNode.insertBefore(fragment, anchorItem);
      injectedMenu = menu;

      logger?.info?.("[Context Menu] Injected link-metadata options");
    }, 50);
  };

  document.addEventListener("contextmenu", handleContextMenu, true);

  const handleClick = () => {
    if (injectedMenu) {
      const items = injectedMenu.querySelectorAll('[data-orca-context-inject="link-metadata"]');
      items.forEach((el) => el.remove());
      injectedMenu = null;
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest(".orca-context-menu")) {
      handleClick();
    }
  };

  document.addEventListener("click", handleClick, true);
  document.addEventListener("mousedown", handleMouseDown, true);

  return {
    disconnect: () => {
      document.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("mousedown", handleMouseDown, true);
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
  item.setAttribute("data-orca-context-inject", "link-metadata");
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
      // 普通 HTTP 链接
      if (href.startsWith("http") || dataL.startsWith("http")) {
        return el;
      }
    }
    el = el.parentElement;
  }
  return null;
}
