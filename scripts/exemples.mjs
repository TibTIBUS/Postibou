import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { METIERS } from './exemples-data.mjs';

const ORIGIN = 'https://postibou.com';
const LASTMOD = '2026-10-09';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const paragraphs = (text) => text.split('\n\n').map((block) => `<p>${esc(block).replace(/\n/g, '<br>')}</p>`).join('');
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const noFinalDot = (s) => s.replace(/\.$/, '');

const head = ({ title, description, path, jsonld }) => `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${ORIGIN}${path}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:site_name" content="Postibou">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${ORIGIN}${path}">
  <meta property="og:image" content="${ORIGIN}/assets/postibou-partage-2026.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#231749">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/postibou-icon-32.png">
  <link rel="apple-touch-icon" href="/assets/postibou-apple-touch-icon.png">
  <link rel="manifest" href="/assets/postibou.webmanifest">
  <link rel="stylesheet" href="/tutoriels.css">
  <link rel="stylesheet" href="/exemples.css">
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
  <a class="skip" href="#contenu">Aller au contenu</a>
  <header><div class="wrap nav">
    <a class="logo" href="/#accueil" aria-label="Postibou, accueil"><img src="/assets/postibou-icon-192.png" width="42" height="42" alt="">postibou<span>.</span></a>
    <nav aria-label="Navigation principale"><a href="/#outil">L’outil</a><a href="/exemples/"${path.startsWith('/exemples') ? ' aria-current="page"' : ''}>Exemples</a><a href="/tutoriels">Tutoriels</a><a href="/?section=tarifs#accueil">Le tarif</a></nav>
    <a class="button small" href="/#connexion">Essayer 7 jours</a>
  </div></header>
  <main id="contenu" class="wrap">
`;

const cta = (text) => `    <section class="cta" aria-labelledby="cta-title"><div><span class="eyebrow">À VOUS DE BRILLER</span><h2 id="cta-title">Votre texte.<br>Deux publications.</h2><p>${esc(text)}</p></div><div><a class="button lime" href="/#connexion">Commencer mes 7 jours gratuits</a><p class="fine">10 adaptations · Sans carte bancaire · Pour les professionnels</p></div></section>
  </main>
  <footer class="wrap"><a class="logo" href="/#accueil">postibou<span>.</span></a><div><a href="/exemples/">Exemples</a><a href="/tutoriels">Tutoriels</a><a href="/conditions">Conditions</a><a href="/confidentialite">Confidentialité</a><a href="/#accueil">Retour à l’accueil</a></div></footer>
</body>
</html>
`;

function metierPage(m) {
  const path = `/exemples/${m.slug}`;
  const title = `Exemples de posts Facebook et Instagram pour ${m.pour} — Postibou`;
  const description = `3 exemples de publications Facebook et Instagram pour ${m.pour} (${lowerFirst(noFinalDot(m.resume))}). Essayez Postibou 7 jours gratuits.`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': `${ORIGIN}${path}#page`, url: `${ORIGIN}${path}`, name: title, description, inLanguage: 'fr-FR',
        isPartOf: { '@type': 'WebSite', name: 'Postibou', url: `${ORIGIN}/` }, dateModified: LASTMOD
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: 'Exemples', item: `${ORIGIN}/exemples/` },
          { '@type': 'ListItem', position: 3, name: m.nom, item: `${ORIGIN}${path}` }
        ]
      }
    ]
  };
  const others = METIERS.filter((o) => o.slug !== m.slug)
    .map((o) => `<li><a href="/exemples/${o.slug}">${esc(o.nom)}</a></li>`).join('');
  const examples = m.exemples.map((e, i) => `      <article class="example">
        <span class="label">Exemple ${i + 1}</span>
        <h3>${esc(e.situation)}</h3>
        <div class="source"><p class="label">Votre texte de départ</p><p>${esc(e.source)}</p></div>
        <div class="posts">
          <section class="post" aria-label="Publication Facebook"><h4><span class="network" aria-hidden="true">f</span>Facebook</h4>${paragraphs(e.facebook)}</section>
          <section class="post" aria-label="Publication Instagram"><h4><span class="network" aria-hidden="true">◎</span>Instagram</h4>${paragraphs(e.instagram)}</section>
        </div>
      </article>`).join('\n');
  const tips = m.conseils.map((c) => `<li>${esc(c)}</li>`).join('');
  return head({ title, description, path, jsonld }) + `    <nav class="crumbs" aria-label="Fil d’Ariane"><a href="/">Accueil</a> › <a href="/exemples/">Exemples</a> › ${esc(m.nom)}</nav>
    <section class="page-intro">
      <span class="eyebrow">EXEMPLES · ${esc(m.nom.toUpperCase())}</span>
      <h1>Exemples de publications Facebook et Instagram <span>pour ${esc(m.pour)}</span></h1>
      <p>${esc(m.intro)}</p>
      <a class="button" href="/#connexion">Essayer Postibou gratuitement <span aria-hidden="true">↗</span></a>
      <p class="fine">7 jours · 10 adaptations · Sans carte bancaire</p>
    </section>
    <section aria-labelledby="exemples-title">
      <div class="section-heading"><h2 id="exemples-title">Trois textes de départ, trois paires de publications</h2><p>Vous écrivez comme vous parlez. Postibou prépare la version Facebook et la version Instagram.</p></div>
${examples}
      <p class="note">Ces exemples illustrent le type de résultat obtenu avec Postibou. Le texte produit varie selon votre texte de départ : relisez-le toujours avant de publier.</p>
    </section>
    <section class="tips" aria-labelledby="conseils-title">
      <div class="section-heading"><h2 id="conseils-title">3 conseils pour les publications d’${esc(m.pour)}</h2></div>
      <ul>${tips}</ul>
    </section>
    <section class="others" aria-labelledby="autres-title">
      <div class="section-heading"><h2 id="autres-title">Exemples pour d’autres métiers</h2></div>
      <ul>${others}</ul>
    </section>
` + cta('Vous relisez, vous copiez et vous publiez vous-même. Votre photo s’ajoute directement sur Facebook ou Instagram.');
}

