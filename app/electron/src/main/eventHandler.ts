import { ipcMain, shell, dialog, app, session, clipboard } from "electron"
import { WindowManager } from "./window"

export function setIpcMainEventHandler(manager: WindowManager) {
	async function openExternal(url: string, background = false) {
		if (url.startsWith("https://") || url.startsWith("http://")) {
			if (background && process.platform === "darwin") {
				shell.openExternal(url, { activate: false })
			} else if (background && manager.hasWindow()) {
				manager.mainWindow.setAlwaysOnTop(true)
				await shell.openExternal(url)
				setTimeout(() => manager.mainWindow.setAlwaysOnTop(false), 1000)
			} else {
				shell.openExternal(url)
			}
		}
	}

	app.on("web-contents-created", (_, contents) => {
		contents.setWindowOpenHandler(details => {
			if (contents.getType() === "webview")
				openExternal(
					details.url,
					details.disposition === "background-tab"
				)
			return {
				action: manager.hasWindow() ? "deny" : "allow",
			}
		})
		contents.on("will-navigate", (event, url) => {
			event.preventDefault()
			if (contents.getType() === "webview") openExternal(url)
		})
	})

	ipcMain.on("get-version", event => {
		event.returnValue = app.getVersion()
	})

	ipcMain.handle("open-external", (_, url: string, background: boolean) => {
		openExternal(url, background)
	})

	ipcMain.handle("show-error-box", (_, title, content) => {
		dialog.showErrorBox(title, content)
	})

	ipcMain.handle(
		"show-message-box",
		async (_, title, message, confirm, cancel, defaultCancel, type) => {
			if (manager.hasWindow()) {
				let response = await dialog.showMessageBox(manager.mainWindow, {
					type: type,
					title: title,
					message: message,
					buttons:
						process.platform === "win32"
							? ["Yes", "No"]
							: [confirm, cancel],
					cancelId: 1,
					defaultId: defaultCancel ? 1 : 0,
				})
				return response.response === 0
			} else {
				return false
			}
		}
	)


	ipcMain.handle("get-cache", async () => {
		return await session.defaultSession.getCacheSize()
	})

	ipcMain.handle("clear-cache", async () => {
		await session.defaultSession.clearCache()
	})

	ipcMain.handle("write-clipboard", (_, text) => {
		clipboard.writeText(text)
	})

	ipcMain.handle("close-window", () => {
		if (manager.hasWindow()) manager.mainWindow.close()
	})

	ipcMain.handle("minimize-window", () => {
		if (manager.hasWindow()) manager.mainWindow.minimize()
	})

	ipcMain.handle("maximize-window", () => {
		manager.zoom()
	})

	ipcMain.on("is-maximized", event => {
		event.returnValue =
			Boolean(manager.mainWindow) && manager.mainWindow.isMaximized()
	})

	ipcMain.on("is-focused", event => {
		event.returnValue =
			manager.hasWindow() && manager.mainWindow.isFocused()
	})

	ipcMain.on("is-fullscreen", event => {
		event.returnValue =
			manager.hasWindow() && manager.mainWindow.isFullScreen()
	})

	ipcMain.handle("request-focus", () => {
		if (manager.hasWindow()) {
			const win = manager.mainWindow
			if (win.isMinimized()) win.restore()
			if (process.platform === "win32") {
				win.setAlwaysOnTop(true)
				win.setAlwaysOnTop(false)
			}
			win.focus()
		}
	})

	ipcMain.handle("request-attention", () => {
		if (manager.hasWindow() && !manager.mainWindow.isFocused()) {
			if (process.platform === "win32") {
				manager.mainWindow.flashFrame(true)
				manager.mainWindow.once("focus", () => {
					manager.mainWindow.flashFrame(false)
				})
			} else if (process.platform === "darwin") {
				app.dock.bounce()
			}
		}
	})

}
