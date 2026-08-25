const { app, BrowserWindow, ipcMain, safeStorage, session, desktopCapturer, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { autoUpdater } = require('electron-updater');

app.setName('Rodnik');
// The installer keeps the legacy build appId so 0.5.x/0.6.0 upgrade in place,
// but the running Windows app must have its own identity. Otherwise Windows
// groups Rodnik under the old Knock taskbar icon.
app.setAppUserModelId('space.rodnik.desktop');
const appDataRoot = app.getPath('appData');
app.setPath('userData', path.join(appDataRoot, 'Rodnik'));

let mainWindow = null;
let selectedDisplaySourceId = null;
let sourceCache = { at: 0, items: [] };
let sourceCachePromise = null;
let updateInterval = null;
let updateReady = false;
let updateInstallTimer = null;

function legacyUserDataDirs() {
  const currentDir = app.getPath('userData');
  return [
    path.join(appDataRoot, 'Knock'),
    path.join(appDataRoot, 'knock-desktop'),
    path.join(appDataRoot, 'knock'),
    path.join(appDataRoot, 'Knock Messenger'),
    path.join(appDataRoot, 'Rodnik Messenger')
  ].filter(dir => path.resolve(dir) !== path.resolve(currentDir));
}

function readJsonFile(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value && typeof value === 'object' ? value : null;
  } catch { return null; }
}

function migrateLegacyUserData() {
  try {
    const currentDir = app.getPath('userData');
    fs.mkdirSync(currentDir, { recursive: true });

    const currentSettingsFile = path.join(currentDir, 'settings.json');
    let merged = readJsonFile(currentSettingsFile) || {};
    let settingsChanged = false;
    for (const legacyDir of legacyUserDataDirs()) {
      const legacy = readJsonFile(path.join(legacyDir, 'settings.json'));
      if (!legacy) continue;
      for (const [key, value] of Object.entries(legacy)) {
        if (merged[key] === undefined || merged[key] === null) {
          merged[key] = value;
          settingsChanged = true;
        }
      }
    }
    if (settingsChanged || (!fs.existsSync(currentSettingsFile) && Object.keys(merged).length)) {
      fs.writeFileSync(currentSettingsFile, JSON.stringify(merged, null, 2), { mode: 0o600 });
    }

    const currentSession = path.join(currentDir, 'session.bin');
    if (!fs.existsSync(currentSession)) {
      for (const legacyDir of legacyUserDataDirs()) {
        const legacySession = path.join(legacyDir, 'session.bin');
        if (!fs.existsSync(legacySession)) continue;
        try { fs.copyFileSync(legacySession, currentSession); break; } catch {}
      }
    }
  } catch (err) {
    console.warn('Legacy user data migration skipped:', err.message);
  }
}

function decryptSessionFile(file) {
  try {
    const data = fs.readFileSync(file);
    if (!data.length || data.toString('utf8').startsWith('plain:')) return null;
    if (!safeStorage.isEncryptionAvailable()) return null;
    const token = safeStorage.decryptString(data);
    return token && typeof token === 'string' ? token : null;
  } catch { return null; }
}

function loadRefreshTokenCandidates() {
  const files = [
    userFile('session.bin'),
    ...legacyUserDataDirs().map(dir => path.join(dir, 'session.bin'))
  ];
  const seen = new Set();
  const tokens = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const token = decryptSessionFile(file);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function clearStoredSessions() {
  for (const file of [userFile('session.bin'), ...legacyUserDataDirs().map(dir => path.join(dir, 'session.bin'))]) {
    try { fs.rmSync(file, { force: true }); } catch {}
  }
  return true;
}

function userFile(name) { return path.join(app.getPath('userData'), name); }

function defaultSettings() {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'default-config.json'), 'utf8'));
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}
  return { serverUrl: 'http://127.0.0.1:3000', theme: 'dark', lowBandwidthCalls: true };
}

function readSettings() {
  const defaults = defaultSettings();
  try {
    const saved = JSON.parse(fs.readFileSync(userFile('settings.json'), 'utf8'));
    if (saved && typeof saved === 'object') {
      return { ...defaults, ...saved };
    }
  } catch {}
  return defaults;
}

function writeSettings(settings) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(userFile('settings.json'), JSON.stringify(settings, null, 2), { mode: 0o600 });
}

function saveRefreshToken(token) {
  const file = userFile('session.bin');
  if (!token) { try { fs.rmSync(file, { force: true }); } catch {} return true; }
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    if (!safeStorage.isEncryptionAvailable()) {
      console.error('OS secure storage is unavailable; refusing to persist the refresh token unencrypted.');
      return false;
    }
    fs.writeFileSync(file, safeStorage.encryptString(token), { mode: 0o600 });
    return true;
  } catch (err) {
    console.error('Cannot save session:', err);
    return false;
  }
}

function loadRefreshToken() {
  return loadRefreshTokenCandidates()[0] || null;
}

async function listDisplaySources(force = false) {
  if (!force && sourceCache.items.length && Date.now() - sourceCache.at < 30000) return sourceCache.items;
  if (sourceCachePromise) return sourceCachePromise;
  sourceCachePromise = (async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 160, height: 90 },
      fetchWindowIcons: false
    });
    const items = sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail?.isEmpty() ? null : source.thumbnail.toDataURL(),
      isScreen: source.id.startsWith('screen:')
    })).sort((a, b) => Number(b.isScreen) - Number(a.isScreen) || a.name.localeCompare(b.name));
    sourceCache = { at: Date.now(), items };
    return items;
  })();
  try { return await sourceCachePromise; }
  finally { sourceCachePromise = null; }
}