function hubPage() {
  const path = '/exemples/';
  const title = 'Exemples de posts Facebook et Instagram pour artisans et commerçants — Postibou';
  const description = 'Des exemples de publications Facebook et Instagram pour plombier, électricien, boulangerie, fleuriste, restaurant, salon de coiffure… Trouvez celui de votre métier.';
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', '@id': `${ORIGIN}${path}#page`, url: `${ORIGIN}${path}`, name: title, description, inLanguage: 'fr-FR',
        isPartOf: { '@type': 'WebSite', name: 'Postibou', url: `${ORIGIN}/` }, dateModified: LASTMOD,
        mainEntity: { '@type': 'ItemList', itemListElement: METIERS.map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: `${ORIGIN}/exemples/${m.slug}`, name: `Exemples de posts pour ${m.pour}` })) }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: 'Exemples', item: `${ORIGIN}${path}` }
        ]
      }
    ]
  };
  const cards = METIERS.map((m) => `<a class="job" href="/exemples/${m.slug}"><h2>${esc(m.nom)}</h2><p>${esc(m.resume)}</p><span>Voir les exemples →</span></a>`).join('\n        ');
  return head({ title, description, path, jsonld }) + `    <nav class="crumbs" aria-label="Fil d’Ariane"><a href="/">Accueil</a> › Exemples</nav>
    <section class="page-intro">
      <span class="eyebrow">EXEMPLES DE PUBLICATIONS</span>
      <h1>Quoi publier sur Facebook et Instagram ? <span>Des exemples pour votre métier.</span></h1>
      <p>Pour chaque métier, trois situations de la vie d’une entreprise : un chantier ou une réalisation, un conseil, une information pratique. Chaque exemple montre le texte de départ, puis les deux publications que Postibou prépare.</p>
      <a class="button" href="/#connexion">Essayer Postibou gratuitement <span aria-hidden="true">↗</span></a>
      <p class="fine">7 jours · 10 adaptations · Sans carte bancaire</p>
    </section>
    <section aria-labelledby="metiers-title">
      <div class="section-heading"><h2 id="metiers-title">Choisissez votre métier</h2><p>Votre métier n’est pas dans la liste ? Le principe est le même : collez votre texte, Postibou s’occupe du reste.</p></div>
      <div class="jobs">
        ${cards}
      </div>
    </section>
` + cta('Quelques phrases suffisent. Vous gardez la main : relisez, copiez et publiez vous-même.');
}

export async function buildExemples({ publishDirectory }) {
  const dir = new URL('exemples/', publishDirectory);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL('index.html', dir), hubPage());
  for (const m of METIERS) await writeFile(new URL(`${m.slug}.html`, dir), metierPage(m));

  // Ajoute les pages d'exemples au plan du site.
  const sitemapUrl = new URL('sitemap.xml', publishDirectory);
  const xml = await readFile(sitemapUrl, 'utf8');
  const urls = [`${ORIGIN}/exemples/`, ...METIERS.map((m) => `${ORIGIN}/exemples/${m.slug}`)]
    .map((loc) => `  <url><loc>${loc}</loc><lastmod>${LASTMOD}</lastmod></url>`).join('\n');
  await writeFile(sitemapUrl, xml.replace('</urlset>', `${urls}\n</urlset>`));
  return METIERS.length + 1;
}
