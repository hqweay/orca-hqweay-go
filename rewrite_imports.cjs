const fs = require('fs');
const path = require('path');

const mappings = {
  ensureInbox: '@/libs/InboxUtils',
  getRepr: '@/libs/BlockFormatter',
  getBlocks: '@/libs/BlockCache',
  isValidId: '@/libs/BlockCache',
  ensureBlockInState: '@/libs/BlockCache',
  getBlockTitle: '@/libs/BlockFormatter',
  getBlockIcon: '@/libs/BlockFormatter',
  getBlockColor: '@/libs/BlockFormatter',
  renderLeftHeadbarButton: '@/libs/HeadbarUtils',
  removeLeftHeadbarButton: '@/libs/HeadbarUtils',
  findPanelById: '@/libs/navUtils',
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;
  
  // Find import statements from utils
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"](.*?\/utils(?:\.ts)?)['"]/g;
  
  let match;
  let newImportsMap = new Map(); // modulePath -> Set of identifiers
  let importsToRemove = [];

  while ((match = importRegex.exec(content)) !== null) {
    importsToRemove.push(match[0]);
    const identifiers = match[1].split(',').map(s => s.trim()).filter(Boolean);
    
    for (const ident of identifiers) {
      // Handle aliased imports like `getBlockTitle as getBlockTitleUtil`
      let baseIdent = ident.split(' as ')[0].trim();
      let modulePath = mappings[baseIdent];
      if (modulePath) {
        if (!newImportsMap.has(modulePath)) newImportsMap.set(modulePath, new Set());
        newImportsMap.get(modulePath).add(ident);
      } else {
        // If it's not in mapping (maybe we missed one?), leave it or warn
        console.warn(`Unmapped identifier ${baseIdent} in ${filePath}`);
        if (!newImportsMap.has('@/libs/utils')) newImportsMap.set('@/libs/utils', new Set());
        newImportsMap.get('@/libs/utils').add(ident);
      }
    }
  }

  if (importsToRemove.length === 0) return;

  // Remove old imports
  for (const oldImport of importsToRemove) {
    content = content.replace(oldImport, '');
  }

  // Generate new import statements
  let newImportsText = '';
  for (const [modulePath, identifiers] of newImportsMap.entries()) {
    newImportsText += `import { ${Array.from(identifiers).join(', ')} } from "${modulePath}";\n`;
  }

  // Add new imports after the last import or at top
  const lastImportIndex = content.lastIndexOf('import ');
  if (lastImportIndex !== -1) {
    const nextLineIndex = content.indexOf('\n', lastImportIndex);
    content = content.slice(0, nextLineIndex + 1) + newImportsText + content.slice(nextLineIndex + 1);
  } else {
    content = newImportsText + content;
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      if (fullPath !== path.join(__dirname, 'src/libs/utils.ts')) {
        processFile(fullPath);
      }
    }
  }
}

walk(path.join(__dirname, 'src'));
