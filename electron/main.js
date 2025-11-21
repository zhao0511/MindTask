const { app, BrowserWindow } = require('electron');
        const path = require('path');

        // 🟢 核心修复：改用 !app.isPackaged 来判断开发环境
        const isDev = !app.isPackaged; 

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
          });

          if (isDev) {
            // 开发模式：加载本地服务
            win.loadURL('http://localhost:5173');
          } else {
            // 生产模式：加载打包文件
            win.loadFile(path.join(__dirname, '../dist/index.html'));
          }
        }

        app.whenReady().then(createWindow);

        app.on('window-all-closed', () => {
          if (process.platform !== 'darwin') app.quit();
        });

        app.on('activate', () => {
          if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });