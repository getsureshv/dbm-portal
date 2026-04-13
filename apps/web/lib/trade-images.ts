/**
 * Trade category images using Unsplash for high-quality construction/home improvement photos.
 * Each key maps to a slug used in category cards and discovery filters.
 */

const UNSPLASH_IMAGES: Record<string, string> = {
  // Popular
  'general-contractors': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop',
  'home-builders': 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=400&h=300&fit=crop',
  'kitchen-bath-remodelers': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop',
  'architects': 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&h=300&fit=crop',
  'interior-designers': 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=400&h=300&fit=crop',
  'landscape-contractors': 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop',

  // Remodeling
  'siding-exteriors': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop',
  'fireplaces': 'https://images.unsplash.com/photo-1545259741-2ea3ebf61fa3?w=400&h=300&fit=crop',
  'custom-countertops': 'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=400&h=300&fit=crop',
  'specialty-contractors': 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&h=300&fit=crop',
  'garage-doors': 'https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=400&h=300&fit=crop',
  'stone-concrete': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',

  // Renovation
  'cabinets-cabinetry': 'https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=400&h=300&fit=crop',
  'flooring-contractors': 'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=400&h=300&fit=crop',
  'carpenters': 'https://images.unsplash.com/photo-1601058272524-0611e132d3c0?w=400&h=300&fit=crop',
  'painters': 'https://images.unsplash.com/photo-1562259929-b4e1fd3aef09?w=400&h=300&fit=crop',
  'window-contractors': 'https://images.unsplash.com/photo-1604871000636-074fa5117945?w=400&h=300&fit=crop',
  'lighting': 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=400&h=300&fit=crop',

  // Outdoor
  'decks-patios': 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400&h=300&fit=crop',
  'pool-builders': 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=400&h=300&fit=crop',
  'fence-contractors': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
  'landscaping': 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400&h=300&fit=crop',
  'lawn-care': 'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=400&h=300&fit=crop',
  'driveways': 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400&h=300&fit=crop',

  // Services
  'handyman': 'https://images.unsplash.com/photo-1581141849291-1125c7b692b5?w=400&h=300&fit=crop',
  'movers': 'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=400&h=300&fit=crop',
  'roofing': 'https://images.unsplash.com/photo-1632759145351-1d592919f522?w=400&h=300&fit=crop',
  'cleaning': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop',
  'pest-control': 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400&h=300&fit=crop',
  'electricians': 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=400&h=300&fit=crop',
  'plumbers': 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400&h=300&fit=crop',
  'hvac': 'https://images.unsplash.com/photo-1631545806609-e9b2e6787f5f?w=400&h=300&fit=crop',

  // Fallback
  'default': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop',
};

export function getTradeImage(slug: string): string {
  return UNSPLASH_IMAGES[slug] || UNSPLASH_IMAGES['default'];
}

export function getTradeImageLarge(slug: string): string {
  const base = UNSPLASH_IMAGES[slug] || UNSPLASH_IMAGES['default'];
  return base.replace('w=400&h=300', 'w=800&h=500');
}

export default UNSPLASH_IMAGES;
