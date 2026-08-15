/**
 * Ponte segura renderer ↔ main (SQLite e outbox via IPC)
 */
const { contextBridge, ipcRenderer } = require('electron');

const storeId = process.env.FLASHSTORE_STORE_ID || process.env.FLASHSTORE_STORE || null;

const db = {
  ping: () => ipcRenderer.invoke('db:ping'),
  getProducts: (opts) => ipcRenderer.invoke('db:getProducts', opts),
  getStock: (opts) => ipcRenderer.invoke('db:getStock', opts),
  getOutboxStats: () => ipcRenderer.invoke('db:getOutboxStats'),
  seedDemo: () => ipcRenderer.invoke('db:seedDemo'),
  createSale: (payload) => ipcRenderer.invoke('db:createSale', payload),
  importCatalog: (payload) => ipcRenderer.invoke('db:importCatalog', payload),
  getRecentSales: (opts) => ipcRenderer.invoke('db:getRecentSales', opts),
  getPendingOutbox: (opts) => ipcRenderer.invoke('db:getPendingOutbox', opts),
  commitSyncResults: (results) => ipcRenderer.invoke('db:commitSyncResults', results),
  requeueFailedOutbox: () => ipcRenderer.invoke('db:requeueFailedOutbox'),
  // Turnos offline
  openShift: (payload) => ipcRenderer.invoke('db:openShift', payload),
  closeShift: (payload) => ipcRenderer.invoke('db:closeShift', payload),
  getOpenShift: (opts) => ipcRenderer.invoke('db:getOpenShift', opts),
  getShiftSales: (opts) => ipcRenderer.invoke('db:getShiftSales', opts),
  // Imagens
  getProductImageUrls: () => ipcRenderer.invoke('db:getProductImageUrls'),
};

contextBridge.exposeInMainWorld('flashstore', {
  platform: process.platform,
  isElectron: true,
  storeId,
  version: '0.4.0-electron-sync',
  db,
});
