/**
 * Handles NPCs (bots)
 */
import { Worker } from 'worker_threads';

import { PenguinJson } from '@server/database/database';
import { SettingsManager } from '@server/settings';
import { GameData } from '@server/timelines/game-data';
import { World } from './world';
import { WorldPenguin } from './world-penguin';
import { WorldRoom } from './world-room';
import { choose, clamp, randomInt, shuffleArray } from '@common/utils';
import { Bot, BotAttributes, WriteFunction } from './bot';
import { FindFourTable } from './find-four';
import { MancalaTable } from './mancala';
import { XtMessenger } from '../xt-messenger';
import { joinWaddle } from '../handlers/room';
import { IGLOO_ROOM_BASE } from '@server/game-data/rooms';
import path from 'path';
import { generateBots, generateRandomBot } from './bot-generation';
import { DialogueStep, DialoguePool } from '@server/npc/npc-types';
import { PERSONALITY_DIALOGUE } from '@server/npc/npc-dialogue';
import { pickFromPool, SNOW_FORTS_ROOM_ID } from '@server/npc/npc-manager';
import { isRareItem } from '@server/npc/npc-clothing';
import { isGreaterOrEqual } from '@server/routes/versions';
import { BOT_ID_BASE, isBot } from './world-penguin';
export { BOT_ID_BASE, isBot };


// TODO -> Similar to item trackign system, a furniture and igloo type/music tracking system
// temporary set of furniture
const FURNITURE_SETS = [
  [1, 2, 3, 4, 5, 6],       // pink
  [10, 11, 12, 13, 14],     // log
  [21, 22, 23, 24, 25, 26], // blue
  [31, 32, 33]              // coffee
];
const IGLOO_TYPES = [1, 2, 3];
const IGLOO_MUSIC = [0, 1, 2, 5, 20];

// TODO -> Documenting spawnable areas for each igloo
//      -> Igloo presets ? (Would involve creating a large database of igloos)
// places to spawn furniture
const FURNITURE_SPOTS: Array<[number, number]> = [
  [180, 260], [300, 240], [420, 240], [540, 260],
  [200, 360], [330, 380], [460, 380], [580, 360],
  [260, 300], [500, 300]
];

/** How long a human sits before bots consider joining when alone in the room, in ms */
const MULTIPLAYER_JOIN_DELAY_ALONE = 12000;
/** How long a human sits before bots consider joining when other real players are in the room, in ms */
const MULTIPLAYER_JOIN_DELAY_WITH_PLAYERS = 35000;
/** Gap between two bots taking waddle seats, in ms */
const WADDLE_SEAT_GAP = 5000;

type BotSettings = {
  /** How many bots exist on the island at once */
  population: number;
  /** Chance (0-1) that a wandering bot picks the room you are standing in */
  followChance: number;
  /** Chance (0-1) that a bot says something instead of moving */
  chatChance: number;
  /** Milliseconds between the fastest and slowest bot action */
  minDelay: number;
  maxDelay: number;
  /** Whether bots sit down in waddles and play them */
  playGames: boolean;
  /** How many bots keep an open igloo at any one time */
  openIgloos: number;
};

const DEFAULT_BOT_SETTINGS: BotSettings = {
  population: 0,
  followChance: 0,
  chatChance: 0.08,
  minDelay: 2500,
  maxDelay: 9000,
  playGames: true,
  openIgloos: 3
};

const MAX_SIZE = 500;

const TIMELINE_POPULATIONS: Record<string, number> = {
  '2005-08-22': 50,
  '2005-09-12': 50,
  '2005-09-13': 50,
  '2005-09-21': 150, // Beta Test Party
  '2005-09-22': 50,
};


export class BotManager {
  private _bots = new Map<number, Bot>();
  private _nextId = BOT_ID_BASE;
  private _timer: NodeJS.Timeout | null = null;
  private _settings: BotSettings = { ...DEFAULT_BOT_SETTINGS };
  /** Bots sitting in a waddle or at a table, which must stop waddling about */
  /** Bots currently at home with an open igloo, and when they will head back out */
  private _on = false;
  private _manualPopulation = false;
  private _waddleSeen = new Map<number, number>();
  private _waddleLastSeat = new Map<number, number>();
  private _tableSeen = new Map<number, number>();
  private _pendingGeneration = false;
  private _chatCooldowns = new Map<string, number>();
  private _roomRecentKeywords = new Map<number, Set<string>>();

