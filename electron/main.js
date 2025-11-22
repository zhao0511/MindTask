// 🟢 1. 这里的引入合并了，不要写两遍
const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');

// 判断开发环境
const isDev = !app.isPackaged;

// 👇👇👇 配置你的 GitHub 信息 👇👇👇
const GITHUB_OWNER = "zhao0511"; 
const GITHUB_REPO = "MindTask";
const CHECK_UPDATE_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// 检查更新函数
async function checkUpdate() {
  try {
    // 请求 GitHub API
    const response = await fetch(CHECK_UPDATE_URL, {
      headers: { 'User-Agent': 'MindTask-App' }
    });
    
    if (!response.ok) return;

    const data = await response.json();
    const latestVersion = data.tag_name; // e.g. "v1.0.1"
    const currentVersion = 'v' + app.getVersion(); // e.g. "v1.0.0"

    // 版本对比
    if (latestVersion && latestVersion !== currentVersion) {
      const { response: buttonIndex } = await dialog.showMessageBox({
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 ${latestVersion}，当前版本 ${currentVersion}`,
        detail: '想要下载最新版本体验新功能吗？',
        buttons: ['去下载', '以后再说'],
        defaultId: 0,
        cancelId: 1
      });

      if (buttonIndex === 0) {
        shell.openExternal(data.html_url);
      }
    }
  } catch (error) {
    console.error('检查更新失败:', error);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "MindTask",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, 
    },
    autoHideMenuBar: true, 
    // 建议加上 icon，否则任务栏图标可能是默认的
    icon: path.join(__dirname, '../public/icon.ico') 
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    // 开发模式可选打开调试工具
    // win.webContents.openDevTools(); 
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  
  // 仅在打包环境检查更新
  if (app.isPackaged) {
    setTimeout(checkUpdate, 3000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});