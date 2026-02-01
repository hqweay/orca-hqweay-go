/**
 * WebviewUtils 提供与 Webview 交互的通用工具函数
 */
export class WebviewUtils {
  /**
   * 从 Webview 中抓取图片并写入剪贴板
   * @param webview Webview 实例
   * @param src 图片 URL
   * @param maxWidth 最大宽度，默认 1200px
   */
  public static async copyImageToClipboard(
    webview: any,
    src: string,
    maxWidth: number = 1200,
  ): Promise<boolean> {
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
            
            // 确保显示在当前视口内
            const r = Math.min(vw / nw, vh / nh, 1);
            const w = Math.floor(nw * r);
            const h = Math.floor(nh * r);
            
            img.style.width = w + 'px';
            img.style.height = h + 'px';
            
            container.appendChild(img);
            document.body.appendChild(container);
            
            const oldOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            
            setTimeout(() => {
              resolve({
                width: w,
                height: h,
                naturalWidth: nw,
                naturalHeight: nh,
                oldOverflow
              });
            }, 50);
          };
          img.onerror = () => resolve(null);
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

        // 清理
        await webview.executeJavaScript(`
          const container = document.getElementById('orca-capture-container');
          if(container) container.remove();
          document.body.style.overflow = ${JSON.stringify(rect.oldOverflow)};
        `);

        // 获取捕获的图片数据
        const initialDataURL = snapshot.toDataURL();
        // console.log("initialDataURL", initialDataURL);
        // console.log("rect", rect);
        // 规格化尺寸（处理 Retina 缩放和 maxWidth）
        // 这里目标尺寸取: Math.min(原图宽度, maxWidth)
        const targetWidth = Math.min(rect.naturalWidth, maxWidth);
        const normalizedBlob = await this.normalizeImage(
          initialDataURL,
          targetWidth,
        );

        await navigator.clipboard.write([
          new ClipboardItem({ [normalizedBlob.type]: normalizedBlob }),
        ]);

        return true;
      }
    } catch (e) {
      console.error("WebviewUtils.copyImageToClipboard error:", e);
    }
    return false;
  }

  /**
   * 使用 Canvas 调整图片尺寸
   */
  private static async normalizeImage(
    dataURL: string,
    targetWidth: number,
  ): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // 如果图已经比目标小了，且 DPI 捕获导致它变大，我们也把它缩放回目标物理尺寸
        const canvas = document.createElement("canvas");
        const ratio = targetWidth / img.width;

        // 如果缩放比例非常接近 1 (例如非 Retina 屏且没超宽)，直接返回
        if (Math.abs(ratio - 1) < 0.01) {
          fetch(dataURL)
            .then((res) => res.blob())
            .then(resolve);
          return;
        }

        canvas.width = targetWidth;
        canvas.height = img.height * ratio;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          fetch(dataURL)
            .then((res) => res.blob())
            .then(resolve);
          return;
        }

        // 使用高质量缩放
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          resolve(blob || new Blob());
        }, "image/png");
      };
      img.src = dataURL;
    });
  }
}
