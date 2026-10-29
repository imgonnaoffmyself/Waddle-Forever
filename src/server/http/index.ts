import express from 'express';

import { FileServer } from "@server/file-server";
import { SettingsManager } from "@server/settings";
import { GameData } from "@server/timelines/game-data";
import { HTTP_PORT } from '@common/constants';
import { PhpServer } from './php-server';
import { PenguinRepository } from '@server/database/database';
import { ModManager } from '@server/mods';
import { WorldServer } from '@server/socket-server/world-server';
import { createMembershipRouter } from './membership-web';

export class HttpServer {
  private fileServer: FileServer;
  private phpServer: PhpServer;

  constructor(
    private gameData: GameData,
    private settings: SettingsManager,
    private db: PenguinRepository,
    private mods: ModManager,
    private worldServer?: WorldServer
  ) {
    this.fileServer = new FileServer(gameData, settings, mods);
    this.phpServer = new PhpServer(settings, db, gameData);
  }

  public async setupServer() {
    const app = express();
    app.use(createMembershipRouter(this.gameData, this.settings, this.db, this.worldServer));
    app.use(this.fileServer.getExpressRouter());
    app.use(this.phpServer.getExpressRouter());

    await new Promise<void>((resolve, reject) => {
      app.listen(HTTP_PORT, () => {
        console.log(`HTTP server listening on port ${HTTP_PORT}`);
        resolve();
      }).on('error', (err) => {
        reject(err)
      })
    })
  }
}