import { choose, clamp, isDisjoint, iterateEntries, randomInt, randomLogNormal, shuffleArray } from "@common/utils";
import { equipProp, EquipProp, isBot, PenguinEquipped, WorldPenguin } from "./world-penguin";
import { WorldRoom } from "./world-room";
import { GameData } from "@server/timelines/game-data";
import { World } from "./world";
import { ClientSocket } from "../socket-server";
import { WorldTable } from "./world-table";
import { FindFourTable } from "./find-four";
import { MancalaTable } from "./mancala";
import { CardJitsu, NinjaPlayer } from "./card";
import { SledRace } from "./sled";
import { buildSledMap, SLED_HILL_0 } from "./sled-track";
import { getNameFromId, getRoomFromName, IGLOO_ROOM_BASE, ROOMS } from "@server/game-data/rooms";
import { getItemAvailability, getItemTypeFromEquipProp, getReleasedItems } from "@server/timelines/items";
import { getBlock, findPathBetweenBlockPoints, compactPath, findLeftmostMiddlemostPosition, getRandomPositionFromBlock } from "./bot-block";
import { PersonalityTrait, DialogueStep, DialoguePool } from "@server/npc/npc-types";
import { PERSONALITY_DIALOGUE } from "@server/npc/npc-dialogue";
import {
  DEV_NPC_NAMES,
  DEV_NPC_TRAITS,
  DEV_NPC_NAME_SET,
  getRoomPool,
  getRoomWeightMap,
  pickFromPool,
  SPAWN_ZONES,
  SNOW_FORTS_ROOM_ID,
  ICE_RINK_ROOM_ID,
  RINK_SCOREBOARD_DATE,
  pointNearPuck,
  hockeyPuckTarget,
  RINK_PUCK_TOUCH_RADIUS
} from "@server/npc/npc-manager";
import { RINK_PUCK_START } from "./world";
import { getDaysDelta, isGreaterOrEqual, isLower } from "@server/routes/versions";
import type { BotManager } from "./bots";
import {
  getAllEligibleSoloLinesForAge,
  getAmbientSoloLine,
  sampleRandomAgeGroup,
  BotAgeGroup
} from "@server/npc/ambient-dialogue";

const EMPTY_SLOT_WEIGHTS: Record<EquipProp, number> = {
  color: 0,
  head: 60,
  face: 80,
  neck: 100,
  body: 50,
  hand: 90,
  feet: 90,
  pin: 70,
  background: 50
};

export function generateRandomOutfit(
  data: GameData,
  inventory: number[],
  isMember: boolean = true
): PenguinEquipped {
  const currentDate = data.getDate();
  const allAvailable = data.getAvailableItems();
  const allReleased = new Set([...getReleasedItems(currentDate), ...inventory]);
  const items: Array<[EquipProp, number]> = [];

  equipProp.forEach(prop => {
    if (prop === 'color') {
      const colors = data.getStarterColors();
      const color = colors.length > 0 ? choose(colors) : 1;
      items.push([prop, color]);
      return;
    }

    const targetType = getItemTypeFromEquipProp(prop);
    const candidates: { id: number; weight: number }[] = [];

    if (!isMember) {
      if (prop === 'pin') {
        // Pins are free in Club Penguin
      } else if (prop === 'head' && inventory.includes(413)) {
        // Former beta testers who didn't renew can still wear their beta party hat
        candidates.push({ id: 413, weight: 100 });
      } else {
        items.push([prop, 0]);
        return;
      }
    }

    // Empty slot option
    const emptyWeight = EMPTY_SLOT_WEIGHTS[prop] ?? 70;
    candidates.push({ id: 0, weight: emptyWeight });

    for (const itemId of allReleased) {
      if (itemId === 0) continue;
      const info = data.getItem(itemId);
      if (!info || info.type !== targetType) continue;
      if (!isMember && info.isMember) continue;

      // Items that haven't been obtainable yet in the timeline at all can't be seen
      const availability = getItemAvailability(itemId, currentDate);
      if (!availability) {
        continue;
      }

      // Most common items being the ones currently obtainable
      if (allAvailable.has(itemId)) {
        candidates.push({ id: itemId, weight: 100 });
      } else if (inventory.includes(itemId)) {
        // Items obtainable in the past have a lower chance decaying by how long ago they were available
        const daysAgo = Math.max(0, getDaysDelta(availability.lastAvailableDate, currentDate));
        let pastWeight = Math.max(1, Math.round(25 * Math.exp(-daysAgo / 180)));
        if (itemId === 413 && currentDate === '2005-10-24') {
          // Former beta testers flaunting their party hat on launch day
          pastWeight = 120;
        }
        candidates.push({ id: itemId, weight: pastWeight });
      }
    }

    // Beta Party Hat boost on 2005-09-21
    if (prop === 'head' && currentDate === '2005-09-21') {
      const partyHatEntry = candidates.find(c => c.id === 413);
      if (partyHatEntry) {
        partyHatEntry.weight = 800;
      } else {
        candidates.push({ id: 413, weight: 800 });
      }
    }

    // Weighted random selection
    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let rand = Math.random() * totalWeight;
    let chosenId = 0;
    for (const c of candidates) {
      rand -= c.weight;
      if (rand <= 0) {
        chosenId = c.id;
        break;
      }
    }

    if (chosenId !== 0 && !inventory.includes(chosenId)) {
      inventory.push(chosenId);
    }
    items.push([prop, chosenId]);
  });

  return Object.fromEntries(items) as PenguinEquipped;
}

export type WriteFunction = (b: Bot, ext: string, code: string, ...args: Array<string | number>) => void;
type SendFunction = (ext: string, code: string, ...args: Array<string | number>) => void;

// TODO -> Complete tracking of all walkable boxes
//         (If possible with a FFDEC script)
/**
 * Rough walkable box of a Club Penguin room. The resolution is 760x480, and most
 * floors sit in the lower half of it. Bots that pick a spot outside the walkable
 * area of a specific room just stand there, which is harmless.
 */
export const WALK_AREA = { minX: 120, maxX: 640, minY: 300, maxY: 410 };

export interface TableSeatConfig {
  x: number;
  y: number;
  frame: number;
}

export const TABLE_SEAT_POSITIONS: Record<number, [TableSeatConfig, TableSeatConfig]> = {
  // Mancala tables in Book Room (111)
  100: [{ x: 501, y: 205, frame: 24 }, { x: 441, y: 241, frame: 20 }],
  101: [{ x: 351, y: 205, frame: 24 }, { x: 291, y: 241, frame: 20 }],
  102: [{ x: 241, y: 305, frame: 24 }, { x: 181, y: 341, frame: 20 }],
  103: [{ x: 428, y: 322, frame: 24 }, { x: 368, y: 358, frame: 20 }],
  104: [{ x: 671, y: 365, frame: 24 }, { x: 611, y: 401, frame: 20 }],
  // Find Four tables in Ski Lodge (220)
  205: [{ x: 331, y: 236, frame: 24 }, { x: 276, y: 273, frame: 20 }],
  206: [{ x: 302, y: 376, frame: 17 }, { x: 354, y: 407, frame: 23 }],
  207: [{ x: 545, y: 410, frame: 23 }, { x: 480, y: 386, frame: 19 }],
};

/** How long a bot "thinks" before playing a table move, in s */
const TABLE_THINK_MIN = 1.8;
const TABLE_THINK_MAX = 4.2;

/** Emote ids sent through `se` */
const EMOTES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];


interface GatedChatLine {
  text: string;
  after?: string;
  before?: string;
}

