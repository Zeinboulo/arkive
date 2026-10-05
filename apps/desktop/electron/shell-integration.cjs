const { spawnSync } = require('child_process');
const path = require('path');

const ARCHIVE_EXTS = ['.zip', '.7z', '.rar', '.tar', '.gz', '.bz2', '.xz', '.zst', '.tgz'];

function runReg(args) {
  const res = spawnSync('reg.exe', args, { windowsHide: true, encoding: 'utf8' });
  return res.status === 0;
}

function regAdd(key, valName, data) {
  const args = ['add', key, '/t', 'REG_SZ', '/f'];
  if (valName) {
    args.push('/v', valName);
  } else {
    args.push('/ve');
  }
  if (data !== undefined) {
    args.push('/d', data);
  }
  return runReg(args);
}

function regDelete(key) {
  return runReg(['delete', key, '/f']);
}

function registerContextMenu(targetExe) {
  if (process.platform !== 'win32') return false;
  const exe = path.resolve(targetExe);

  try {
    // 1. Files: "Add to archive with Arkive..."
    regAdd('HKCU\\Software\\Classes\\*\\shell\\Arkive', '', 'Add to archive with Arkive...');
    regAdd('HKCU\\Software\\Classes\\*\\shell\\Arkive', 'Icon', `"${exe}",0`);
    regAdd('HKCU\\Software\\Classes\\*\\shell\\Arkive\\command', '', `"${exe}" --create "%1"`);

    // 2. Folders: "Add to archive with Arkive..."
    regAdd('HKCU\\Software\\Classes\\Directory\\shell\\Arkive', '', 'Add to archive with Arkive...');
    regAdd('HKCU\\Software\\Classes\\Directory\\shell\\Arkive', 'Icon', `"${exe}",0`);
    regAdd('HKCU\\Software\\Classes\\Directory\\shell\\Arkive\\command', '', `"${exe}" --create "%1"`);

    // 3. Background in folders: "Open Arkive here"
    regAdd('HKCU\\Software\\Classes\\Directory\\Background\\shell\\Arkive', '', 'Open Arkive here');
    regAdd('HKCU\\Software\\Classes\\Directory\\Background\\shell\\Arkive', 'Icon', `"${exe}",0`);
    regAdd('HKCU\\Software\\Classes\\Directory\\Background\\shell\\Arkive\\command', '', `"${exe}" "%V"`);

    // 4. Archive formats: "Open with Arkive" & "Extract files with Arkive..."
    for (const ext of ARCHIVE_EXTS) {
      const baseKey = `HKCU\\Software\\Classes\\SystemFileAssociations\\${ext}\\shell`;
      regAdd(`${baseKey}\\Arkive.Open`, '', 'Open with Arkive');
      regAdd(`${baseKey}\\Arkive.Open`, 'Icon', `"${exe}",0`);
      regAdd(`${baseKey}\\Arkive.Open\\command`, '', `"${exe}" "%1"`);

      regAdd(`${baseKey}\\Arkive.Extract`, '', 'Extract files with Arkive...');
      regAdd(`${baseKey}\\Arkive.Extract`, 'Icon', `"${exe}",0`);
      regAdd(`${baseKey}\\Arkive.Extract\\command`, '', `"${exe}" --extract "%1"`);
    }

    return true;
  } catch (err) {
    console.error('Failed to register context menu:', err);
    return false;
  }
}

function unregisterContextMenu() {
  if (process.platform !== 'win32') return false;
  try {
    regDelete('HKCU\\Software\\Classes\\*\\shell\\Arkive');
    regDelete('HKCU\\Software\\Classes\\Directory\\shell\\Arkive');
    regDelete('HKCU\\Software\\Classes\\Directory\\Background\\shell\\Arkive');

    for (const ext of ARCHIVE_EXTS) {
      regDelete(`HKCU\\Software\\Classes\\SystemFileAssociations\\${ext}\\shell\\Arkive.Open`);
      regDelete(`HKCU\\Software\\Classes\\SystemFileAssociations\\${ext}\\shell\\Arkive.Extract`);
    }
    return true;
  } catch (err) {
    console.error('Failed to unregister context menu:', err);
    return false;
  }
}

function isContextMenuRegistered() {
  if (process.platform !== 'win32') return false;
  return runReg(['query', 'HKCU\\Software\\Classes\\*\\shell\\Arkive', '/ve']);
}

module.exports = {
  registerContextMenu,
  unregisterContextMenu,
  isContextMenuRegistered,
};
