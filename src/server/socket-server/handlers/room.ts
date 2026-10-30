import { getPenguinString } from "./join";
import { WorldPenguin } from "@server/socket-server/world/world-penguin";
import { WorldTable } from "@server/socket-server/world/world-table";
import { ROOMS } from "@server/game-data/rooms";
import { PenguinHandler, RoomContext, RoomGuard, RoomHandler } from "./handlers";
import { isLower } from "@server/routes/versions";
import { WorldRoom } from "@server/socket-server/world/world-room";
import { WaddleRoom } from "@server/socket-server/world/waddle-room";
import { WaddleGame } from "@server/socket-server/world/waddle-game";
import { GameData } from "@server/timelines/game-data";
import { isBot } from "@server/socket-server/world/bots";
import { checkProfanity, checkPII, formatBanExpiry } from "@server/moderation/filter";
import { evaluateMessage, classifyLocally, preBroadcastTracker, postBroadcastTracker, SEVERITY_RANK, ModerationSeverity } from "@server/moderation/localmod";
import { getCommandsHandler } from "@server/commands/commands";

export const handleSetPosition: RoomHandler<[number, number]> = ({ penguin, room, msg, data }, x, y) => {
  const state = room.getState(penguin);
  const isInitialPosition = state.x === 0 && state.y === 0;
  room.updatePosition(penguin, x, y);
  if (data.isSpOnJr() && isInitialPosition) {
    msg.send(room.players, 'ap', getPenguinString(data, penguin, { ...state, x, y }));
  } else {
    msg.send(room.players, 'sp', penguin.id, x, y);
  }
}

function hasSpecialDanceCombination(penguin: WorldPenguin): boolean {
  const equipped = [
    penguin.inventory.head,
    penguin.inventory.face,
    penguin.inventory.neck,
    penguin.inventory.body,
    penguin.inventory.hand,
    penguin.inventory.feet,
  ].filter(id => id > 0);

  equipped.sort((a, b) => a - b);
  const equippedStr = equipped.join(',');

  const validCombos = [
    '212',
    '171',
    '193',
    '3185',
    '3247',
    '171,212',
    '193,212',
    '212,3247'
  ];

  return validCombos.includes(equippedStr);
}

export const handleSetFrame: RoomHandler<[number]> = ({ penguin, room, msg }, frame) => {
  let finalFrame = frame;
  // If attempting to dance, check if they have the special dance clothing combo
  if (finalFrame === 26 && hasSpecialDanceCombination(penguin)) {
    finalFrame = 32;
  }
  
  room.updateFrame(penguin, finalFrame);
  msg.send(room.players, 'sf', penguin.id, finalFrame);
}

export const handleSetAction: RoomHandler<[string]> = ({ room, msg, penguin }, action) => {
  msg.send(room.players, 'sa', penguin.id, action);
}

export const handleSetSnowball: RoomHandler<[string, string]> = ({ room, msg, penguin, bot }, x, y) => {
  msg.send(room.players, 'sb', penguin.id, x, y);
  if (!isBot(penguin)) {
    bot?.onPlayerSnowball(room, penguin, Number(x), Number(y));
  }
}

export const handleSendEmote: RoomHandler<[string]> = ({ room, msg, penguin, data, world, bot }, emote) => {
  if (data.hasBakery() && room === world.bakery.room) {
    if (Number(emote) === world.bakery.emote) {
      world.bakery.incrementCheer();
    }
  }
  
  msg.send(room.players, 'se', penguin.id, emote);
  if (!isBot(penguin)) {
    bot?.onPlayerEmote(room, penguin, Number(emote));
  }
}

export const handleSendJoke: RoomHandler<[string]> = ({ room, msg, penguin }, joke) => {
  msg.send(room.players, 'sj', penguin.id, joke);
}

