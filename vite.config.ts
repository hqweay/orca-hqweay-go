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
        : []),
    ],
  };
});
