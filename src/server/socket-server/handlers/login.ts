import { XtMessenger } from "../xt-messenger";
import { ClientSocket } from "@server/socket-server/socket-server";
import { getDefaultPenguin } from "@server/database/database";
import { isLower } from "@server/routes/versions";
import { logdebug } from "@server/logger";
import { WorldPenguin } from "@server/socket-server/world/world-penguin";
import serverList, { getServerPopulation } from "@server/servers";
import { LoginContext } from "@server/socket-server/xml-handler";
import { hashPassword, verifyPassword } from "@server/auth/password";
import { getBanStatus } from "@server/moderation/filter";

const STARTING_COINS_CHANGE_DATE = '2008-07-15';

function getStartingCoins(version: string): number {
  return isLower(version, STARTING_COINS_CHANGE_DATE) ? 100 : 500;
}

export function sendError(msg: XtMessenger, p: WorldPenguin | ClientSocket | Array<WorldPenguin | ClientSocket>, error: number) {
  msg.send(p, 'e', error);
}

type LoginHandler = (ctx: LoginContext, message: string) => void;

export const filePolicy: LoginHandler = ({ client }) => {
  client.end('<cross-domain-policy><allow-access-from domain="*" to-ports="*" /></cross-domain-policy>');
};

export const checkVersion: LoginHandler = ({ msg, client }) => {
  // version checking
  // this is irrelevant for us, we just always send an OK response
  msg.sendXml(client, 'apiOK', '', 0);
}

export const getKey: LoginHandler = ({ msg, client }) => {
  // random key generation
  // this is used for authentication, so it is not needed for us, we just send any key
  msg.sendXml(client, 'rndK', '<k>key</k>', -1);
}

export const login: LoginHandler = async (ctx, message: string) => {
  const { msg, data, settings, db, client } = ctx;

  const joinMatch = message.match(/<login z='j'>/);
  if (data.isPreCpip() && joinMatch) {
    // join.swf sends 'j' as the login
    msg.sendXml(client, 'logOK', '');
    return;
  }

  const nicknameMatch = message.match(/<nick><!\[CDATA\[(.*)\]\]><\/nick>/);
  if (nicknameMatch === null) {
    logdebug('No nickname provided during Login, terminating.');
  } else {
    const nickname = data.isPreCpip() ? nicknameMatch[1].replace(/_/g, ' ') : nicknameMatch[1];
    const passwordMatch = message.match(/<pword><!\[CDATA\[(.*)\]\]><\/pword>/);
    const password = passwordMatch ? passwordMatch[1] : '';

    // in the LOGIN world of modern clients, nickname -> ID
    // everywhere else, nickname -> name

    // account creation only happens when given name, not when given ID
    const modernLogin = ('world' in ctx && data.isVanillaEngine());
    if (!modernLogin) {
      if (!await db.exists(nickname)) {
        if (settings.settings.no_create_via_login) {
          sendError(msg, client, 100);
          return;
        }

        const passwordHash = password ? await hashPassword(password) : undefined;
        const json = getDefaultPenguin(
          nickname,
          1 /* blue */,
          settings.settings.always_member,
          settings.getVirtualDate(0).getTime(),
          settings.settings.version,
          passwordHash
        );
        await db.create(json);
      } else {
        const idLookup = await db.fromName(nickname);
        if (idLookup !== null) {
          const [existId, existJson] = idLookup;
          if (!existJson.password_hash) {
            if (password) {
              existJson.password_hash = await hashPassword(password);
              await db.update(existId, existJson);
            }
          } else {
            const valid = await verifyPassword(password, existJson.password_hash);
            if (!valid) {
              sendError(msg, client, 101);
              return;
            }
          }

          const banStatus = getBanStatus(existJson);
          if (banStatus.banned) {
            msg.send(client, 'e', 600, banStatus.remainingHours);
            return;
          }
        }
      }
    }

    const idTest = modernLogin ? Number(nickname.split('|')[0]) : await db.fromName(nickname);
    if (idTest === null) {
      throw new Error(`Could not find penguin with name: ${nickname}`);
    }
    const id = typeof idTest === 'number' ? idTest : idTest[0];

    if ('world' in ctx) {
      const offline = await ctx.off.getPenguin(id);
      if (offline === undefined) {
        throw new Error('Couldn\'t find penguin');
      }
      const offlineJson = offline.getJSON();
      const banStatus = getBanStatus(offlineJson);
      if (banStatus.banned) {
        msg.send(client, 'e', 600, banStatus.remainingHours);
        client.end();
        return;
      }
      const p = new WorldPenguin(id, offlineJson, settings, data);
      ctx.off.removePenguin(offline.id);
      ctx.world.addPenguin(p);
      msg.linkClient(client, p);
      console.log(`${p.name} is logging in (world)`);
    } else {
      console.log(`${nickname} is logging in`);
    }
    /*
    TODO
    buddies
    how will server size be handled after NPCs?
    */
    // information regarding how many populations are in each server
    msg.send(
      client,
      'l',
      data.isVanillaEngine() ? [
        // id, swid, username, login key
        id, id, nickname, id
      ].join('|') : id,
      id,
      '',
      serverList.map((server) => {
        const population = server.name === 'Blizzard' ? 5 : getServerPopulation()
        return `${server.id},${population}`;
      }).join('|')
    );
  }
}