const TIMELINE_CHAT_LINES: GatedChatLine[] = [
  { text: 'hi' },
  { text: 'hello!' },
  { text: 'sup' },
  { text: 'wanna be buddies?' },
  { text: 'brb' },
  { text: 'cool igloo' },
  { text: 'nice hat' },
  { text: 'im so bored' },
  { text: 'party at my igloo' },
  { text: 'waddle on' },
  { text: 'lol' },
  { text: 'thanks!' },
  { text: 'where is everyone' },
  { text: 'first!' },
  { text: 'add me' },
  { text: 'hi everyone' },
  { text: 'whats up' },
  { text: 'wanna dance' },
  { text: 'lets dance' },
  { text: 'nice outfit' },
  { text: 'cool penguin' },
  { text: 'im hungry' },
  { text: 'wanna be friends' },
  { text: 'you are cool' },
  { text: 'peace' },
  { text: 'lets play' },
  { text: 'yay' },
  { text: 'grrrr' },
  { text: 'hello world' },
  { text: 'now check this out' },
  { text: 'everyone smile!' },
  { text: 'hey' },
  { text: 'yo' },
  { text: 'lets play hockey later' },
  { text: 'penguin chat' },
  { text: 'you guys are silly' },
  { text: 'now thats what im talking about!' },
  { text: 'snails used to live on our island' },
  { text: 'i need coins' },
  { text: 'i want coffee' },
  { text: 'im saving up for cool items' },
  { text: 'im saving up for expensive furniture' },
  { text: 'ur so random lol' },
  { text: 'im looking for cool penguins to hang with' },
  { text: 'good game' },
  { text: 'best day ever!' },
  { text: 'lets roleplay!' },
  { text: 'has anyone seen my friend?' },
  { text: 'this island is so cool :)' },
  { text: 'love it here already' },
  { text: 'wonder who else is online right now!' },
  { text: 'i hope i can make lots of friends' },
  { text: "it's such a nice day out" },
  { text: 'waddling around is fun' },
  { text: 'everyone is so nice :)' },
  { text: 'im gonna explore the whole map today' },
  { text: 'has anyone seen a cool new room?' },
  { text: 'the games here are actually pretty fun' },
  { text: 'still finding bugs lol but its still fun' },
  { text: 'i played penguin chat 3, had to try update!' },
  { text: 'club penguin is such a cute name for it :)' },
  { text: 'wow actually people on here today :)' },
  { text: 'the island feels kinda small but i love it' },
  { text: 'the cp team is gonna be here!!' },
  { text: 'anyone wanna play bean counters?' },
  { text: 'love the coffee shop :)' },
  { text: 'the coffee smell in here is so good!!' },
  { text: 'bean counters is my fave right now' },
  { text: 'hey!! welcome :)' },
  { text: 'welcome to the island!!' },
  { text: 'anyone actually playing mancala here??' },
  { text: 'so cool!!' },
  { text: 'nice moves!' },

  // Beta era only (< 2005-10-24)
  { text: 'glad you made it to the beta :D', before: '2005-10-24' },
  { text: 'cant wait for the next party', before: '2005-10-24' },

  // Astro Barrier (>= 2005-09-13)
  { text: 'tried astro barrier upstairs in dance club?', after: '2005-09-13' },

  // Sled Racing & Mountain (>= 2005-10-20)
  { text: 'lets go sledding', after: '2005-10-20' },
  { text: 'who wants to race down the mountain?', after: '2005-10-20' },

  // Launch Day, PSA, Newspaper, Catalogs, Membership (>= 2005-10-24)
  { text: 'i saw a secret agent once', after: '2005-10-24' },
  { text: 'spy phone? what is that?', after: '2005-10-24' },
  { text: 'the catalog has a secret item', after: '2005-10-24' },
  { text: 'check the newspaper', after: '2005-10-24' },
  { text: 'im a member', after: '2005-10-24' },

  // Find Four in Ski Lodge (>= 2006-04-27)
  { text: 'anyone wanna play find four?', after: '2006-04-27' }
];

export function getEligibleChatLines(currentDate: string, ageGroup?: BotAgeGroup): string[] {
  const eligible = TIMELINE_CHAT_LINES.filter(item => {
    if (item.after && isLower(currentDate, item.after)) return false;
    if (item.before && !isLower(currentDate, item.before)) return false;
    return true;
  }).map(item => item.text);
  const ambient = ageGroup ? getAllEligibleSoloLinesForAge(ageGroup) : [];
  const combined = [...eligible, ...ambient];
  return combined.length > 0 ? combined : ['hi', 'hello!', 'waddle on'];
}

export const IGLOO_PISSED_LINES = [
  "who the hell are you?! get out!",
  "did you ever hear of knocking?! fuck off!",
  "get out of my house right now!!",
  "who invited you?! leave!",
  "excuse me?! door's behind you, get lost!",
  "what the fuck are you doing in my igloo?!",
  "trespasser!! OUT!",
  "you really just walked in unannounced?!",
  "i'm calling the cops. GET OUT.",
  "fuck off creep!!",
  "do you mind?! this is a PRIVATE igloo!",
  "seriously?! get the fuck out!",
  "i didn't invite you! bye!",
  "SECURITY! GET OUT OF MY HOUSE!"
];

export const IGLOO_DECOR_LINES = [
  "omg a guest!! what do you think of my setup?!",
  "be honest, does this couch match carpet?",
  "spent all my coins on furniture, how is it?",
  "look around, what do you think of vibes?",
  "like the decor? took hours to place right!",
  "welcome to my house! rate it 1 to 10 please!!",
  "i'm thinking of getting a fireplace next, thoughts?",
  "check out my stereo! pretty sweet right?",
  "does room feel cozy or crowded? be honest!",
  "glad you came by! how is the layout?",
  "took forever to save for this flooring!",
  "should i move the stereo over there?"
];

export const IGLOO_PLEASED_LINES = [
  "oh hey!! welcome to my igloo :)",
  "feel free to make yourself at home!",
  "welcome!! grab a seat, I was just chilling",
  "hey! nice to see you! want some hot cocoa?",
  "welcome in! pizza is in the fridge :D",
  "hi!! wow a visitor! welcome to my crib",
  "hey buddy! pull up a bean bag :)",
  "oh hi there! good to see a friendly face!",
  "make yourself comfortable, glad you stopped by!",
  "perfect timing, just put on some music!"
];

export const IGLOO_STARTLED_LINES = [
  "AHH! who are you?!",
  "woah!! how did you get in here?!",
  "wait what... who gave you my address?!",
  "omg you scared the feathers off me!!",
  "did you just walk through my front door?!",
  "uhhh... hello? can i help you?? lol",
  "wait I was just changing clothes omg look away!!",
  "uhhh.. ignore the mess, I wasn't expecting company",
  "just vacuumed, please take shoes off!",
  "omg my heart... knock next time please!!"
];

interface BotBrain {
  handle(name: string, args: string[]): void;
  dispose(): void;
}

class TableBrain implements BotBrain {
  private _timeout: NodeJS.Timeout;

  constructor(
    private _table: WorldTable,
    private _seat: number,
    private _room: WorldRoom,
    private _penguin: WorldPenguin,
    private _send: SendFunction,
    private _onEnd: () => void,
    private _rng: Rng
  ) {
    this._timeout = this.tableMove();
  }

  handle(name: string, args: string[]): void {
    if (name === 'zo' || name === 'cz' || name === 'lz') {
      this.dispose();
    }
  }

  dispose(): void {
    clearTimeout(this._timeout);
    this._onEnd();
  }

  public tableMove(): NodeJS.Timeout {
    return setTimeout(() => {
      // human walked off, or the round was reset out from under us
      const stillSeated = this._table.getSeatIndex(this._penguin) === this._seat;
      const opponent = this._table.getSeats().some(p => p !== null && p !== this._penguin);

      if (!stillSeated || !opponent) {
        this.dispose();
        return;
      }

      if (this._table.hasEnded()) {
        this.dispose();
        return;
      }
      if (!this._table.hasStarted() || this._table.getTurn() !== this._seat) {
        this._timeout = this.tableMove();
        return;
      }

      const moves = this.chooseTableMove();
      if (moves === null) {
        return;
      }
      this._send('z', 'zm', ...moves);
      this._timeout = this.tableMove();
    }, this._rng.int(TABLE_THINK_MIN, TABLE_THINK_MAX) * 1000);
  }

  private chooseTableMove(): number[] | null {
    if (this._table instanceof FindFourTable) {
      return this.chooseFindFourMove(this._table);
    }
    if (this._table instanceof MancalaTable) {
      return this.chooseMancalaMove(this._table);
    }
    return null;
  }

  private chooseFindFourMove(table: FindFourTable): number[] | null {
    const board = this.parseFindFour(table);
    const me = this._seat + 1;
    const them = this._seat === 0 ? 2 : 1;

    const options: Array<{ column: number; row: number }> = [];
    for (let x = 0; x < FindFourTable.FIND_FOUR_WIDTH; x++) {
      const row = this.dropRow(board[x] ?? []);
      if (row !== null) {
        options.push({ column: x, row });
      }
    }
    if (options.length === 0) {
      return null;
    }

    // win if possible
    for (const { column, row } of options) {
      if (this.isFindFourWin(board, column, row, me)) {
        return [column, row];
      }
    }
    // otherwise block
    for (const { column, row } of options) {
      if (this.isFindFourWin(board, column, row, them)) {
        return [column, row];
      }
    }
    // otherwise favour the middle, but not every single time
    if (Math.random() < 0.75) {
      const centre = (FindFourTable.FIND_FOUR_WIDTH - 1) / 2;
      const sorted = [...options].sort(
        (a, b) => Math.abs(a.column - centre) - Math.abs(b.column - centre)
      );
      const best = sorted.slice(0, 3);
      const choice = choose(best);
      return [choice.column, choice.row];
    }

    const choice = choose(options);
    return [choice.column, choice.row];
  }

  private chooseMancalaMove(table: MancalaTable): number[] | null {
    const board = table.serializeBoard().split(',').map(Number);
    if (board.length !== 14) {
      return null;
    }

    const legal: number[] = [];
    for (let cup = 0; cup < 14; cup++) {
      if (table.isMancalaCupForPlayer(this._seat, cup) && (board[cup] ?? 0) > 0) {
        legal.push(cup);
      }
    }
    if (legal.length === 0) {
      return null;
    }

    let free: number | null = null;
    let capture: number | null = null;

    for (const cup of legal) {
      // applyMancalaMove works on the array it is handed, so a copy simulates
      const result = table.applyMancalaMove([...board], this._seat, cup);
      if (result.command === 'f' && free === null) {
        free = cup;
      }
      if (result.command === 'c' && capture === null) {
        capture = cup;
      }
    }

    if (free !== null && Math.random() < 0.85) {
      return [free];
    }
    if (capture !== null && Math.random() < 0.75) {
      return [capture];
    }
    return [choose(legal)];
  }

