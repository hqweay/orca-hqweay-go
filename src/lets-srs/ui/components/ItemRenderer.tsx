import React, { useEffect, useRef } from "react";
import type { DbId } from "@/orca";

const { Block } = orca.components;

interface ItemRendererProps {
  blockId: DbId;
  panelId: string;
  showAnswer: boolean;
}

/**
 * 问答型卡片渲染器 (Item)
 * 使用 MutationObserver 动态切换显示父块内容 (问题) 或子块内容 (答案)
 * 这是一个 O(1) 的 DOM 操作方案，性能优异
 */
export const ItemRenderer: React.FC<ItemRendererProps> = ({
  blockId,
  panelId,
  showAnswer,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !blockId) return;

    const toggleVisibility = () => {
      // 1. 处理父块的主内容 (Question)
      // const mainContent = container.querySelector<HTMLElement>(
      //   ":scope > .orca-block > .orca-repr > .orca-repr-main",
      // );
      // if (mainContent) {
      //   // 如果 showAnswer 为 true，隐藏题目（可选，vendor 模式是显示答案时隐藏题目）
      //   // 这里遵循之前的逻辑：显示答案时隐藏题目内容，仅展示子块
      //   mainContent.style.display = showAnswer ? "none" : "";
      // }
      // 2. 隐藏块的 UI 杂项 (Bullet, Handle, Breadcrumb)
      // const breadcrumb =
      //   container.querySelector<HTMLElement>(".orca-breadcrumb");
      // if (breadcrumb) breadcrumb.style.display = "none";
      // const uiSelectors = `
      //   :scope > .orca-block > .orca-block-handle,
      //   :scope > .orca-block > .orca-block-bullet,
      //   :scope > .orca-block > .orca-repr > .orca-repr-handle,
      //   :scope > .orca-block > .orca-repr > .orca-repr-collapse
      // `;
      // const uiElements = container.querySelectorAll<HTMLElement>(uiSelectors);
      // uiElements.forEach((el) => {
      //   el.style.display = "none";
      // });
      // 3. 处理子块 (Answer)
      const childrenSelector = `
        :scope > .orca-block > .orca-block-children,
        :scope > .orca-block > .orca-repr > .orca-repr-children,
        :scope [data-role='children']
      `;
      const childrenNodes =
        container.querySelectorAll<HTMLElement>(childrenSelector);
      if (childrenNodes.length > 0) {
        childrenNodes.forEach((node) => {
          node.style.display = showAnswer ? "" : "none";
          // 确保子块展开
          // if (showAnswer) {
          //   const collapseEl = node.parentElement?.querySelector<HTMLElement>(
          //     ".orca-repr-scope-line",
          //   );
          //   console.log("collapseEl", collapseEl);
          //   if (collapseEl) {
          //     collapseEl.click();
          //   }
          //   console.log("collapseEl click", collapseEl);
          // }
        });
      }
      // else if (!showAnswer) {
      //   // 如果没加载出来子块且没显示答案，确保以后加载出来也被隐藏
      // }
      // const collapseEl = container?.querySelector<HTMLElement>(
      //   ".orca-repr-scope-line",
      // );
      // console.log("collapseEl", collapseEl);
      // if (collapseEl) {
      //   collapseEl.click();
      // }
    };

    // 初始执行一次
    toggleVisibility();

    // 监听 DOM 变化（处理异步加载的块）
    const observer = new MutationObserver(toggleVisibility);
    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [blockId, showAnswer]);

  return (
    <div
      ref={containerRef}
      className="srs-item-renderer"
      data-orca-block-root="true"
    >
      <Block
        key={blockId}
        panelId={panelId}
        blockId={blockId}
        blockLevel={0}
        indentLevel={0}
        // renderingMode="normal"
        initiallyCollapsed={false}
      />
    </div>
  );
};
