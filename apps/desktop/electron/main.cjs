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

ipcMain.handle('dialog:openVideo', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Select Video to Compress',
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'wmv', 'm4v', 'ts'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

ipcMain.handle('dialog:saveVideo', async (_, defaultName) => {
  const res = await dialog.showSaveDialog({
    title: 'Save Compressed Video As',
    defaultPath: defaultName || 'video.compressed.mp4',
    filters: [
      { name: 'MP4 Video', extensions: ['mp4'] },
      { name: 'MKV Video', extensions: ['mkv'] },
      { name: 'WebM Video', extensions: ['webm'] },
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

// Video Processing Engine & FFmpeg Integration
function findFfmpegBinary() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'bin', 'ffmpeg.exe'),
        path.join(process.resourcesPath, 'ffmpeg.exe'),
      ]
    : [
        path.join(__dirname, '..', 'bin', 'ffmpeg.exe'),
        path.join(__dirname, '..', '..', '..', 'target', 'release', 'ffmpeg.exe'),
        path.join(__dirname, '..', '..', '..', 'target', 'debug', 'ffmpeg.exe'),
      ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return 'ffmpeg.exe';
}

function probeVideoDirect(videoPath) {
  return new Promise((resolve, reject) => {
    const ffmpegBin = findFfmpegBinary();
    const proc = spawn(ffmpegBin, ['-i', videoPath], { windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', () => {
      try {
        let stats = fs.statSync(videoPath);
        let size_bytes = stats.size;
        let filename = path.basename(videoPath);
        let duration_seconds = 0;
        let bitrate_kbps = 0;
        let width = 0;
        let height = 0;
        let video_codec = 'unknown';
        let audio_codec = 'unknown';
        let fps = 0;

        const lines = stderr.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('Duration:')) {
            const match = trimmed.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
            if (match) {
              duration_seconds = parseFloat(match[1]) * 3600 + parseFloat(match[2]) * 60 + parseFloat(match[3]);
            }
            const brMatch = trimmed.match(/bitrate:\s*(\d+)\s*kb\/s/);
            if (brMatch) {
              bitrate_kbps = parseInt(brMatch[1], 10);
            }
          }
          if (trimmed.includes('Video:')) {
            const idx = trimmed.indexOf('Video:');
            const rest = trimmed.slice(idx + 6);
            const tokens = rest.split(',').map((s) => s.trim());
            if (tokens[0]) {
              video_codec = tokens[0].split(/\s+/)[0] || 'unknown';
            }
            for (const t of tokens) {
              const resMatch = t.match(/^(\d{3,5})x(\d{3,5})/);
              if (resMatch) {
                width = parseInt(resMatch[1], 10);
                height = parseInt(resMatch[2], 10);
              }
              const fpsMatch = t.match(/([\d.]+)\s*fps/);
              if (fpsMatch) {
                fps = parseFloat(fpsMatch[1]);
              }
            }
          }
          if (trimmed.includes('Audio:')) {
            const idx = trimmed.indexOf('Audio:');
            const rest = trimmed.slice(idx + 6);
            const tokens = rest.split(',').map((s) => s.trim());
            if (tokens[0]) {
              audio_codec = tokens[0].split(/\s+/)[0] || 'unknown';
            }
          }
        }

        resolve({
          path: videoPath.replace(/\\/g, '/'),
          filename,
          size_bytes,
          duration_seconds,
          width,
          height,
          video_codec,
          audio_codec,
          bitrate_kbps,
          fps,
        });
      } catch (err) {
        reject(err);
      }
    });
    proc.on('error', (err) => reject(err));
  });
}

ipcMain.handle('video:probe', async (_, videoPath) => {
  try {
    const { stdout } = await runArkive(['video', videoPath, '--probe', '--json']);
    return parseJson(stdout);
  } catch (_) {
    return probeVideoDirect(videoPath);
  }
});

let currentVideoProc = null;
let currentVideoCancelled = false;

ipcMain.handle('video:cancel', () => {
  if (currentVideoProc) {
    currentVideoCancelled = true;
    try {
      currentVideoProc.kill('SIGTERM');
    } catch (_) {}
    currentVideoProc = null;
    return true;
  }
  return false;
});

ipcMain.handle('video:compress', async (_, options) => {
  const {
    input,
    output,
    preset = 'balanced',
    codec = 'h264',
    targetMb,
    crf,
    resolution,
    audioBitrate = 128,
  } = options;

  currentVideoCancelled = false;
  const ffmpegBin = findFfmpegBinary();
  const startTime = Date.now();

  let meta;
  try {
    meta = await probeVideoDirect(input);
  } catch (err) {
    meta = { duration_seconds: 1, size_bytes: 0, height: 1080 };
  }

  const durationSecs = Math.max(1, meta.duration_seconds || 1);
  const inputBytes = meta.size_bytes || 0;

  let vcodec = 'libx264';
  if (codec === 'hevc' || codec === 'h265') vcodec = 'libx265';
  else if (codec === 'vp9') vcodec = 'libvpx-vp9';
  else if (codec === 'av1') vcodec = 'libaom-av1';

  let effectiveTargetMb = targetMb;
  let effectiveCrf = crf;
  let effectiveResolution = resolution;

  if (preset === 'discord') {
    effectiveTargetMb = 24.0;
    vcodec = 'libx264';
    if (meta.height > 1080) effectiveResolution = '1080p';
  } else if (preset === 'balanced') {
    vcodec = 'libx264';
    if (effectiveCrf === undefined && !effectiveTargetMb) effectiveCrf = 28;
  } else if (preset === 'high') {
    vcodec = 'libx265';
    if (effectiveCrf === undefined && !effectiveTargetMb) effectiveCrf = 28;
  } else if (preset === '720p') {
    vcodec = 'libx264';
    if (effectiveCrf === undefined && !effectiveTargetMb) effectiveCrf = 28;
    effectiveResolution = '720p';
  }

  const args = ['-y', '-i', input, '-c:v', vcodec];

  if (vcodec === 'libx264') {
    args.push('-pix_fmt', 'yuv420p');
  } else if (vcodec === 'libx265') {
    args.push('-tag:v', 'hvc1');
  }

  if (effectiveTargetMb) {
    const totalKbits = effectiveTargetMb * 8192;
    const totalKbps = Math.floor(totalKbits / durationSecs);
    const aKbps = Math.min(audioBitrate, Math.floor(totalKbps / 4));
    const vKbps = Math.max(100, totalKbps - aKbps);
    args.push('-b:v', `${vKbps}k`);
    args.push('-maxrate', `${Math.floor(vKbps * 1.5)}k`);
    args.push('-bufsize', `${vKbps * 2}k`);
  } else {
    args.push('-crf', (effectiveCrf || 28).toString());
  }

  if (effectiveResolution === '1080p' && meta.height > 1080) {
    args.push('-vf', 'scale=-2:1080');
  } else if (effectiveResolution === '720p' && meta.height > 720) {
    args.push('-vf', 'scale=-2:720');
  } else if (effectiveResolution === '480p' && meta.height > 480) {
    args.push('-vf', 'scale=-2:480');
  }

  args.push('-c:a', 'aac', '-b:a', `${audioBitrate}k`);
  args.push('-preset', 'fast');
  args.push(output);

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin, args, { windowsHide: true });
    currentVideoProc = proc;
    let stderr = '';

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;

      const timeMatch = text.match(/time=(\d+):(\d+):([\d.]+)/);
      if (timeMatch && mainWindow && !mainWindow.isDestroyed()) {
        const curSecs = parseFloat(timeMatch[1]) * 3600 + parseFloat(timeMatch[2]) * 60 + parseFloat(timeMatch[3]);
        const percent = Math.min(100, Math.round((curSecs / durationSecs) * 100));

        let fps = 0;
        const fpsMatch = text.match(/fps=\s*([\d.]+)/);
        if (fpsMatch) fps = parseFloat(fpsMatch[1]);

        let speed = '1.0x';
        const speedMatch = text.match(/speed=\s*([\d.]+x)/);
        if (speedMatch) speed = speedMatch[1];

        let sizeKb = 0;
        const sizeMatch = text.match(/size=\s*(\d+)kB/);
        if (sizeMatch) sizeKb = parseInt(sizeMatch[1], 10);

        mainWindow.webContents.send('video:progress', {
          percent,
          currentTime: curSecs,
          totalDuration: durationSecs,
          fps,
          speed,
          currentSizeKb: sizeKb,
        });
      }
    });

    proc.on('close', (code) => {
      currentVideoProc = null;
      if (currentVideoCancelled) {
        try {
          if (fs.existsSync(output)) fs.unlinkSync(output);
        } catch (_) {}
        return reject(new Error('Compression cancelled'));
      }

      if (code === 0) {
        let outputBytes = 0;
        try {
          outputBytes = fs.statSync(output).size;
        } catch (_) {}

        const savingsPct = inputBytes > 0 && outputBytes < inputBytes
          ? Number((((inputBytes - outputBytes) / inputBytes) * 100).toFixed(1))
          : 0;

        resolve({
          input_bytes: inputBytes,
          output_bytes: outputBytes,
          duration_seconds: durationSecs,
          savings_pct: savingsPct,
          elapsed_ms: Date.now() - startTime,
          output_path: output.replace(/\\/g, '/'),
        });
      } else {
        reject(new Error(stderr || `FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      currentVideoProc = null;
      reject(err);
    });
  });
});