  private parseFindFour(table: FindFourTable): number[][] {
    const values = table.serializeBoard().split(',').map(Number);
    const board: number[][] = [];
    for (let x = 0; x < FindFourTable.FIND_FOUR_WIDTH; x++) {
      const column: number[] = [];
      for (let y = 0; y < FindFourTable.FIND_FOUR_HEIGHT; y++) {
        column.push(values[x * FindFourTable.FIND_FOUR_HEIGHT + y] ?? 0);
      }
      board.push(column);
    }
    return board;
  }

  private dropRow(column: number[]): number | null {
    const height = FindFourTable.FIND_FOUR_HEIGHT;
    for (let y = height - 1; y >= 0; y--) {
      if (column[y] === 0) {
        return y;
      }
    }
    return null;
  }

  private isFindFourWin(board: number[][], x: number, y: number, value: number): boolean {
    const width = FindFourTable.FIND_FOUR_WIDTH;
    const height = FindFourTable.FIND_FOUR_HEIGHT;
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];

    return dirs.some(([dx, dy]) => {
      let count = 1;
      for (const sign of [1, -1]) {
        let cx = x + dx * sign;
        let cy = y + dy * sign;
        while (
          cx >= 0 && cx < width && cy >= 0 && cy < height &&
          board[cx]?.[cy] === value
        ) {
          count++;
          cx += dx * sign;
          cy += dy * sign;
        }
      }
      return count >= 4;
    });
  }
}

class CardJitsuBrain implements BotBrain {
  private _timeout: NodeJS.Timeout | null = null;

  constructor(
    private _game: CardJitsu,
    private _ninja: NinjaPlayer,
    private _seat: number,
    private _send: SendFunction,
    private _onEnd: () => void
  ) {

  }

  handle(name: string, args: string[]): void {
    if (name === 'zm') {
      if (args[0] === 'deal' && args[1] != String(this._seat)) {
        // remove deal and seat to find number of cards
        const amount = args.length - 2;
        this._send('z', 'zm', 'deal', amount);
        this._timeout = setTimeout(() => {
          const selectableCards = this._ninja.cards
            .map((sessionId) => [this._game.getCard(sessionId).element, sessionId])
            .filter(([element,]) => element !== this._ninja.blockedElement)
            .map(([,id]) => id);
          
          if (selectableCards.length === 0) {
            this._send('z', 'zm', 'death');
          } else {
            this._send('z', 'zm', 'pick', choose(selectableCards));
          }
          
        }, clamp(randomLogNormal(1.2, 0.8), 1, 20) * 1000);
      }
    } else if (name === 'czo' || name === 'cz') {
      // packets that terminate the match
      this.dispose();
    }
  }

  dispose(): void {
    if (this._timeout !== null) {
      clearTimeout(this._timeout);
    }
    this._onEnd();
  }
}

class SledBrain implements BotBrain {
  private _interval: NodeJS.Timeout | null = null;
  private _disposed = false;

  constructor(
    private _sled: SledRace,
    private _seatId: number,
    private _send: SendFunction,
    private _onEnd: () => void
  ) {
    const map = buildSledMap(SLED_HILL_0);
    const lanes = [160, 120, 80, 40];
    const seatId = Math.max(0, this._seatId);
    let x = lanes[seatId] ?? 100;
    let y = 0;
    let speed = 0;
    let isCrashed = false;
    let crashTimer = 0;
    let isFinished = false;
    let finishTimer = 0;
    const startTime = Date.now();
    let lastTime = startTime;
    let lastSyncTime = startTime;

    // 82% to 98% dodge skill
    const dodgeSkill = 0.82 + Math.random() * 0.16;

    this._interval = setInterval(() => {
      if (this._disposed) return;
      const now = Date.now();
      const dt = Math.min(200, Math.max(10, now - lastTime));
      lastTime = now;

      if (!this._sled.isRacing()) {
        return;
      }

      const gameTime = this._sled.getGameTime();

      if (isFinished) {
        finishTimer += dt;
        if (finishTimer >= 3000) {
          this.dispose();
        }
        return;
      }

      if (isCrashed) {
        crashTimer -= dt;
        speed *= 0.9;
        if (crashTimer <= 0) {
          isCrashed = false;
          speed = 10;
        }
        return;
      }

      // Normal speed curve
      if (speed < 20) {
        speed = Math.min(20, speed + 2);
      } else if (speed > 20) {
        speed = Math.max(20, speed * 0.96);
      }

      const move = (dt / 40) * speed;
      y += move;

      const py = Math.floor(y / 20);
      const px = Math.min(9, Math.max(0, Math.round(x / 20)));

      // Finish line at row 890 / y 17800
      if (py >= 890 || y >= 17800) {
        isFinished = true;
        this._send('z', 'zm', seatId, 0, Math.round(y), gameTime);
        this._send('z', 'zo', Math.min(4, Math.max(1, seatId + 1)));
        return;
      }

      const currentTile = map[py]?.[px] ?? 0;

      // Obstacle collision (tile 11: tree or rock)
      if (currentTile === 11) {
        isCrashed = true;
        crashTimer = 1200;
        speed = 20;
        this._send('z', 'zm', seatId, 1, Math.round(y), gameTime);
        return;
      }

      // Boost ramp (tile 12)
      if (currentTile === 12 && speed < 60) {
        speed = 60;
        // In AS2 SledRacing2006.swf, sending n >= 400 triggers `player.s = mySpeed[diff]`, where diff is a float,
        // resulting in undefined (NaN) due to AS2 float indexing.
        // Instead, the bot accelerates internally and sends normal position (x + 100).
        this._send('z', 'zm', seatId, x + 100, Math.round(y), gameTime);
        return;
      }

      // Lookahead obstacle dodging & boost targeting
      const lookahead = 12;
      let obstacleAheadInLane = false;
      for (let r = 1; r <= lookahead; r++) {
        if (map[py + r]?.[px] === 11) {
          obstacleAheadInLane = true;
          break;
        }
      }

      let desiredCol = px;
      if (obstacleAheadInLane && Math.random() < dodgeSkill) {
        const leftCol = px - 1;
        const rightCol = px + 1;
        let leftSafe = leftCol >= 0;
        let rightSafe = rightCol <= 9;

        if (leftSafe) {
          for (let r = 1; r <= lookahead; r++) {
            if (map[py + r]?.[leftCol] === 11) {
              leftSafe = false;
              break;
            }
          }
        }
        if (rightSafe) {
          for (let r = 1; r <= lookahead; r++) {
            if (map[py + r]?.[rightCol] === 11) {
              rightSafe = false;
              break;
            }
          }
        }

        if (leftSafe && rightSafe) {
          desiredCol = Math.abs(leftCol - 4.5) < Math.abs(rightCol - 4.5) ? leftCol : rightCol;
        } else if (leftSafe) {
          desiredCol = leftCol;
        } else if (rightSafe) {
          desiredCol = rightCol;
        }
      } else if (!obstacleAheadInLane && Math.random() < 0.25) {
        for (let r = 1; r <= 8; r++) {
          if (px > 0 && map[py + r]?.[px - 1] === 12) {
            desiredCol = px - 1;
            break;
          } else if (px < 9 && map[py + r]?.[px + 1] === 12) {
            desiredCol = px + 1;
            break;
          }
        }
      }

      let steered = false;
      if (desiredCol !== px) {
        const targetX = desiredCol * 20;
        const dir = targetX > x ? 1 : -1;
        x = Math.max(0, Math.min(180, x + dir * 20));
        steered = true;
      }

      if (steered || now - lastSyncTime >= 400) {
        lastSyncTime = now;
        this._send('z', 'zm', seatId, x + 100, Math.round(y), gameTime);
      }
    }, 100);
  }

  handle(name: string, args: string[]): void {
    if (name === 'zo' || name === 'lz' || name === 'lt') {
      this.dispose();
    }
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    if (this._interval !== null) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this._onEnd();
  }
}

export type BotAttributes = {
  personalityTrait?: PersonalityTrait;
  ageGroup?: BotAgeGroup;
  emptyRoomTolerance: number;
  roomDistraction: number;
  snowballFan: number;
  waveFan: number;
  sitFan: number;
  danceFan: number;
  chatFan: number;
  emoteFan: number;
  walkFan: number;
  iglooFan: number;
  secretsFan: number;
  followability: number;
  mythsFan: number;
  stampsFan: number;
  musicFan: number;
  collectorMania: number;
  tester: number;
  ninjaFan: number;
  exploreFan: number;
  transferFan: number;
  agentFan: number;
}

enum BehaviorId {
  RandomDance,
  RandomSnowball,
  RandomWave,
  RandomSit,
  RandomMessage,
  RandomEmote,
  RandomWalk,
  LeaveRoom,
  HostIgloo,
  JoinDanceFloor,
  MatchDanceColor,
  TipTheBerg,
  FormBand,
  SnowFortsFight,
  PlayHockey
}

