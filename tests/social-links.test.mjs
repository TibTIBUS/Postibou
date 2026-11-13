import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addEditorialSocialLinks } from '../scripts/social-links.mjs';
const urls = ['https://www.instagram.com/postibou/', 'https://www.facebook.com/profile.php?id=61596182746093'];
test('Homepage links are accessible and sameAs belongs to Postibou', async () => {
 const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
 for (const url of urls) assert.ok(html.includes(url));
 const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
 const app = schemas.find(s => s['@type'] === 'SoftwareApplication');
 assert.deepEqual(app.sameAs, urls);
 assert.equal(app.publisher.sameAs, undefined);
 assert.match(html, /aria-label="Postibou sur les réseaux sociaux"/);
 assert.match(html, /aria-hidden="true"/);
});
test('Editorial links work recursively and stay idempotent', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'pb-social-'));
 try {
  await mkdir(join(dir, 'article'));
  const p = join(dir, 'article/index.html');
  await writeFile(p, '<html><head></head><body><footer>Test</footer></body></html>');
  await addEditorialSocialLinks(dir); await addEditorialSocialLinks(dir);
  const html = await readFile(p, 'utf8');
  assert.equal((html.match(/class="postibou-social"/g) || []).length, 1);
  for (const url of urls) assert.ok(html.includes(url));
 } finally { await rm(dir, {recursive:true,force:true}); }
});
