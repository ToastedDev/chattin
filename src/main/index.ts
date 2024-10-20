import type { Message } from "@shared/types";

import { electronApp, is } from "@electron-toolkit/utils";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { Masterchat, stringify } from "masterchat";
import crypto from "node:crypto";
import { join } from "node:path";

import icon from "../../resources/icon.png?asset";

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 600,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  }
  else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  function generateId(...params) {
  // Combine parameters into a single string
    const combined = `${params.join("_")}_${Date.now()}`;

    // Encode the combined string to make it unique
    return crypto.createHash("md5").update(combined).digest("hex");
  }

  ipcMain.on("start-chat-stream", async (event, _args) => {
    const [replyPort] = event.ports;

    const mc = await Masterchat.init("L0jKCtHzkyE");

    mc.on("chats", (chats) => {
      replyPort.postMessage(JSON.stringify({
        type: "chats",
        data: chats.map(chat => ({
          id: generateId(chat.id),
          content: stringify(chat.message!),
          author: {
            name: chat.authorName!,
            badges: {
              moderator: chat.isModerator,
              verified: chat.isVerified,
              owner: chat.isOwner,
            },
          },
        }) satisfies Message),
      }));
    });

    await mc.listen();

    replyPort.on("close", () => {
      mc.stop();
    });
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    window.webContents.on("before-input-event", (event, input) => {
      if (!is.dev) {
        if (input.code === "KeyR" && (input.control || input.meta))
          event.preventDefault();
      }
      else {
        if (input.code === "F12") {
          if (window.webContents.isDevToolsOpened()) {
            window.webContents.closeDevTools();
          }
          else {
            window.webContents.openDevTools({ mode: "undocked" });
          }
        }
      }

      if (input.control && input.key === "=") { // CTRL+= for zooming in
        const zoomFactor = window.webContents.getZoomLevel();
        window.webContents.setZoomLevel(zoomFactor + 0.5);
        event.preventDefault();
      }
    });
  });

  // IPC test
  ipcMain.on("ping", () => console.log("pong"));

  createWindow();

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