// this variable is usede to access all behaviors at compile time
const allBehaviors: Record<BehaviorId, 0> = {
  [BehaviorId.RandomDance]: 0,
  [BehaviorId.RandomSnowball]: 0,
  [BehaviorId.RandomWave]: 0,
  [BehaviorId.RandomSit]: 0,
  [BehaviorId.RandomMessage]: 0,
  [BehaviorId.RandomWalk]: 0,
  [BehaviorId.RandomEmote]: 0,
  [BehaviorId.LeaveRoom]: 0,
  [BehaviorId.HostIgloo]: 0,
  [BehaviorId.JoinDanceFloor]: 0,
  [BehaviorId.MatchDanceColor]: 0,
  [BehaviorId.TipTheBerg]: 0,
  [BehaviorId.FormBand]: 0,
  [BehaviorId.SnowFortsFight]: 0,
  [BehaviorId.PlayHockey]: 0
}

interface Behavior {
  readonly id: BehaviorId;
  readonly uses: readonly Resource[];
  success(ctx: BotContext): boolean;
  duration(ctx: BotContext): number;
  cooldown(ctx: BotContext): number;
  start(ctx: BotContext): Promise<void>;
  end?(ctx: BotContext): void;
}

interface BotContext {
  bot: Bot;
  room: WorldRoom;
  now: number;
  attrs: BotAttributes;
  rng: Rng;
}

interface Rng {
  random(): number;
  int(a: number, b: number): number;
  choose<T>(xs: T[]): T;
  logNormal(mu: number, sigma: number): number;
}

const eagerness = (attr: number, max: number) => (1 - attr) * max;
const stamina = (attr: number, max: number) => (attr + 1) * max;

type Resource = 'locomotion' | 'pose' | 'voice' | 'appearance' | 'room';

const BEHAVIORS: Behavior[] = [
  {
    id: BehaviorId.RandomDance,
    uses: ['pose'],
    duration({ rng, attrs }) {
      return stamina(attrs.danceFan, rng.random() * 20);
    },
    cooldown({ rng, attrs }) {
      return eagerness(attrs.danceFan, rng.random() * 30);
    },
    success({ rng, attrs }) {
      return attrs.danceFan > rng.random();
    },
    async start({ bot }) {
      bot.doDance();
    }
  },
  {
    id: BehaviorId.RandomSnowball,
    uses: ['pose'],
    duration() {
      return 0;
    },
    cooldown({ rng, attrs }) {
      return eagerness(attrs.snowballFan, rng.random() * 30);
    },
    success({ rng, attrs }) {
      return attrs.snowballFan > rng.random();
    },
    async start({ bot }) {
      bot.throwSnowball(randomInt(WALK_AREA.minX, WALK_AREA.maxX), randomInt(WALK_AREA.minY, WALK_AREA.maxY));
    },
  },
  {
    id: BehaviorId.RandomSit,
    uses: ['pose'],
    duration({ rng, attrs }) {
      return stamina(attrs.sitFan, rng.random() * 20);
    },
    cooldown({ rng, attrs }) {
      return eagerness(attrs.sitFan, rng.random() * 30);
    },
    success({ rng, attrs }) {
      return attrs.sitFan > rng.random();
    },
    async start({ bot }) {
      bot.doFrame(choose([17, 18, 19, 20, 21, 22, 23, 24]));
    },
  },
  {
    id: BehaviorId.RandomWalk,
    uses: ['locomotion'],
    duration() {
      return 0;
    },
    cooldown({ rng, attrs }) {
      return eagerness(attrs.walkFan, rng.random() * 30);
    },
    success({ attrs }) {
      return attrs.walkFan > Math.random();
    },
    async start({ bot, room }) {
      const [x, y] = getRandomPointInRoom(room);
      await bot.walk(x, y);
    }
  },
  {
    id: BehaviorId.RandomMessage,
    uses: ['voice'],
    duration() {
      return 5;
    },
    cooldown({ rng, attrs }) {
      return eagerness(attrs.chatFan, rng.random() * 30);
    },
    success({ rng, attrs }) {
      return attrs.chatFan > rng.random();
    },
    async start({ bot, room }) {
      bot.sendDynamicMessage(room);
    }
  },
  {
    id: BehaviorId.RandomEmote,
    uses: ['voice'],
    duration() {
      return 5;
    },
    cooldown({ rng, attrs }) {
      return eagerness(attrs.emoteFan, rng.random() * 30);
    },
    success({ rng, attrs }) {
      return attrs.emoteFan > rng.random();
    },
    async start({ bot, rng }) {
      bot.doEmote(rng.choose(EMOTES));
    }
  },
  {
    id: BehaviorId.RandomWave,
    uses: ['pose'],
    duration() {
      return 0;
    },
    cooldown({ rng, attrs }) {
      return eagerness(attrs.waveFan, rng.random() * 30);
    },
    success({ rng, attrs }) {
      return attrs.waveFan > rng.random();
    },
    async start({ bot }) {
      bot.doFrame(25);
    },
  },
  {
    id: BehaviorId.LeaveRoom,
    uses: ['room'],
    duration() {
      return 0;
    },
    cooldown({ rng, attrs }) {
      return eagerness(attrs.roomDistraction, rng.random() * 120 + 30);
    },
    success({ rng, room, bot }) {
      if (bot.isHostingIgloo || bot.isPartyHomie) {
        return false;
      }
      if (room.hasRealPlayers) {
        const botCount = room.players.filter(p => isBot(p)).length;
        const weightMap = getRoomWeightMap(bot.data.getDate());
        const baseWeight = Math.max(1, weightMap.get(room.id) ?? 1);
        const crowdLimit = baseWeight >= 3 ? Math.round(baseWeight * 2.5) : 3;
        // Don't leave if the room is at or below minimum crowd threshold
        if (botCount <= Math.max(2, Math.floor(crowdLimit * 0.5))) {
          return rng.random() < 0.04;
        }
        return rng.random() < 0.12;
      }
      const botCount = room.players.filter(p => isBot(p)).length;
      const weightMap = getRoomWeightMap(bot.data.getDate());
      const baseWeight = Math.max(1, weightMap.get(room.id) ?? 1);

      // In hot zones (weight >= 3), allow larger crowds before encouraging leaving
      const crowdLimit = baseWeight >= 3 ? Math.round(baseWeight * 2.5) : 3;
      if (botCount > crowdLimit) {
        return rng.random() < 0.6;
      }
      return rng.random() < 0.25;
    },
    async start({ bot }) {
      await bot.enter(bot.chooseRoom());
    }
  },
  {
    id: BehaviorId.SnowFortsFight,
    uses: ['pose'],
    duration() {
      return 0;
    },
    cooldown({ rng, attrs }) {
      return eagerness(attrs.snowballFan, rng.random() * 8 + 3);
    },
    success({ room, bot }) {
      return room.id === SNOW_FORTS_ROOM_ID && isGreaterOrEqual(bot.data.getDate(), '2005-09-12');
    },
    async start({ bot, room, rng }) {
      const others = room.players.filter(p => p.id !== bot.penguin.id && !p.deadInternet);
      if (others.length === 0) return;
      const target = choose(others);
      const targetState = room.getState(target);
      if (targetState) {
        bot.throwSnowball(targetState.x, targetState.y);
        if (rng.random() < 0.3) {
          bot.doEmote(choose([1, 4, 7, 9, 10]));
        }
      }
    }
  },
  {
    id: BehaviorId.PlayHockey,
    uses: ['locomotion', 'room'],
    duration({ rng }) {
      return rng.random() * 3 + 2;
    },
    cooldown({ rng }) {
      return rng.random() * 8 + 4;
    },
    success({ room }) {
      return room.id === ICE_RINK_ROOM_ID;
    },
    async start({ bot, room }) {
      const puck = bot.world.getPuck(room) ?? RINK_PUCK_START;
      const [nearX, nearY] = pointNearPuck(puck);
      await bot.walk(nearX, nearY);

      const currentRoom = bot.world.getPenguinRoom(bot.penguin);
      if (currentRoom?.id !== room.id) return;

      const state = room.getState(bot.penguin);
      if (!state) return;

      const dx = state.x - puck[0];
      const dy = state.y - puck[1];
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= RINK_PUCK_TOUCH_RADIUS + 25) {
        const [targetX, targetY] = hockeyPuckTarget(bot.data.getDate());
        if (bot.world.updatePuck(targetX, targetY, room)) {
          if (bot.data.isPreCpip() && isLower(bot.data.getDate(), RINK_SCOREBOARD_DATE)) {
            bot.simulate('z', 'zm', targetX, targetY);
          } else {
            bot.simulate('z', 'm', bot.penguin.id, targetX, targetY, targetX - puck[0], targetY - puck[1]);
          }
        }
      }
    }
  },
  {
    id: BehaviorId.HostIgloo,
    uses: ['room'],
    duration({ rng, attrs }) {
      return stamina(attrs.iglooFan, rng.random() * 900);
    },
    cooldown({ rng, attrs }) {
      return eagerness(attrs.roomDistraction, rng.random() * 300);
    },
    success({ rng, attrs }) {
      return rng.random() * attrs.iglooFan > 0.9;
    },
    async start({ bot }) {
      await bot.enter(IGLOO_ROOM_BASE + bot.penguin.id);
      bot.openIgloo();
    },
  },
  {
    id: BehaviorId.JoinDanceFloor,
    uses: ['locomotion', 'pose', 'room'],
    duration({ rng, attrs }) {
      return stamina(attrs.danceFan, rng.random() * 180);
    },
    cooldown({ rng, attrs }) {
      return eagerness(attrs.danceFan, rng.random() * 30);
    },
    success({ room, rng, attrs }) {
      return room.id === ROOMS.dance.id && (rng.random() * attrs.danceFan > 0.3); 
    },
    async start({ bot }) {
      bot.joinDanceFloor();
    },
  },
  {
    id: BehaviorId.MatchDanceColor,
    uses: ['appearance'],
    duration() {
      return 0;
    },
    cooldown({ rng, attrs }) {
      return eagerness(attrs.secretsFan, rng.random() * 30);
    },
    success({ bot, rng, attrs, now }) {
      return bot.isDoingAction(BehaviorId.JoinDanceFloor, now) && rng.random() * attrs.danceFan > 0.3;
    },
    async start({ room, bot }) {
      const colors = new Map<number, number>();
      room.players.forEach((p) => {
        colors.set(p.inventory.color, (colors.get(p.inventory.color) ?? 0) + 1);
      });
      const entries = [...colors.entries()];
      let mostPopular = entries[0][0];
      let mostAmount = entries[0][1];
      for (const [id, amount] of entries.slice(1)) {
        if (amount > mostAmount) {
          mostAmount = amount;
          mostPopular = id;
        }
      }
      bot.schedule(() => {
        bot.wearItem('color', mostPopular);
      }, 4 + Math.random() * 2);
    }
  },
  {
    id: BehaviorId.TipTheBerg,
    uses: ['locomotion', 'pose', 'appearance', 'room'],
    duration({ rng, attrs }) {
      return stamina(Math.pow(Math.max(attrs.mythsFan, attrs.stampsFan), 2), rng.random() * 600);
    },
    cooldown({ rng, attrs }) {
      return eagerness(Math.max(attrs.mythsFan, attrs.stampsFan), rng.random() * 120);
    },
    success({ room, attrs, rng }) {
      return room.id === ROOMS.berg.id && Math.max(attrs.mythsFan, attrs.stampsFan) > rng.random();
    },
    async start({ bot, room }) {
      const [x, y] = findLeftmostMiddlemostPosition(getBlock('berg'), getPositionsFromRoom(room));
      bot.wearItem('head', 429);
      bot.wearItem('face', 0);
      bot.wearItem('neck', 0);
      bot.wearItem('body', 0);
      bot.wearItem('hand', 0);
      bot.wearItem('feet', 0);
      await bot.walk(x, y);
      bot.doDance();
    },
    end({ bot }) {
      bot.wearOutfit();
    },
  },
  {
    id: BehaviorId.FormBand,
    uses: ['locomotion', 'appearance', 'pose', 'room'],
    duration({ rng, attrs }) {
      return stamina(Math.pow(Math.max(attrs.musicFan, attrs.stampsFan), 2), rng.random() * 600);
    },
    cooldown({ rng, attrs }) {
      return eagerness(Math.max(attrs.musicFan, attrs.stampsFan), rng.random() * 120);
    },
    success({ attrs, rng, room }) {
      return room.id === ROOMS.light.id && Math.max(attrs.musicFan, attrs.stampsFan) > rng.random();
    },
    async start({ bot, rng }) {
      bot.joinBand(rng.random(), rng.random());
    },
    end({ bot }) {
      bot.wearOutfit();
    }
  }
];

