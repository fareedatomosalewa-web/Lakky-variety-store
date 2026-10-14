// Pure category helpers — NO "use server" (imported by pages AND popups).
// The hierarchy is derived from the existing "Parent, Child" product labels.
// Matching ignores capital letters and extra spaces: "skincare", "Skincare "
// and "SKINCARE" are one category. Works to any depth.

export function normCat(s: unknown): string {
  return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function prettyCat(s: unknown): string {
  return normCat(s)
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Full label path of a product, e.g. "Kitchen, Cookware" -> ["Kitchen","Cookware"].
export function pathOf(p: any): string[] {
  return String(p?.category || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export type CatNode = { key: string; name: string; children: CatNode[]; count: number };

function ensureNode(list: CatNode[], seg: string): CatNode {
  const key = normCat(seg);
  let n = list.find((x) => x.key === key);
  if (!n) {
    n = { key, name: prettyCat(seg), children: [], count: 0 };
    list.push(n);
  }
  return n;
}

// Nested tree of every category found in the products.
export function buildTree(products: any[]): CatNode[] {
  const roots: CatNode[] = [];
  for (const p of products || []) {
    const path = pathOf(p);
    if (!path.length) continue;
    let list = roots;
    let node: CatNode | null = null;
    for (const seg of path) {
      node = ensureNode(list, seg);
      node.count += 1;
      list = node.children;
    }
  }
  return roots;
}

// Every product under a trail (a category + all its sub-categories).
export function productsUnder(products: any[], trail: string[]): any[] {
  const keys = (trail || []).map(normCat).filter(Boolean);
  if (!keys.length) return products || [];
  return (products || []).filter((p) => {
    const segs = pathOf(p).map(normCat);
    return keys.every((k, i) => segs[i] === k);
  });
}

// Products sharing the same top-level category (for "similar items").
export function similarTo(products: any[], product: any, limit = 4): any[] {
  const top = normCat(pathOf(product)[0] || '');
  if (!top) return [];
  return (products || [])
    .filter((p) => p !== product && normCat(pathOf(p)[0] || '') === top)
    .slice(0, limit);
}
