# Glow in the Dirt

The glowinthedirt.com site, moved off Webflow to [Astro](https://astro.build). It builds to plain static files, served for free by Cloudflare Workers.

## Run it locally

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # static site in dist/
```

## Where things live

| What | Where |
| --- | --- |
| Past Works (was the Webflow CMS) | `src/content/work/<slug>.md`, one file per project |
| Space page lists: add-ons, amenities, zones | `src/data/space.yaml` |
| Home, Work and Space pages | `src/pages/index.astro`, `src/pages/work/index.astro`, `src/pages/space.astro` |
| Project page template | `src/pages/work/[slug].astro` |
| Styles (exported from Webflow) | `src/styles/webflow.css` |
| Images, video, fonts | `public/assets/` |
| Animations | `src/data/interactions.json` (exported from Webflow) played by `src/scripts/interactions.ts` |

### Add a project

1. Put the images in `public/assets/`.
2. Copy an existing file in `src/content/work/`, rename it to the URL you want (for example `new-project.md` becomes `/work/new-project`), and edit the fields at the top.
3. Set `order` to where it should sit in the archive on /work (1 is the top). Bump the others if needed.
4. Anything below the second `---` is the long write-up. Markdown or HTML both work.

### Change the space rates or lists

The hourly and daily rates are in `src/pages/space.astro` (search for `$250`). Add-ons, amenities and zones are in `src/data/space.yaml`.

## Deploy (Cloudflare Workers)

The repo is connected to a Cloudflare Worker called `glowinthedirt` through Workers Builds. Settings live in `wrangler.jsonc`.

1. Every push to a pull request builds the site and posts a preview URL on the PR (`npx wrangler preview`).
2. Merging to `main` builds and deploys the live site (`npx wrangler deploy`).
3. To go live on the real domain, open the Worker in the Cloudflare dashboard, go to Settings, then Domains & Routes, and add `glowinthedirt.com` and `www.glowinthedirt.com`. Then turn off the Webflow site plan's auto-renew.

Unknown URLs show `src/pages/404.astro`. Cache headers for images and bundled files are in `public/_headers`.

## Notes on the move

- Pages keep the same URLs as on Webflow, so links and search results keep working.
- Webflow's responsive image sizes were kept (`src/data/image-srcsets.json`). New images you add won't get extra sizes unless you add them there.
- The old Universal Analytics tag was dropped, since Google shut UA down. The GA4 tag (`G-5ZYWQP5B2L`) and the Search Console verification tag are still in place.
