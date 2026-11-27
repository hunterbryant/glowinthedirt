import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Past Works (was the Webflow "Past Works" CMS collection).
// One Markdown file per project in src/content/work/. The file name is the URL slug.
const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    // Shown in the /work archive row when it differs from the page title.
    archiveTitle: z.string().optional(),
    // Position in the /work archive (1 = top).
    order: z.number(),
    client: z.string(),
    projectType: z.string(),
    role: z.string(),
    link: z.string().optional(),
    skills: z.array(z.string()).default([]),
    description: z.string().default(''),
    // Paths under /public, e.g. /assets/my-photo.jpg
    highlightImage: z.string(),
    highlightAlt: z.string().default(''),
    ogImage: z.string().optional(),
    images: z.array(z.object({ src: z.string(), alt: z.string().default('') })).default([]),
  }),
});

export const collections = { work };
