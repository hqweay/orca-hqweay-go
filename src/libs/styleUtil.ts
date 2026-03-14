interface CSSRuleOptions {
  /** 样式表唯一标识符 */
  id?: string;
  /** 作用域: 'global' 全局, 'shadow' 为 Shadow DOM 准备, Element 特定元素, string CSS选择器 */
  scope?: "global" | "shadow" | Element | string;
  /** 优先级: 'normal' 普通, 'important' 重要 */
  priority?: "normal" | "important";
  /** 是否替换已存在的同名样式 */
  replace?: boolean;
  /** 媒体查询条件 */
  media?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 样式加载完成回调 */
  onLoad?: (style: HTMLStyleElement) => void;
  /** 错误回调 */
  onError?: (error: Error, style: HTMLStyleElement) => void;
}

interface CSSRuleObject {
  /** CSS 选择器 */
  selector: string;
  /** CSS 声明 */
  declarations: string;
  /** 选项 */
  options?: CSSRuleOptions;
}

interface CSSRuleInstance {
  /** 样式元素 */
  element: HTMLStyleElement;
  /** 样式ID */
  id: string;
  /** 启用样式 */
  enable: () => CSSRuleInstance;
  /** 禁用样式 */
  disable: () => CSSRuleInstance;
  /** 移除样式 */
  remove: () => CSSRuleInstance;
  /** 更新样式 */
  update: (
    cssText: string,
    updateOptions?: Partial<CSSRuleOptions>,
  ) => CSSRuleInstance;
  /** 克隆样式 */
  clone: (cloneOptions?: Partial<CSSRuleOptions>) => CSSRuleInstance;
}

/**
 * 应用CSS规则
 * @param cssText CSS文本
 * @param options 配置选项
 * @returns CSS规则实例
 */