export const handleSendMessage: RoomHandler<[string, string]> = async (ctx, _penguinIdParam, message) => {
  const { room, msg, penguin, data, prst, client, world, db, settings, off, bot } = ctx;

  // In-game command execution via chat prefix '!'
  if (message.startsWith('!')) {
    const commandText = message.slice(1).trim();
    const commandMatch = commandText.match(/(\w+)(.*)/);
    if (commandMatch !== null) {
      const name = commandMatch[1];
      const argString = commandMatch[2].trim();
      const args = argString === '' ? [] : argString.split(/\s+/);
      const commandsHandler = getCommandsHandler();
      const res = commandsHandler.run({
        world,
        penguin,
        prst,
        msg,
        data,
        db,
        settings,
        off,
        client,
        room,
        bot: bot!
      }, name, args);
      msg.send(penguin, 'sm', 0, res || `Command '${name}' ran successfully`);
      return;
    }
  }

  if (!isBot(penguin)) {
    // Evaluate message before broadcast using local moderation classifier
    const preEval = classifyLocally(message);
    const profanity = checkProfanity(message);
    if (profanity.isSwear) {
      // Determine severity of profanity
      const isSevere = /\b(?:nigger|nigga|faggot|fag|cunt|kys|kill\s*your\s*self)\b/i.test(message);
      const swearSeverity: ModerationSeverity = isSevere ? 'critical' : 'high';
      if (SEVERITY_RANK[swearSeverity] > SEVERITY_RANK[preEval.severityLevel]) {
        preEval.flagged = true;
        preEval.severityLevel = swearSeverity;
        preEval.reason = `Inappropriate language: "${profanity.matchedWord ?? message}"`;
      }
    }

    if (preEval.flagged) {
      const takePreAction = preBroadcastTracker.shouldTakeAction(penguin.id, preEval);
      console.log(`[LocalMod Pre-Broadcast] Flagged message (${preEval.severityLevel}) from ${penguin.name}: "${message}" -> ${preEval.reason} (takeAction=${takePreAction})`);

      // Criteria:
      // - low: take no action
      // - medium: only take action after 3 mediums in a row or 3 mediums in 90 seconds
      // - high: only take action after 2 highs in a row or 2 highs in 60 seconds
      // - critical: take action immediately
      if (takePreAction) {
        const banExpiry = Date.now() + 24 * 60 * 60 * 1000;
        penguin.moderation.ban(banExpiry, `Moderator ban: ${preEval.reason}`);
        prst(penguin, true);

        // Display the ban screen with Pacific date/time as expected by the Flash client ban UI
        msg.send(penguin, 'e', 600, formatBanExpiry(banExpiry));

        // Allow the ban packet to be fully delivered so the client displays the ban modal
        setTimeout(() => {
          client.end();
        }, 700);
        return;
      }
    } else {
      preBroadcastTracker.recordSafeMessage(penguin.id);
    }

    // Check if player is currently muted by a moderator
    if (penguin.moderation.isMuted()) {
      // Muted: echo only to sender so bubble appears locally, but room never sees it
      msg.send(penguin, 'sm', _penguinIdParam, message);
      return;
    }

    // Check PII filter (Authentic Club Penguin silent drop)
    const pii = checkPII(message);
    if (pii.hasPII) {
      // Silently prevent broadcasting to other players in the room
      // Echo only to sender so the player's client shows their chat bubble normally
      msg.send(penguin, 'sm', _penguinIdParam, message);
      return;
    }
  }

  if (message.trim().toLowerCase() === "dead internet theory") {
    penguin.deadInternet = !penguin.deadInternet;
    if (penguin.deadInternet) {
      const bots = room.players.filter(p => isBot(p));
      bots.forEach(b => msg.send(penguin, 'rp', b.id));
    } else {
      const botStates = room.playerStates.filter(([p]) => isBot(p));
      botStates.forEach(([b, s]) => {
        msg.send(penguin, 'ap', getPenguinString(data, b, s));
      });
    }
  }

  // 1. BROADCAST TO ROOM FIRST
  msg.send(room.players, 'sm', _penguinIdParam, message);

  // 2. AFTER MESSAGE HAS ALREADY BEEN BROADCAST (LLM REVIEW):
  if (!isBot(penguin)) {
    // Check if there was a moderator in the room at the time it was said
    const modBot = room.players
      .filter(p => isBot(p))
      .map(p => bot?.getBot(p.id))
      .find(b => b !== undefined && (b.isModerator || b.isDev));

    const hasModeratorInRoom = Boolean(modBot);

    // Send off to LocalMod LLM for evaluation
    evaluateMessage(message).then((evalResult) => {
      if (evalResult.flagged) {
        const takeAction = postBroadcastTracker.shouldTakeAction(penguin.id, evalResult);
        console.log(`[LocalMod Post-Broadcast LLM] Flagged message (${evalResult.severityLevel}) from ${penguin.name} in room ${room.id}: "${message}" -> ${evalResult.reason} (takeAction=${takeAction})`);

        // Criteria:
        // - low: take no action
        // - medium: only take action after 3 mediums in a row or 3 mediums in 90 seconds
        // - high: only take action after 2 highs in a row or 2 highs in 60 seconds
        // - critical: take action immediately
        if (takeAction) {
          // If there was a moderator in the room at the time it was said, trigger a ban!
          if (hasModeratorInRoom) {
            const banExpiry = Date.now() + 24 * 60 * 60 * 1000;
            penguin.moderation.ban(banExpiry, `Moderator ban: ${evalResult.reason}`);
            prst(penguin, true);
            msg.send(penguin, 'e', 600, formatBanExpiry(banExpiry));
            setTimeout(() => {
              client.end();
            }, 700);
          }
        }
      } else {
        postBroadcastTracker.recordSafeMessage(penguin.id);
        // Safe message: run ambient bot dialogue triggers
        bot?.onPlayerChat(room, penguin, message);
      }
    }).catch((err) => {
      console.error('[LocalMod] Error during evaluation:', err);
      postBroadcastTracker.recordSafeMessage(penguin.id);
      bot?.onPlayerChat(room, penguin, message);
    });
  }
}

