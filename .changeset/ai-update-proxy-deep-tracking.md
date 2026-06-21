---
"orca-hqweay-go": patch
---

- 修复了因为 React `useMemo`/`useEffect` 与 Valtio Proxy 对象缓存冲突，导致侧边栏（`arc-tabs` 和 `block-nav`）无法响应“前进/后退”页面内局部刷新的问题。
