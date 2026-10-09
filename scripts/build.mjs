import { TERMS_DOCUMENT, TERMS_VERSION } from '../netlify/functions/legal-policy.mjs';
import { cp, copyFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = new URL('../', import.meta.url);
const publishDirectory = new URL('dist/', projectRoot);
if (await readFile(new URL('legal/conditions-' + TERMS_VERSION + '.txt', projectRoot), 'utf8') !== TERMS_DOCUMENT) throw new Error('Le document public diffère de la preuve contractuelle');
await mkdir(publishDirectory, { recursive: true });
await copyFile(new URL('index.html', projectRoot), new URL('index.html', publishDirectory));
await copyFile(new URL('auth.js', projectRoot), new URL('auth.js', publishDirectory));
await copyFile(new URL('admin.js', projectRoot), new URL('admin.js', publishDirectory));
await copyFile(new URL('homepage-demo.js', projectRoot), new URL('homepage-demo.js', publishDirectory));
console.log(`Interface prête : ${fileURLToPath(publishDirectory)}`);


for (const file of await readdir(new URL('legal/', projectRoot))) {
  await copyFile(new URL('legal/' + file, projectRoot), new URL(file, publishDirectory));
}

// Include public images referenced by social sharing metadata.
await cp(new URL('assets/', projectRoot), new URL('assets/', publishDirectory), { recursive: true });
