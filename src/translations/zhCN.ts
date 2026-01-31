// @ts-ignore
const modules = import.meta.glob("./parts/*.ts", { eager: true });

let zhCN: { [key: string]: string } = {};

for (const path in modules) {
  const module = modules[path] as any;
  if (module.default) {
    zhCN = { ...zhCN, ...module.default };
  }
}

export default zhCN;