// generate a more optimized mapping of all the allowed behaviors
const allowedMapping: Record<BehaviorId, BehaviorId[]> = Object.fromEntries(Object.keys(allBehaviors).map(v => [Number(v), []])) as Record<BehaviorId, BehaviorId[]>;
BEHAVIORS.forEach((behavior, i) => {
  for (let j = i + 1; j < BEHAVIORS.length; j++) {
    const other = BEHAVIORS[j];
    if (isDisjoint(behavior.uses, other.uses)) {
      allowedMapping[behavior.id].push(other.id);
      allowedMapping[other.id].push(behavior.id);
    }  
  }
});

function getPositionsFromRoom(room: WorldRoom): Array<[number, number]> {
  return room.players.map(p => {
    const state = room.getState(p);
    return [state.x, state.y];
  });
}

export function getRandomPointInRoom(room: WorldRoom): [number, number] {
  if (room.id === ROOMS.berg.id) {
    const pt = getRandomPositionFromBlock(getBlock('berg'));
    return [pt[0], Math.min(pt[1], 410)];
  }
  const zone = SPAWN_ZONES[room.id];
  if (zone) {
    const [xMin, yMin, xMax, yMax] = zone;
    return [randomInt(xMin, xMax), Math.min(randomInt(yMin, yMax), 410)];
  }
  if (room.id === ROOMS.town.id) {
    const pt = getRandomPositionFromBlock(getBlock('town'));
    return [pt[0], Math.min(pt[1], 410)];
  }
  return [randomInt(250, 550), randomInt(330, 410)];
}

export class Bot implements ClientSocket {
  public isHostingIgloo = false;
  public isPartyHomie = false;
  private _brain: BotBrain | null = null;
  public get busy () {
    if (this._brain !== null) {
      return true;
    }
    const room = this._world.getPenguinRoom(this.penguin);
    if (room !== undefined) {
      if (room.getWaddleRooms().some(w => w.getSeats().some(p => p?.id === this.penguin.id))) {
        return true;
      }
      if (room.getTables().some(t => t.getSeats().some(p => p?.id === this.penguin.id))) {
        return true;
      }
    }
    return false;
  }
  private _timers = new Set<NodeJS.Timeout>();

  private _simulate: (ext: string, code: string, ...args: Array<string | number>) => void;

  private _lenghts: Record<BehaviorId, number> = { ...allBehaviors };
  private _cooldowns: Record<BehaviorId, number> = { ...allBehaviors };
  private _rng: Rng = {
    random() {
      return Math.random()
    },
    choose(xs) {
      return choose(xs);
    },
    int(a, b) {
      return randomInt(a, b);
    },
    logNormal(mu, sigma) {
      return randomLogNormal(mu, sigma);
    }
  }

  public personalityTrait: PersonalityTrait;
  public ageGroup: BotAgeGroup;
  public recentMessages: string[] = [];
  public recentTopics: any[] = [];

  public get name() {
    return this._penguin.name;
  }

  public get membership() {
    return this._penguin.membership;
  }

  public get isMember(): boolean {
    return this._penguin.membership.isMember;
  }

  public get isDev() {
    return DEV_NPC_NAME_SET.has(this._penguin.name);
  }

  public get data() {
    return this._data;
  }

  public get world() {
    return this._world;
  }

  constructor(
    private _penguin: WorldPenguin,
    private _data: GameData,
    private _world: World,
    public nextActionAt: number,
    writeFn: WriteFunction,
    private _attributes: BotAttributes,
    private _manager?: BotManager
  ) {
    this._simulate = (e, c, ...a) => writeFn(this, e, c, ...a);
    this.personalityTrait = _attributes.personalityTrait
      ?? DEV_NPC_TRAITS[this._penguin.name as any]
      ?? choose(['friendly', 'shy', 'grumpy', 'excitable', 'curious']);
    this.ageGroup = _attributes.ageGroup
      ?? sampleRandomAgeGroup(this.isDev);
  }

  public simulate(ext: string, code: string, ...args: Array<string | number>): void {
    this._simulate(ext, code, ...args);
  }

  public get penguin() {
    return this._penguin;
  }

  public async enter(id: number): Promise<void> {
    const room = this._world.getPenguinRoom(this._penguin);
    if (room !== undefined) {
      const path = this._data.getPath(getNameFromId(room.id), getNameFromId(id));
      if (path !== null) {
        for (const { target, pos, spawn } of path) {
          await this.walk(...pos);
          this._simulate('s', this._data.isPreCpip() ? 'jr' : 'j#jr', ROOMS[target].id, ...spawn);
          await this.wait(1);
        }
        const point = getRandomPointInRoom(this._world.getRoom(id));
        await this.walk(...point);
        return;
      }
    }

    const point = getRandomPointInRoom(this._world.getRoom(id));
    this._simulate('s', this._data.isPreCpip() ? 'jr' : 'j#jr', id,
    ...point
    );
  }

  public schedule(fn: () => void, seconds: number): NodeJS.Timeout {
    const t = setTimeout(() => {
      this._timers.delete(t);
      fn();
    }, seconds * 1000);

    this._timers.add(t);
    return t;
  }

  private clearAllTimers() {
    this._timers.forEach(clearTimeout);
    this._timers.clear();
  }

