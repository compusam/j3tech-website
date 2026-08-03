import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://j3tech.mx',
  trailingSlash: 'always',
  integrations: [mdx(), sitemap()],
});
