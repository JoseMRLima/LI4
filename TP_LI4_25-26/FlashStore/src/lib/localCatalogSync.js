import { api } from '@/api/apiClient';
import { checkOnline, isElectronApp } from '@/lib/connectivity';

const API_ROOT = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/**
 * Descarrega uma imagem do servidor e devolve um data URL base64.
 * Usado para guardar imagens localmente durante o sync (modo offline).
 */
async function fetchImageAsDataUrl(imageUrl) {
  if (!imageUrl || imageUrl.startsWith('data:')) return null;
  try {
    const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${API_ROOT}${imageUrl}`;
    const res = await fetch(fullUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Copia catálogo + stock da loja para a BD local (quando online).
 * As imagens dos produtos são descarregadas e guardadas como base64
 * para ficarem disponíveis offline.
 */
export async function syncLocalCatalog(store) {
  if (!store || !isElectronApp() || !window.flashstore?.db?.importCatalog) {
    return null;
  }
  const online = await checkOnline();
  if (!online) return null;

  const [products, stock, promotions] = await Promise.all([
    api.entities.Product.filter({ is_active: true }),
    api.entities.Stock.filter({ store }),
    api.entities.Promotion.list(),
  ]);

  // Obter URLs já em cache (data:) para não re-descarregar desnecessariamente
  const cachedUrls = {};
  if (window.flashstore.db.getProductImageUrls) {
    try {
      const rows = await window.flashstore.db.getProductImageUrls();
      rows.forEach((r) => { cachedUrls[r.id] = r.image_url; });
    } catch { /* ignora */ }
  }

  // Para cada produto com imagem: usa o cache se já for data URL, senão descarrega
  const productsWithImages = await Promise.all(
    products.map(async (p) => {
      if (!p.image_url) return p;
      const existing = cachedUrls[p.id];
      if (existing && existing.startsWith('data:')) return { ...p, image_url: existing };
      const dataUrl = await fetchImageAsDataUrl(p.image_url);
      return { ...p, image_url: dataUrl || p.image_url };
    })
  );

  const result = await window.flashstore.db.importCatalog({ store, products: productsWithImages, stock, promotions });
  return result;
}

/** Atualiza queries do PDV Electron após import do catálogo. */
export function invalidateLocalCatalogQueries(queryClient, store) {
  if (!store) return;
  queryClient.invalidateQueries({ queryKey: ['localProducts', store] });
  queryClient.invalidateQueries({ queryKey: ['localStock', store] });
}