  public async write(message: string): Promise<void> {
    const split = message.split('%');
    const name = split[2];
    const args = split.slice(4, split.length - 1);

    this.handle(name, args);
  }

  private async reactToMessage(message: string) {
    message = message.toLowerCase();

    // attempt to match a two or one word name, for the room
    const commandMatch = message.match(/^come to (\w+)( \w+)?$/i);
    if (commandMatch !== null) {
      const doubleName = commandMatch[1] + commandMatch[2];
      const singleName = commandMatch[1];
      const room = getRoomFromName(doubleName) ?? getRoomFromName(singleName);
      if (room !== undefined && this._attributes.roomDistraction * this._attributes.followability > Math.pow(Math.random(), 2)) {
        await this.wait(2 * (Math.random() + 1));
        this.stopAllActions();
        await this.enter(room);
      }
    }
  }

  public stopAllActions() {
    this._lenghts = { ...allBehaviors };
    this.clearAllTimers();
  }

  public teleportTo(room: WorldRoom, x: number, y: number): void {
    this.stopAllActions();
    this.nextActionAt = Date.now() + randomInt(1500, 3500);
  }

  private async exitGameMode(targetRoomId?: number) {
    await this.enter(targetRoomId ?? this.chooseRoom());
  }

  private handleOverworld(message: string, args: string[]): void {
    if (message === 'jt') {
      const room = this._world.getPenguinRoom(this._penguin);
      this._brain = new TableBrain(
        room.getTable(Number(args[0])),
        Number(args[1]) - 1,
        room,
        this._penguin,
        this._simulate,
        () => {
          this._brain = null;
          this.doFrame(1);
          this._lenghts[BehaviorId.RandomWalk] = Date.now() + 5000;
        },
        this._rng
      );
      this._simulate('z', 'gz');
      this._simulate('z', 'jz');
    } else if (message === 'sm') {
      this.reactToMessage(args[1]);
    }
  }
  

  private handle(name: string, args: string[]): void {
    this._brain?.handle(name, args) ?? this.handleOverworld(name, args);
  }

  public joinCard(card: CardJitsu): void {
    this._brain = new CardJitsuBrain(
      card,
      card.getNinja(this._penguin),
      card.getSeatId(this._penguin),
      this._simulate,
      () => {
        this._brain = null;
        this.exitGameMode();
      }
    );
  }

  public joinSled(sled: SledRace): void {
    this.stopAllActions();
    this._brain = new SledBrain(
      sled,
      sled.getSeatId(this._penguin),
      this._simulate,
      () => {
        this._brain = null;
        this.exitGameMode(230);
      }
    );
  }

  public async sitAtTable(tableId: number): Promise<void> {
    const room = this._world.getPenguinRoom(this._penguin);
    if (!room) return;
    const table = room.getTable(tableId);
    if (!table) return;

    // Which seat is open?
    const seats = table.getSeats();
    const targetSeatIndex = seats[0] === null ? 0 : 1;

    // Stop all wandering/ambient actions so bot is not interrupted while walking to chair
    this.stopAllActions();

    const seatConfig = TABLE_SEAT_POSITIONS[tableId]?.[targetSeatIndex];
    if (seatConfig) {
      await this.walk(seatConfig.x, seatConfig.y);
      this.doFrame(seatConfig.frame);
      await this.wait(0.5);
    }

    this._simulate('s', this._data.isPreCpip() ? 'jt' : 'a#jt', tableId);
  }

  public throwSnowball(x: number, y: number) {
    if (this._data.isPreCpip()) {
      this._simulate('s', 'sb', x, y);
    } else {
      this._simulate('s', 'u#sb', x, y);
    }
  }

  public doEmote(emote: number) {
    if (this._data.isPreCpip()) {
      this._simulate('s', 'se', emote);
    } else {
      this._simulate('s', 'u#se', emote);
    }
  }

  public doFrame(frame: number) {
    if (this._data.isPreCpip()) {
      this._simulate('s', 'sf', frame);
    } else {
      this._simulate('s', 'u#sf', frame);
    }
  }

  public sendMessage(message: string) {
    if (message.length > 48) {
      message = message.slice(0, 48);
    }
    if (this._data.isPreCpip()) {
      this._simulate('m', 'sm', this._penguin.id, message);
    } else {
      this._simulate('s', 'm#sm', this._penguin.id, message);
    }
  }

  private async wait(seconds: number) {
    return new Promise<void>((res) => {
      this.schedule(() => {
        res();
      }, seconds);
    });
  }

  public async walk(x: number, y: number) {
    y = Math.min(y, 410);
    const room = this._world.getPenguinRoom(this._penguin);
    if (room === undefined) {
      return;
    }

    const state = room.getState(this._penguin);
    if (state === undefined) {
      return;
    }

    // Only Iceberg and Town have authentic collision block grids
    if (room.id === ROOMS.town.id || room.id === ROOMS.berg.id) {
      const roomBlock = getBlock(getNameFromId(room.id));
      const [scaledX, scaledY] = [Math.floor(x / roomBlock.scale), Math.floor(y / roomBlock.scale)];
      const path = compactPath(findPathBetweenBlockPoints([state.x, state.y], [scaledX, scaledY], roomBlock), roomBlock);

      if (path.length > 0) {
        return new Promise<void>((res) => {
          const nextStep = (step: number) => {
            const currentRoom = this._world.getPenguinRoom(this._penguin);
            if (!currentRoom || !currentRoom.hasRealPlayers) {
              res();
              return;
            }
            if (step < path.length) {
              const [unscaledX, unscaledY] = [path[step][0] * roomBlock.scale, Math.min(path[step][1] * roomBlock.scale, 410)];
              const distance = Math.sqrt(Math.pow(unscaledX - state.x, 2) + Math.pow(unscaledY - state.y, 2));
              this._simulate('s', this._data.isPreCpip() ? 'sp' : 'u#sp', unscaledX, unscaledY);

              // 4.8 pixels per frame at 24 fps
              const time = distance / 4.8 / 24 + 1;

              this.schedule(() => {
                nextStep(step + 1);
              }, time);
            } else {
              res();
            }
          };
          nextStep(0);
        });
      }
    }

    // Direct movement for rooms without collision grids
    return new Promise<void>((res) => {
      const distance = Math.sqrt(Math.pow(x - state.x, 2) + Math.pow(y - state.y, 2));
      this._simulate('s', this._data.isPreCpip() ? 'sp' : 'u#sp', x, y);
      const time = distance / 4.8 / 24 + 0.5;
      this.schedule(() => {
        res();
      }, time);
    });
  }

