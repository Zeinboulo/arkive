const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arkive', {
  isDesktop: true,

  // Dialogs
  openArchiveDialog: () => ipcRenderer.invoke('dialog:openArchive'),
  openFilesDialog: () => ipcRenderer.invoke('dialog:openFiles'),
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  saveArchiveDialog: (defaultName) => ipcRenderer.invoke('dialog:saveArchive', defaultName),
  selectFolderDialog: () => ipcRenderer.invoke('dialog:selectFolder'),

  // Local File System Exploration
  readDirectory: (dirPath) => ipcRenderer.invoke('fs:readDirectory', dirPath),
  getQuickPlaces: () => ipcRenderer.invoke('fs:getQuickPlaces'),

  // External / Startup Actions (from Windows Explorer context menu)
  getStartupAction: () => ipcRenderer.invoke('app:getStartupAction'),
  onExternalAction: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('app:externalAction', handler);
    return () => ipcRenderer.removeListener('app:externalAction', handler);
  },

  // Windows Shell Context Menu
  registerContextMenu: () => ipcRenderer.invoke('shell:registerContextMenu'),
  unregisterContextMenu: () => ipcRenderer.invoke('shell:unregisterContextMenu'),
  isContextMenuRegistered: () => ipcRenderer.invoke('shell:isContextMenuRegistered'),

  // Archive Operations
  listArchive: (path, password) => ipcRenderer.invoke('arkive:list', { path, password }),
  getArchiveInfo: (path, password) => ipcRenderer.invoke('arkive:info', { path, password }),
  createArchive: (options) => ipcRenderer.invoke('arkive:create', options),
  extractArchive: (options) => ipcRenderer.invoke('arkive:extract', options),
  testArchive: (path, password) => ipcRenderer.invoke('arkive:test', { path, password }),
  repairArchive: (archive, output) => ipcRenderer.invoke('arkive:repair', { archive, output }),
  readEntry: (path, entry, password, maxBytes) => ipcRenderer.invoke('arkive:cat', { path, entry, password, maxBytes }),
  runBenchmark: (config) => ipcRenderer.invoke('arkive:bench', config),
});
