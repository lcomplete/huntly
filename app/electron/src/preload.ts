/* eslint-disable @typescript-eslint/no-namespace */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ipcRenderer, IpcRenderer, contextBridge } from 'electron'
import { utilsBridge } from "./utilsBridge";

declare global {
  var ipcRenderer: IpcRenderer
}

// Since we disabled nodeIntegration we can reintroduce
// needed node functionality here
process.once('loaded', () => {
  global.ipcRenderer = ipcRenderer
})

contextBridge.exposeInMainWorld("electron", { utilsBridge: utilsBridge });