function sendUpdateState(type, payload = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:state', { type, ...payload });
}

function updaterLog(level, ...args) {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    const text = args.map(value => value instanceof Error ? (value.stack || value.message) : (typeof value === 'string' ? value : JSON.stringify(value))).join(' ');
    fs.appendFileSync(path.join(dir, 'updater.log'), `${new Date().toISOString()} [${level}] ${text}\n`);
  } catch {}
}

function installDownloadedUpdate() {
  if (!app.isPackaged || !updateReady) return false;
  updateReady = false;
  if (updateInstallTimer) { clearTimeout(updateInstallTimer); updateInstallTimer = null; }
  sendUpdateState('installing');
  updaterLog('INFO', 'Installing downloaded update and restarting Rodnik');
  setTimeout(() => autoUpdater.quitAndInstall(true, true), 250);
  return true;
}

function setupAutoUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.logger = { info: (...a) => updaterLog('INFO', ...a), warn: (...a) => updaterLog('WARN', ...a), error: (...a) => updaterLog('ERROR', ...a), debug: (...a) => updaterLog('DEBUG', ...a) };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.on('checking-for-update', () => sendUpdateState('checking'));
  autoUpdater.on('update-available', info => sendUpdateState('available', { version: info.version }));
  autoUpdater.on('download-progress', p => sendUpdateState('progress', { percent: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', info => {
    updateReady = true;
    sendUpdateState('downloaded', { version: info.version, autoInstallSeconds: 8 });
    if (updateInstallTimer) clearTimeout(updateInstallTimer);
    updateInstallTimer = setTimeout(() => installDownloadedUpdate(), 8000);
  });
  autoUpdater.on('update-not-available', () => sendUpdateState('current'));
  autoUpdater.on('error', err => {
    updaterLog('ERROR', err);
    sendUpdateState('error', { message: err.message });
  });
  const check = () => autoUpdater.checkForUpdates().catch(err => updaterLog('WARN', 'Update check failed:', err));
  setTimeout(check, 7000).unref?.();
  updateInterval = setInterval(check, 30 * 60_000);
  updateInterval.unref?.();
}

function createWindow() {
  const iconPath = path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
  const rodnikIcon = nativeImage.createFromPath(iconPath);
  const win = new BrowserWindow({
    width: 1220,
    height: 800,
    minWidth: 860,
    minHeight: 600,
    title: 'Rodnik',
    icon: rodnikIcon,
    backgroundColor: '#252931',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow = win;
  try { if (!rodnikIcon.isEmpty()) win.setIcon(rodnikIcon); } catch {}
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  migrateLegacyUserData();

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media' || permission === 'display-capture');
  });

  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } });
      const selected = sources.find(source => source.id === selectedDisplaySourceId)
        || sources.find(source => source.id.startsWith('screen:')) || sources[0];
      selectedDisplaySourceId = null;
      if (!selected) return callback({});
      callback({ video: selected });
    } catch (err) {
      console.error('display media handler error', err);
      callback({});
    }
  });

  ipcMain.handle('settings:get', () => readSettings());
  ipcMain.handle('settings:setServerUrl', (event, url) => {
    const settings = readSettings();
    settings.serverUrl = String(url || '').trim();
    writeSettings(settings);
    return settings;
  });
  ipcMain.handle('settings:setPreferences', (event, patch) => {
    const settings = readSettings();
    const next = patch && typeof patch === 'object' ? patch : {};
    if (next.theme === 'dark' || next.theme === 'light') settings.theme = next.theme;
    if (typeof next.lowBandwidthCalls === 'boolean') settings.lowBandwidthCalls = next.lowBandwidthCalls;
    writeSettings(settings);
    return settings;
  });
  ipcMain.handle('session:getRefreshToken', () => loadRefreshToken());
  ipcMain.handle('session:getRefreshTokenCandidates', () => loadRefreshTokenCandidates());
  ipcMain.handle('session:setRefreshToken', (event, token) => saveRefreshToken(String(token || '')));
  ipcMain.handle('session:getCachedUser', () => readSettings().cachedUser || null);
  ipcMain.handle('session:setCachedUser', (event, user) => {
    const settings = readSettings();
    settings.cachedUser = user && typeof user === 'object' ? user : null;
    writeSettings(settings);
    return true;
  });
  ipcMain.handle('session:clear', () => {
    const ok = clearStoredSessions();
    const settings = readSettings();
    delete settings.cachedUser;
    writeSettings(settings);
    return ok;
  });
  ipcMain.handle('screen:listSources', (event, force) => listDisplaySources(Boolean(force)));
  ipcMain.handle('screen:primeSources', async () => { try { await listDisplaySources(true); return true; } catch { return false; } });
  ipcMain.handle('screen:selectSource', (event, sourceId) => { selectedDisplaySourceId = String(sourceId || ''); return true; });
  ipcMain.handle('update:restart', () => installDownloadedUpdate());
  ipcMain.handle('update:defer', () => { if (updateInstallTimer) { clearTimeout(updateInstallTimer); updateInstallTimer = null; } sendUpdateState('deferred'); return true; });
  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged) return { ok: false, dev: true };
    try { await autoUpdater.checkForUpdates(); return { ok: true }; }
    catch (err) { return { ok: false, message: err.message }; }
  });

  createWindow();
  setupAutoUpdates();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (updateInterval) clearInterval(updateInterval); if (updateInstallTimer) clearTimeout(updateInstallTimer); });
