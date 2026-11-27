import srcsets from '../data/image-srcsets.json';

// Responsive sizes Webflow generated for each image (kept so pages load as fast as before).
// New images simply get no srcset unless you add one here.
export function srcsetFor(src: string): string | undefined {
  return (srcsets as Record<string, string>)[src];
}
