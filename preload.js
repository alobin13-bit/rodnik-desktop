const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rodnikNative', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setServerUrl: (url) => ipcRenderer.invoke('settings:setServerUrl', url),
  setPreferences: (patch) => ipcRenderer.invoke('settings:setPreferences', patch),
  getRefreshToken: () => ipcRenderer.invoke('session:getRefreshToken'),
  getRefreshTokenCandidates: () => ipcRenderer.invoke('session:getRefreshTokenCandidates'),
  setRefreshToken: (token) => ipcRenderer.invoke('session:setRefreshToken', token),
  getCachedUser: () => ipcRenderer.invoke('session:getCachedUser'),
  setCachedUser: (user) => ipcRenderer.invoke('session:setCachedUser', user),
  clearSession: () => ipcRenderer.invoke('session:clear'),
  listScreenSources: (force = false) => ipcRenderer.invoke('screen:listSources', force),
  primeScreenSources: () => ipcRenderer.invoke('screen:primeSources'),
  selectScreenSource: (sourceId) => ipcRenderer.invoke('screen:selectSource', sourceId),
  restartForUpdate: () => ipcRenderer.invoke('update:restart'),
  deferUpdate: () => ipcRenderer.invoke('update:defer'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  onUpdateState: (callback) => ipcRenderer.on('update:state', (_event, data) => callback(data))
});
