/**
 * Product image generation.
 *
 * Product photos are generated on demand from a text prompt via the public
 * Pollinations image API (no key required). The URL is deterministic per
 * product name — the seed is a hash of the name — so a given product always
 * renders the same picture and the browser/CDN can cache it.
 *
 * The URL is stored on the product (`Product.imageUrl`) when it is added; the
 * browser loads the generated pixels later. Products saved before this feature
 * existed have no `imageUrl`, so ProductCard falls back to `buildProductImageUrl`
 * and still shows a generated image.
 */

const PLACEHOLDER_COLOR = "e5e7eb";

function hashSeed(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 100000;
}

/** Deterministic generated-image URL for a product name. */
export function buildProductImageUrl(name: string): string {
  const product = (name || "product").trim() || "product";
  const prompt = `${product}, product photo, studio lighting, white background, high detail`;
  const seed = hashSeed(product.toLowerCase());
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt,
  )}?width=400&height=400&nologo=true&seed=${seed}`;
}

/** Plain generated placeholder, used only if the image API is unreachable. */
export function placeholderProductImage(name: string): string {
  const label = (name.trim().split(/\s+/)[0] || name.trim() || "?")
    .slice(0, 12)
    .toUpperCase();
  return `https://placehold.co/400x400/${PLACEHOLDER_COLOR}/6b7280?text=${encodeURIComponent(
    label,
  )}`;
}

/**
 * Resolve the image URL for a product that is being created. Kept async so the
 * add-product flow can await it, and so it can later do a reachability check
 * without changing callers.
 */
export async function fetchProductImage(name: string): Promise<string> {
  return buildProductImageUrl(name);
}
