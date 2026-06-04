const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;
let tray = null;
let fetchInterval = null;

// ── 窗口创建 ──
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 880,
    height: 780,
    minWidth: 480,
    minHeight: 600,
    title: '沪铜行情',
    titleBarStyle: 'hiddenInset',        // macOS 原生标题栏
    vibrancy: 'sidebar',                 // 毛玻璃效果
    visualEffectState: 'active',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('index.html');

  // 关闭时释放
  mainWindow.on('closed', () => { mainWindow = null; });

  // macOS 保持激活
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });

  buildMenu();
}

// ── 菜单栏 ──
function buildMenu() {
  const template = [
    {
      label: '沪铜行情',
      submenu: [
        { role: 'about', label: '关于沪铜行情' },
        { type: 'separator' },
        { label: '刷新数据', accelerator: 'CmdOrCtrl+R', click: () => fetchAndSend() },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出沪铜行情' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'togglefullscreen', label: '全屏' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { type: 'separator' },
        { role: 'front', label: '全部置于最前' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ── 数据抓取 ──
function fetchAndSend() {
  if (!mainWindow) return;
  mainWindow.webContents.send('fetch-start');

  const child = spawn('/usr/local/bin/node', [path.join(__dirname, 'fetch.js')], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (d) => { stdout += d.toString(); });
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  child.on('close', (code) => {
    const ok = code === 0;
    if (!mainWindow) return;

    // 读取数据
    let data = null;
    let history = null;
    try {
      const latestPath = path.join(__dirname, 'data', 'latest.json');
      const historyPath = path.join(__dirname, 'data', 'history.json');
      if (fs.existsSync(latestPath)) {
        data = JSON.parse(fs.readFileSync(latestPath, 'utf-8'));
      }
      if (fs.existsSync(historyPath)) {
        history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      }
    } catch (e) {
      console.error('读取数据失败:', e);
    }

    mainWindow.webContents.send('fetch-done', { ok, data, history, error: ok ? null : stderr });

    // 失败时桌面通知
    if (!ok) {
      new Notification({
        title: '数据更新失败',
        body: stderr.slice(0, 200),
      }).show();
    }
  });
}

// ── 自动刷新 ──
function startAutoRefresh(intervalMs = 60000) {
  stopAutoRefresh();
  // 首次立即刷新
  setTimeout(fetchAndSend, 500);
  fetchInterval = setInterval(fetchAndSend, intervalMs);
}

function stopAutoRefresh() {
  if (fetchInterval) {
    clearInterval(fetchInterval);
    fetchInterval = null;
  }
}

// ── IPC 处理 ──
ipcMain.handle('refresh', () => fetchAndSend());
ipcMain.handle('set-refresh-interval', (_e, ms) => {
  startAutoRefresh(ms);
  return true;
});
ipcMain.handle('stop-refresh', () => {
  stopAutoRefresh();
  return true;
});

// ── 应用生命周期 ──
app.whenReady().then(() => {
  createWindow();
  startAutoRefresh(60000);  // 每分钟刷新
});

app.on('window-all-closed', () => {
  stopAutoRefresh();
  if (process.platform !== 'darwin') app.quit();
});
