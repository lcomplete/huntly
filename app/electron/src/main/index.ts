// Native

// Packages
import {app, BrowserWindow, ipcMain, IpcMainEvent} from 'electron'
import path, {join} from 'path';

import {WindowManager} from "./window";
import SettingStore from "./settingStore";
import {ChildProcessWithoutNullStreams, spawn} from "child_process";
import kill from "tree-kill";

app.on("ready", async () => {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1600,
    minHeight: 900,
    titleBarStyle: 'hidden',
    // titleBarOverlay: {height: 44},
    trafficLightPosition: {x: 15, y: 15},
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
    },
  })

  const windowManager = new WindowManager(mainWindow);
  windowManager.init();

  // const url = format({
  //   pathname: join(__dirname, './renderer/index.html'),
  //   protocol: 'file:',
  //   slashes: true,
  // });

  mainWindow.loadFile(join(__dirname, './renderer/index.html'))
})

// Quit the app once all windows are closed
app.on('window-all-closed', app.quit)

app.on("before-quit", () => {
  stopServer();
});

let javaProcess: ChildProcessWithoutNullStreams;

ipcMain.on('server-start', (event: IpcMainEvent, message: any) => {
  stopServer();
  const serverPort = getServerPort();
  if (serverPort) {
    const jarPath = path.join(app.getAppPath(), "huntly-server.jar");
    console.log({jarPath,serverPort});
    javaProcess = spawn('java', ['-Xms128m', '-Xmx1024m', '-jar', jarPath, '--server.port=' + serverPort.toString()]);
  }
})

ipcMain.on('server-port', (event: IpcMainEvent, message: any) => {
  event.returnValue = getServerPort();
})

function stopServer() {
  if (javaProcess && javaProcess.pid) {
    kill(javaProcess.pid);
  }
}

function getServerPort() {
  const store = new SettingStore();
  return store.getServerPort();
}
