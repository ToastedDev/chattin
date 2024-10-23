import type { Message, Tab } from "@shared/types";

import { electronApp, is } from "@electron-toolkit/utils";
import { app, BrowserWindow, clipboard, ipcMain, Menu, shell } from "electron";
import { Masterchat, stringify } from "masterchat";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { join } from "node:path";

import icon from "../../resources/icon.png?asset";
import { getData, setData } from "./utils/data";
import { getChannel, getLatestStream, getVideo } from "./utils/scrapers";

let mainWindow: BrowserWindow;

function createWindow(): void {
  mainWindow = new BrowserWindow({
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

  async function getCurrentUser() {
    const data = await getData();
    return data.currentUser ?? null;
  }

  ipcMain.on("chat:start-stream", async (event, args) => {
    const [replyPort] = event.ports;

    const mc = await Masterchat.init(args.videoId, {
      credentials: (await getCurrentUser())?.token,
    });

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

  ipcMain.handle("tabs:add", async (_, tab: Tab) => {
    await setData((data) => {
      data.tabs ??= [];
      data.tabs.push(tab);
      return data;
    });
  });

  ipcMain.handle("context-menu:link", async (_, link) => {
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

  ipcMain.handle("context-menu:user", async (_) => {
    const menu = Menu.buildFromTemplate([
      {
        label: "Sign out",
        click: async () => {
          await setData((data) => {
            data.currentUser = undefined;
            return data;
          });
          mainWindow.webContents.send("auth:user-updated");
        },
      },
    ]);
    menu.popup();
  });

  ipcMain.handle("auth:current-user", () => getCurrentUser());
  ipcMain.handle("auth:sign-in", () => signInToYouTube());

  ipcMain.on("auth:recieved-token", (async (event: { token: string; id: string }) => {
    const channel = await getChannel(event.id);
    await setData((data) => {
      data.currentUser = {
        id: event.id,
        name: channel.name!,
        handle: channel.handle!,
        avatar: channel.avatar!,
        token: event.token,
      };
      return data;
    });
    mainWindow.webContents.send("auth:user-updated");
  }) as any);
}

async function signInToYouTube() {
  const authWindow = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
    parent: mainWindow,
  });

  authWindow.on("ready-to-show", () => {
    authWindow.show();
  });

  // @ts-expect-error type errors for some reason, though it works at runtime
  authWindow.webContents.on("did-finish-load", async (_) => {
    const url = authWindow.webContents.getURL();
    if (url === "https://www.youtube.com/") {
      const match = await authWindow.webContents.executeJavaScript(
        "/ytcfg\\.set\\(({.+?})\\);/.exec(document.head.innerHTML)",
        true,
      );
      const id = await authWindow.webContents.executeJavaScript(
        "ytInitialData.topbar.desktopTopbarRenderer.topbarButtons[0].topbarMenuButtonRenderer.menuRenderer.multiPageMenuRenderer.sections[0].multiPageMenuSectionRenderer.items[2].compactLinkRenderer.navigationEndpoint.browseEndpoint.browseId",
        true,
      );
      const sessionId = match
        ? JSON.parse(match[1]).DELEGATED_SESSION_ID
        : undefined;
      const ses = mainWindow.webContents.session;
      const cookies = await ses.cookies.get({});
      const creds = Object.fromEntries(
        cookies
          .filter(cookie =>
            ["APISID", "HSID", "SAPISID", "SID", "SSID"].includes(cookie.name),
          )
          .map(cookie => [cookie.name, cookie.value]),
      );
      const token = Buffer.from(
        JSON.stringify({ ...creds, DELEGATED_SESSION_ID: sessionId }),
      ).toString("base64");
      ipcMain.emit("auth:recieved-token", {
        token,
        id,
      });
      authWindow.close();
    }
  });

  await authWindow.loadURL(
    `https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=https://www.youtube.com/channel_switcher&uilel=3&hl=en&flowName=GlifWebSignIn&flowEntry=ServiceLogin${
      { userAgent: "Chrome" }}`,
  );
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
