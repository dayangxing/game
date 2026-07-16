const { contextBridge } = require('electron');

const api = new URLSearchParams(window.location.search).get('api') ?? '';

contextBridge.exposeInMainWorld('WENDAO_DESKTOP_APP', true);
contextBridge.exposeInMainWorld('WENDAO_API_BASE_URL', api);
