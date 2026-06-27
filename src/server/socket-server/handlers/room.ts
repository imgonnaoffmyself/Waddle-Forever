import { getPenguinString } from "./join";
import { WorldPenguin } from "@server/socket-server/world/world-penguin";
import { WorldTable } from "@server/socket-server/world/world-table";
import { ROOMS } from "@server/game-data/rooms";
import { RoomGuard, RoomHandler } from "./handlers";
import { isLower } from "@server/routes/versions";

export const handleSetPosition: RoomHandler<[number, number]> = ({ penguin, room, msg }, x, y) => {
  room.updatePosition(penguin, x, y);
  msg.send(room.players, 'sp', penguin.id, x, y);
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

export const handleSetSnowball: RoomHandler<[string, string]> = ({ room, msg, penguin, npc }, x, y) => {
  msg.send(room.players, 'sb', penguin.id, x, y);
  npc?.onPlayerSnowball(room, penguin, Number(x), Number(y));
}

export const handleSendEmote: RoomHandler<[string]> = ({ room, msg, penguin, data, world, npc }, emote) => {
  if (data.hasBakery() && room === world.bakery.room) {
    if (Number(emote) === world.bakery.emote) {
      world.bakery.incrementCheer();
    }
  }
  
  msg.send(room.players, 'se', penguin.id, emote);
  // Let NPCs react to the emote
  npc?.onPlayerEmote(room, penguin, Number(emote));
}

export const handleSendJoke: RoomHandler<[string]> = ({ room, msg, penguin }, joke) => {
  msg.send(room.players, 'sj', penguin.id, joke);
}

export const handleSendMessage: RoomHandler<[string, string]> = ({ room, msg, penguin, npc }, _penguinIdParam, message) => {
  msg.send(room.players, 'sm', _penguinIdParam, message);
  // Let NPCs react to the player's chat
  npc?.onPlayerChat(room, penguin, message);
}

export const handleSafeMessage: RoomHandler<[string]> = ({ room, msg, penguin }, message) => {
  msg.send(room.players, 'ss', penguin.id, message);
}

export const handleSendLine: RoomHandler<[string]> = ({ room, msg, penguin }, line) => {
  msg.send(room.players, 'sl', penguin.id, line);
}

export const handleGetWaddle: RoomHandler<[]> = ({ msg, penguin, room }) => {
  msg.send(penguin, 'gw', ...room.getWaddleRooms().map((w) => {
    return `${w.getId()}|${w.getSeats().map(p => {
      return p?.name ?? '';
    }).join(',')}`
  }))
}

export const handleJoinWaddle: RoomHandler<[number]> = ({ msg, penguin, room, world, data }, waddleId) => {
  const waddle = room.getWaddleRoom(waddleId);
  if (waddle !== undefined) {
    const seat = room.enterWaddleRoom(waddle, penguin);
    msg.send(penguin, 'jw', seat);
    msg.send(room.players, 'uw', waddleId, seat, penguin.name, penguin.id);
    if (waddle.isFull()) {
      const players = waddle.getSeats().filter((p): p is WorldPenguin => p !== null);
      players.forEach(p => {
        room.removePenguin(p);
      });
      const game = world.getWaddleGame(waddle.getGame(), players);
      waddle.reset();
      msg.send(players, 'jg', game.roomId);

      // 2006 sled race notification for starting the game
      if (waddle.getGame() === 'sled' && data.isPreCpip()) {
        msg.send(players, 'sw', waddle.getId(), room.id, players.length);
      }
    }
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

export const handleJoinTable: RoomHandler<[number]> =({ msg, penguin, room, npc }, tableId) => {
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

    // If this is the only player at a Mancala table, invite an NPC after a short delay
    if (before === 0 && WorldTable.MANCALA_TABLE_IDS.has(tableId) && npc) {
      const delay = Math.floor(Math.random() * 4000) + 2000; // 2-6 seconds
      console.log(`[jt] Player "${penguin.name}" sat at mancala table ${tableId}. NPC will be invited in ${delay}ms.`);
      setTimeout(() => {
        // Only proceed if the player is still alone (no one else joined in the meantime)
        const curCount = table.getCount();
        const curStarted = table.hasStarted();
        console.log(`[jt-timer] Mancala table ${tableId}: count=${curCount}, started=${curStarted} — will invite NPC? ${curCount === 1 && !curStarted}`);
        if (curCount === 1 && !curStarted) {
          npc.onPlayerJoinedMancala(room, table);
        }
      }, delay);
    }
  }
  // the index here is 1 based
  const tableSeatId = seatId === WorldTable.TABLE_SPECTATOR_SEAT ? seatId : seatId + 1;
  msg.send(penguin, 'jt', tableId, tableSeatId);
}

export const handleLeaveTable: RoomHandler<[]> = ({ msg, room, penguin, npc }) => {
  // old leave flow: free seat, broadcast count, and reset if empty
  const table = room.getPenguinTable(penguin);
  if (table !== null) {
    table.removePlayer(penguin);

    // If only an NPC is left, kick them too
    if (npc && WorldTable.MANCALA_TABLE_IDS.has(table.getId())) {
      const seats = table.getSeats();
      const npcOpp = seats.find(s => s !== null && !(s instanceof WorldPenguin));
      if (npcOpp) {
        npc.fireMancalaAbortedReaction(npcOpp as any, room);
        npc.releaseMancalaNpc(npcOpp as any);
        table.removePlayer(npcOpp as any);
      }
    }

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

  if (WorldTable.MANCALA_TABLE_IDS.has(resolvedTableId)) {
    console.log(`[gz] Player "${penguin.name}" requested table ${resolvedTableId}. names=${JSON.stringify(table.getNames())}, board="${boardState}", seats=${JSON.stringify(table.getSeats().map(s => s?.name ?? null))}, joined=${JSON.stringify((table as any).joined)}, started=${table.hasStarted()}`);
  }

  msg.send(penguin, 'gz', ...table.getNames(), boardState);
}

export const handleJoinTableGame: RoomHandler<[]> = ({ msg, room, penguin, npc }) => {
  // join the game instance after table seat selection
  const table = room.getPenguinTable(penguin);
  console.log(`[jz] Player "${penguin.name}" sent jz. table=${table?.getId() ?? 'null'}, isMancala=${table ? WorldTable.MANCALA_TABLE_IDS.has(table.getId()) : false}`);
  if (table !== null) {
    const currentSeat = table.getSeatIndex(penguin);
    let seatId;
    if (currentSeat !== undefined) {
      seatId = currentSeat;
    } else {
      seatId = table.assignSeatIndex(penguin);
    }

    table.setJoined(seatId);
    console.log(`[jz] table=${table.getId()}, seatId=${seatId}, joined=${JSON.stringify((table as any).joined)}, everyoneJoined=${table.hasEveryoneJoined()}, started=${table.hasStarted()}, seats=${JSON.stringify(table.getSeats().map(s => s?.name ?? null))}`);

    msg.send(penguin, 'jz', seatId);
    table.getSeats().forEach((seat, index) => {
      msg.send(penguin, 'uz', index, seat?.name ?? '');
    });

    msg.send(table.realPlayers, 'uz', seatId, penguin.name);

    // start the match when both players have joined
    if (!table.hasStarted()) {
      if (table.hasEveryoneJoined()) {
        console.log(`[jz] Both joined — starting game on table ${table.getId()}, turn=${table.getTurn()}`);
        table.setStarted();
        msg.send(table.realPlayers, 'sz', table.getTurn());

        // If the first turn belongs to an NPC, trigger their move loop
        const firstTurnSeatId = table.getTurn();
        const firstTurnPlayer = table.getSeats()[firstTurnSeatId];
        if (firstTurnPlayer && !(firstTurnPlayer instanceof WorldPenguin)) {
          console.log(`[jz] First turn is NPC "${firstTurnPlayer.name}" at seat ${firstTurnSeatId} — firing NPC turn`);
          npc?.handleMancalaTurn(firstTurnPlayer as any, room, table.getId());
        }
      } else {
        console.log(`[jz] Not everyone joined yet on table ${table.getId()}, waiting...`);
      }
      return;
    }
    console.log(`[jz] Table ${table.getId()} already started — ignoring`);
  }
}

export const handleLeaveTableGame: RoomHandler<[]> = ({ msg, room, penguin, npc }) => {
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
        msg.send(table.realPlayers, 'uz', seat, '');
      }

      // If only an NPC is left, kick them too
      if (npc && WorldTable.MANCALA_TABLE_IDS.has(table.getId())) {
        const seats = table.getSeats();
        const npcOpp = seats.find(s => s !== null && !(s instanceof WorldPenguin));
        if (npcOpp) {
          npc.fireMancalaAbortedReaction(npcOpp as any, room);
          npc.releaseMancalaNpc(npcOpp as any);
          table.removePlayer(npcOpp as any);
        }
      }

      const count = table.getCount();
      msg.send(room.players, 'ut', table.getId(), table.getCount());
      if (count === 0) {
        table.reset();
      }
      return;
    }
    msg.send(table.realPlayers, 'cz', penguin.name);
    
    // Release NPC if one was at the table
    if (npc && WorldTable.MANCALA_TABLE_IDS.has(table.getId())) {
      const seats = table.getSeats();
      const npcOpp = seats.find(s => s !== null && !(s instanceof WorldPenguin));
      if (npcOpp) {
        npc.fireMancalaAbortedReaction(npcOpp as any, room);
        npc.releaseMancalaNpc(npcOpp as any);
      }
    }

    table.resetRound();
    msg.send(room.players, 'ut', table.getId(), table.getCount());
  }
}

