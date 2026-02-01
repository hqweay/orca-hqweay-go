/**
 * WebviewUtils 提供与 Webview 交互的通用工具函数
 */
export class WebviewUtils {
  /**
   * 从 Webview 中抓取图片并写入剪贴板
   * 通过注入脚本渲染图片并使用 capturePage 截图，规避 CORS 限制
   */
  public static async copyImageToClipboard(webview: any, src: string): Promise<boolean> {
    if (!webview) return false;

    const prepScript = `
      (async () => {
        const old = document.getElementById('orca-capture-container');
        if(old) old.remove();

        const container = document.createElement('div');
        container.id = 'orca-capture-container';
        container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:white;z-index:999999999;overflow:hidden;';
        
        const img = document.createElement('img');
        img.id = 'orca-temp-capture';
        img.style.cssText = 'position:absolute;top:0;left:0;margin:0;padding:0;display:block;';
        
        return new Promise((resolve) => {
          img.onload = () => {
            const nw = img.naturalWidth;
            const nh = img.naturalHeight;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            
            const r = Math.min(vw / nw, vh / nh, 1);
            const w = Math.floor(nw * r);
            const h = Math.floor(nh * r);
            
            img.style.width = w + 'px';
            img.style.height = h + 'px';
            
            container.appendChild(img);
            document.body.appendChild(container);
            
            const oldOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            
            // 延时确保渲染稳定
            setTimeout(() => {
              resolve({
                width: w,
                height: h,
                oldOverflow
              });
            }, 50);
          };
          img.onerror = () => {
            resolve(null);
          };
          img.src = ${JSON.stringify(src)};
        });
      })()
    `;

    try {
      const rect = await webview.executeJavaScript(prepScript);

      if (rect) {
        const snapshot = await webview.capturePage({
          x: 0,
          y: 0,
          width: rect.width,
          height: rect.height,
        });

        const dataURL = snapshot.toDataURL();

        // 清理注入的 DOM
        await webview.executeJavaScript(`
          const container = document.getElementById('orca-capture-container');
          if(container) container.remove();
          document.body.style.overflow = ${JSON.stringify(rect.oldOverflow)};
        `);

        // 转换为 Blob 并写入剪贴板
        const res = await fetch(dataURL);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);

        return true;
      }
    } catch (e) {
      console.error("WebviewUtils.copyImageToClipboard error:", e);
    }
    return false;
  }
}
