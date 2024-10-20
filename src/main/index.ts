import type { Message, Tab } from "@shared/types";

import { electronApp, is } from "@electron-toolkit/utils";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { Masterchat, stringify } from "masterchat";
import crypto from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
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

  function generateId(clientId: string): string {
    const combined = `${clientId}_${Date.now()}`;
    return crypto.createHash("md5").update(combined).digest("hex");
  }

  ipcMain.handle("get-channel", async (_, urlOrId) => {
    let url = urlOrId;

    if (urlOrId.startsWith("UC")) {
      url = `https://youtube.com/channel/${urlOrId}`;
    }

    const res = await fetch(url);
    const data = await res.text();

    // eslint-disable-next-line regexp/prefer-w
    const id = data.match(/<link itemprop="url" href="https:\/\/www\.youtube\.com\/channel\/([A-Za-z0-9\-_]+)"/)?.[1];

    if (!id) {
      throw new Error("Invalid channel URL");
    }

    return {
      id,
      name: data.match(/<meta itemprop="name" content="([^"]+)"/)?.[1],
    };
  });

  ipcMain.handle("get-video", async (_, urlOrId: string) => {
    let url = urlOrId;

    if (!urlOrId.includes("youtube.com") && !urlOrId.includes("youtu.be")) {
      url = `https://youtube.com/watch?v=${urlOrId}`;
    }

    const res = await fetch(url);
    const data = await res.text();

    return {
      id: urlOrId.includes("youtu.be") ? urlOrId.split("/").pop() : urlOrId.split("v=").pop()?.split("&").shift(),
      title: data.match(/<meta itemprop="name" content="([^"]+)"/)?.[1],
    };
  });

  ipcMain.handle("get-current-stream", async (_, channelId: string) => {
    const res = await fetch(`https://youtube.com/channel/${channelId}/streams`);
    const html = await res.text();
    const initialData = JSON.parse(
      `{${html.split("var ytInitialData = {")[1].split("};")[0]}}`,
    );
    const streams = initialData.contents.twoColumnBrowseResultsRenderer.tabs
      .find((tab: any) => tab.tabRenderer.title === "Live")
      ?.tabRenderer
      .content
      .richGridRenderer
      .contents
      .filter(
        (stream: any) =>
          !stream.richItemRenderer.content.videoRenderer.lengthText,
      )
      .map(
        (stream: any) => stream.richItemRenderer.content.videoRenderer.videoId,
      );

    return streams[0];
  });

  ipcMain.on("start-chat-stream", async (event, args) => {
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

  async function getData() {
    try {
      const data = await readFile(join(app.getPath("userData"), "data.json"), "utf-8");
      return JSON.parse(data);
    }
    catch {
      await writeFile(join(app.getPath("userData"), "data.json"), "{}");
      return {};
    }
  }

  async function setData(data) {
    await writeFile(join(app.getPath("userData"), "data.json"), JSON.stringify(data));
  }

  ipcMain.handle("get-tabs", async (_) => {
    const data = await getData();
    return data.tabs ?? [];
  });

  ipcMain.on("add-tab", async (_, tab: Tab) => {
    const data = await getData();
    data.tabs ??= [];
    data.tabs.push(tab);
    await setData(data);
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
