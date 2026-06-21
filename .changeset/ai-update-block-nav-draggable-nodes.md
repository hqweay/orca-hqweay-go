---
"orca-hqweay-go": patch
---

- 修复 `lets-block-nav` 侧边栏节点自身无法被拖拽的问题，为其添加了标准的 `draggable` 属性与 `onDragStart` 事件，现在支持在侧边栏内部直接拖拽节点进行同级排序或层级移动。
