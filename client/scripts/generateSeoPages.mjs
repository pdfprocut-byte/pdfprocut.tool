import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toolCatalog } from '../../shared/toolCatalog.mjs';
import { homeSeo, pageSeo } from '../../shared/pageSeo.mjs';
import { toolGuides } from '../../shared/toolGuides.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(scriptDir, '..');
const distDir = path.join(clientDir, 'dist');
const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const publicPages = Object.entries(pageSeo).map(([route, metadata]) => ({ route, metadata }));
const toolPages = toolCatalog.map((tool) => ({
  route: `/tools/${tool.slug}`,
  metadata: { title: `${tool.name} Online | PDF Pro Cut`, description: tool.description },
  tool
}));
const pages = [{ route: '/', metadata: homeSeo }, ...publicPages, ...toolPages];
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...pages.map(({ route }) => `  <url><loc>https://pdfprocut.com${escapeHtml(route)}</loc></url>`),
  '</urlset>',
  ''
].join('\n');

function setTag(html, expression, replacement) {
  return expression.test(html) ? html.replace(expression, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`);
}

function makePageHtml(template, { route, metadata, tool }) {
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const canonical = `https://pdfprocut.com${route}`;
  let html = template.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
  html = setTag(html, /<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${description}" />`);
  html = setTag(html, /<meta\s+name="robots"[^>]*>/i, '<meta name="robots" content="index,follow" />');
  html = setTag(html, /<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${title}" />`);
  html = setTag(html, /<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${description}" />`);
  html = setTag(html, /<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${escapeHtml(canonical)}" />`);
  html = setTag(html, /<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`);

  let content;
  if (route === '/tools') {
    const links = toolCatalog.map(({ slug, name }) => `<li><a href="/tools/${escapeHtml(slug)}">${escapeHtml(name)}</a></li>`).join('');
    content = `<main class="seo-route-fallback"><h1>Public Service, PDF and Social Media Tools</h1><p>${description}</p><ul>${links}</ul></main>`;
  } else if (tool) {
    const breadcrumbItems = [
      { name: 'Home', item: 'https://pdfprocut.com/' },
      { name: 'Tools', item: 'https://pdfprocut.com/tools' },
      { name: tool.name, item: canonical }
    ];
    const breadcrumbSchema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumbItems.map(({ name, item }, index) => ({ '@type': 'ListItem', position: index + 1, name, item })) };
    const faqs = toolGuides[tool.slug]?.faqs || (tool.gov && tool.category !== 'Social Media' ? [
      { question: `Does ${tool.name} guarantee that my file meets the current application rules?`, answer: 'No. Requirements vary by agency, post, route, and recruitment cycle. Check the current official notice and the downloaded file before submitting.' },
      { question: `Does ${tool.name} upload my source image?`, answer: tool.endpoint === 'government-image' ? 'No. Image processing runs in your browser; the source image is not uploaded for this tool.' : 'Document compression sends the selected file to the PDF Pro Cut server for processing. Review the Privacy Policy before using it with sensitive documents.' }
    ] : []);
    const faqSchema = faqs.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(({ question, answer }) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) } : null;
    const jsonLd = [breadcrumbSchema, ...(faqSchema ? [faqSchema] : [])].map((schema) => `<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<', '\\u003c')}</script>`).join('');
    content = `<nav class="tool-breadcrumb container" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/tools">Tools</a></li><li aria-current="page">${escapeHtml(tool.name)}</li></ol></nav>${jsonLd}<main class="seo-route-fallback"><h1>${escapeHtml(tool.name)} Online</h1><p>${escapeHtml(tool.description)}</p><h2>Check the current application requirements</h2><p>Use the dimensions, file type, background, and maximum size stated in the latest official notice, then review the processed file before submitting it.</p><p>Prepare a file in this browser and download the result from PDF Pro Cut.</p><a href="/tools">Browse all PDF Pro Cut tools</a></main>`;
  } else {
    const heading = metadata.title.split('|')[0].trim();
    content = `<main class="seo-route-fallback"><h1>${escapeHtml(heading)}</h1><p>${description}</p><a href="/tools">Browse all tools</a></main>`;
  }
  html = html.replace('<div id="root"></div>', `<div id="root">${content}</div>`);
  return html;
}

const template = await readFile(path.join(distDir, 'index.html'), 'utf8');
for (const page of pages) {
  const relativeDirectory = page.route === '/' ? '' : page.route.slice(1).split('/').join(path.sep);
  const outputDirectory = path.join(distDir, relativeDirectory);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, 'index.html'), makePageHtml(template, page));
}

await writeFile(path.join(clientDir, 'public', 'sitemap.xml'), sitemap);
await writeFile(path.join(distDir, 'sitemap.xml'), sitemap);
console.log(`Generated ${pages.length} route-specific HTML pages and a sitemap with ${pages.length} public URLs.`);