export const handleSafeMessage: RoomHandler<[string]> = ({ room, msg, penguin }, message) => {
  msg.send(room.players, 'ss', penguin.id, message);
}

export const handleSendLine: RoomHandler<[string]> = ({ room, msg, penguin }, line) => {
  msg.send(room.players, 'sl', penguin.id, line);
}

export const handleReportPlayer: RoomHandler<[number, number]> = ({ penguin, room, bot }, targetId, reasonId) => {
  const target = room.players.find(p => p.id === targetId);
  bot?.moderationManager.fileReport(
    penguin.id,
    targetId,
    room.id,
    `Player report (reason: ${reasonId})`,
    undefined,
    target,
    room
  );
}

export const handleGetWaddle: RoomHandler<[]> = ({ msg, penguin, room }) => {
  msg.send(penguin, 'gw', ...room.getWaddleRooms().map((w) => {
    return `${w.getId()}|${w.getSeats().map(p => {
      return p?.name ?? '';
    }).join(',')}`
  }))
}

/**
 * Seats a penguin in a waddle and starts the game once it is full.
 */
export const joinWaddle = (
  { msg, world, data }: Pick<RoomContext, 'msg' | 'world' | 'data'>,
  room: WorldRoom,
  waddle: WaddleRoom,
  penguin: WorldPenguin
): WaddleGame | undefined => {
  const seat = room.enterWaddleRoom(waddle, penguin);
  msg.send(penguin, 'jw', seat);
  msg.send(room.players, 'uw', waddle.getId(), seat, penguin.name, penguin.id);
  if (waddle.isFull()) {
    const players = waddle.getSeats().filter((p): p is WorldPenguin => p !== null);
    players.forEach(p => {
      room.removePenguin(p);
    });
    const game = world.getWaddleGame(waddle.getGame(), players);
    waddle.reset();

    // 2006 sled race notification for starting the game
    if (waddle.getGame() === 'sled' && data.isPreCpip()) {
      msg.send(players, 'sw', waddle.getId(), room.id, players.length);
    } else {
      msg.send(players, 'jg', game.roomId);
    }
    return game;
  }
  return undefined;
}

export const handleJoinWaddleGame: PenguinHandler<number[]> = (ctx) => {
  const { penguin, msg } = ctx;
  const gameRoomId = 'sled' in ctx ? ctx.sled.roomId : ('card' in ctx ? ctx.card.roomId : 999);
  msg.send(penguin, 'jx', gameRoomId);
}

