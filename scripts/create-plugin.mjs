import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: node create-plugin.mjs <plugin-dir-name> [PluginClassName]");
  console.error("Example: node create-plugin.mjs lets-demo DemoPlugin");
  process.exit(1);
}

const pluginDirName = args[0];
if (!pluginDirName.startsWith("lets-")) {
  console.error("Error: Plugin directory name must start with 'lets-' (e.g. lets-demo)");
  process.exit(1);
}

// Generate class name if not provided (e.g. lets-demo -> DemoPlugin)
let pluginClassName = args[1];
if (!pluginClassName) {
  const parts = pluginDirName.split("-").slice(1);
  pluginClassName = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("") + "Plugin";
}

const templateDir = path.join(__dirname, "templates", "lets-plugin");
const targetDir = path.join(__dirname, "..", "src", pluginDirName);

if (fs.existsSync(targetDir)) {
  console.error(`Error: Target directory already exists: ${targetDir}`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });

function copyAndReplace(srcPath, destPath) {
  const stat = fs.statSync(srcPath);
  if (stat.isDirectory()) {
    fs.mkdirSync(destPath, { recursive: true });
    const files = fs.readdirSync(srcPath);
    for (const file of files) {
      copyAndReplace(path.join(srcPath, file), path.join(destPath, file));
    }
  } else {
    let content = fs.readFileSync(srcPath, "utf-8");
    content = content.replace(/__PLUGIN_CLASS_NAME__/g, pluginClassName);
    fs.writeFileSync(destPath, content, "utf-8");
  }
}

copyAndReplace(templateDir, targetDir);

console.log(`\n✅ Plugin created successfully at src/${pluginDirName}!`);
console.log(`\nNext steps:`);
console.log(`1. Refresh the app to auto-load the new plugin.`);
console.log(`2. Edit src/${pluginDirName}/index.tsx to customize commands.`);
console.log(`3. (Optional) Uncomment settings code if you need a settings panel.\n`);
