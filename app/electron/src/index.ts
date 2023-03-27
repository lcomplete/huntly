// Native

// Packages
import {app, BrowserWindow, ipcMain, IpcMainEvent} from 'electron'
import path, {join} from 'path';
import isDev from "electron-is-dev";

import {WindowManager} from "./window";
import {format} from 'url';


app.on("ready", async () => {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1600,
    minHeight: 900,
    titleBarStyle: 'hidden',
    // titleBarOverlay: {height: 44},
    trafficLightPosition:{x: 15, y: 15},
    webPreferences: {
      nodeIntegration: false,
      // contextIsolation: false,
      preload: join(__dirname, 'preload.js'),
    },
  })

  const windowManager = new WindowManager(mainWindow);
  windowManager.init();

  const url = isDev
    ? 'http://localhost:3000/'
    : format({
      pathname: join(__dirname, '../renderer/out/index.html'),
      protocol: 'file:',
      slashes: true,
    })


  mainWindow.loadURL(url)
})

// Quit the app once all windows are closed
app.on('window-all-closed', app.quit)

// listen the channel `message` and resend the received message to the renderer process
ipcMain.on('message', (event: IpcMainEvent, message: any) => {
  console.log(message)
  setTimeout(() => event.sender.send('message', 'hi from electron'), 500)
})
