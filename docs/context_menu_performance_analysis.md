# 插件右键菜单（Context Menu）注入性能与稳定性分析

本文档分析了 `src/lets-link-tools/context-menu.ts` 中基于 `setTimeout` 注入右键菜单逻辑的性能及潜在隐患。

## 性能表现分析

当前的 `setTimeout` 逻辑对性能的影响**微乎其微（几乎可以忽略不计）**，不会导致应用卡顿。

1. **触发频率极低**：逻辑绑定在 `contextmenu`（鼠标右键点击）事件上，这属于极低频的由用户主动触发的操作，不会像 `scroll` 或 `mousemove` 那样频繁执行。
2. **异步非阻塞**：`setTimeout(..., 50)` 是非阻塞的，仅将任务推迟到 50ms 后的任务队列中执行，完全不影响页面的正常渲染和主线程的其他工作。
3. **极小的 DOM 查询开销**：在右键点击时执行一次 `document.querySelector(".orca-context-menu")`，在现代浏览器中耗时通常不到 1 毫秒，毫无负担。

## `setTimeout` 的作用

在插件开发中这是一种常见的“Hack”手法：
当触发原生的 `contextmenu` 事件时，宿主应用（Orca）可能还在执行其内部逻辑以渲染自定义的 DOM 菜单。延迟 50ms 是为了留出时间让宿主应用完成渲染，确保 `querySelector` 能够拿到真实的 DOM 节点，而不是 `null`。

## 潜在的稳定性隐患（Race Condition）

该逻辑不存在性能问题，但**硬编码的 50ms** 会带来代码不够健壮（可靠性不足）的问题：

1. **注入失败**：如果用户设备卡顿，或宿主应用渲染菜单耗时超过了 50ms，那么定时器在第 50ms 时将找不到菜单（拿到 `null`），导致本次右键点击**无法注入自定义选项**。
2. **视觉闪烁**：如果宿主应用渲染极快（例如 5ms 就完成了），用户会先看到原始菜单，45ms 后自定义项才突然出现，导致体验上存在轻微的视觉割裂感。

## 改进方案（增加稳定性）

如果为了解决上述的稳定性问题，推荐将死板的 `setTimeout(..., 50)` 改为**带超时机制的轮询检测（Polling）**（例如利用 `requestAnimationFrame`）：

```typescript
const handleContextMenu = async (e: MouseEvent) => {
  let startTime = Date.now();
  
  const checkMenu = () => {
    const menu = document.querySelector(".orca-context-menu") as HTMLElement;
    
    if (menu) {
      // 找到菜单，立刻执行注入逻辑
      if (injectedMenu === menu) return;
      // ...
    } else {
      // 没找到且未超时（例如 200ms 内），则在下一帧继续查找
      if (Date.now() - startTime < 200) {
        requestAnimationFrame(checkMenu);
      }
    }
  };
  
  requestAnimationFrame(checkMenu);
};
```
该方案能在菜单渲染出的第一时间就进行注入（消除闪烁），并能自适应不同的渲染速度（避免因为渲染慢而导致注入失败）。
