const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

// 判断开发环境
const isDev = !app.isPackaged;

// 👇 配置 GitHub 信息
const GITHUB_OWNER = "zhao0511"; 
const GITHUB_REPO = "MindTask";
const CHECK_UPDATE_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// 🟢 1. 注册 IPC 监听器：供前端 React 调用检查更新
ipcMain.handle('check-update', async () => {
  try {
    const response = await fetch(CHECK_UPDATE_URL, {
      headers: { 'User-Agent': 'MindTask-App' }
    });
    
    if (!response.ok) throw new Error('Network response was not ok');

    const data = await response.json();
    const latestVersion = data.tag_name; // e.g. "v1.2.3"
    const currentVersion = 'v' + app.getVersion(); // e.g. "v1.2.2"
    
    // 返回给前端的数据结构
    return {
      currentVersion,
      latestVersion,
      hasUpdate: latestVersion !== currentVersion,
      releaseNotes: data.body, // 更新日志
      downloadUrl: data.html_url
    };
  } catch (error) {
    console.error('Update check failed:', error);
    return { error: true };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "MindTask",
    webPreferences: {
      nodeIntegration: true, // 允许在渲染进程使用 Node API
      contextIsolation: false,
      spellcheck: false,
    },
    autoHideMenuBar: true, 
    icon: path.join(__dirname, '../public/icon.ico') 
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  // 注意：这里不再自动 setTimeout checkUpdate 了，逻辑移交给了前端
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
