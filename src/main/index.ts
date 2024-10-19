import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";

import icon from "../../resources/icon.png?asset";
import { getLiveChatContinuation, stringify, withContext } from "./youtube/utils";

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
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

  ipcMain.on("start-chat-stream", async (event, _args) => {
    const [replyPort] = event.ports;
    let timeout;
    let continuation: string | null = getLiveChatContinuation({
      channelId: "UCeGCG8SYUIgFO13NyOe6reQ",
      videoId: "L0jKCtHzkyE",
    });

    async function fetchYouTubeChat() {
      const res = await fetch(`https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": "en",
          "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36",
        },
        body: withContext({
          continuation,
        }),
      });
      const data = await res.json();
      const { continuationContents } = data;
      const actions = continuationContents.liveChatContinuation.actions;

      if (actions?.length > 0) {
        replyPort.postMessage(JSON.stringify({
          event: "messages",
          data: actions.filter(
            (action: any) => action.addChatItemAction && action.addChatItemAction.clientId,
          ).map((action: any) => ({
            id: action.addChatItemAction.item.liveChatTextMessageRenderer.id,
            content: stringify(action.addChatItemAction.item.liveChatTextMessageRenderer.message),
            author: {
              name: stringify(action.addChatItemAction.item.liveChatTextMessageRenderer.authorName),
            },
          })),
        }));
      }

      const continuationObj = Object.values<any>(continuationContents.liveChatContinuation.continuations[0])[0];

      continuation = continuationObj.continuation;
      timeout = setTimeout(fetchYouTubeChat, continuationObj.timeoutMs);
    }

    fetchYouTubeChat();

    replyPort.on("close", () => {
      if (timeout)
        clearTimeout(timeout);
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
    optimizer.watchWindowShortcuts(window);
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
