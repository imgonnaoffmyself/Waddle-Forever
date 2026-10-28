import { getGreenString, getYellowString, logverbose } from "@server/logger";
import { ClientSocket } from "@server/socket-server/socket-server";
import { WorldPenguin, isBot } from "@server/socket-server/world/world-penguin";
import { Messenger } from "./messenger";

const getXtMessageLastless = (handler: string, ...args: Array<number | string>): string => {
  return `%xt%${handler}%-1%` + args.join('%');
}

const getXtMessage = (handler: string, ...args: Array<number | string>): string => {
  return getXtMessageLastless(handler, ...args) + '%';
}

function isBotPacket(message: string, args: Array<string | number>): boolean {
  if (args.length === 0) return false;
  if (message === 'ap' || message === 'up') {
    const id = Number(String(args[0]).split('|')[0]);
    return isBot(id);
  }
  if (message === 'uw') {
    return args.length >= 4 && isBot(Number(args[3]));
  }
  const id = Number(args[0]);
  if (!Number.isNaN(id) && isBot(id)) {
    return true;
  }
  return false;
}

export class XtMessenger extends Messenger<WorldPenguin> {
  constructor() {
    super('\0');
  }

  isPenguin(p: unknown): p is WorldPenguin {
    return p instanceof WorldPenguin;
  }
  
  public async send(penguins: WorldPenguin | ClientSocket | Array<ClientSocket | WorldPenguin>, message: string, ...args: Array<string | number>): Promise<void> {
    logverbose(getGreenString('sending XT: '), message, args);

    if (isBotPacket(message, args)) {
      if (Array.isArray(penguins)) {
        penguins = penguins.filter(p => !this.isPenguin(p) || !p.deadInternet);
      } else if (this.isPenguin(penguins) && penguins.deadInternet) {
        if (message !== 'rp') {
          return;
        }
      }
    }

    await this.write(penguins, getXtMessage(message, ...args));
  }

  public async sendXml(client: ClientSocket, action: string, body: string, room?: number) {
    const roomString = room === undefined ? '' : ` r="${room}"`;
    const xml = `<msg t="sys"><body action="${action}"${roomString}>${body}</body></msg>`;
    logverbose(getYellowString('Sending XML: '), xml);
    await this.write(client, xml);
  }
}