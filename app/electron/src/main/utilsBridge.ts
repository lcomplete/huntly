import {ipcRenderer} from "electron";
import {WindowStateListenerType} from "./types";
import * as process from "node:process";

export const utilsBridge = {
  isBrowser: process.type === 'browser',
  isMac: process.platform === 'darwin',
  isWin: process.platform === 'win32',
  isLinux: process.platform === 'linux',
  isLinux64: process.platform === 'linux' && process.arch === 'x64',
  isLinux32: process.platform === 'linux' && process.arch === 'ia32',
  isLinuxARM: process.platform === 'linux' && process.arch === 'arm',
  isLinuxARM64: process.platform === 'linux' && process.arch === 'arm64',
  addWindowStateListener: (callback: (type: WindowStateListenerType, state: boolean) => void) => {
    ipcRenderer.removeAllListeners("maximized")
    ipcRenderer.on("maximized", () => {
      callback(WindowStateListenerType.Maximized, true)
    })
    ipcRenderer.removeAllListeners("unmaximized")
    ipcRenderer.on("unmaximized", () => {
      callback(WindowStateListenerType.Maximized, false)
    })
    ipcRenderer.removeAllListeners("enter-fullscreen")
    ipcRenderer.on("enter-fullscreen", () => {
      callback(WindowStateListenerType.Fullscreen, true)
    })
    ipcRenderer.removeAllListeners("leave-fullscreen")
    ipcRenderer.on("leave-fullscreen", () => {
      callback(WindowStateListenerType.Fullscreen, false)
    })
    ipcRenderer.removeAllListeners("window-focus")
    ipcRenderer.on("window-focus", () => {
      callback(WindowStateListenerType.Focused, true)
    })
    ipcRenderer.removeAllListeners("window-blur")
    ipcRenderer.on("window-blur", () => {
      callback(WindowStateListenerType.Focused, false)
    })
  },
  closeWindow: () => {
    ipcRenderer.invoke("close-window")
  },
  minimizeWindow: () => {
    ipcRenderer.invoke("minimize-window")
  },
  maximizeWindow: () => {
    ipcRenderer.invoke("maximize-window")
  },
  isMaximized: () => {
    return ipcRenderer.sendSync("is-maximized") as boolean
  },
  isFullscreen: () => {
    return ipcRenderer.sendSync("is-fullscreen") as boolean
  },
  isFocused: () => {
    return ipcRenderer.sendSync("is-focused") as boolean
  },
  startServer: () => {
    ipcRenderer.send("server-start");
  },
  getServerPort: () => {
    return ipcRenderer.sendSync("server-port") as number;
  }
}

declare global {
  interface Window {
    electron: {
      utilsBridge: typeof utilsBridge
    }
  }
}