# 图像处理策略：基于 Electron 截图的剪贴板复制方案

## 场景
在 Electron 环境中，当需要复制 Webview 内的图片到系统剪贴板，但遇到以下限制时：
1. **CORS 限制**：图片服务器不允许跨域 fetch，导致无法获取 Blob。
2. **防盗链限制**：图片服务器检查 Referer，宿主环境 (Host) fetch 失败。
3. **安全限制**：Webview 内部的 `document.execCommand('copy')` 在非用户交互触发的异步脚本中失效，或仅能复制 HTML/URL 文本。

## 方案：Auto-Scroll + capturePage

### 1. Webview 内部脚本 (定位与调整)
通过 `executeJavaScript` 注入脚本，找到目标图片并将其滚动到视口中央，以最大化其可见区域。

```javascript
(async () => {
    const targetSrc = "IMAGE_URL";
    const imgs = document.getElementsByTagName('img');
    let targetImg = null;
    for (let i = 0; i < imgs.length; i++) {
        if (imgs[i].src === targetSrc) { targetImg = imgs[i]; break; }
    }
    
    if (targetImg) {
        // 居中滚动，确保图片在 capturePage 的有效范围内
        targetImg.scrollIntoView({block: 'center', inline: 'center', behavior: 'instant'});
        // 等待滚动和渲染稳定
        await new Promise(r => setTimeout(r, 150));
        
        const rect = targetImg.getBoundingClientRect();
        return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0
        };
    }
    return null;
})()
```

### 2. 宿主端处理 (截图与写入)
利用 Electron Webview 标签特有的 `capturePage` 方法，直接截取特定区域的像素数据。

```typescript
const rect = await webview.executeJavaScript(script);
if (rect && rect.visible) {
    // 截取视图
    const nativeImage = await webview.capturePage({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
    });
    
    // 转为 Blob 并写入剪贴板
    const dataURL = nativeImage.toDataURL();
    const res = await fetch(dataURL);
    const blob = await res.blob();
    await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob })
    ]);
}
```

## 优点
- **完全绕过网络层**：不需要重新请求图片，只要用户能看到，就能复制。
- **二进制数据**：复制的是真正的图像，可直接粘贴到微信、图像编辑器等。

## 缺点
- **视图局限性**：截取的是屏幕渲染的像素，如果图片被遮挡或大于视口，截取的是残缺图。
- **质量依赖分辨率**：截图质量受当前屏幕缩放 (DPI) 影响。