  constructor(
    private _world: World,
    private _msg: XtMessenger,
    private _data: GameData,
    private _appSettings: SettingsManager,
    private _writeFn: WriteFunction,
    private disconnect: (b: Bot) => void
  ) {
    this.syncTimelineDate();
  }

  public syncTimelineDate(): void {
    if (this._manualPopulation) {
      return;
    }
    const date = this._data.getDate();
    if (date in TIMELINE_POPULATIONS) {
      this.setPopulation(TIMELINE_POPULATIONS[date], false);
    } else if (this._settings.population > 0) {
      this.setPopulation(0, false);
    }
  }

  /**
   * Called right before a human player enters a room.
   * If it's a bot's igloo, gives a chance for the bot to be home when the player arrives.
   */
  public prepareIglooVisit(room: WorldRoom, visitor: WorldPenguin): void {
    if (isBot(visitor) || visitor.deadInternet) return;
    if (room.id < IGLOO_ROOM_BASE) return;

    const ownerId = room.id - IGLOO_ROOM_BASE;
    if (ownerId === visitor.id) return;

    const bot = this._bots.get(ownerId);
    if (!bot) return;

    const currentRoom = this._world.getPenguinRoom(bot.penguin);
    if (currentRoom?.id === room.id) {
      return; // Already home!
    }

    // Small-to-medium chance (~45%) that the bot is at home when you visit
    if (Math.random() < 0.45) {
      const [botX, botY] = choose([
        [380, 280], [310, 310], [450, 300], [260, 270], [490, 310], [370, 350]
      ]);

      if (currentRoom !== undefined) {
        currentRoom.removePenguin(bot.penguin);
      }
      room.addPenguin(bot.penguin, botX, botY);
      this._world.enterState(bot.penguin, { room });
      bot.markHome();
    }
  }

  /**
   * Called right after a human player enters a room.
   * If they entered a bot's igloo and the owner is present, trigger the unannounced arrival reaction.
   * If they entered a public room, bots can greet or compliment rare items.
   */
  public onPlayerEnterRoom(room: WorldRoom, visitor: WorldPenguin): void {
    if (isBot(visitor) || visitor.deadInternet) return;

    // Wake up bots in this room so they become active soon after human arrival
    const now = Date.now();
    for (const bot of this._bots.values()) {
      if (this._world.getPenguinRoom(bot.penguin)?.id === room.id) {
        bot.nextActionAt = now + randomInt(1000, 3000);
      }
    }

    if (room.id < IGLOO_ROOM_BASE) {
      this.onPlayerJoinPublicRoom(room, visitor);
      return;
    }

    const ownerId = room.id - IGLOO_ROOM_BASE;
    if (ownerId === visitor.id) return;

    const bot = this._bots.get(ownerId);
    if (!bot) return;

    const currentRoom = this._world.getPenguinRoom(bot.penguin);
    if (currentRoom?.id !== room.id) return;

    bot.reactToIglooVisitor(visitor, room);
  }

  private onPlayerJoinPublicRoom(room: WorldRoom, visitor: WorldPenguin): void {
    const botsInRoom = room.players
      .filter(p => isBot(p))
      .map(p => this._bots.get(p.id))
      .filter((b): b is Bot => b !== undefined && !b.busy);

    if (botsInRoom.length === 0) return;

    const currentDate = this._data.getDate();
    const equipped = [
      visitor.inventory.head,
      visitor.inventory.face,
      visitor.inventory.neck,
      visitor.inventory.body,
      visitor.inventory.hand,
      visitor.inventory.feet,
      visitor.inventory.pin
    ];
    const hasRare = equipped.some(id => id > 0 && isRareItem(id, currentDate));

    if (hasRare && Math.random() < 0.35) {
      const bot = choose(botsInRoom);
      const dialogue = PERSONALITY_DIALOGUE[bot.personalityTrait];
      const entry = pickFromPool(dialogue.onPlayerRareItem, currentDate, bot, room);
      if (entry) {
        bot.executeSteps(entry.steps, 1000);
        return;
      }
    }

    if (Math.random() < 0.25) {
      const candidates = botsInRoom.filter(b => b.personalityTrait === 'friendly' || b.personalityTrait === 'excitable');
      const bot = candidates.length > 0 ? choose(candidates) : choose(botsInRoom);
      const dialogue = PERSONALITY_DIALOGUE[bot.personalityTrait];
      const roomPool = dialogue.onPlayerJoin[room.id];
      const anyPool = dialogue.onPlayerJoin['any'];
      const pool = (roomPool && roomPool.length > 0 && Math.random() < 0.6) ? roomPool : (anyPool ?? []);
      const entry = pickFromPool(pool, currentDate, bot, room);
      if (entry) {
        bot.executeSteps(entry.steps, 1000);
      }
    }
  }