  public chooseRoom(): number {
    if (this.isDev && this._data.getDate() === '2005-10-24') {
      const devRooms = [100, 110, 120]; // Town, Coffee Shop, Dance Club
      return choose(devRooms);
    }

    // Small chance (~7%) to visit an open igloo where the owner is inside
    if (Math.random() < 0.07) {
      const openPlayers = this._world.getOpenIglooPlayers();
      const eligibleIgloos: number[] = [];
      for (const p of openPlayers) {
        if (p.id === this.penguin.id) continue;
        const currentRoom = this._world.getPenguinRoom(p);
        const pIglooId = p.id + IGLOO_ROOM_BASE;
        if (currentRoom && currentRoom.id === pIglooId) {
          if (this._manager && this._manager.hasBuddyNameConflictForBot(currentRoom, this._penguin, p)) {
            continue;
          }
          eligibleIgloos.push(pIglooId);
        }
      }
      if (eligibleIgloos.length > 0) {
        return choose(eligibleIgloos);
      }
    }

    const availableRooms = this._data.getAvailableRooms();
    const canGo = availableRooms.filter(r => {
      if (r === 'agent') {
        return this._penguin.inventory.has(800) || this._penguin.psa?.isAgent;
      }
      return this._penguin.membership.isMember || !this._data.isRoomMember(r);
    });
    let validRoomIds = canGo
      .map(name => ROOMS[name]?.id)
      .filter((id): id is number => id !== undefined && id < IGLOO_ROOM_BASE);

    if (this._manager) {
      const nonConflicting = validRoomIds.filter(roomId => {
        const room = this._world.getRoom(roomId);
        return !this._manager?.hasBuddyNameConflictForBot(room, this._penguin);
      });
      if (nonConflicting.length > 0) {
        validRoomIds = nonConflicting;
      }
    }

    if (validRoomIds.length === 0) {
      return 100;
    }

    const currentDate = this._data.getDate();
    const weightMap = getRoomWeightMap(currentDate);

    // Sum total base weights across available rooms to compute target share per room
    let totalBaseWeight = 0;
    for (const rId of validRoomIds) {
      totalBaseWeight += Math.max(1, weightMap.get(rId) ?? 1);
    }

    const totalBots = this._world.players.filter(p => isBot(p)).length || validRoomIds.length * 3;

    // Weight each room based on its hotspot base weight and how much room it has relative to its target share
    const weights = validRoomIds.map(roomId => {
      const room = this._world.getRoom(roomId);
      const currentCount = room.players.length;
      const baseWeight = Math.max(1, weightMap.get(roomId) ?? 1);
      const targetShare = Math.max(1, (baseWeight / totalBaseWeight) * totalBots);

      let weightMultiplier: number;
      if (room.hasRealPlayers) {
        // Bots naturally want to hang out in rooms with real human players!
        if (currentCount < targetShare) {
          weightMultiplier = 3.0 + 2.0 * (targetShare - currentCount) / targetShare;
        } else {
          weightMultiplier = Math.max(0.8, targetShare / (currentCount + 1));
        }
      } else if (currentCount === 0) {
        weightMultiplier = 1.2;
      } else if (currentCount < targetShare) {
        weightMultiplier = 1.0 + (targetShare - currentCount) / targetShare;
      } else {
        weightMultiplier = Math.max(0.1, targetShare / (currentCount + 1));
      }

      return baseWeight * weightMultiplier;
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let rand = Math.random() * totalWeight;
    for (let i = 0; i < validRoomIds.length; i++) {
      rand -= weights[i];
      if (rand <= 0) {
        return validRoomIds[i];
      }
    }

    return validRoomIds[0];
  }

  public executeSteps(steps: DialogueStep[], extraDelayMs = 0): void {
    for (const step of steps) {
      this.schedule(() => {
        const room = this._world.getPenguinRoom(this._penguin);
        if (!room || !room.hasRealPlayers) return;

        switch (step.action.type) {
          case 'chat': {
            this.sendMessage(step.action.message);
            this.recentMessages.push(step.action.message);
            if (this.recentMessages.length > 10) {
              this.recentMessages.shift();
            }
            break;
          }
          case 'emote': {
            this.doEmote(step.action.emoteId);
            break;
          }
          case 'frame': {
            this.doFrame(step.action.frame);
            break;
          }
          case 'snowball': {
            this.throwSnowball(step.action.x ?? 300, step.action.y ?? 300);
            break;
          }
          case 'move': {
            this.walk(step.action.x, step.action.y);
            break;
          }
        }
      }, (step.delayMs + extraDelayMs) / 1000);
    }
  }

  public sendDynamicMessage(room: WorldRoom): void {
    if (!room.hasRealPlayers) return;

    if (room.id >= IGLOO_ROOM_BASE) {
      this.sendIglooMessage(room);
      return;
    }

    if (this.isDev) {
      this.sendDevMessage(room);
      return;
    }

    // Attempt initiating a multi-bot dialogue chain with another bot in the room
    if (this._manager && Math.random() < 0.45) {
      if (this._manager.tryTriggerDialogueChain(room, this)) {
        return;
      }
    }

    const dialogue = PERSONALITY_DIALOGUE[this.personalityTrait];
    const currentDate = this._data.getDate();
    if (!dialogue) {
      this.sendMessage(choose(getEligibleChatLines(currentDate)));
      return;
    }

    // 40% chance to speak about ambient real-world topics partitioned by age group and personality trait
    if (Math.random() < 0.40) {
      this.sendMessage(getAmbientSoloLine(this.ageGroup, this.personalityTrait));
      return;
    }

    const roomPool = dialogue.onIdle[room.id];
    const anyPool = dialogue.onIdle['any'];

    let pool: DialoguePool;
    if (roomPool && roomPool.length > 0 && Math.random() < 0.7) {
      pool = roomPool;
    } else {
      pool = anyPool ?? [];
    }

    const entry = pickFromPool(pool, currentDate, this, room);
    if (entry !== undefined) {
      this.executeSteps(entry.steps);
    } else {
      this.sendMessage(choose(getEligibleChatLines(currentDate)));
    }
  }

  private sendDevMessage(room: WorldRoom): void {
    const currentDate = this._data.getDate();
    const devName = this._penguin.name;

    // Beta Test Party (2005-09-21)
    if (currentDate === '2005-09-21') {
      const partyLinesByDev: Record<string, string[]> = {
        'Rsnail': [
          'welcome to the beta party eh! :)',
          'thanks so much for testing club penguin!',
          'grab a party hat from the boxes in town!',
          'so great seeing everyone testing today :)'
        ],
        'Billybob': [
          'billybob here! thanks for coming out eh! :)',
          'everyone loving the party hats? so cool!',
          'thanks a bunch for testing with us! :)'
        ],
        'Screenhog': [
          'hope you like the party hat i drew! :D',
          'screenhog here! loving the music eh!',
          'drawing all these penguins is a blast! :D'
        ],
        'Gizmo': [
          'gizmo here! servers holding up great eh!',
          'welcome to the beta test party everyone! :)',
          'thanks for helping us test the server! :)'
        ]
      };
      const lines = partyLinesByDev[devName] ?? [
        'welcome to the beta test party eh! :)',
        'thanks so much for testing club penguin!'
      ];
      this.sendMessage(choose(lines));
      return;
    }

    // Launch Day (2005-10-24)
    if (currentDate === '2005-10-24') {
      const launchLinesByDev: Record<string, string[]> = {
        'Rsnail': [
          'welcome to launch day everyone! :)',
          'rsnail here! thanks for playing club penguin',
          'we are officially launched eh! so happy!',
          'hope you are enjoying the island eh! :)'
        ],
        'Billybob': [
          'billybob here! happy launch day eh! :D',
          'welcome new penguins and beta testers alike!',
          'thanks a million for joining us today! :)'
        ],
        'Screenhog': [
          'screenhog here! hope you like the art! :D',
          'look at the shadows under our feet eh! :D',
          'working on new tunes for the coffee shop! :)'
        ],
        'Gizmo': [
          'gizmo here! happy launch day everyone! :)',
          'so glad to have you all here on the island!',
          'thanks for being part of club penguin eh! :)'
        ]
      };
      const lines = launchLinesByDev[devName] ?? [
        'welcome to official launch day everyone! :)',
        'thanks so much for joining us on the island!'
      ];
      this.sendMessage(choose(lines));
      return;
    }

    // General / other dates
    const generalLinesByDev: Record<string, string[]> = {
      'Rsnail': [
        'hope you are having fun on the island eh! :)',
        'rsnail here! let us know if you find bugs',
        'thanks for playing club penguin with us! :)'
      ],
      'Billybob': [
        'billybob here! hope you are having a blast!',
        'always happy to see new penguins waddling! :)',
        'thanks a bunch for stopping by eh! :)'
      ],
      'Screenhog': [
        'screenhog here! doodling some new rooms :)',
        'hope you enjoy the island music and art! :D',
        'having such a fun time animating penguins! :D'
      ],
      'Gizmo': [
        'gizmo here! everything running smoothly eh!',
        'hi there! thanks for waddling around with us',
        'hope you have a wonderful day on the island'
      ]
    };
    const lines = generalLinesByDev[devName] ?? [
      'hope you have a wonderful day on the island',
      'thanks so much for playing with us today! :)'
    ];
    this.sendMessage(choose(lines));
  }

  public sendIglooMessage(room: WorldRoom): void {
    const isOwner = (this.penguin.id + IGLOO_ROOM_BASE) === room.id;
    const trait = this.personalityTrait;

    const ownerLines: Record<PersonalityTrait, string[]> = {
      friendly: [
        'welcome to my igloo! :)',
        'make yourself at home!',
        'feel free to take a seat!',
        'thanks for stopping by my crib!',
        'do you like the music in here?'
      ],
      excitable: [
        'WOOOO WELCOME TO THE PARTY!!',
        'EVERYONE HIT THE DANCE FLOOR!!',
        'turn up the stereo!!',
        'who wants pizza?!',
        'BEST IGLOO PARTY EVER!!'
      ],
      curious: [
        'what do you think of my furniture arrangement?',
        'i saved up so many coins for this igloo upgrade!',
        'do you have any decorating tips?',
        'what music track is your favorite for igloos?'
      ],
      grumpy: [
        "don't mess up my furniture",
        'wipe your flippers at the door',
        'who left the door open?',
        'turn that music down a notch...'
      ],
      shy: [
        'hi... thanks for coming over...',
        'i just got this new chair...',
        'i hope you like the vibes in here...',
        'make yourself comfy...'
      ]
    };

    const currentDate = this._data.getDate();
    const guestLines: Record<PersonalityTrait, string[]> = {
      friendly: [
        'great igloo! loving the setup',
        'this place is so cozy',
        'turn up the music! ♫',
        ...(isGreaterOrEqual(currentDate, '2006-04-27') ? ['who wants to play find four later?'] : ['who wants to play minigames later?']),
        'love what you did with the furniture!'
      ],
      excitable: [
        'THIS PARTY IS OFF THE HOOK!!',
        'CHECK OUT MY MOVES!!',
        "LET'S GOOOOO!!",
        'THIS SONG IS MY JAM!!',
        'who brought the snacks?!'
      ],
      curious: [
        'where did you buy this couch?',
        'how many coins was this?',
        'i should get one of these for my igloo too',
        'great color coordination in here!'
      ],
      grumpy: [
        "it's pretty loud in here",
        'not bad for an igloo i guess',
        'who spilled punch on the carpet?',
        'where are the snacks?'
      ],
      shy: [
        'cool igloo...',
        'nice music track...',
        'i like the colors here...',
        'very peaceful...'
      ]
    };

    const pool = isOwner
      ? (ownerLines[trait] ?? ownerLines.friendly)
      : (guestLines[trait] ?? guestLines.friendly);

    const message = choose(pool);
    this.sendMessage(message);

    // Occasional emote or animation
    const roll = Math.random();
    if (roll < 0.25) {
      this.doDance();
    } else if (roll < 0.5) {
      this.doFrame(25); // wave
    } else if (roll < 0.7) {
      this.doEmote(choose([1, 5, 6, 10, 22, 25])); // smile, heart, music note, thumbs up, igloo, cake/pizza
    }
  }

  public openIgloo(): void {
    if (this._data.isPreCpip()) {
      this._simulate('r', 'or', this.penguin.id);
    } else {
      this._simulate('s', 'g#or', this.penguin.id, this.penguin.name);
    }
  }

  public doDance(): void {
    this.doFrame(26);
  }

  public async joinDanceFloor(): Promise<void> {
    const y = randomInt(267,413);
    const minX = (149-205) / (413-267) * (y - 267) + 205;
    const maxX = (489-442) / (413-267) * (y - 267) + 489;
    await this.walk(randomInt(minX, maxX), y);
    this.doDance();
  }

  public async joinBand(deltaX: number, deltaY: number): Promise<void> {
    const BAND_ROLES: Array<[EquipProp, number, [number, number]]> = [
      ['hand', 233, [117, 337]],
      ['hand', 234, [139, 302]],
      ['hand', 729, [43, 308]],
      ['body', 293, [44, 351]],
      ['hand', 5014, [176, 268]],
      ['hand', 340, [87, 225]]
    ];

    const taken = BAND_ROLES.map(() => false);

    const room = this._world.getPenguinRoom(this._penguin);
    room.players.forEach(p => {
      let i = 0;
      for (const [prop, id] of BAND_ROLES) {
        if (p.inventory[prop] === id) {
          taken[i] = true;
          break;
        }
        i++;
      }
    });

    const notYetTaken = taken.map((v, i): [number, boolean] => [i, v]).filter(([,v]) => !v);
    const roleIndex = notYetTaken.length === 0 ? randomInt(0, BAND_ROLES.length - 1) : choose(notYetTaken)[0];

    const role = BAND_ROLES[roleIndex];
    const x = Math.round(role[2][0] + (deltaX - 0.5) * 30);
    const y = Math.round(role[2][1] + (deltaY - 0.5) * 30);

    this.wearItem('body', 0);
    this.wearItem('hand', 0);
    this.wearItem('face', 0);
    this.wearItem('feet', 0);
    this.wearItem('head', 0);
    this.wearItem('neck', 0);
    this.wearItem(role[0], role[1]);
    await this.walk(x, y);
    this.doDance();
  }

  public wearOutfit(): void {
    const outfit = generateRandomOutfit(this._data, [...this._penguin.inventory.items], this.isMember);
    equipProp.forEach(prop => {
      this.wearItem(prop, outfit[prop]);
    })
  }

  public wearItem(type: EquipProp, id: number): void {
    const code = {
      'color': 'c',
      'head': 'h',
      'neck': 'n',
      'hand': 'a',
      'body': 'b',
      'feet': 'e',
      'face': 'f'
    }[type];
    this._penguin.inventory.updateWear({ [type]: id });
    if (code !== undefined) {
      this._simulate('s', `s#up${code}`, id);
    }
  }

  public act(): void {
    if (this._brain !== null) {
      return;
    }
    const room = this._world.getPenguinRoom(this.penguin);
    if (room === undefined || !room.hasRealPlayers) {
      return;
    }
    if (room.getWaddleRooms().some(w => w.getSeats().some(p => p?.id === this.penguin.id))) {
      return;
    }
    if (room.getTables().some(t => t.getSeats().some(p => p?.id === this.penguin.id))) {
      return;
    }

    const ctx: BotContext = {
      bot: this,
      room: this._world.getPenguinRoom(this._penguin),
      rng: this._rng,
      now: Date.now(),
      attrs: this._attributes
    }

    const allowed = new Set<BehaviorId>();
    let ongoing = false;
    iterateEntries(this._lenghts, (behavior, time) => {
      if (time > ctx.now) {
        ongoing = true;
        allowedMapping[Number(behavior) as BehaviorId].forEach(b => {
          allowed.add(b);
        });
      }
    });

    const takeAllowedIntoAccount = ongoing;



    for (const action of shuffleArray(BEHAVIORS)) {
      // whether the variable uses a locked action
      if (takeAllowedIntoAccount && !allowed.has(action.id)) {
        continue;
      }

      if (this.isOnCooldown(action.id, ctx.now)) {
        continue;
      }

      if (action.success(ctx)) {
        const len = action.duration(ctx);
        const cooldown = action.cooldown(ctx);
        action.start(ctx).then(() => {
          if (action.end !== undefined) {
            this.schedule(() => {
              action.end(ctx);
            }, len);
          }
        });
        this._lenghts[action.id] = ctx.now + len * 1000;
        this._cooldowns[action.id] = ctx.now + (len + cooldown) * 1000;
        break;
      }
    }
  }

  public isDoingAction(id: BehaviorId, now: number): boolean {
    return this._lenghts[id] > now;
  }

  public isOnCooldown(id: BehaviorId, now: number): boolean {
    return this._cooldowns[id] > now;
  }

  public markHome(): void {
    // Keep bot in their igloo for at least 60 seconds
    this._lenghts[BehaviorId.HostIgloo] = Date.now() + 60_000;
  }

  public reactToIglooVisitor(visitor: WorldPenguin, room: WorldRoom): void {
    const delayMs = randomInt(1000, 1800);

    setTimeout(() => {
      const currentBotRoom = this._world.getPenguinRoom(this._penguin);
      const currentVisitorRoom = this._world.getPenguinRoom(visitor);
      if (currentBotRoom?.id !== room.id || currentVisitorRoom?.id !== room.id) {
        return;
      }

      const visitorState = room.getState(visitor);

      // Archetype selection based on bot attributes
      let archetype: 'pissed' | 'excited_decor' | 'pleased' | 'startled';
      const roll = Math.random();

      if (this._attributes.snowballFan > 0.55 && this._attributes.followability < 0.45) {
        archetype = roll < 0.7 ? 'pissed' : 'startled';
      } else if (this._attributes.iglooFan > 0.5) {
        archetype = roll < 0.65 ? 'excited_decor' : (roll < 0.85 ? 'pleased' : 'pissed');
      } else if (this._attributes.waveFan > 0.4 || this._attributes.chatFan > 0.5) {
        archetype = roll < 0.6 ? 'pleased' : (roll < 0.8 ? 'excited_decor' : 'startled');
      } else {
        if (roll < 0.28) archetype = 'pissed';
        else if (roll < 0.56) archetype = 'excited_decor';
        else if (roll < 0.82) archetype = 'pleased';
        else archetype = 'startled';
      }

      switch (archetype) {
        case 'pissed': {
          const line = choose(IGLOO_PISSED_LINES);
          this.doEmote(choose([4, 8])); // mad frown or angry
          setTimeout(() => {
            if (this._world.getPenguinRoom(this._penguin)?.id === room.id) {
              this.sendMessage(line);
            }
          }, 400);

          // Throw a snowball right at the intruder!
          setTimeout(() => {
            if (
              this._world.getPenguinRoom(this._penguin)?.id === room.id &&
              this._world.getPenguinRoom(visitor)?.id === room.id
            ) {
              this.throwSnowball(visitorState.x, visitorState.y);
            }
          }, 1400);
          break;
        }

        case 'excited_decor': {
          const line = choose(IGLOO_DECOR_LINES);
          this.doEmote(choose([1, 9])); // smile or cheer
          setTimeout(() => {
            if (this._world.getPenguinRoom(this._penguin)?.id === room.id) {
              this.sendMessage(line);
            }
          }, 400);

          // Show off with a dance
          setTimeout(() => {
            if (this._world.getPenguinRoom(this._penguin)?.id === room.id) {
              this.doDance();
            }
          }, 1500);
          break;
        }

        case 'pleased': {
          const line = choose(IGLOO_PLEASED_LINES);
          this.doEmote(choose([1, 5, 11])); // smile, heart, coffee
          setTimeout(() => {
            if (this._world.getPenguinRoom(this._penguin)?.id === room.id) {
              this.sendMessage(line);
            }
          }, 400);

          // Wave to the visitor
          setTimeout(() => {
            if (this._world.getPenguinRoom(this._penguin)?.id === room.id) {
              this.doFrame(25); // wave
            }
          }, 1300);
          break;
        }

        case 'startled': {
          const line = choose(IGLOO_STARTLED_LINES);
          this.doEmote(choose([7, 10])); // surprise/gasp or sweat
          setTimeout(() => {
            if (this._world.getPenguinRoom(this._penguin)?.id === room.id) {
              this.sendMessage(line);
            }
          }, 400);
          break;
        }
      }
    }, delayMs);
  }

  public end() {};
}
