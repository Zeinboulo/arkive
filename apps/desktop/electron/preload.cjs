const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arkive', {
  isDesktop: true,
  openArchiveDialog: () => ipcRenderer.invoke('dialog:openArchive'),
  openFilesDialog: () => ipcRenderer.invoke('dialog:openFiles'),
  saveArchiveDialog: (defaultName) => ipcRenderer.invoke('dialog:saveArchive', defaultName),
  selectFolderDialog: () => ipcRenderer.invoke('dialog:selectFolder'),
  
  listArchive: (path, password) => ipcRenderer.invoke('arkive:list', { path, password }),
  getArchiveInfo: (path, password) => ipcRenderer.invoke('arkive:info', { path, password }),
  createArchive: (options) => ipcRenderer.invoke('arkive:create', options),
  extractArchive: (options) => ipcRenderer.invoke('arkive:extract', options),
  testArchive: (path, password) => ipcRenderer.invoke('arkive:test', { path, password }),
  repairArchive: (archive, output) => ipcRenderer.invoke('arkive:repair', { archive, output }),
  runBenchmark: (config) => ipcRenderer.invoke('arkive:bench', config),
});
