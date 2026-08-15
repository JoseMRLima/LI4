import { api } from '@/api/apiClient';
import { checkOnline, isElectronApp } from '@/lib/connectivity';

/**
 * Regista venda online (API) ou offline (BD local + outbox) no Electron.
 */
export async function registerSale(saleData) {
  const online = await checkOnline();

  if (online) {
    return api.entities.Sale.create(saleData);
  }

  if (!isElectronApp() || !window.flashstore?.db?.createSale) {
    throw new Error('Sem ligação ao servidor. Abra a app Electron para vender offline.');
  }

  return window.flashstore.db.createSale(saleData);
}
