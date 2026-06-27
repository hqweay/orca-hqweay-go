# 彻底消除 Orca 侧边栏（react-split-pane）排版闪烁的终极方案

## 1. 背景与问题表现
在使用 Orca API (`orca.nav.addTo`) 动态创建侧边栏时，底层 `react-split-pane` 组件会先赋予新插入面板默认样式（如 `flex-basis: 33.3333%`），之后才会通过异步 State 更新为目标尺寸（如宽度 250px 或垂直平分的 50% 高度）。
这种先渲染默认态、再渲染目标态的机制，导致了每次开关侧边栏时不可避免的**视觉闪烁 (Layout Flicker)**。

## 2. 踩坑与认知迭代
在试图通过 `MutationObserver` (MO) 拦截并强制注入样式的过程中，我们踩了以下几个经典的坑：

1. **时序问题**：不能在同一个函数末尾同步调用 `observer.disconnect()`，因为 `MutationObserver` 是通过微任务触发的。同步断开会导致回调永远不执行。**解法**：使用 `setTimeout` 在 2 秒后清理。
2. **标识判定失效**：最初试图通过判断类名 `orca-locked` 和内联样式 `flex-basis` 来精准捕捉侧边栏。但发现 Orca 重建面板时，未必会立刻附加上这些属性，导致拦截经常“漏掉”第一帧。
3. **无限死循环（浏览器卡死）**：为了解决漏判，我们不仅监听节点的 `childList` 插入，还监听了 `attributes` (尤其是 `style` 属性)，并在第一时间去掉条件约束强行修改 `style`。这导致了：**MO 修改样式 -> 触发 attributes 变更 -> MO 再次捕获 -> 再次修改 -> 无限死循环**。
4. **组件层级重构陷阱**：在垂直堆叠（第二个侧边栏打开）时，旧的外层容器不会被销毁，而是其内部被替换成了一个新的 `SplitPane`（包含两个新面板）。这要求必须能准确识别出哪些是“外层容器”（需要锁宽），哪些是“内层容器”（需要锁高）。

## 3. 终极破局思路
为了做到“即插即用、零闪烁、不卡死”，最终抽象出了以下完美的观察者逻辑：

### 核心机制
1. **快照排它 (Snapshot)**：在调用 API 添加面板**前**，将当前文档中所有的 `.orca-panel` 存入一个 `Set`，新加入的面板才会被处理。
2. **防死循环标记**：一旦给一个面板强行设置了 `!important` 的尺寸，**立刻将其加入 Snapshot 集合**。这样下次该面板因为样式变更再次触发回调时，就会被直接 `continue` 跳过。
3. **根据 DOM 层级判断内外层**：抛弃计算 `getBoundingClientRect` 和类名查找的玄学。直接从新面板开始向上遍历 `parentElement`：
   - 如果父级链路中**存在**另一个 `.orca-panel`，说明它是嵌套在里面的**内层面板**（高度平分）。
   - 如果父级链路中**不存在**任何 `.orca-panel`，说明它是**最外层容器**（定宽 250px）。

## 4. 终极代码片段参考

这份代码非常适合被抽离为一个通用的工具库（如 `sidebarObserver.ts`），可以在任何基于 Orca 的侧边栏插件中复用：

```typescript
export const createOpenObserver = (width: number, isVertical: boolean): MutationObserver => {
  // 1. 获取快照
  const snapshot = new Set([...document.querySelectorAll<HTMLElement>(".orca-panel")]);
  
  // 2. 预先计算总高度（用于垂直切分）
  let totalHeight = window.innerHeight;
  const existingSidebarCol = document.querySelector<HTMLElement>(".orca-sidebar-column");
  if (existingSidebarCol) {
    totalHeight = existingSidebarCol.getBoundingClientRect().height;
  }
  const halfHeight = Math.floor(totalHeight / 2);

  const unifiedObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const nodesToCheck = new Set<HTMLElement>();
      
      // 收集新增节点和属性变更的节点
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach(n => { if (n instanceof HTMLElement) nodesToCheck.add(n); });
      } else if (mutation.type === "attributes") {
        if (mutation.target instanceof HTMLElement) nodesToCheck.add(mutation.target);
      }

      for (const node of nodesToCheck) {
        // 获取所有涉及的面板
        const panels: HTMLElement[] = node.classList?.contains("orca-panel")
          ? [node]
          : [...node.querySelectorAll<HTMLElement>(".orca-panel")];

        for (const panel of panels) {
          // 如果已在快照中（或已被处理过），直接跳过
          if (snapshot.has(panel)) continue;

          // 根据层级判断内外层
          let isOuter = true;
          let parent = panel.parentElement;
          while (parent) {
            if (parent.classList.contains("orca-panel")) {
              isOuter = false; 
              break; 
            }
            parent = parent.parentElement;
          }

          if (isOuter) {
            // 最外层容器：锁死宽度
            panel.style.setProperty("flex", `0 0 ${width}px`, "important");
            panel.style.setProperty("width", `${width}px`, "important");
            panel.style.setProperty("min-width", `${width}px`, "important");
            panel.style.setProperty("max-width", `${width}px`, "important");
            panel.classList.add("orca-sidebar-column");
            // 【关键】处理完毕后加入快照，防止 style 变更引发无限死循环
            snapshot.add(panel);
          } else if (isVertical) {
            // 内层容器（垂直堆叠情况）：锁死一半高度
            panel.style.setProperty("flex", `0 0 ${halfHeight}px`, "important");
            panel.style.setProperty("height", `${halfHeight}px`, "important");
            panel.style.setProperty("min-height", `${halfHeight}px`, "important");
            panel.style.setProperty("max-height", `${halfHeight}px`, "important");
            // 【关键】防止死循环
            snapshot.add(panel);
          }
        }
      }
    }
  });

  // 【关键】同时监听 childList 和 attributes，以防遗漏 Orca 异步附加样式的瞬间
  unifiedObserver.observe(document.body, { 
    childList: true, 
    subtree: true, 
    attributes: true, 
    attributeFilter: ["style", "class"] 
  });

  return unifiedObserver;
};

export const autoDisconnect = (observer: MutationObserver, timeoutMs = 2000) => {
  const timeoutId = setTimeout(() => observer.disconnect(), timeoutMs);
  const origDisc = observer.disconnect.bind(observer);
  observer.disconnect = () => { 
    clearTimeout(timeoutId); 
    origDisc(); 
  };
};
```

---

## 5. 结语
这套方案通过直接从 DOM 的生命周期最底层入手，完全绕过了 React 层面的 State 计算延迟。虽然看起来有些 Hacker，但在面对难以控制的第三方组件排版闪烁时，这可以说是性能最好、最稳定的降维打击方案。
