const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
  saveBookmark: (bookmark) => ipcRenderer.invoke('save-bookmark', bookmark),
  removeBookmark: (data) => ipcRenderer.invoke('remove-bookmark', data),
  getHistory: () => ipcRenderer.invoke('get-history'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  getFileContent: (filePath) => ipcRenderer.invoke('get-file-content', filePath),
  removeFromHistory: (filePath) => ipcRenderer.invoke('remove-from-history', filePath),
  saveHistory: (history) => ipcRenderer.invoke('save-history', history),
  enterMiniMode: (data) => ipcRenderer.invoke('enter-mini-mode', data),

  onFileOpened: (callback) => {
    ipcRenderer.on('file-opened', (_event, data) => callback(data))
  },
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (_event, action) => callback(action))
  },
  onBossKeyToggle: (callback) => {
    ipcRenderer.on('boss-key-toggle', () => callback())
  },
  onFishModeToggle: (callback) => {
    ipcRenderer.on('fish-mode-toggle', () => callback())
  },
  onMiniModeToggle: (callback) => {
    ipcRenderer.on('mini-mode-toggle', () => callback())
  },
  onAppClosing: (callback) => {
    ipcRenderer.on('app-closing', () => callback())
  }
})
