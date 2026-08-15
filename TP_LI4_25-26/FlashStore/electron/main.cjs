/**
 * FlashStore — processo principal Electron
 * Fase 1: shell + Vite | Fase 2: SQLite local (main) + IPC
 */
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { initLocalDatabase, getDb, getStoreConfig, closeLocalDatabase } = require('./db/localDb.cjs');
const { registerDbIpc } = require('./ipc/dbHandlers.cjs');

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const STORE_LABEL = process.env.FLASHSTORE_STORE_ID || process.env.FLASHSTORE_STORE || 'Dev';
const LOAD_DIST = process.env.ELECTRON_LOAD_DIST === '1';

/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null;

function resolveLoadTarget() {
  if (process.env.ELECTRON_LOAD_URL) {
    return { mode: 'url', target: process.env.ELECTRON_LOAD_URL };
  }
  if (LOAD_DIST) {
    return {
      mode: 'file',
      target: path.join(__dirname, '..', 'dist', 'index.html'),
    };
  }
  return { mode: 'url', target: DEV_SERVER_URL };
}

function createWindow() {
  const load = resolveLoadTarget();
  const title = `FlashStore — ${STORE_LABEL}`;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    if (url === 'about:blank') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 420,
          height: 700,
          parent: mainWindow,
          modal: false,
          show: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }
    return { action: 'deny' };
  });

  if (load.mode === 'url') {
    mainWindow.loadURL(load.target);
    const openDevTools =
      process.env.ELECTRON_OPEN_DEVTOOLS === '1' ||
      (!app.isPackaged && process.env.ELECTRON_OPEN_DEVTOOLS !== '0');
    if (openDevTools) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(load.target);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await initLocalDatabase(app);
    registerDbIpc(getDb, getStoreConfig);
  } catch (err) {
    console.error('[FlashStore] Falha ao iniciar BD local:', err);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  closeLocalDatabase();
});
