import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const nav = "<nav class=\"postibou-social\" aria-label=\"Postibou sur les réseaux sociaux\"><a href=\"https://www.instagram.com/postibou/\" target=\"_blank\" rel=\"me noopener noreferrer\"><svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"5\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/><circle cx=\"17.5\" cy=\"6.5\" r=\".8\" fill=\"currentColor\" stroke=\"none\"/></svg><span>Instagram</span><span class=\"social-sr\"> (nouvel onglet)</span></a><a href=\"https://www.facebook.com/profile.php?id=61596182746093\" target=\"_blank\" rel=\"me noopener noreferrer\"><svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M14 21v-8h3l.5-4H14V7c0-1 .3-2 2-2h2V1.5A24 24 0 0 0 15 1c-3 0-5 2-5 5v3H7v4h3v8\"/></svg><span>Facebook</span><span class=\"social-sr\"> (nouvel onglet)</span></a></nav>";
const css = ".postibou-social{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center;margin-top:18px;font-family:inherit;font-size:14px;font-weight:600;line-height:1.5;flex-basis:100%;color:#5328c9}.postibou-social a{display:inline-flex;align-items:center;gap:8px;min-height:44px;text-decoration:none}.postibou-social a:hover{text-decoration:underline}.postibou-social a:focus-visible{outline:3px solid #6135e8;outline-offset:4px}.postibou-social svg{flex:none}.social-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}";
export async function addEditorialSocialLinks(root) {
 for (const entry of await readdir(root, {withFileTypes:true})) {
  const path = join(root, entry.name);
  if (entry.isDirectory()) { await addEditorialSocialLinks(path); continue; }
  if (!entry.name.endsWith('.html')) continue;
  let html = await readFile(path, 'utf8');
  if (!html.includes('</footer>') || html.includes('class="postibou-social"')) continue;
  html = html.replace('</head>', `<style>${css}</style></head>`).replace('</footer>', `${nav}</footer>`);
  await writeFile(path, html);
 }
}
