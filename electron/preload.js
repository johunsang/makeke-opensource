const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  scrapeUrl: (url, options = {}) => ipcRenderer.invoke('scrape-url', url, options),
  chooseDirectory: () => ipcRenderer.invoke('choose-directory'),
  backendStatus: () => ipcRenderer.invoke('backend-status'),
  backendRestart: () => ipcRenderer.invoke('backend-restart'),
  mediaToolsStatus: () => ipcRenderer.invoke('media-tools-status'),
  installMediaTools: () => ipcRenderer.invoke('media-tools-install'),
  getAppVersion: () => ipcRenderer.invoke('app-version'),
  checkAppUpdateNow: (options = {}) => ipcRenderer.invoke('app-update-check', options),
  openExternalUrl: (url, options = {}) => ipcRenderer.invoke('open-external-url', url, options),
  showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),
});
