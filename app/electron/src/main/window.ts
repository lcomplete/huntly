import windowStateKeeper = require("electron-window-state")
import { BrowserWindow, app } from "electron"
import { setIpcMainEventHandler } from "./eventHandler";


export class WindowManager {
	mainWindow: BrowserWindow
	private mainWindowState: windowStateKeeper.State = windowStateKeeper({
		defaultWidth: 1200,
		defaultHeight: 700,
	})

	constructor(browserWindow: BrowserWindow) {
		this.mainWindow = browserWindow
	}

	init = () => {
		this.setEventHandler()
		this.setWindowEventHandler()
	}

	private setEventHandler = () => {
		setIpcMainEventHandler(this)

		app.on("second-instance", () => {
			if (this.mainWindow !== null) {
				this.mainWindow.focus()
			}
		})
	}

	setWindowEventHandler = () => {
		this.mainWindowState.manage(this.mainWindow)
		this.mainWindow.on("ready-to-show", () => {
			this.mainWindow.show()
			this.mainWindow.focus()
			// if (!app.isPackaged) this.mainWindow.webContents.openDevTools()
		})
		// this.mainWindow.loadFile(
		// 	(app.isPackaged ? "dist/" : "") + "index.html"
		// )

		this.mainWindow.on("maximize", () => {
			this.mainWindow.webContents.send("maximized")
		})
		this.mainWindow.on("unmaximize", () => {
			this.mainWindow.webContents.send("unmaximized")
		})
		this.mainWindow.on("enter-full-screen", () => {
			this.mainWindow.webContents.send("enter-fullscreen")
		})
		this.mainWindow.on("leave-full-screen", () => {
			this.mainWindow.webContents.send("leave-fullscreen")
		})
		this.mainWindow.on("focus", () => {
			this.mainWindow.webContents.send("window-focus")
		})
		this.mainWindow.on("blur", () => {
			this.mainWindow.webContents.send("window-blur")
		})
		this.mainWindow.webContents.on("context-menu", (_, params) => {
			if (params.selectionText) {
				this.mainWindow.webContents.send(
					"window-context-menu",
					[params.x, params.y],
					params.selectionText
				)
			}
		})
	}

	zoom = () => {
		if (this.hasWindow()) {
			if (this.mainWindow.isMaximized()) {
				this.mainWindow.unmaximize()
			} else {
				this.mainWindow.maximize()
			}
		}
	}

	hasWindow = () => {
		return this.mainWindow !== null && !this.mainWindow.isDestroyed()
	}
}
