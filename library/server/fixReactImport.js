import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function scanDirectory(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await scanDirectory(fullPath);
    } else if (entry.isFile() && path.extname(entry.name) === '.jsx') {
      await processFile(fullPath);
    }
  }
}

async function processFile(filePath) {
  let content = await fs.readFile(filePath, 'utf8');
  
  // Check if the file already contains an import for React
  const reactImportRegex = /import\s+(?:React|\*\s+as\s+React)(?:\s*,\s*{[^}]*})?\s+from\s+['"]react['"]/;
  if (!reactImportRegex.test(content)) {
    const importStatement = "import React from 'react';\n";
    content = importStatement + content;
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

async function main() {
  const srcDirectory = path.resolve(__dirname, '..', '..', 'src');
  console.log(srcDirectory)
  await scanDirectory(srcDirectory);
}

main().catch(error => {
  console.error('Error processing files:', error);
});
