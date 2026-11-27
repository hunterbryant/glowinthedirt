// Sitemap for search engines, replacing the one Webflow generated.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://www.glowinthedirt.com');
  const projects = await getCollection('work');
  const paths = ['/', '/work', '/space', ...projects.map((p) => `/work/${p.id}`)];
  const urls = paths.map((path) => `  <url><loc>${new URL(path, base).href}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
