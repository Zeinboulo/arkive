const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const {
  registerContextMenu,
  unregisterContextMenu,
  isContextMenuRegistered,
} = require('./shell-integration.cjs');

function parseJson(text) {
  const i = text.search(/[\[{]/);
  return JSON.parse(i > 0 ? text.slice(i) : text);
}

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

function parseStartupArgs(argv) {
  if (!argv || argv.length === 0) return null;
  const args = argv.slice(app.isPackaged ? 1 : 2);
  let action = null;
  let targetPath = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--create' && args[i + 1]) {
      action = 'create';
      targetPath = args[i + 1];
      i++;
    } else if (arg === '--extract' && args[i + 1]) {
      action = 'extract';
      targetPath = args[i + 1];
      i++;
    } else if (!arg.startsWith('--') && !arg.startsWith('-') && fs.existsSync(arg)) {
      targetPath = arg;
      try {
        const stat = fs.statSync(arg);
        if (stat.isDirectory()) {
          action = 'browse';
        } else {
          const ext = path.extname(arg).toLowerCase();
          const isArchive = ['.zip', '.7z', '.rar', '.tar', '.gz', '.bz2', '.xz', '.zst', '.tgz'].includes(ext);
          action = isArchive ? 'open' : 'create';
        }
      } catch (_) {
        action = 'create';
      }
    }
  }

  return targetPath ? { action: action || 'create', path: targetPath.replace(/\\/g, '/') } : null;
}

let mainWindow = null;
let pendingStartupAction = parseStartupArgs(process.argv);

function sendActionToWindow(act) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:externalAction', act);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 740,
    minWidth: 850,
    minHeight: 550,
    title: 'Arkive — High-Performance Archive Manager',
    backgroundColor: '#0f172a',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    if (pendingStartupAction) {
      setTimeout(() => {
        sendActionToWindow(pendingStartupAction);
        pendingStartupAction = null;
      }, 300);
    }
  });

  // Fallback to force show if ready-to-show event is missed
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 1200);

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load UI: ${errorDescription} (${errorCode}) at ${validatedURL}`);
    dialog.showErrorBox(
      'Arkive Failed to Load',
      `Failed to load the interface (${errorDescription}, code ${errorCode}).\nURL: ${validatedURL}`
    );
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingStartupAction) {
      sendActionToWindow(pendingStartupAction);
      pendingStartupAction = null;
    }
  });

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (app.isPackaged || fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Failed to load local HTML:', err);
      dialog.showErrorBox('Arkive Error', `Could not load application bundle:\n${err.message}`);
    });
  } else {
    mainWindow.loadURL('http://localhost:5173').catch((err) => {
      console.error('Failed to load dev server:', err);
      mainWindow.loadFile(indexPath).catch(() => {});
    });
  }

  if (process.env.ARKIVE_SELFTEST) {
    const log = [];
    mainWindow.webContents.on('console-message', (_e, level, msg) => log.push(`console[${level}] ${msg}`));
    mainWindow.webContents.on('did-fail-load', (_e, code, desc) => log.push(`did-fail-load ${code} ${desc}`));
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        const img = await mainWindow.webContents.capturePage();
        fs.writeFileSync(process.env.ARKIVE_SELFTEST, img.toPNG());
        const text = await mainWindow.webContents.executeJavaScript('document.body.innerText.length');
        fs.writeFileSync(process.env.ARKIVE_SELFTEST + '.log', log.join('\n') + `\nbodyTextLength=${text}\nbinary=${findArkiveBinary()}\n`);
        app.quit();
      }, 2500);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();

      const action = parseStartupArgs(commandLine);
      if (action) {
        sendActionToWindow(action);
      }
    }
  });

  app.whenReady().then(() => {
    // Auto-register context menu on startup
    try {
      const currentExe = app.isPackaged
        ? process.execPath
        : path.resolve(__dirname, '../release/win-unpacked/Arkive.exe');
      if (fs.existsSync(currentExe)) {
        registerContextMenu(currentExe);
      }
    } catch (err) {
      console.error('Context menu auto-registration:', err);
    }

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  dialog.showErrorBox('Arkive Unexpected Error', `${err.message}\n\n${err.stack || ''}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers - Local Filesystem Explorer
ipcMain.handle('fs:readDirectory', async (_, targetDir) => {
  const dir = targetDir || os.homedir();
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const items = [];
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      let size = 0;
      let modified = '';
      try {
        const st = fs.statSync(full);
        size = st.size;
        modified = st.mtime.toISOString().replace('T', ' ').slice(0, 16);
      } catch (_) {}
      const isDir = ent.isDirectory();
      const ext = path.extname(ent.name).toLowerCase();
      const isArchive = ['.zip', '.7z', '.rar', '.tar', '.gz', '.bz2', '.xz', '.zst', '.tgz', '.tbz2', '.txz'].includes(ext);
      items.push({
        name: ent.name,
        path: full.replace(/\\/g, '/'),
        isDir,
        size,
        modified,
        isArchive,
      });
    }
    return {
      currentPath: dir.replace(/\\/g, '/'),
      items,
    };
  } catch (err) {
    throw new Error(`Failed to read directory: ${err.message}`);
  }
});

ipcMain.handle('fs:getQuickPlaces', () => {
  const home = os.homedir();
  const places = [
    { name: 'C:\\ Drive', path: 'C:/' },
    { name: 'User Home', path: home.replace(/\\/g, '/') },
    { name: 'Desktop', path: path.join(home, 'Desktop').replace(/\\/g, '/') },
    { name: 'Downloads', path: path.join(home, 'Downloads').replace(/\\/g, '/') },
    { name: 'Documents', path: path.join(home, 'Documents').replace(/\\/g, '/') },
  ].filter((p) => {
    try {
      return fs.existsSync(p.path);
    } catch (_) {
      return false;
    }
  });

  // Check additional drive letters on Windows (D:, E:, F:)
  if (process.platform === 'win32') {
    for (const drive of ['D', 'E', 'F']) {
      const p = `${drive}:/`;
      try {
        if (fs.existsSync(p)) {
          places.unshift({ name: `${drive}:\\ Drive`, path: p });
        }
      } catch (_) {}
    }
  }

  return places;
});

// IPC Handlers - Dialogs
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
    title: 'Select Files to Archive',
    properties: ['openFile', 'multiSelections'],
  });
  if (res.canceled) return [];
  return res.filePaths;
});

ipcMain.handle('dialog:openFolder', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Select Folder',
    properties: ['openDirectory'],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
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

// Startup & Shell IPC
ipcMain.handle('app:getStartupAction', () => {
  const act = pendingStartupAction;
  pendingStartupAction = null;
  return act;
});

ipcMain.handle('shell:registerContextMenu', () => {
  const exe = app.isPackaged ? process.execPath : path.resolve(__dirname, '../release/win-unpacked/Arkive.exe');
  return registerContextMenu(exe);
});

ipcMain.handle('shell:unregisterContextMenu', () => unregisterContextMenu());
ipcMain.handle('shell:isContextMenuRegistered', () => isContextMenuRegistered());

// IPC Handlers - Engine Operations
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
  const args = ['repair', archive, '--json'];
  if (output) args.push('-o', output);
  const { stdout } = await runArkive(args);
  return parseJson(stdout);
});

ipcMain.handle('arkive:cat', async (_, { path: archivePath, entry, password, maxBytes }) => {
  const args = ['cat', archivePath, entry];
  if (password) args.push('-p', password);
  if (maxBytes) args.push('--max-bytes', maxBytes.toString());
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
  return parseJson(stdout);
});
