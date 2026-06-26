// @ts-ignore
const modules = import.meta.glob("./parts/*.ts", { eager: true });

let zhCN: { [key: string]: string } = {};

for (const path in modules) {
  const module = modules[path] as any;
  if (!module.default) continue;

  const filename = path.replace("./parts/", "").replace(".ts", "");

  if (filename === "common") {
    // common.ts keys are mixed into the global scope without prefix
    zhCN = { ...zhCN, ...module.default };
  } else {
    // For plugin translation files, ensure keys are prefixed with filename.
    for (const [key, value] of Object.entries(module.default)) {
      if (key.startsWith(`${filename}.`)) {
        zhCN[key] = value as string;
      } else {
        zhCN[`${filename}.${key}`] = value as string;
        // Keep the original unprefixed key for backward compatibility
        // until all plugins are migrated to use this.t()
        zhCN[key] = value as string;
      }
    }
  }
}

export default zhCN;
