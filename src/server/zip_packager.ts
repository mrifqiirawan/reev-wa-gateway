import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

export async function createProjectZip(): Promise<Buffer> {
  const zip = new JSZip();
  const rootDir = process.cwd();

  const ignoreList = new Set([
    'node_modules',
    '.git',
    'dist',
    '.aistudio',
    'sessions',
    'bun.lock',
    '.env',
    'reev-wa-gateway-production.zip',
  ]);

  function addDirectoryToZip(currentDir: string, zipFolder: JSZip) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (ignoreList.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        const subFolder = zipFolder.folder(entry.name);
        if (subFolder) {
          addDirectoryToZip(fullPath, subFolder);
        }
      } else if (entry.isFile()) {
        try {
          const content = fs.readFileSync(fullPath);
          zipFolder.file(entry.name, content);
        } catch (readErr) {
          console.warn(`Could not read file ${fullPath} for zip:`, readErr);
        }
      }
    }
  }

  addDirectoryToZip(rootDir, zip);

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  return buffer;
}