export const handleSendTableMove: RoomHandler<number[]> = ({ msg, room, penguin, data, npc }, ...moves) => {
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
      if (WorldTable.MANCALA_TABLE_IDS.has(table.getId())) {
        console.log(`[zm] Player "${penguin.name}" move: table=${table.getId()}, seat=${seat}, moves=${JSON.stringify(moves)}, board="${table.serializeBoard()}"`);
      }
      const [endArgs, args] = table.sendMove(moves);
      
      // Ignore non-table zm packets (e.g. sled racing uses 4 args).
      if (table.getAutomaticTurnChange()) {
        table.changeTurn();
      }
      if (args !== null) {
        if (WorldTable.MANCALA_TABLE_IDS.has(table.getId())) {
          console.log(`[zm] Sending zm to players: args=${JSON.stringify(args)}, nextTurn=${table.getTurn()}`);
        }
        msg.send(table.realPlayers, 'zm', ...args);
      }
      if (endArgs !== null) {
        if (WorldTable.MANCALA_TABLE_IDS.has(table.getId())) {
          console.log(`[zo] Game over on table ${table.getId()}: endArgs=${JSON.stringify(endArgs)}`);
        }
        // end args is pre-cpip thing
        // post-cpip: regular player coins
        if (data.isPreCpip()) {
          table.blockSpectators();
          msg.send(table.realPlayers, 'zo', ...endArgs);
        } else {
          table.realPlayers.forEach(p => msg.send(p, 'zo', p.currency.coins));
        }
        // Fire NPC reaction if one of the seats was an NPC
        if (npc && WorldTable.MANCALA_TABLE_IDS.has(table.getId())) {
          const seats = table.getSeats();
          const npcOpp = seats.find(s => s !== null && !(s instanceof WorldPenguin));
          if (npcOpp) {
            const finalBoard = table.serializeBoard().split(',').map(Number);
            const npcSeatId = table.getSeatIndex(npcOpp)!;
            const npcScore = npcSeatId === 0 ? finalBoard[6] : finalBoard[13];
            const playerScore = npcSeatId === 0 ? finalBoard[13] : finalBoard[6];
            npc.fireMancalaEndReaction(npcOpp as any, room, npcScore > playerScore, table.realPlayers);
          }
        }
        msg.send(room.players, 'ut', table.getId(), table.getCount());
        table.resetRound();
      }

      // If it's now an NPC's turn, notify the NpcManager
      if (!table.hasEnded() && npc) {
        const currentTurnSeatId = table.getTurn();
        const seats = table.getSeats();
        const currentTurnPlayer = seats[currentTurnSeatId];
        
        // Identify NPC occupants: they are NOT instances of WorldPenguin
        if (currentTurnPlayer && !(currentTurnPlayer instanceof WorldPenguin)) {
          if (WorldTable.MANCALA_TABLE_IDS.has(table.getId())) {
            console.log(`[zm] Now NPC "${currentTurnPlayer.name}"'s turn at seat ${currentTurnSeatId} — firing handleMancalaTurn`);
          }
          npc.handleMancalaTurn(currentTurnPlayer as any, room, table.getId());
        }
      }
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

export const handleUpdateColor: RoomHandler<[number]> = ({ room, msg, penguin }, id) => {
  penguin.inventory.updateWear({ color: id });
  msg.send(room.players, 'upc', penguin.id, id);
}

export const handleUpdateHead: RoomHandler<[number]> = ({ room, msg, penguin }, id) => {
  penguin.inventory.updateWear({ head: id });
  msg.send(room.players, 'uph', penguin.id, id);
}

export const handleUpdateFace: RoomHandler<[number]> = ({ room, msg, penguin }, id) => {
  penguin.inventory.updateWear({ face: id });
  msg.send(room.players, 'upf', penguin.id, id);
}

export const handleUpdateNeck: RoomHandler<[number]> = ({ room, msg, penguin }, id) => {
  penguin.inventory.updateWear({ neck: id });
  msg.send(room.players, 'upn', penguin.id, id);
}

export const handleUpdateBody: RoomHandler<[number]> = ({ room, msg, penguin }, id) => {
  penguin.inventory.updateWear({ body: id });
  msg.send(room.players, 'upb', penguin.id, id);
}

export const handleUpdateHand: RoomHandler<[number]> = ({ room, msg, penguin }, id) => {
  penguin.inventory.updateWear({ hand: id });
  msg.send(room.players, 'upa', penguin.id, id);
}

export const handleUpdateFeet: RoomHandler<[number]> = ({ room, msg, penguin }, id) => {
  penguin.inventory.updateWear({ feet: id });
  msg.send(room.players, 'upe', penguin.id, id);
}

export const handleUpdatePin: RoomHandler<[number]> = ({ room, msg, penguin }, id) => {
  penguin.inventory.updateWear({ pin: id });
  msg.send(room.players, 'upl', penguin.id, id);
}

export const handleUpdateBackground: RoomHandler<[number]> = ({ room, msg, penguin }, id) => {
  penguin.inventory.updateWear({ background: id });
  msg.send(room.players, 'upp', penguin.id, id);
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