  public onPlayerLeaveRoom(room: WorldRoom, visitor: WorldPenguin): void {
    if (isBot(visitor) || visitor.deadInternet) return;

    const botsInRoom = room.players
      .filter(p => isBot(p))
      .map(p => this._bots.get(p.id))
      .filter((b): b is Bot => b !== undefined && !b.busy);

    if (botsInRoom.length === 0 || Math.random() > 0.25) return;

    const bot = choose(botsInRoom);
    const currentDate = this._data.getDate();
    const dialogue = PERSONALITY_DIALOGUE[bot.personalityTrait];
    const roomPool = dialogue.onPlayerLeave[room.id];
    const anyPool = dialogue.onPlayerLeave['any'];
    const pool = (roomPool && roomPool.length > 0 && Math.random() < 0.6) ? roomPool : (anyPool ?? []);
    const entry = pickFromPool(pool, currentDate, bot, room);
    if (entry) {
      bot.executeSteps(entry.steps, 500);
    }
  }

  public onPlayerChat(room: WorldRoom, player: WorldPenguin, message: string): void {
    if (isBot(player) || player.deadInternet) return;
    const currentDate = this._data.getDate();
    const lower = message.toLowerCase();
    const now = Date.now();

    const botsInRoom = room.players
      .filter(p => isBot(p))
      .map(p => this._bots.get(p.id))
      .filter((b): b is Bot => b !== undefined && !b.busy);

    if (botsInRoom.length === 0) return;

    let respondents = 0;
    for (const bot of shuffleArray(botsInRoom)) {
      if (respondents >= 2) break;
      const dialogue = PERSONALITY_DIALOGUE[bot.personalityTrait];

      for (let i = 0; i < dialogue.onPlayerChat.length; i++) {
        const trigger = dialogue.onPlayerChat[i];
        const matchedKws = trigger.keywords.filter(kw => lower.includes(kw));
        if (matchedKws.length === 0) continue;

        const blockedKws = this._roomRecentKeywords.get(room.id);
        if (blockedKws && matchedKws.every(kw => blockedKws.has(kw))) continue;

        const cooldownKey = `${bot.penguin.id}:chat:${i}`;
        const lastFired = this._chatCooldowns.get(cooldownKey) ?? 0;
        const cooldown = trigger.cooldownMs ?? 30_000;
        if (now - lastFired < cooldown) continue;

        const entry = pickFromPool(trigger.responses, currentDate, bot, room);
        if (entry !== undefined) {
          this._chatCooldowns.set(cooldownKey, now);

          let cur = this._roomRecentKeywords.get(room.id);
          if (!cur) {
            cur = new Set<string>();
            this._roomRecentKeywords.set(room.id, cur);
          }
          for (const kw of matchedKws) {
            cur.add(kw);
            setTimeout(() => {
              this._roomRecentKeywords.get(room.id)?.delete(kw);
            }, 15_000);
          }

          bot.executeSteps(entry.steps, respondents * 1200);
          respondents++;
          break;
        }
      }
    }
  }

