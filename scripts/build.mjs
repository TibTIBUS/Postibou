import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = new URL('../', import.meta.url);
const publishDirectory = new URL('dist/', projectRoot);
await mkdir(publishDirectory, { recursive: true });
await copyFile(new URL('index.html', projectRoot), new URL('index.html', publishDirectory));
console.log(`Interface prête : ${fileURLToPath(publishDirectory)}`);
