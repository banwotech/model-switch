const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('switchAPI', {
  readState: () => ipcRenderer.invoke('state:read'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  activateConfig: (client, providerId, state) => ipcRenderer.invoke('config:activate', client, providerId, state),
  showError: (payload) => ipcRenderer.invoke('dialog:showError', payload)
});