  public onPlayerSnowball(room: WorldRoom, player: WorldPenguin, targetX: number, targetY: number): void {
    if (isBot(player) || player.deadInternet) return;
    const currentDate = this._data.getDate();
    const now = Date.now();
    const isSnowForts = room.id === SNOW_FORTS_ROOM_ID && isGreaterOrEqual(currentDate, '2005-09-12');

    const botsInRoom = room.players
      .filter(p => isBot(p))
      .map(p => this._bots.get(p.id))
      .filter((b): b is Bot => b !== undefined && !b.busy);

    if (botsInRoom.length === 0) return;

    let respondents = 0;
    for (const bot of shuffleArray(botsInRoom)) {
      if (respondents >= (isSnowForts ? 3 : 2)) break;
      const state = room.getState(bot.penguin);
      if (!state) continue;

      const dx = targetX - state.x;
      const dy = targetY - state.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const hitRadius = isSnowForts ? 110 : 80;
      if (distance > hitRadius) continue;

      const cooldownKey = `${bot.penguin.id}:snowball_hit`;
      const lastHit = this._chatCooldowns.get(cooldownKey) ?? 0;
      const snowballCooldownMs = isSnowForts ? 4_000 : 8_000;
      if (now - lastHit < snowballCooldownMs) continue;

      const dialogue = PERSONALITY_DIALOGUE[bot.personalityTrait];
      const entry = pickFromPool(dialogue.onPlayerSnowball, currentDate, bot, room);

      if (entry !== undefined) {
        this._chatCooldowns.set(cooldownKey, now);

        const playerState = room.getState(player);
        const resolvedSteps: DialogueStep[] = entry.steps.map(step => {
          if (step.action.type === 'snowball' && step.action.target === 'origin' && playerState) {
            return {
              ...step,
              action: { ...step.action, x: playerState.x, y: playerState.y }
            };
          }
          return step;
        });

        bot.executeSteps(resolvedSteps, respondents * 1000);
        respondents++;
      }
    }
  }

  public onPlayerEmote(room: WorldRoom, player: WorldPenguin, emoteId: number): void {
    if (isBot(player) || player.deadInternet) return;
    const currentDate = this._data.getDate();

    const botsInRoom = room.players
      .filter(p => isBot(p))
      .map(p => this._bots.get(p.id))
      .filter((b): b is Bot => b !== undefined && !b.busy);

    if (botsInRoom.length === 0) return;

    let respondents = 0;
    for (const bot of shuffleArray(botsInRoom)) {
      if (respondents >= 2) break;
      const dialogue = PERSONALITY_DIALOGUE[bot.personalityTrait];

      for (const trigger of dialogue.onPlayerEmote) {
        if (trigger.emoteId !== emoteId) continue;
        if (Math.random() >= trigger.chance) continue;

        const entry = pickFromPool(trigger.responses, currentDate, bot, room);
        if (entry !== undefined) {
          bot.executeSteps(entry.steps, respondents * 1000);
          respondents++;
          break;
        }
      }
    }
  }

  public setOff() {
    this._on = false;
    this._settings.population = 0;
    this.syncPopulation();
    this.stop();
  }

  /** Spawns a bot straight into one room and returns it */
  public spawnInto(roomId: number): Bot {
    if (!this._on || this._bots.size > MAX_SIZE) {
      return undefined;
    }
    this._settings.population += 1;
    return this.spawn({ roomId });
  }

  public configure(partial: Partial<BotSettings>): void {
    this._settings = { ...this._settings, ...partial };
  }

  private setOn() {
    if (this._settings.population > 0) {
      this._on = true;
      this.start();
    }
  }

  public setPopulation(n: number, manual: boolean = true): void {
    if (manual) {
      this._manualPopulation = true;
    }
    this._settings.population = clamp(n, 0, MAX_SIZE);
    if (n > 0) {
      this.setOn();
      this.syncPopulation();
    } else {
      this.setOff();
    }
  }

  /** Spawns `count` extra bots directly into one room and keeps them around */
  public addAt(roomId: number, count: number): void {
    this._settings.population = Math.min(this._settings.population + count, MAX_SIZE);
    for (let i = 0; i < count; i++) {
      if (this._bots.size >= this._settings.population) {
        break;
      }
      this.spawn({ roomId });
    }
    this.setOn();
  }

  public start(): void {
    if (this._timer === null) {
      this._timer = setInterval(() => this.tick(), 1000);
      // don't hold the process open just for bots
      this._timer.unref?.();
    }
  }