export const handleJoinWaddle: RoomHandler<[number]> = (ctx, waddleId) => {
  const waddle = ctx.room.getWaddleRoom(waddleId);
  if (waddle !== undefined) {
    joinWaddle(ctx, ctx.room, waddle, ctx.penguin);
  }
}

export const handleLeaveWaddle: RoomHandler<[]> = ({ penguin, msg, room }) => {
  const waddleRoom = room.getWaddleRooms().find(room => room.getSeats().includes(penguin));
  if (waddleRoom === undefined) {
    return;
  }
  const seatIndex = waddleRoom.removePlayer(penguin);
  msg.send(room.players, 'uw', waddleRoom.getId(), seatIndex);
}

//TODO persistence for new players joining (was that actually a thing?)
export const handleAddToy: RoomHandler<[string]> = ({ msg, penguin, room }, toy) => {
  msg.send(room.players, 'at', penguin.id, toy);
}

export const handleAddToyOld: RoomHandler<[string, string]> = ({ msg, penguin, room }, toy, frame) => {
  msg.send(room.players, 'at', penguin.id, toy, frame);
}

export const handleCloseToy: RoomHandler<[]> = ({ msg, room, penguin }) => {
  msg.send(room.players, 'rt', penguin.id);
}

export const handlePlayerTransform: RoomHandler<[number]> = ({ msg, room, penguin }, avatarId) => {
  penguin.avatar.transform(avatarId);
  msg.send(room.players, 'spts', penguin.id, avatarId);
}

export const sendTeleportOld: RoomHandler<[number, number, number]> = ({ msg, penguin, room }, x, y, frame) => {
  room.updatePosition(penguin, x, y);
  room.updateFrame(penguin, frame);

  msg.send(room.players, 'st', x, y, frame);
}

export const handleGetTables: RoomHandler<number[]> = ({ msg, penguin, room }, ...tableIds) => {
  // return table occupancy counts for the requested table ids
  msg.send(penguin, 'gt', ...tableIds.map(id => {
    return `${id}|${room.getTable(id).getCount()}`;
  }));
}

export const handleJoinTable: RoomHandler<[number]> =({ msg, penguin, room }, tableId) => {
  const table = room.getTable(tableId);

  const before = table.getCount();

  const seatId = table.getSeatIndex(penguin) ?? table.assignSeatIndex(penguin);

  if (seatId !== WorldTable.TABLE_SPECTATOR_SEAT && before === 0) {
    table.reset();
  }
  if (seatId !== WorldTable.TABLE_SPECTATOR_SEAT) {
    const count = table.getCount();
    if (count !== before) {
      msg.send(room.players, 'ut', table.getId(), table.getCount())
    }
  }
  // the index here is 1 based
  const tableSeatId = seatId === WorldTable.TABLE_SPECTATOR_SEAT ? seatId : seatId + 1;
  msg.send(penguin, 'jt', tableId, tableSeatId);
}

export const handleLeaveTable: RoomHandler<[]> = ({ msg, room, penguin }) => {
  // old leave flow: free seat, broadcast count, and reset if empty
  const table = room.getPenguinTable(penguin);
  if (table !== null) {
    table.removePlayer(penguin);
    const count = table.getCount();
    msg.send(room.players, 'ut', table.getId(), table.getCount());
    if (count === 0) {
      table.reset();
    }
  }
}

function isTableId(tableId: number) {
  return WorldTable.FIND_FOUR_TABLE_IDS.has(tableId) || WorldTable.MANCALA_TABLE_IDS.has(tableId);
}

export const handleGetTableGame: RoomHandler<[string]> = ({ msg, room, penguin }, tableId) => {
  // resolve table id from context so spectators can re-open correctly
  let resolvedTableId = Number(tableId);
  if (!isTableId(resolvedTableId)) {
    const existingTable = room.getPenguinTable(penguin);
    if (existingTable !== null) {
      resolvedTableId = existingTable.getId();
    }
  }

  const table = room.getTable(resolvedTableId);
  const boardState = table.serializeBoard();

  msg.send(penguin, 'gz', ...table.getNames(), boardState);
}

