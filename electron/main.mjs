import { app, BrowserWindow, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { startDesktopBackend } from './backendRuntime.mjs';

const electronDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(electronDir, '..');
const distIndexPath = path.join(projectRoot, 'frontend', 'dist', 'index.html');
const legacyIndexPath = path.join(projectRoot, 'frontend', 'index.html');
const preloadPath = path.join(electronDir, 'preload.cjs');

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';

let desktopBackend = null;
let isQuitting = false;

function resolveFrontendPath() {
  if (fs.existsSync(distIndexPath)) return distIndexPath;
  if (fs.existsSync(legacyIndexPath)) return legacyIndexPath;
  return null;
}

async function createMainWindow() {
  desktopBackend = await startDesktopBackend({
    savePath: path.join(app.getPath('userData'), 'wendao-fusheng-save.json'),
    env: process.env
  });

  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0b1019',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const frontendPath = resolveFrontendPath();
  if (frontendPath) {
    const frontendUrl = pathToFileURL(frontendPath);
    frontendUrl.searchParams.set('desktop', '1');
    frontendUrl.searchParams.set('api', desktopBackend.baseUrl);
    await window.loadURL(frontendUrl.toString());
  } else {
    const devUrl = new URL(VITE_DEV_SERVER_URL);
    devUrl.searchParams.set('desktop', '1');
    devUrl.searchParams.set('api', desktopBackend.baseUrl);
    await window.loadURL(devUrl.toString());
  }

  return window;
}

async function boot() {
  try {
    await createMainWindow();
  } catch (error) {
    await stopDesktopBackend();
    dialog.showErrorBox('问道浮生启动失败', `本地游戏服务未能启动。\n\n${error.message}`);
    app.quit();
  }
}

async function stopDesktopBackend() {
  if (!desktopBackend) return;
  const backend = desktopBackend;
  desktopBackend = null;
  await backend.stop();
}

app.whenReady().then(boot);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) boot();
});

app.on('before-quit', (event) => {
  if (isQuitting || !desktopBackend) return;
  event.preventDefault();
  isQuitting = true;
  stopDesktopBackend().finally(() => app.quit());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
