import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.glowinthedirt.com',
  trailingSlash: 'never',
  build: { format: 'file' },
});
