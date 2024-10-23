import type { Message, Tab } from "@shared/types";

import { electronApp, is } from "@electron-toolkit/utils";
import { app, BrowserWindow, clipboard, ipcMain, Menu, shell } from "electron";
import { Masterchat, stringify } from "masterchat";
import crypto from "node:crypto";
import { join } from "node:path";

import icon from "../../resources/icon.png?asset";
import { getData, setData } from "./utils/data";
import { getChannel, getLatestStream, getVideo } from "./utils/scrapers";

function createWindow(): void {
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

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  }
  else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  function generateId(clientId: string): string {
    const combined = `${clientId}_${Date.now()}`;
    return crypto.createHash("md5").update(combined).digest("hex");
  }

  ipcMain.handle("yt:channel", (_, urlOrId: string) => getChannel(urlOrId));
  ipcMain.handle("yt:video", (_, urlOrId: string) => getVideo(urlOrId));
  ipcMain.handle("yt:latest-stream", (_, channelId: string) => getLatestStream(channelId));

  ipcMain.on("chat:start-stream", async (event, args) => {
    const [replyPort] = event.ports;

    const mc = await Masterchat.init(args.videoId);

    mc.on("chats", (chats) => {
      replyPort.postMessage(JSON.stringify({
        type: "chats",
        data: chats.map(chat => ({
          id: generateId(chat.id),
          content: stringify(chat.message!),
          author: {
            name: chat.authorName!,
            avatar: chat.authorPhoto!,
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

  ipcMain.handle("tabs:get", async (_) => {
    const data = await getData();
    return data.tabs ?? [];
  });

  ipcMain.on("tabs:add", async (_, tab: Tab) => {
    await setData((data) => {
      data.tabs ??= [];
      data.tabs.push(tab);
      return data;
    });
  });

  ipcMain.on("context-menu:link", async (_, link) => {
    const menu = Menu.buildFromTemplate([
      {
        label: "Copy link",
        click: () => {
          clipboard.writeText(link);
        },
      },
    ]);
    menu.popup();
  });
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.electron");

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

      if (input.control && input.key === "=") {
        const zoomFactor = window.webContents.getZoomLevel();
        window.webContents.setZoomLevel(zoomFactor + 0.5);
        event.preventDefault();
      }
    });
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
