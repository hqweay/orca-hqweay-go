import { resolve } from "path";
import react from "@vitejs/plugin-react-swc";
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
      outDir: isDev ? devDistDir : "./dist",
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
                inDir: "./dist",
                outDir: "./",
                outFileName: "package.zip",
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
