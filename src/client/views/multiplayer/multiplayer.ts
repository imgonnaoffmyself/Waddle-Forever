import { BrowserWindow, ipcMain } from "electron";
import path from "path";
import { SettingsManager } from "@server/settings";
import { GlobalSettings, makeUrl } from "@common/utils";
import { HTTP_PORT } from "@common/constants";

let multiplayerWindow: BrowserWindow | null;

export function getSiteUrl(settings: GlobalSettings, serverSettings: SettingsManager): string {
  if (settings.multiplayer.type === 'guest') {
    return makeUrl(settings.multiplayer.ip, settings.multiplayer.port ?? HTTP_PORT);
  } else {
    return makeUrl(serverSettings.targetIP, serverSettings.targetPort);
  }
}

/** Creates the window which allows changing which IP the client connects to */
export function createMultiplayerSettings(globalSettings: GlobalSettings, serverSettings: SettingsManager, mainWindow: BrowserWindow) {
  if (multiplayerWindow) {
    multiplayerWindow.focus();
    return;
  } 
  multiplayerWindow = new BrowserWindow({
    height: 330,
    width: 425,
    title: "Multiplayer Settings",
    webPreferences: {
      preload: path.join(__dirname, 'multiplayer-preload.js')
    },
    resizable: false,
    parent: mainWindow
  });

  multiplayerWindow.setMenu(null);

  multiplayerWindow.loadFile(path.join(__dirname, 'multiplayer.html'));

  multiplayerWindow.webContents.on('did-finish-load', () => {
    const multiplayerSettings: { type: string; ip?: string; port?: number } = { ...globalSettings.multiplayer };
    if (multiplayerSettings.type === 'host') {
      multiplayerSettings.ip = serverSettings.targetIP;
      multiplayerSettings.port = serverSettings.targetPort;
    } else if (multiplayerSettings.type === 'local') {
      if (!multiplayerSettings.ip && serverSettings.targetIP && serverSettings.targetIP !== '127.0.0.1') {
        multiplayerSettings.ip = serverSettings.targetIP;
      }
      if (multiplayerSettings.port === undefined && serverSettings.targetPort && serverSettings.targetPort !== HTTP_PORT) {
        multiplayerSettings.port = serverSettings.targetPort;
      }
    }
    multiplayerWindow?.webContents.send('get-info', multiplayerSettings);
  });

  multiplayerWindow.on('closed', () => {
    multiplayerWindow = null;
    ipcMain.removeAllListeners('update');
  });

  ipcMain.on('update', (_, arg) => {
    const { ip, port, type } = arg;
    const prevIp = ('ip' in globalSettings.multiplayer) ? globalSettings.multiplayer.ip : undefined;
    const prevPort = ('port' in globalSettings.multiplayer) ? globalSettings.multiplayer.port : undefined;
    const rememberedIp = ip ?? prevIp ?? (serverSettings.targetIP !== '127.0.0.1' ? serverSettings.targetIP : undefined);
    const rememberedPort = port ?? prevPort ?? (serverSettings.targetPort !== HTTP_PORT ? serverSettings.targetPort : undefined);

    switch (type) {
      case 'guest':
        globalSettings.multiplayer = { type: 'guest', ip: ip ?? rememberedIp ?? '', port };
        serverSettings.updateSettings({
          multiplayer: globalSettings.multiplayer
        });
        break;
      case 'local':
        serverSettings.targetPort = HTTP_PORT;
        serverSettings.targetIP = '127.0.0.1';
        globalSettings.multiplayer = { type: 'local', ip: rememberedIp, port: rememberedPort };
        serverSettings.updateSettings({
          multiplayer: globalSettings.multiplayer,
          targetIP: '127.0.0.1',
          targetPort: HTTP_PORT
        });
        break;
      case 'host':
        serverSettings.targetIP = ip ?? '127.0.0.1';
        serverSettings.targetPort = port ?? HTTP_PORT;
        globalSettings.multiplayer = { type: 'host', ip, port };
        serverSettings.updateSettings({
          multiplayer: globalSettings.multiplayer,
          targetIP: serverSettings.targetIP,
          targetPort: serverSettings.targetPort
        });
        break;
      default:
        throw new Error(`Unknown type in update: ${type}`);
    }
    mainWindow.loadURL(getSiteUrl(globalSettings, serverSettings));
  });
}