function applyCSSRule(
  cssText: string,
  options: CSSRuleOptions = {},
): CSSRuleInstance {
  const {
    id = undefined,
    scope = "global",
    priority = "normal",
    replace = false,
    media = undefined,
    disabled = false,
    onLoad = null,
    onError = null,
  } = options;

  // 生成唯一ID
  const styleId =
    id || `css-rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // 清理CSS文本
  const cleanedCssText = cssText
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, ""); // 移除注释

  if (!cleanedCssText) {
    throw new Error("CSS text cannot be empty");
  }

  // 添加优先级标记
  const processedCssText =
    priority === "important"
      ? cleanedCssText
          .replace(/;/g, " !important;")
          .replace(/\s*\}\s*/g, " !important; }")
      : cleanedCssText;

  // 包装媒体查询
  const finalCssText = media
    ? `@media ${media} { ${processedCssText} }`
    : processedCssText;

  // 创建样式元素
  const createStyleElement = (): HTMLStyleElement => {
    const style = document.createElement("style");
    style.id = styleId;
    style.type = "text/css";
    style.setAttribute(
      "data-css-scope",
      typeof scope === "string" ? scope : "element",
    );
    style.setAttribute("data-css-priority", priority);

    if (media) {
      style.setAttribute("data-media-query", media);
    }

    if (disabled) {
      style.disabled = true;
    }

    return style;
  };

  // 查找现有样式
  const findExistingStyle = (): HTMLStyleElement | null => {
    if (id) {
      return document.getElementById(id) as HTMLStyleElement;
    }

    // 检查内容相同的样式
    const allStyles = document.querySelectorAll("style");
    for (const style of allStyles) {
      if (style.textContent && style.textContent.includes(cleanedCssText)) {
        return style as HTMLStyleElement;
      }
    }

    return null;
  };

  // 处理样式插入
  const insertStyle = (): HTMLStyleElement => {
    const existingStyle = findExistingStyle();

    if (existingStyle) {
      if (replace) {
        // 替换现有样式
        existingStyle.textContent = finalCssText;
        existingStyle.disabled = disabled;
        return existingStyle;
      } else {
        // 不替换，直接返回现有样式
        return existingStyle;
      }
    }

    const style = createStyleElement();

    try {
      // 尝试设置 textContent
      style.textContent = finalCssText;

      // 添加到文档
      if (scope === "global") {
        if (document.head) {
          document.head.appendChild(style);
        } else {
          document.documentElement.appendChild(style);
        }
      } else if (scope === "shadow" && document.head) {
        // 为shadow DOM准备的样式
        document.head.appendChild(style);
      } else if (scope instanceof Element) {
        // 添加到特定元素
        scope.appendChild(style);
      } else if (typeof scope === "string" && scope.startsWith("#")) {
        // 添加到指定ID的元素
        const target = document.querySelector(scope);
        if (target) target.appendChild(style);
      } else if (typeof scope === "string") {
        // 添加到选择器匹配的元素
        const target = document.querySelector(scope);
        if (target) target.appendChild(style);
      }

      // 触发回调
      if (onLoad && typeof onLoad === "function") {
        setTimeout(() => onLoad(style), 0);
      }

      return style;
    } catch (error) {
      // 处理错误
      if (onError && typeof onError === "function") {
        onError(error as Error, style);
      } else {
        console.error("Failed to apply CSS rule:", error);
      }
      throw error;
    }
  };

  // 返回样式元素和方法
  const styleElement = insertStyle();

  const instance: CSSRuleInstance = {
    element: styleElement,
    id: styleId,
    enable: (): CSSRuleInstance => {
      styleElement.disabled = false;
      return instance;
    },
    disable: (): CSSRuleInstance => {
      styleElement.disabled = true;
      return instance;
    },
    remove: (): CSSRuleInstance => {
      styleElement.parentNode?.removeChild(styleElement);
      return instance;
    },
    update: (
      newCssText: string,
      updateOptions: Partial<CSSRuleOptions> = {},
    ): CSSRuleInstance => {
      return applyCSSRule(newCssText, {
        ...options,
        id: styleId,
        replace: true,
        ...updateOptions,
      });
    },
    clone: (cloneOptions: Partial<CSSRuleOptions> = {}): CSSRuleInstance => {
      return applyCSSRule(cleanedCssText, {
        ...options,
        ...cloneOptions,
        id: undefined,
      });
    },
  };

  return instance;
}

/**
 * 批量应用CSS规则
 * @param rules CSS规则数组或对象
 * @param options 配置选项
 * @returns CSS规则实例数组
 */
function applyCSSRules(
  rules: string[] | Record<string, string> | CSSRuleObject[],
  options: CSSRuleOptions = {},
): CSSRuleInstance[] {
  const results: CSSRuleInstance[] = [];

  if (Array.isArray(rules)) {
    rules.forEach((rule) => {
      if (typeof rule === "string") {
        results.push(applyCSSRule(rule, options));
      } else if (
        rule &&
        (rule as CSSRuleObject).selector &&
        (rule as CSSRuleObject).declarations
      ) {
        // 对象格式: { selector: '.class', declarations: 'color: red;' }
        const cssRule = rule as CSSRuleObject;
        const cssText = `${cssRule.selector} { ${cssRule.declarations} }`;
        results.push(applyCSSRule(cssText, { ...options, ...cssRule.options }));
      }
    });
  } else if (typeof rules === "object") {
    // 对象格式: { '.class': 'color: red;', '#id': 'display: block;' }
    Object.entries(rules).forEach(([selector, declarations]) => {
      const cssText = `${selector} { ${declarations} }`;
      results.push(applyCSSRule(cssText, options));
    });
  }

  return results;
}

/**
 * 移除CSS规则
 * @param identifier 样式ID或CSS文本片段
 * @returns 是否成功移除
 */
function removeCSSRule(identifier: string | CSSRuleInstance): boolean {
  if (typeof identifier === "string") {
    const element = document.getElementById(identifier);
    if (element && element.tagName === "STYLE") {
      element.parentNode?.removeChild(element);
      return true;
    }

    // 尝试通过内容查找
    const allStyles = document.querySelectorAll("style");
    for (const style of allStyles) {
      if (style.textContent && style.textContent.includes(identifier)) {
        style.parentNode?.removeChild(style);
        return true;
      }
    }
  } else if (identifier && (identifier as CSSRuleInstance).element) {
    (identifier as CSSRuleInstance).element.parentNode?.removeChild(
      (identifier as CSSRuleInstance).element,
    );
    return true;
  }

  return false;
}

/**
 * 检查CSS规则是否存在
 * @param cssTextOrId CSS文本片段或ID
 * @returns 是否存在
 */
function hasCSSRule(cssTextOrId: string): boolean {
  if (typeof cssTextOrId === "string") {
    if (cssTextOrId.startsWith("#")) {
      return !!document.getElementById(cssTextOrId.slice(1));
    }

    const allStyles = document.querySelectorAll("style");
    for (const style of allStyles) {
      if (style.textContent && style.textContent.includes(cssTextOrId)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 获取所有应用的CSS规则
 * @returns CSS规则实例数组
 */
function getAllCSSRules(): CSSRuleInstance[] {
  const styles = document.querySelectorAll("style");
  const instances: CSSRuleInstance[] = [];

  styles.forEach((style) => {
    const id = style.id || `style-${Array.from(styles).indexOf(style)}`;
    const instance: CSSRuleInstance = {
      element: style as HTMLStyleElement,
      id,
      enable: () => {
        style.disabled = false;
        return instance;
      },
      disable: () => {
        style.disabled = true;
        return instance;
      },
      remove: () => {
        style.parentNode?.removeChild(style);
        return instance;
      },
      update: (
        newCssText: string,
        updateOptions: Partial<CSSRuleOptions> = {},
      ) => {
        return applyCSSRule(newCssText, {
          id: style.id,
          replace: true,
          ...updateOptions,
        });
      },
      clone: (cloneOptions: Partial<CSSRuleOptions> = {}) => {
        return applyCSSRule(style.textContent || "", {
          ...cloneOptions,
          id: undefined,
        });
      },
    };
    instances.push(instance);
  });

  return instances;
}

/**
 * 清理所有应用的CSS规则
 * @param filter 过滤器函数
 */
function clearAllCSSRules(
  filter?: (instance: CSSRuleInstance) => boolean,
): void {
  const instances = getAllCSSRules();
  instances.forEach((instance) => {
    if (!filter || filter(instance)) {
      instance.remove();
    }
  });
}

// 导出类型
export type { CSSRuleOptions, CSSRuleObject, CSSRuleInstance };

// 导出函数
export {
  applyCSSRule,
  applyCSSRules,
  removeCSSRule,
  hasCSSRule,
  getAllCSSRules,
  clearAllCSSRules,
};

// 默认导出
export default applyCSSRule;