export const handleJoinTableGame: RoomHandler<[]> = ({ msg, room, penguin }) => {
  // join the game instance after table seat selection
  const table = room.getPenguinTable(penguin);
  if (table !== null) {
    const currentSeat = table.getSeatIndex(penguin);
    let seatId;
    if (currentSeat !== undefined) {
      seatId = currentSeat;
    } else {
      seatId = table.assignSeatIndex(penguin);
    }

    table.setJoined(seatId);

    msg.send(penguin, 'jz', seatId);
    table.getSeats().forEach((seat, index) => {
      msg.send(penguin, 'uz', index, seat?.name ?? '');
    });

    msg.send(table.penguins, 'uz', seatId, penguin.name);

    // start the match when both players have joined
    if (!table.hasStarted()) {
      if (table.hasEveryoneJoined()) {
        table.setStarted();
        msg.send(table.penguins, 'sz', table.getTurn())
      }
      return;
    }
  }
}

export const handleLeaveTableGame: RoomHandler<[]> = ({ msg, room, penguin }) => {
  // leave the active game: spectators just close, players clear seats/reset
  const table = room.getPenguinTable(penguin);

  if (table !== null) {
    const seat = table.getSeatIndex(penguin);
    if (seat === WorldTable.TABLE_SPECTATOR_SEAT) {
      table.removeSpectator(penguin);
      msg.send(penguin, 'lz');
      return;
    }
    if (!table.hasStarted()) {
      if (seat !== undefined) {
        table.removePlayer(penguin);
        msg.send(table.penguins, 'uz', seat, '');
      }
      const count = table.getCount();
      msg.send(room.players, 'ut', table.getId(), table.getCount());
      if (count === 0) {
        table.reset();
      }
      return;
    }
    msg.send(table.penguins, 'cz', penguin.name);
    table.resetRound();
    msg.send(room.players, 'ut', table.getId(), table.getCount());
  }
}

export const sendTableMove = (data: GameData, table: WorldTable, room: WorldRoom, moves: number[]) => {
  const [endArgs, args] = table.sendMove(moves);
  const msgs: Array<[WorldPenguin | WorldPenguin[], string, Array<string | number>]> = [];
      
  // Ignore non-table zm packets (e.g. sled racing uses 4 args).
  if (table.getAutomaticTurnChange()) {
    table.changeTurn();
  }
  if (args !== null) {
    msgs.push([table.penguins, 'zm', args]);
  }
  if (endArgs !== null) {
    // end args is pre-cpip thing
    // post-cpip: regular player coins
    if (data.isPreCpip()) {
      table.blockSpectators();
      msgs.push([table.penguins, 'zo', endArgs]);
    } else {
      table.penguins.forEach(p => 
        msgs.push([p, 'zo', [p.currency.coins]])
      );
    }
    msgs.push([room.players, 'ut', [table.getId(), table.getCount()]]);
    table.resetRound();
  }

  return msgs;
}

export const handleSendTableMove: RoomHandler<number[]> = ({ msg, room, penguin, data }, ...moves) => {
  // dispatch board moves for find four or mancala
  const table = room.getPenguinTable(penguin);
  if (table !== null) {
    if (!table.hasStarted() || table.hasEnded()) {
      return;
    }
    const seat = table.getSeatIndex(penguin);
    if (seat === undefined || seat === WorldTable.TABLE_SPECTATOR_SEAT || !table.hasJoined(seat)) {
      return;
    }
    const player = seat;
    if (player !== 0 && player !== 1) {
      return;
    }
    if (table.getTurn() !== player) {
      return;
    }

    // table game specific logic
    if (moves.length === table.getMoveLength()) {
      const msgs = sendTableMove(data, table, room, moves);
      msgs.forEach(([p, m, a]) => msg.send(p, m, ...a));
    }
  }  
}

export const handleUpdatePenguinOld: RoomHandler<[number, number, number, number, number, number, number, number, number]> = ({ penguin, room, msg, data, prst }, color, head, face, neck, body, hand, feet, pin, background) => {
  penguin.inventory.updateWear({
    color,
    head,
    face,
    neck,
    body,
    hand,
    feet,
    pin,
    background
  });

  msg.send(room.players, 'up', getPenguinString(data, penguin, room.getState(penguin)));

  prst(penguin);
}