  public stop(): void {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /** Removes every bot and stops the loop. Call this when the world is reset. */
  public shutdown(): void {
    this.stop();
    this._waddleSeen.clear();
    this._waddleLastSeat.clear();
    this._tableSeen.clear();
    [...this._bots.keys()].forEach(id => this.despawn(id));
  }

  // -------------------------------------------------------------------------
  // population
  // -------------------------------------------------------------------------

  async generateBots(amount: number): Promise<Array<[BotAttributes, PenguinJson]>> {
    if (amount > 20) {
      return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'bot-worker.js'), { workerData: {date: this._data.getDate(), amount } });
  
        worker.on('message', resolve);
        worker.on('error', reject);
      });
    } else {
      return generateBots(this._data, amount);
    }
  }

  private async syncPopulation(): Promise<void> {
    if (this._pendingGeneration) {
      return;
    }
    const botsToSpawn = this._settings.population - this._bots.size;
    if (botsToSpawn > 0) {
      this._pendingGeneration = true;
      const bots = await this.generateBots(botsToSpawn);
      this._pendingGeneration = false;
      bots.forEach(info => {
        this.spawn({ info });
      });
    } else {
      for (let i = 0; i < -botsToSpawn; i++) {
        const idle = [...this._bots.entries()].find(
          ([, b]) => !b.busy
        );
        const id = idle?.[0] ?? [...this._bots.keys()][0];
        if (id === undefined) {
          break;
        }
        this.despawn(id);
      }
    }
  }

  public spawn(
    { roomId, info }: {
      roomId?: number;
      info?: [BotAttributes, PenguinJson]
    } = {}): Bot {
    const id = this._nextId++;
    const [attrs,json] = info === undefined ? generateRandomBot(this._data) : info;
    const penguin = new WorldPenguin(id, json, this._appSettings, this._data);
    this._world.addPenguin(penguin);
    const bot = new Bot(
      penguin,
      this._data,
      this._world,
      Date.now() + this.delay(),
      this._writeFn,
      attrs
    )
    this._msg.linkClient(bot, bot.penguin);
    this._bots.set(id, bot);
    this._msg
    this.decorateIgloo(penguin);

    bot.enter(roomId ?? bot.chooseRoom());
    return bot;
  }

  public despawn(id: number): void {
    const bot = this._bots.get(id);
    if (bot === undefined) {
      return;
    }

    this.disconnect(bot);
    this._world.closeIgloo(bot.penguin);
    this._world.disconnect(bot.penguin);
    this._bots.delete(id);
  }

  /** Unique rooms that a real, human player is currently standing in */
  private humanRooms(): WorldRoom[] {
    const seen = new Set<number>();
    const rooms: WorldRoom[] = [];
    for (const p of this._world.players) {
      if (!isBot(p)) {
        const room = this._world.getPenguinRoom(p);
        if (room !== undefined && !seen.has(room.id)) {
          seen.add(room.id);
          rooms.push(room);
        }
      }
    }
    return rooms;
  }

  // -------------------------------------------------------------------------
  // behaviour
  // -------------------------------------------------------------------------

  private delay(): number {
    return randomInt(this._settings.minDelay, this._settings.maxDelay);
  }

  /** A bot standing in this room that isn't already sitting somewhere */
  private getFreeBotIn(room: WorldRoom): Bot | undefined {
    const seated = new Set<WorldPenguin>();
    room.getWaddleRooms().forEach((w) => {
      w.getSeats().forEach((p) => {
        if (p !== null) {
          seated.add(p);
        }
      });
    });
    room.getTables().forEach((t) => {
      t.getSeats().forEach((p) => {
        if (p !== null) {
          seated.add(p);
        }
      });
    });

    const p = room.players.find(p => isBot(p) && !seated.has(p));
    if (p === undefined) {
      return undefined;
    }
    return this._bots.get(p.id);
  }

  private tickWaddles(room: WorldRoom): void {
    if (!room.hasRealPlayers) return;
    const now = Date.now();

    for (const waddle of room.getWaddleRooms()) {
      const seats = waddle.getSeats();
      const occupants = seats.filter((p): p is WorldPenguin => p !== null);
      const waitingHuman = occupants.some(p => !isBot(p) && !p.deadInternet);
      const id = waddle.getId();

      if (!waitingHuman || waddle.isFull()) {
        this._waddleSeen.delete(id);
        this._waddleLastSeat.delete(id);
        continue;
      }

      const otherHumansInRoom = room.players.filter(p => !isBot(p) && !occupants.includes(p));
      const requiredDelay = otherHumansInRoom.length > 0
        ? MULTIPLAYER_JOIN_DELAY_WITH_PLAYERS
        : MULTIPLAYER_JOIN_DELAY_ALONE;

      const since = this._waddleSeen.get(id);
      if (since === undefined) {
        this._waddleSeen.set(id, now);
        continue;
      }
      if (now - since < requiredDelay) {
        continue;
      }
      const last = this._waddleLastSeat.get(id) ?? 0;
      if (now - last < WADDLE_SEAT_GAP) {
        continue;
      }

      const bot = this.getFreeBotIn(room) ?? (otherHumansInRoom.length === 0 ? this.spawnInto(room.id) : undefined);
      if (bot === undefined) {
        continue;
      }

      this._waddleLastSeat.set(id, now);
      joinWaddle({ msg: this._msg, world: this._world, data: this._data }, room, waddle, bot.penguin);

      const ctx = this._world.getContext(bot.penguin);
      if ('card' in ctx) {
        bot.joinCard(ctx.card);
      }

      // starting the game empties the waddle
      if (waddle.isFull()) {
        this._waddleSeen.delete(id);
        this._waddleLastSeat.delete(id);
      }
    }
  }

  private tickTables(room: WorldRoom): void {
    if (!room.hasRealPlayers) return;
    const now = Date.now();

    for (const table of room.getTables()) {
      const id = table.getId();
      if (table.hasStarted() || table.hasEnded()) {
        this._tableSeen.delete(id);
        continue;
      }
      const seats = table.getSeats();
      const occupants = seats.filter((p): p is WorldPenguin => p !== null);
      const human = occupants.some(p => !isBot(p) && !p.deadInternet);
      const hasBot = occupants.some(p => isBot(p));

      if (!human || hasBot || occupants.length !== 1) {
        this._tableSeen.delete(id);
        continue;
      }
      // treasure hunt is co-op and needs mining logic bots don't have
      if (!(table instanceof FindFourTable) && !(table instanceof MancalaTable)) {
        this._tableSeen.delete(id);
        continue;
      }

      const otherHumansInRoom = room.players.filter(p => !isBot(p) && !occupants.includes(p));
      const requiredDelay = otherHumansInRoom.length > 0
        ? MULTIPLAYER_JOIN_DELAY_WITH_PLAYERS
        : MULTIPLAYER_JOIN_DELAY_ALONE;

      const since = this._tableSeen.get(id);
      if (since === undefined) {
        this._tableSeen.set(id, now);
        continue;
      }
      if (now - since < requiredDelay) {
        continue;
      }

      // Only choose a bot that is already freely roaming in this room
      const bot = this.getFreeBotIn(room);
      if (bot === undefined) {
        continue;
      }
      this._tableSeen.delete(id);
      bot.sitAtTable(table.getId());
    }
  }

  private tickGames(): void {
    const rooms = this.humanRooms();

    rooms.forEach((room) => {
      this.tickWaddles(room);
      this.tickTables(room);
    });
  }

  private tick(): void {
    const now = Date.now();
    this.syncPopulation();
    if (this._settings.playGames) {
      this.tickGames();
    }

    // Keep a few bot igloos open on the map for players to discover and visit
    const openBotPenguins = this._world.getOpenIglooPlayers().filter(p => isBot(p));
    if (openBotPenguins.length < this._settings.openIgloos && this._bots.size > 0) {
      const candidates = [...this._bots.values()].filter(b => !openBotPenguins.some(p => p.id === b.penguin.id));
      if (candidates.length > 0) {
        const toOpen = choose(candidates);
        this._world.openIgloo(toOpen.penguin);
      }
    }

    for (const bot of this._bots.values()) {
      if (now < bot.nextActionAt || bot.busy) {
        continue;
      }
      const room = this._world.getPenguinRoom(bot.penguin);
      if (!room || !room.hasRealPlayers) {
        continue;
      }
      bot.nextActionAt = now + this.delay();
      try {
        bot.act();
      } catch (e) {
        // a misbehaving bot should never take the world server down
        console.error('bot action failed', e);
      }
    }
  }

  /** Gives a bot a decorated igloo of its own. Called once, when it spawns. */
  private decorateIgloo(penguin: WorldPenguin): void {
    const set = choose(FURNITURE_SETS);
    const spots = [...FURNITURE_SPOTS].sort(() => Math.random() - 0.5)
      .slice(0, randomInt(3, Math.min(7, FURNITURE_SPOTS.length)));

    const furniture = spots.map(([x, y]) => {
      const id = choose(set);
      penguin.igloo.addFurniture(id, 1);
      return { id, x, y, rotation: randomInt(1, 4), frame: 1 };
    });

    try {
      penguin.igloo.updateIgloo({
        type: choose(IGLOO_TYPES),
        music: choose(IGLOO_MUSIC),
        flooring: 0,
        location: 1,
        locked: false,
        furniture
      });
    } catch (e) {
      // a bot without a valid layout simply doesn't get an igloo
      console.error('could not decorate bot igloo', e);
    }
  }
}
