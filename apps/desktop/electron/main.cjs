const { app, BrowserWindow, ipcMain, dialog } = require('electron');

function parseJson(text) {
  const i = text.search(/[\[{]/);
  return JSON.parse(i > 0 ? text.slice(i) : text);
}
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

function findArkiveBinary() {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'bin', 'arkive.exe')]
    : [
        path.join(__dirname, '..', 'bin', 'arkive.exe'),
        path.join(__dirname, '..', '..', '..', 'target', 'release', 'arkive.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'arkive-target', 'release', 'arkive.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'arkive-target', 'debug', 'arkive.exe'),
      ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return 'arkive.exe';
}

function runArkive(args) {
  return new Promise((resolve, reject) => {
    const bin = findArkiveBinary();
    const proc = spawn(bin, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `Process exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 850,
    minHeight: 550,
    title: 'Arkive — High-Performance Archive Manager',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    win.loadFile(indexPath);
  } else {
    win.loadURL('http://localhost:5173');
  }

  if (process.env.ARKIVE_SELFTEST) {
    const log = [];
    win.webContents.on('console-message', (_e, level, msg) => log.push(`console[${level}] ${msg}`));
    win.webContents.on('did-fail-load', (_e, code, desc) => log.push(`did-fail-load ${code} ${desc}`));
    win.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        const img = await win.webContents.capturePage();
        fs.writeFileSync(process.env.ARKIVE_SELFTEST, img.toPNG());
        const text = await win.webContents.executeJavaScript('document.body.innerText.length');
        fs.writeFileSync(process.env.ARKIVE_SELFTEST + '.log', log.join('\n') + `\nbodyTextLength=${text}\nbinary=${findArkiveBinary()}\n`);
        app.quit();
      }, 2500);
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('dialog:openArchive', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Select Archive to Open',
    filters: [
      { name: 'Supported Archives', extensions: ['zip', '7z', 'rar', 'tar', 'gz', 'bz2', 'xz', 'zst', 'tgz', 'tbz2', 'txz'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

ipcMain.handle('dialog:openFiles', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Select Files or Folders to Archive',
    properties: ['openFile', 'multiSelections'],
  });
  if (res.canceled) return [];
  return res.filePaths;
});

ipcMain.handle('dialog:selectFolder', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Select Destination Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

ipcMain.handle('dialog:saveArchive', async (_, defaultName) => {
  const res = await dialog.showSaveDialog({
    title: 'Create Archive As',
    defaultPath: defaultName || 'archive.zip',
    filters: [
      { name: 'ZIP Archive', extensions: ['zip'] },
      { name: '7-Zip Archive', extensions: ['7z'] },
      { name: 'TAR Zstandard', extensions: ['tar.zst'] },
      { name: 'TAR Gzip', extensions: ['tar.gz'] },
      { name: 'TAR XZ', extensions: ['tar.xz'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (res.canceled) return null;
  return res.filePath;
});

ipcMain.handle('arkive:list', async (_, { path: archivePath, password }) => {
  const args = ['l', archivePath, '--json'];
  if (password) args.push('-p', password);
  const { stdout } = await runArkive(args);
  return parseJson(stdout);
});

ipcMain.handle('arkive:info', async (_, { path: archivePath, password }) => {
  const args = ['i', archivePath, '--json'];
  if (password) args.push('-p', password);
  const { stdout } = await runArkive(args);
  return parseJson(stdout);
});

ipcMain.handle('arkive:create', async (_, { archive, inputs, format, level, password, threads, method }) => {
  const args = ['a', archive, ...inputs];
  if (format) args.push('-f', format);
  if (level !== undefined) args.push('-l', level.toString());
  if (password) args.push('-p', password);
  if (threads) args.push('-t', threads.toString());
  if (method) args.push('-m', method);
  const { stdout } = await runArkive(args);
  return stdout;
});

ipcMain.handle('arkive:extract', async (_, { archive, dest, password, force }) => {
  const args = ['x', archive];
  if (dest) args.push('-o', dest);
  if (password) args.push('-p', password);
  if (force) args.push('-f');
  const { stdout } = await runArkive(args);
  return stdout;
});

ipcMain.handle('arkive:test', async (_, { path: archivePath, password }) => {
  const args = ['t', archivePath];
  if (password) args.push('-p', password);
  const { stdout } = await runArkive(args);
  return stdout;
});

ipcMain.handle('arkive:repair', async (_, { archive, output }) => {
  const args = ['repair', archive];
  if (output) args.push('-o', output);
  const { stdout } = await runArkive(args);
  return stdout;
});

ipcMain.handle('arkive:bench', async (_, config) => {
  const args = ['bench', '--json'];
  if (config.dataset) args.push('-d', config.dataset);
  if (config.sizeMb) args.push('-s', config.sizeMb.toString());
  if (config.threads !== undefined) args.push('-t', config.threads.toString());
  if (config.codecs && config.codecs.length > 0) args.push('-c', config.codecs.join(','));
  const { stdout } = await runArkive(args);
  return JSON.parse(stdout);
});
