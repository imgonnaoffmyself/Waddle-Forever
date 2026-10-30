import path from 'path';
import { BrowserWindow, dialog, shell } from "electron";
import { Store } from "./store";
import { checkUpdates } from "./update";
import { GlobalSettings } from '../common/utils';
import { SettingsManager } from '../server/settings';
import { getSiteUrl } from './views/multiplayer/multiplayer';
import { HTTP_PORT } from '../common/constants';

const faviconPaths = {
  win32: "../assets/favicon.ico",
  darwin: "../assets/icon.png",
  linux: "../assets/icon.png"
}

function getIP(clientSettings: GlobalSettings, serverSettings: SettingsManager) {
  if (clientSettings.multiplayer.type === 'guest') {
    return clientSettings.multiplayer.ip;
  }
  return serverSettings.targetIP;
}

export const toggleFullScreen = (store: Store, mainWindow: BrowserWindow) => {
  const fullScreen = !store.private.get("fullScreen");

  store.private.set("fullScreen", fullScreen);

  mainWindow.setFullScreen(fullScreen);
};

export const loadMain = (window: BrowserWindow, settings: GlobalSettings, serverSettings: SettingsManager) => {
  window.loadURL(getSiteUrl(settings, serverSettings));    
}

export const createWindow = async (store: Store, clientSettings: GlobalSettings, serverSettings: SettingsManager) => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    title: "Loading...",
    webPreferences: {
      plugins: true,
    },
  });

  mainWindow.setIcon(path.join(__dirname, faviconPaths[process.platform]));
  
  mainWindow.setMenu(null);
  mainWindow.maximize();
  
  checkUpdates(mainWindow, serverSettings);

  loadMain(mainWindow, clientSettings, serverSettings);

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const targetIp = getIP(clientSettings, serverSettings);
    const isAllowed = url.includes('localhost') ||
                      url.includes('127.0.0.1') ||
                      (Boolean(targetIp) && url.includes(targetIp));
    if (!isAllowed) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.on('did-fail-load', async (_event, errorCode, _errorDescription, validatedURL) => {
    if (errorCode === -3) return; // ERR_ABORTED

    if (clientSettings.multiplayer.type === 'guest') {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Switch to Local', 'Retry'],
        defaultId: 0,
        title: 'Connection Failed',
        message: `Could not connect to multiplayer server at ${validatedURL}.\n\nWould you like to switch to Local mode?`
      });

      if (result.response === 0) {
        const lastIp = clientSettings.multiplayer.ip;
        const lastPort = clientSettings.multiplayer.port;
        clientSettings.multiplayer = { type: 'local', ip: lastIp, port: lastPort };
        serverSettings.targetIP = '127.0.0.1';
        serverSettings.targetPort = HTTP_PORT;
        serverSettings.updateSettings({
          multiplayer: clientSettings.multiplayer,
          targetIP: '127.0.0.1',
          targetPort: HTTP_PORT
        });
        loadMain(mainWindow, clientSettings, serverSettings);
      } else {
        loadMain(mainWindow, clientSettings, serverSettings);
      }
    }
  });

  return mainWindow;
};
