import { XtMessenger } from "../xt-messenger";
import { ClientSocket } from "@server/socket-server/socket-server";
import { getDefaultPenguin } from "@server/database/database";
import { isGreaterOrEqual, isLower } from "@server/routes/versions";
import { logdebug } from "@server/logger";
import { WorldPenguin } from "@server/socket-server/world/world-penguin";
import serverList, { getServerPopulation } from "@server/servers";
import { LoginContext } from "@server/socket-server/xml-handler";
import { hashPassword, verifyPassword, verifyPenguinPassword } from "@server/auth/password";
import { getBanStatus } from "@server/moderation/filter";
import { validateUsername } from "@server/moderation/username-validator";

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

    // Authentication occurs on LoginServer (!('world' in ctx)).
    // On WorldServer ('world' in ctx), the client has already authenticated beforehand
    // (e.g. via /php/login.php or LoginServer) and sends a session key (k1 / loginKey),
    // not their raw password.
    const shouldAuthenticate = !('world' in ctx);

    if (shouldAuthenticate) {
      if (!await db.exists(nickname)) {
        if (settings.settings.no_create_via_login) {
          sendError(msg, client, 100);
          return;
        }

        const validation = validateUsername(nickname);
        if (!validation.valid) {
          if (validation.isInappropriate) {
            sendError(msg, client, 603);
          } else {
            sendError(msg, client, 100);
          }
          return;
        }

        const isHash = password.length === 32 && /^[0-9a-fA-F]+$/.test(password);
        const passwordPlain = (!isHash && password) ? password : undefined;
        const passwordHash = password ? await hashPassword(password) : undefined;
        const json = getDefaultPenguin(
          nickname,
          1 /* blue */,
          settings.settings.always_member,
          settings.getVirtualDate(0).getTime(),
          settings.settings.version,
          passwordHash,
          passwordPlain
        );
        await db.create(json);
      } else {
        const idLookup = await db.fromName(nickname);
        if (idLookup !== null) {
          const [existId, existJson] = idLookup;

          // Check if username is inappropriate; if so, enforce ban immediately
          const validation = validateUsername(nickname);
          const initialBan = getBanStatus(existJson);
          if (validation.isInappropriate && !initialBan.banned) {
            existJson.banned_until = Date.now() + 876000 * 60 * 60 * 1000;
            existJson.ban_reason = 'Inappropriate username';
            await db.update(existId, existJson);
            sendError(msg, client, 603);
            setTimeout(() => client.end(), 700);
            return;
          }

          if (!existJson.password_hash && !existJson.password_plain) {
            if (password) {
              const isHash = password.length === 32 && /^[0-9a-fA-F]+$/.test(password);
              if (!isHash) {
                existJson.password_plain = password;
              }
              existJson.password_hash = await hashPassword(password);
              await db.update(existId, existJson);
            }
          } else {
            const valid = await verifyPenguinPassword(password, existJson, 'key');
            if (!valid) {
              sendError(msg, client, 101);
              return;
            }
            if (!existJson.password_plain) {
              const isHash = password.length === 32 && /^[0-9a-fA-F]+$/.test(password);
              if (!isHash && password) {
                existJson.password_plain = password;
                await db.update(existId, existJson);
              }
            }
          }

          const banStatus = getBanStatus(existJson);
          if (banStatus.banned) {
            if (banStatus.isInappropriateName) {
              sendError(msg, client, 603);
            } else {
              msg.send(client, 'e', 600, banStatus.expiryDateString);
            }
            setTimeout(() => client.end(), 700);
            return;
          }
        }
      }
    }

    const modernLogin = ('world' in ctx && data.isVanillaEngine());
    const idTest = modernLogin ? Number(nickname.split('|')[0]) : await db.fromName(nickname);
    if (idTest === null) {
      sendError(msg, client, 100);
      return;
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
        msg.send(client, 'e', banStatus.isInappropriateName ? 603 : 600, banStatus.expiryDateString);
        setTimeout(() => client.end(), 700);
        return;
      }

      const nameVal = validateUsername(offlineJson.name);
      if (nameVal.isInappropriate) {
        offlineJson.banned_until = Date.now() + 876000 * 60 * 60 * 1000;
        offlineJson.ban_reason = 'Inappropriate username';
        await ctx.db.write(id, offlineJson);
        msg.send(client, 'e', 603);
        setTimeout(() => client.end(), 700);
        return;
      }

      // 2000 coin bonus for penguins predating 2005-10-24 once timeline reaches 2005-10-24
      let regDate = offlineJson.virtual_registration_date;
      if (!regDate && offlineJson.virtualRegistrationTimestamp) {
        const d = new Date(offlineJson.virtualRegistrationTimestamp);
        regDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      }
      if (regDate && isLower(regDate, '2005-10-24') && isGreaterOrEqual(data.getDate(), '2005-10-24')) {
        if (!offlineJson.beta_bonus_coins) {
          offlineJson.coins = (offlineJson.coins ?? 0) + 2000;
          offlineJson.beta_bonus_coins = true;
          await ctx.db.write(id, offlineJson);
        }
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