export const handleUpdateColor: RoomHandler<[number]> = ({ room, msg, penguin, prst }, id) => {
  penguin.inventory.updateWear({ color: id });
  msg.send(room.players, 'upc', penguin.id, id);
  prst(penguin);
}

export const handleUpdateHead: RoomHandler<[number]> = ({ room, msg, penguin, prst }, id) => {
  penguin.inventory.updateWear({ head: id });
  msg.send(room.players, 'uph', penguin.id, id);
  prst(penguin);
}

export const handleUpdateFace: RoomHandler<[number]> = ({ room, msg, penguin, prst }, id) => {
  penguin.inventory.updateWear({ face: id });
  msg.send(room.players, 'upf', penguin.id, id);
  prst(penguin);
}

export const handleUpdateNeck: RoomHandler<[number]> = ({ room, msg, penguin, prst }, id) => {
  penguin.inventory.updateWear({ neck: id });
  msg.send(room.players, 'upn', penguin.id, id);
  prst(penguin);
}

export const handleUpdateBody: RoomHandler<[number]> = ({ room, msg, penguin, prst }, id) => {
  penguin.inventory.updateWear({ body: id });
  msg.send(room.players, 'upb', penguin.id, id);
  prst(penguin);
}

export const handleUpdateHand: RoomHandler<[number]> = ({ room, msg, penguin, prst }, id) => {
  penguin.inventory.updateWear({ hand: id });
  msg.send(room.players, 'upa', penguin.id, id);
  prst(penguin);
}

export const handleUpdateFeet: RoomHandler<[number]> = ({ room, msg, penguin, prst }, id) => {
  penguin.inventory.updateWear({ feet: id });
  msg.send(room.players, 'upe', penguin.id, id);
  prst(penguin);
}

export const handleUpdatePin: RoomHandler<[number]> = ({ room, msg, penguin, prst }, id) => {
  penguin.inventory.updateWear({ pin: id });
  msg.send(room.players, 'upl', penguin.id, id);
  prst(penguin);
}

export const handleUpdateBackground: RoomHandler<[number]> = ({ room, msg, penguin, prst  }, id) => {
  penguin.inventory.updateWear({ background: id });
  msg.send(room.players, 'upp', penguin.id, id);
  prst(penguin);
}

export const handleGetHockeyGame: RoomHandler<[]> = ({ world, room, penguin, msg, data }) => {
  const pos = world.getPuck(room);
  if (pos !== null) {
    if (room.id === 802 && data.isPreCpip() && isLower(data.getDate(), '2006-08-11')) {
      msg.send(penguin, 'gz', ...pos);
      return;
    }

    msg.send(penguin, 'gz', ...pos, ...world.teamScores);
  }
}

export const handleMoveHockeyPuck: RoomHandler<[number, number, number, number, number]> = ({ world, room, msg }, penguinId, x, y, ...speed) => {
  if (world.updatePuck(x, y, room)) {
    msg.send(room.players, 'zm', penguinId, x, y, ...speed);
  }
}

export const handleMoveHockeyPuckOld: RoomHandler<[number, number]> = ({ world, room, msg }, x, y) => {
  if (world.updatePuck(x, y, room)) {
    msg.send(room.players, 'zm', x, y);
  }
}

export const handleUpdateHockeyGame: RoomHandler<[number]> = ({ msg, room, world }, team) => {
  if (room.id !== 802) {
    return;
  }

  world.updateTeamScore(team);
  msg.send(room.players, 'uz', ...world.teamScores);
}

export const isTableGuard: RoomGuard = ({ room }) => {
  return room.hasTable();
}

export const isHockeyGuard: RoomGuard = ({ room }) => {
  return room.id === ROOMS.rink.id || room.id === ROOMS.pitch.id
}
export const handleTeleport: RoomHandler<[number, number]> = ({ msg, room, penguin }, x, y) => {
  msg.send(room.players, 'tp', penguin.id, x, y);
}
