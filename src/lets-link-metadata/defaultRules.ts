import { Rule } from "./types";

// @ts-ignore
const modules = import.meta.glob("./rules/*.ts", { eager: true });

let allRules: Rule[] = [];

for (const path in modules) {
  const module = modules[path] as any;
  if (module.default) {
    allRules.push(module.default);
  }
}

// Ensure "default-generic" is last, as it matches everything
const genericRuleIndex = allRules.findIndex((r) => r.id === "default-generic");
if (genericRuleIndex > -1) {
  const genericRule = allRules.splice(genericRuleIndex, 1)[0];
  allRules.push(genericRule);
}

export const DEFAULT_RULES: Rule[] = allRules;
