import { addEditorialSocialLinks } from './social-links.mjs';
import { TERMS_DOCUMENT, TERMS_VERSION } from '../netlify/functions/legal-policy.mjs';
import { cp, copyFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildBlog } from './build-blog.mjs';
import { buildExemples } from './exemples.mjs';

const projectRoot = new URL('../', import.meta.url);
const publishDirectory = new URL('dist/', projectRoot);
if (await readFile(new URL('legal/conditions-' + TERMS_VERSION + '.txt', projectRoot), 'utf8') !== TERMS_DOCUMENT) throw new Error('Le document public diffère de la preuve contractuelle');
await mkdir(publishDirectory, { recursive: true });
await copyFile(new URL('index.html', projectRoot), new URL('index.html', publishDirectory));
await copyFile(new URL('app-views.js', projectRoot), new URL('app-views.js', publishDirectory));
await copyFile(new URL('auth.js', projectRoot), new URL('auth.js', publishDirectory));
await copyFile(new URL('admin.js', projectRoot), new URL('admin.js', publishDirectory));
await copyFile(new URL('homepage-demo.js', projectRoot), new URL('homepage-demo.js', publishDirectory));
for (const file of ['tutoriels.html', 'tutoriels.css', 'tutoriels.js']) {
  await copyFile(new URL(file, projectRoot), new URL(file, publishDirectory));
}
console.log(`Interface prête : ${fileURLToPath(publishDirectory)}`);


for (const file of await readdir(new URL('legal/', projectRoot))) {
  await copyFile(new URL('legal/' + file, projectRoot), new URL(file, publishDirectory));
}

// Robots, sitemap and redirect rules published at the site root.
for (const file of await readdir(new URL('public/', projectRoot))) {
  await cp(new URL('public/' + file, projectRoot), new URL(file, publishDirectory), { recursive: true });
}

// Pages d'exemples de publications par métier (après la copie de public/ : le plan du site doit exister).
await buildExemples({ publishDirectory });

// Include public images referenced by social sharing metadata.
await cp(new URL('assets/', projectRoot), new URL('assets/', publishDirectory), { recursive: true });

await buildBlog(fileURLToPath(new URL("blog/", publishDirectory)));

// Le fichier importé par le navigateur est renommé au chemin public stable.
await copyFile(new URL("assets/2-postibou-kit-media-2026-11-11.zip", projectRoot), new URL("assets/postibou-kit-media-2026-11-11.zip", publishDirectory));
await copyFile(new URL("assets/2-postibou-kit-media-2026-11-11.zip", projectRoot), new URL("assets/postibou-kit-media-2026-10-09.zip", publishDirectory));

// Only editorial pages: never rewrite accepted legal archives.
await addEditorialSocialLinks(fileURLToPath(new URL("blog/", publishDirectory)));
await addEditorialSocialLinks(fileURLToPath(new URL("exemples/", publishDirectory)));
