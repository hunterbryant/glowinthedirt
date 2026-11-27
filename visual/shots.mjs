// Screenshots the live Webflow site and the local Astro build side by side.
import { chromium } from 'playwright';
import fs from 'node:fs';

const LIVE = 'https://www.glowinthedirt.com';
const LOCAL = 'http://localhost:4321';
const out = 'shots';
fs.mkdirSync(out, { recursive: true });
const log = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const scenarios = [
  { name: 'home', path: '/', steps: [] },
  { name: 'home-hover-work', path: '/', steps: [['hover', '.work-column'], ['wait', 900]] },
  { name: 'home-sayhi', path: '/', steps: [['click', '.say-hi-button'], ['wait', 1500]] },
  { name: 'work', path: '/work', steps: [['wait', 1500]] },
  { name: 'work-capabilities', path: '/work', steps: [['scroll', 1.3], ['wait', 1500]] },
  { name: 'work-capabilities-2', path: '/work', steps: [['scroll', 2.6], ['wait', 1500]] },
  { name: 'work-archive-open', path: '/work', steps: [['scrollTo', '#archive'], ['wait', 800], ['hover', '.accordion-trigger'], ['wait', 600], ['click', '.accordion-trigger'], ['wait', 1500]] },
  { name: 'work-casestudy', path: '/work', steps: [['scrollTo', '#casestudy'], ['wait', 1500]] },
  { name: 'space', path: '/space', steps: [['wait', 1500]] },
  { name: 'space-highlights', path: '/space', steps: [['scroll', 1.2], ['wait', 1500]] },
  { name: 'space-looks', path: '/space', steps: [['scrollTo', '#looks'], ['mouse', 0.7, 0.5], ['wait', 1500]] },
  { name: 'space-rates', path: '/space', steps: [['scrollTo', '#rates'], ['wait', 1200]] },
  { name: 'project', path: '/work/culver-current', steps: [['wait', 1200]] },
  { name: 'project-lightbox', path: '/work/heartburn', steps: [['click', 'a.blog-lightbox.top'], ['wait', 1200]] },
  { name: 'project-empty', path: '/work/branding-package', steps: [['wait', 1000]] },
];
const viewports = [{ tag: 'desk', width: 1440, height: 900 }, { tag: 'mob', width: 390, height: 844, isMobile: true, hasTouch: true }];

const browser = await chromium.launch({ channel: 'chrome' });
for (const vp of viewports) {
  for (const sc of scenarios) {
    if (vp.tag === 'mob' && sc.steps.some((s) => s[0] === 'hover' || s[0] === 'mouse')) continue;
    for (const [site, base] of [['live', LIVE], ['new', LOCAL]]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on('console', (m) => { if (m.type() === 'error') log.push(`${site} ${vp.tag} ${sc.name} console: ${m.text()}`); });
      page.on('pageerror', (e) => log.push(`${site} ${vp.tag} ${sc.name} pageerror: ${e.message}`));
      try {
        await page.goto(base + sc.path, { waitUntil: 'load', timeout: 60000 });
        await wait(1500);
        for (const [op, a, b] of sc.steps) {
          if (op === 'wait') await wait(a);
          if (op === 'hover') await page.hover(a, { timeout: 5000 });
          if (op === 'click') await page.click(a, { timeout: 5000 });
          if (op === 'scroll') { for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, (vp.height * a) / 10); await wait(60); } }
          if (op === 'scrollTo') await page.evaluate((s) => document.querySelector(s)?.scrollIntoView(), a);
          if (op === 'mouse') await page.mouse.move(vp.width * a, vp.height * b, { steps: 10 });
        }
        await page.screenshot({ path: `${out}/${vp.tag}-${sc.name}-${site}.png` });
      } catch (e) {
        log.push(`${site} ${vp.tag} ${sc.name} FAILED: ${e.message.split('\n')[0]}`);
      }
      await ctx.close();
    }
  }
}
await browser.close();
fs.writeFileSync(`${out}/log.txt`, log.join('\n') + '\n');
console.log(log.join('\n'));
