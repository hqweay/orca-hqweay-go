import { resolve, dirname } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react-swc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import externalGlobals from "rollup-plugin-external-globals";
import livereload from "rollup-plugin-livereload";
import zipPack from "vite-plugin-zip-pack";
import { defineConfig } from "vite";

import orcaObfuscator from "vite-plugin-javascript-obfuscator";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isDev = mode === "development";
  const devDistDir = "/Users/hqweay/Documents/orca/plugins/orca-hwqeay-go/dist";
  return {
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
        "#": resolve(__dirname, "."),
      },
    },
    define: {
      "process.env": {
        NODE_ENV: JSON.stringify(isDev ? "development" : "production"),
      },
    },
    build: {
      emptyOutDir: true, // 强制清空输出目录
      outDir: isDev ? devDistDir : "./build/dist",
      minify: !isDev,
      sourcemap: false, // 禁用源码映射，避免因混淆导致的解析错误并增强安全性
      lib: {
        entry: "src/main.tsx",
        fileName: "index",
        formats: ["es"],
      },
      rollupOptions: {
        external: ["react", "valtio"],
        plugins: !isDev
          ? [
              zipPack({
                inDir: "build",
                outDir: "./",
                outFileName: "package.zip",
                pathPrefix: "orca-hwqeay-go",
              }),
            ]
          : [],
      },
      // 开发模式下启用监听
      watch: isDev
        ? {
            include: "src/**",
            exclude: "node_modules/**",
          }
        : undefined,
    },
    esbuild: {
      minifyWhitespace: true,
      minifySyntax: true,
      minifyIdentifiers: true,
      legalComments: "none",
      drop: ["console", "debugger"], // 丢弃所有 console 和 debugger 语句
    },
    plugins: [
      react(),
      externalGlobals({ react: "React", valtio: "Valtio" }),
      viteStaticCopy({
        targets: [
          {
            src: "icon.png",
            dest: "..",
          },
          {
            src: "README.md",
            dest: "..",
          },
          {
            src: "LICENSE",
            dest: "..",
          },
        ],
      }),
      // 仅在开发模式下启用livereload
      ...(isDev
        ? [
            livereload({
              verbose: true,
              delay: 100,
            }),
          ]
        : [
            orcaObfuscator({
              options: {
                compact: true, // 紧凑模式，移除换行和空格，减小体积并初步降低可读性
                controlFlowFlattening: true, // 控制流打乱，将代码逻辑扁平化，使逻辑流程难以追踪
                controlFlowFlatteningThreshold: 1, // 控制流打乱的概率 (1 = 100%)
                numbersToExpressions: true, // 将数字转换为复杂的算术表达式
                simplify: true, // 简化代码，同时配合其他混淆手段增加理解难度
                stringArray: true, // 将字符串提取到全局数组，防止直接搜索可见文本
                stringArrayEncoding: ["base64"], // 字符串数组编码方式，增加提取难度
                stringArrayThreshold: 1, // 字符串被提取到数组的概率

                // --- 高级保护建议 ---
                deadCodeInjection: true, // 注入死代码块，干扰反编译器分析
                deadCodeInjectionThreshold: 0.4, // 死代码注入概率
                identifierNamesGenerator: "hexadecimal", // 标识符生成器，使用十六进制随机字符串 (如 0xabc)
                renameGlobals: false, // 是否重命名全局变量（插件通常设为 false 以免破坏生命周期函数）
                selfDefending: false, // 自我保护，如果代码被格式化/美化，可能导致运行失败
                splitStrings: true, // 分割字符串，将单个字符串拆分为多个部分
                splitStringsChunkLength: 5, // 减小分割长度，增加碎片化
                unicodeEscapeSequence: true, // 使用 Unicode 转义序列，使代码充满 \u 字符

                // --- 极致保护 (进一步减少空行并提高难度) ---
                transformObjectKeys: true, // 混淆对象键名
                stringArrayWrappersCount: 2, // 增加字符串数组包装器层数
                stringArrayWrappersChainedCalls: true, // 链式调用包装器，更难追踪
                stringArrayWrappersType: "variable", // 使用变量形式的包装器
                stringArrayIndexesType: ["hexadecimal-number"], // 数组索引使用十六进制数字

                // --- 禁用调试信息 ---
                disableConsoleOutput: true, // 彻底禁用 console.log/info/error 等输出

                // --- 修复模块解析问题 ---
                reservedStrings: [
                  "jszip", // 保护 jszip 导入
                  "^\\./.*", // 保护所有以 ./ 开头的相对路径导入
                  "^assets/.*", // 保护可能的资产路径
                ],
              },
            }),
          ]),
    ],
  };
});
