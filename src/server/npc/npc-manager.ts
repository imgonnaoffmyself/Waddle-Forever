// ============================================================
// NPC Module — NPC Manager
// ============================================================
//
// Manages the full lifecycle of NPC penguins:
//   - Spawning a pool of randomized NPCs at activation
//   - Room-to-room roaming on individual dwell timers
//   - Idle dialogue timers
//   - Reacting to player join, leave, chat, and emotes
//   - NPC-to-NPC dialogue exchanges
//   - Rare item detection on player join

import { isGreaterOrEqual, isLower } from '@server/routes/versions';
import { GameData } from '@server/timelines/game-data';
import { XtMessenger as PenguinMessenger } from '@server/socket-server/xt-messenger';
import { RINK_PUCK_START, World } from '@server/socket-server/world/world';
import { WorldRoom } from '@server/socket-server/world/world-room';
import { WorldPenguin } from '@server/socket-server/world/world-penguin';
import { WorldTable } from '@server/socket-server/world/world-table';
import { getPenguinString } from '@server/socket-server/handlers/join';
import { isRareItem } from './npc-clothing';
import { NpcPenguin } from './npc-penguin';
import { NPC_NAME_POOL } from './npc-names';
import { PERSONALITY_DIALOGUE } from './npc-dialogue';
import {
  PersonalityTrait,
  DialoguePool,
  DialogueStep,
  NpcAction,
  TimelineGate,
  DialoguePoolEntry,
} from './npc-types';

// ─── Configuration ───────────────────────────────────────────

/** Number of NPC penguins spawned when the module activates */
const BASE_NPC_COUNT = 100;
const BETA_TEST_PARTY_DATE = '2005-09-21';
const BETA_TEST_PARTY_END_DATE = '2005-09-22';
const BETA_TEST_PARTY_GATE: TimelineGate = { after: BETA_TEST_PARTY_DATE, before: BETA_TEST_PARTY_END_DATE };
const BETA_TEST_PARTY_NPC_MULTIPLIER = 3;
const BETA_TEST_PARTY_NPC_COUNT = BASE_NPC_COUNT * BETA_TEST_PARTY_NPC_MULTIPLIER;
export const DEV_NPC_NAMES = ['Rsnail', 'Billybob', 'Gizmo', 'Screenhog'] as const;
export const DEV_NPC_NAME_SET = new Set<string>(DEV_NPC_NAMES);
export const DEV_NPC_TRAITS: Record<(typeof DEV_NPC_NAMES)[number], PersonalityTrait> = {
  Rsnail: 'friendly',
  Billybob: 'curious',
  Gizmo: 'shy',
  Screenhog: 'grumpy',
};

/** Exact timeline snapshots that enable the NPC module */
const ACTIVE_DATES = new Set(['2005-08-22', '2005-09-12', '2005-09-13', BETA_TEST_PARTY_DATE, '2005-09-22']);

export const SNOW_FORTS_ROOM_ID = 801;
export const ICE_RINK_ROOM_ID = 802;
export const NIGHT_CLUB_ROOM_ID = 120;
const DANCE_FRAME = 26;
const NIGHT_CLUB_POST_MOVE_DANCE_DELAY_MS = 2_500;
const OLD_RINK_PUCK_CHANGE_DATE = '2006-04-01';
export const RINK_SCOREBOARD_DATE = '2006-08-11';
export const RINK_PUCK_TOUCH_RADIUS = 55;

export type WeightedRoomEntry = {
  roomId: number;
  weight: number;
  gate?: TimelineGate;
};

/**
 * Room weighting is defined as one timeline-aware list instead of separate
 * per-date pools. Entries stack, so later timeline entries can add weight to
 * an existing room without redefining the whole pool.
 */
export const ROOM_POOL_ENTRIES: WeightedRoomEntry[] = [
  { roomId: 100, weight: 4 }, // Town
  { roomId: 110, weight: 3 }, // Coffee Shop
  { roomId: 111, weight: 2 }, // Book Room
  { roomId: 120, weight: 3 }, // Dance Club
  { roomId: 121, weight: 1 }, // Dance Lounge
  { roomId: 130, weight: 3 }, // Gift Shop
  { roomId: 200, weight: 1 }, // Ski Village
  { roomId: 800, weight: 2 }, // Dock
  { roomId: 802, weight: 2 }, // Ice Rink
  { roomId: 320, weight: 1 }, // Dojo

  // 2005-09-12: Snow Forts opens as a new hotspot.
  { roomId: SNOW_FORTS_ROOM_ID, weight: 3, gate: { after: '2005-09-12' } },

  // 2005-09-13: Astro Barrier makes the Dance Lounge an actual destination,
  // while Snow Forts cool off slightly from launch-day intensity.
  { roomId: SNOW_FORTS_ROOM_ID, weight: -1, gate: { after: '2005-09-13' } },
  { roomId: 121, weight: 2, gate: { after: '2005-09-13' } },

  // 2005-09-21: Beta Test Party concentrates more traffic in the social hubs.
  { roomId: 121, weight: -1, gate: BETA_TEST_PARTY_GATE },
  { roomId: 100, weight: 1, gate: BETA_TEST_PARTY_GATE },
  { roomId: 130, weight: 1, gate: BETA_TEST_PARTY_GATE },
  { roomId: 120, weight: 1, gate: BETA_TEST_PARTY_GATE },
];

/**
 * Valid spawn rectangle per room [xMin, yMin, xMax, yMax].
 * NPCs pick a random point within this area when entering a room.
 * Values are approximate — adjust if penguins appear clipped.
 */
export const SPAWN_ZONES: Record<number, [number, number, number, number]> = {
  100: [200, 300, 750, 410], // Town
  110: [150, 300, 600, 410], // Coffee Shop
  111: [150, 250, 600, 410], // Book Room
  120: [200, 300, 650, 410], // Dance Club
  121: [150, 280, 600, 410], // Dance Lounge
  130: [180, 300, 550, 410], // Gift Shop
  200: [150, 320, 650, 410], // Ski Village
  800: [250, 350, 700, 410], // Dock
  801: [160, 260, 730, 410], // Snow Forts
  802: [150, 200, 750, 410], // Ice Rink
  320: [200, 250, 600, 410], // Dojo
  221: [150, 200, 500, 380], // Lodge Attic
};


/** Min/max seconds an NPC stays in a room before roaming */
const DWELL_MIN_MS = 15_000;
const DWELL_MAX_MS = 60_000;

/** Min/max seconds between idle dialogue attempts */
const IDLE_MIN_MS = 15_000;
const IDLE_MAX_MS = 40_000;

/** Min/max seconds between ambient movements/actions (waddling, waving) */
const AMBIENT_MIN_MS = 5_000;
const AMBIENT_MAX_MS = 15_000;

/** Probability a rare-item comment fires when a player joins wearing an off-sale item */
const RARE_ITEM_CHANCE = 0.3;

// ─── Helpers ─────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function spawnPosForRoom(roomId: number): [number, number] {
  const zone = SPAWN_ZONES[roomId] ?? [300, 350, 600, 480];
  const [xMin, yMin, xMax, yMax] = zone;
  return [randInt(xMin, xMax), randInt(yMin, yMax)];
}

function randomRinkPuckTarget(): [number, number] {
  return [randInt(220, 620), randInt(150, 390)];
}

export function hockeyPuckTarget(currentDate: string): [number, number] {
  if (isLower(currentDate, OLD_RINK_PUCK_CHANGE_DATE)) {
    return randomRinkPuckTarget();
  }

  const shootsRight = Math.random() < 0.5;
  return [
    shootsRight ? randInt(655, 735) : randInt(145, 225),
    randInt(205, 335)
  ];
}

export function pointNearPuck(puck: [number, number]): [number, number] {
  return [
    puck[0] + randInt(-RINK_PUCK_TOUCH_RADIUS, RINK_PUCK_TOUCH_RADIUS),
    puck[1] + randInt(-RINK_PUCK_TOUCH_RADIUS, RINK_PUCK_TOUCH_RADIUS)
  ];
}

export function getRoomPool(currentDate: string): number[] {
  const roomWeights = new Map<number, number>();

  for (const entry of ROOM_POOL_ENTRIES) {
    if (!gatePass(entry.gate, currentDate)) continue;
    roomWeights.set(entry.roomId, (roomWeights.get(entry.roomId) ?? 0) + entry.weight);
  }

  const pool: number[] = [];
  for (const [roomId, weight] of roomWeights) {
    for (let i = 0; i < weight; i++) {
      pool.push(roomId);
    }
  }

  return pool;
}

function getNpcCount(currentDate: string): number {
  return currentDate === BETA_TEST_PARTY_DATE
    ? BETA_TEST_PARTY_NPC_COUNT
    : BASE_NPC_COUNT;
}

function buildUniqueNamePool(count: number): string[] {
  const names: string[] = [];
  let cycle = 0;

  while (names.length < count) {
    const batch = shuffle(NPC_NAME_POOL);
    for (const baseName of batch) {
      const candidate = cycle === 0 ? baseName : `${baseName}${cycle + 1}`;
      if (DEV_NPC_NAME_SET.has(candidate)) continue;
      names.push(candidate);
      if (names.length === count) {
        break;
      }
    }
    cycle++;
  }

  return names;
}

/** Check whether the current timeline date passes a TimelineGate */
export function gatePass(gate: TimelineGate | undefined, currentDate: string): boolean {
  if (gate === undefined) return true;
  if (gate.before !== undefined && !isLower(currentDate, gate.before)) return false;
  if (gate.after  !== undefined && !isGreaterOrEqual(currentDate, gate.after)) return false;
  return true;
}

/** Pick one eligible entry from a DialoguePool; returns undefined if none qualify */
export function pickFromPool(pool: DialoguePool, currentDate: string, npc?: any, room?: WorldRoom): DialoguePoolEntry | undefined {
  const eligible = pool.filter(entry => {
    if (!gatePass(entry.gate, currentDate)) return false;
    if (npc && entry.condition && !entry.condition(npc, room)) return false;

    // Repetition prevention: ensure this entry wasn't recently chosen as a topic
    if (npc && npc.recentTopics && npc.recentTopics.includes(entry)) {
      return false;
    }

    // Secondary repetition prevention: ensure this entry doesn't contain a chat string the NPC recently said
    if (npc && npc.recentMessages && npc.recentMessages.length > 0) {
      const chatSteps = entry.steps.filter(s => s.action.type === 'chat');
      for (const step of chatSteps) {
        if (step.action.type === 'chat' && npc.recentMessages.includes(step.action.message)) {
          return false;
        }
      }
    }

    const chance = entry.chance ?? 1;
    return Math.random() < chance;
  });

  if (eligible.length === 0) return undefined;
  
  const picked = randFrom(eligible);
  
  if (npc && npc.recentTopics) {
    npc.recentTopics.push(picked);
    if (npc.recentTopics.length > 10) {
      npc.recentTopics.shift();
    }
  }
  
  return picked;
}

// ─── NpcManager ──────────────────────────────────────────────

export class NpcManager {
  private npcs: NpcPenguin[] = [];

  /** Current room for each NPC */
  private npcRooms = new Map<NpcPenguin, WorldRoom>();

  /** Dwell timers (auto-room-change) */
  private dwellTimers = new Map<NpcPenguin, NodeJS.Timeout>();

  /** Idle dialogue timers */
  private idleTimers = new Map<NpcPenguin, NodeJS.Timeout>();

  /** Ambient movement/action timers */
  private ambientTimers = new Map<NpcPenguin, NodeJS.Timeout>();

  /** Cooldown timestamps keyed by `${npc.id}:${triggerIndex}` for chat triggers */
  private chatCooldowns = new Map<string, number>();

  /** Cooldown timestamps keyed by `${npcA.id}:${npcB.id}` for NPC exchanges */
  private exchangeCooldowns = new Map<string, number>();

  /** Timestamps for when the last chat message was spoken in a room, keyed by room.id */
  private roomLastSpoken = new Map<number, number>();

  /**
   * Tracks recently matched keywords in a room to prevent the same topic
   * from infinitely bouncing between NPCs.
   * Keyed by room.id, value is a Set of keywords blocked for ~15 seconds.
   */
  private roomRecentKeywords = new Map<number, Set<string>>();

  private active = false;

  constructor(
    private world: World,
    private msg: PenguinMessenger,
    private data: GameData,
  ) {}

  // ── Lifecycle ──────────────────────────────────────────────

  public activate(): void {
    if (this.active) return;
    this.active = true;

    NpcPenguin.resetIdCounter();
    const currentDate = this.data.getDate();
    const npcCount = getNpcCount(currentDate);
    const roomPool = getRoomPool(currentDate);
    const betaHasAllAccess = isLower(currentDate, '2005-10-24');
    const hasBetaTestParty = currentDate === BETA_TEST_PARTY_DATE;

    // Sample names without replacement
    const traits: PersonalityTrait[] = ['friendly', 'shy', 'grumpy', 'excitable', 'curious'];
    const genericNpcCount = hasBetaTestParty ? npcCount - DEV_NPC_NAMES.length : npcCount;
    const namePool = buildUniqueNamePool(genericNpcCount);

    for (let i = 0; i < genericNpcCount; i++) {
      const nameIdx = randInt(0, namePool.length - 1);
      const name = namePool.splice(nameIdx, 1)[0];
      const trait = randFrom(traits);
      const isMember = betaHasAllAccess || Math.random() < 0.7;
      const npc = new NpcPenguin(name, trait, isMember, { currentDate });
      this.npcs.push(npc);

      const roomId = randFrom(roomPool);
      this.spawnNpc(npc, roomId);
    }

    if (hasBetaTestParty) {
      for (const name of DEV_NPC_NAMES) {
        const npc = new NpcPenguin(name, DEV_NPC_TRAITS[name], true, {
          currentDate,
          isDev: true,
        });
        this.npcs.push(npc);

        const roomId = randFrom(roomPool);
        this.spawnNpc(npc, roomId);
      }
    }
  }

  public deactivate(): void {
    if (!this.active) return;
    this.active = false;

    // Clear all timers
    for (const t of this.dwellTimers.values()) clearTimeout(t);
    for (const t of this.idleTimers.values()) clearTimeout(t);
    for (const t of this.ambientTimers.values()) clearTimeout(t);
    this.dwellTimers.clear();
    this.idleTimers.clear();
    this.ambientTimers.clear();

    // Remove all NPCs from their rooms — broadcast rp to real players
    for (const [npc, room] of this.npcRooms) {
      room.removePenguin(npc as any);
      this.msg.send(room.players, 'rp', npc.id);
    }

    this.npcRooms.clear();
    this.npcs = [];
    this.chatCooldowns.clear();
    this.exchangeCooldowns.clear();
    this.roomLastSpoken.clear();
    this.roomRecentKeywords.clear();
  }

  // ── Spawning & Roaming ─────────────────────────────────────

  private spawnNpc(npc: NpcPenguin, roomId: number): void {
    const room = this.world.getRoom(roomId);
    const [x, y] = spawnPosForRoom(roomId);

    room.addPenguin(npc as any, x, y);
    this.npcRooms.set(npc, room);

    // Broadcast new NPC to real players already in the room
    this.msg.send(room.players, 'ap', getPenguinString(this.data, npc as any, { x, y, frame: 1 }));
    this.scheduleNightClubDance(npc, room);

    this.scheduleDwell(npc);
    this.scheduleIdle(npc);
    this.scheduleAmbient(npc);
  }

  private scheduleDwell(npc: NpcPenguin): void {
    const delay = randInt(DWELL_MIN_MS, DWELL_MAX_MS);
    const timer = setTimeout(() => this.roamNpc(npc), delay);
    this.dwellTimers.set(npc, timer);
  }

  private roamNpc(npc: NpcPenguin): void {
    if (!this.active) return;
    const currentRoom = this.npcRooms.get(npc);
    if (currentRoom === undefined) return;

    // Remove from current room
    currentRoom.removePenguin(npc as any);
    this.msg.send(currentRoom.players, 'rp', npc.id);

    // Pick a new room (avoid same room if possible)
    const roomPool = getRoomPool(this.data.getDate());
    const eligible = roomPool.filter(id => id !== currentRoom.id);
    const newRoomId = eligible.length > 0 ? randFrom(eligible) : randFrom(roomPool);
    const newRoom = this.world.getRoom(newRoomId);
    const [x, y] = spawnPosForRoom(newRoomId);

    newRoom.addPenguin(npc as any, x, y);
    this.npcRooms.set(npc, newRoom);

    // Broadcast arrival to players in new room
    this.msg.send(newRoom.players, 'ap', getPenguinString(this.data, npc as any, { x, y, frame: 1 }));
    this.scheduleNightClubDance(npc, newRoom);

    this.scheduleDwell(npc);
  }

  // ── Ambient Actions ────────────────────────────────────────

  private scheduleAmbient(npc: NpcPenguin): void {
    const delay = randInt(AMBIENT_MIN_MS, AMBIENT_MAX_MS);
    const timer = setTimeout(() => this.fireAmbient(npc), delay);
    this.ambientTimers.set(npc, timer);
  }

  private fireAmbient(npc: NpcPenguin): void {
    if (!this.active) return;

    const room = this.npcRooms.get(npc);
    const currentDate = this.data.getDate();
    if (room !== undefined && room.players.length > 0) {
      if (room.id === SNOW_FORTS_ROOM_ID && isGreaterOrEqual(currentDate, '2005-09-12')) {
        const roll = Math.random();
        const hasOtherNpcs = this.getNpcsInRoom(room).some(other => other !== npc);

        // The freshly opened Snow Forts are a high-energy snowball hotspot.
        if (roll < 0.65) {
          const target = hasOtherNpcs && Math.random() < 0.35 ? 'random-npc' : 'random-player';
          this.dispatchAction(npc, room, { type: 'snowball', target });
        } else if (roll < 0.9) {
          const [x, y] = spawnPosForRoom(room.id);
          this.dispatchAction(npc, room, { type: 'move', x, y });
        } else {
          const frames = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 1];
          const frame = randFrom(frames);
          this.dispatchAction(npc, room, { type: 'frame', frame });
        }
      } else if (room.id === NIGHT_CLUB_ROOM_ID) {
        if (Math.random() < 0.7) {
          const [x, y] = spawnPosForRoom(room.id);
          this.dispatchAction(npc, room, { type: 'move', x, y });
        } else {
          this.dispatchAction(npc, room, { type: 'frame', frame: DANCE_FRAME });
        }
	  } else if (room.id === ICE_RINK_ROOM_ID) {
        const roll = Math.random();
        const puck = this.world.getPuck(room) ?? RINK_PUCK_START;

        if (roll < 0.45) {
          const [x, y] = pointNearPuck(puck);
          this.dispatchAction(npc, room, { type: 'move', x, y });

          setTimeout(() => {
            if (!this.active || this.npcRooms.get(npc) !== room) return;

            // Verify the asshole actually walked to the puck before hitting it
            const currentNPCState = room.playerStates.find(([occ]) => occ.id === npc.id);
            if (!currentNPCState) return;

            const npcX = currentNPCState[1].x;
            const npcY = currentNPCState[1].y;
            const dx = npcX - puck[0];
            const dy = npcY - puck[1];
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Give it a small buffer above the touch radius to account for processing/network ticks
            if (distance > RINK_PUCK_TOUCH_RADIUS + 15) return;

            const [targetX, targetY] = hockeyPuckTarget(currentDate);
            this.dispatchAction(npc, room, {
              type: 'hockey_puck',
              x: targetX,
              y: targetY,
              speedX: targetX - puck[0],
              speedY: targetY - puck[1]
            });
          }, randInt(1200, 2200)); // Slightly increased minimum delay to allow for the waddle time
        } else if (roll < 0.75) {
          const [x, y] = spawnPosForRoom(room.id);
          this.dispatchAction(npc, room, { type: 'move', x, y });
        } else {
          const frame = randFrom([17, 18, 19, 20, 21, 22, 23, 24, 25, 1]);
          this.dispatchAction(npc, room, { type: 'frame', frame });
        }
      } else if (Math.random() < 0.7) {
        // 70% chance to waddle to a new spot, 30% chance to do a random frame (wave, sit, dance)
        const [x, y] = spawnPosForRoom(room.id);
        this.dispatchAction(npc, room, { type: 'move', x, y });
      } else {
        const frames = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 1]; // sitting frames, wave, dance, normal
        const frame = randFrom(frames);
        this.dispatchAction(npc, room, { type: 'frame', frame });
      }
    }

    this.scheduleAmbient(npc);
  }

  private scheduleNightClubDance(npc: NpcPenguin, room: WorldRoom, delayMs = 0): void {
    if (room.id !== NIGHT_CLUB_ROOM_ID) return;

    setTimeout(() => {
      if (!this.active) return;
      if (this.npcRooms.get(npc) !== room) return;

      this.dispatchAction(npc, room, { type: 'frame', frame: DANCE_FRAME });
    }, delayMs);
  }

  // ── Idle Dialogue ──────────────────────────────────────────

  private scheduleIdle(npc: NpcPenguin): void {
    const delay = randInt(IDLE_MIN_MS, IDLE_MAX_MS);
    const timer = setTimeout(() => this.fireIdle(npc), delay);
    this.idleTimers.set(npc, timer);
  }

  private fireIdle(npc: NpcPenguin): void {
    if (!this.active) return;

    const room = this.npcRooms.get(npc);
    if (room === undefined || room.players.length === 0) {
      // Nobody in room — still reschedule, just skip dialogue
      this.scheduleIdle(npc);
      return;
    }

    // Prevent idle chat clashing: if someone just spoke in this room in the last 3000ms, skip
    const lastSpoken = this.roomLastSpoken.get(room.id) ?? 0;
    if (Date.now() - lastSpoken < 3000) {
      this.scheduleIdle(npc);
      return;
    }

    const dialogue = PERSONALITY_DIALOGUE[npc.personalityTrait];
    const currentDate = this.data.getDate();

    // Try room-specific pool first, fall back to 'any'
    const roomPool = dialogue.onIdle[room.id];
    const anyPool  = dialogue.onIdle['any'];
    
    let pool: DialoguePool;
    // 70% chance to exclusively use the room-specific pool if it has entries,
    // otherwise fall back to the generic 'any' pool.
    if (roomPool && roomPool.length > 0 && Math.random() < 0.7) {
      pool = roomPool;
    } else {
      pool = anyPool ?? [];
    }

    const entry = pickFromPool(pool, currentDate, npc, room);
    if (entry !== undefined) {
      this.scheduleSteps(npc, room, entry.steps);
    }

    // Also check NPC-to-NPC exchanges on idle tick
    this.checkNpcExchanges(npc, room);

    this.scheduleIdle(npc);
  }

  // ── NPC-to-NPC Exchanges ───────────────────────────────────

  private checkNpcExchanges(npc: NpcPenguin, room: WorldRoom): void {
    const dialogue = PERSONALITY_DIALOGUE[npc.personalityTrait];
    const currentDate = this.data.getDate();
    const now = Date.now();

    // Don't start a new exchange if anyone just spoke in this room recently
    const lastSpoken = this.roomLastSpoken.get(room.id) ?? 0;
    if (now - lastSpoken < 4000) return;

    // Find other NPCs in the same room
    const otherNpcs = [...this.npcRooms.entries()]
      .filter(([other, r]) => other !== npc && r === room)
      .map(([other]) => other);

    if (otherNpcs.length === 0) return;

    for (const exchange of dialogue.npcExchanges) {
      if (!gatePass(exchange.gate, currentDate)) continue;

      const cooldownKey = `${npc.id}:exchange:${dialogue.npcExchanges.indexOf(exchange)}`;
      const lastFired = this.exchangeCooldowns.get(cooldownKey) ?? 0;
      if (now - lastFired < exchange.cooldownMs) continue;

      if (Math.random() >= exchange.chance) continue;

      const eligibleOthers = exchange.condition
        ? otherNpcs.filter(other => exchange.condition?.(npc, other, room))
        : otherNpcs;
      if (eligibleOthers.length === 0) continue;

      const npcB = randFrom(eligibleOthers);
      this.exchangeCooldowns.set(cooldownKey, now);

      // Accumulate timing so B always speaks AFTER A finishes
      let cursor = 0;
      for (const { who, step } of exchange.steps) {
        const actor = who === 'a' ? npc : npcB;
        // Add a natural reading pause between lines (1500ms minimum gap between each speaker)
        const fireAt = cursor + step.delayMs;
        this.scheduleStep(actor, room, { ...step, delayMs: fireAt });
        cursor = fireAt + 2000; // next line can start 2s after this one fires
      }

      break; // only one exchange per idle tick
    }
  }

  // ── Event Hooks ────────────────────────────────────────────

  public onPlayerJoin(room: WorldRoom, player: WorldPenguin): void {
    if (!this.active) return;
    const currentDate = this.data.getDate();

    const npcsInRoom = this.getNpcsInRoom(room);
    if (npcsInRoom.length === 0) return;

    // Rare item check
    const inventory = player.inventory;
    const wornIds = [
      inventory.head, inventory.face, inventory.neck,
      inventory.body, inventory.hand, inventory.feet,
      inventory.pin, inventory.background,
    ].filter(id => id > 0);

    const hasRareItem = wornIds.some(id => isRareItem(id, currentDate));

    let respondents = 0;
    const shuffledNpcs = shuffle(npcsInRoom);

    for (const npc of shuffledNpcs) {
      if (respondents >= 2) break;
      const dialogue = PERSONALITY_DIALOGUE[npc.personalityTrait];

      // Standard join reaction
      const joinPool: DialoguePool = [
        ...(dialogue.onPlayerJoin[room.id] ?? []),
        ...(dialogue.onPlayerJoin['any'] ?? []),
      ];
      const entry = pickFromPool(joinPool, currentDate, npc, room);
      if (entry !== undefined) {
        this.scheduleSteps(npc, room, entry.steps, respondents * 1200);
        respondents++;
      }

      // Rare item reaction (independent roll per NPC)
      if (hasRareItem && Math.random() < RARE_ITEM_CHANCE) {
        const rareEntry = pickFromPool(dialogue.onPlayerRareItem, currentDate, npc);
        if (rareEntry !== undefined) {
          // Delay so it doesn't overlap the join reaction
          this.scheduleSteps(npc, room, rareEntry.steps.map(s => ({
            ...s,
            delayMs: s.delayMs + 4000,
          })), respondents * 1200);
        }
      }
    }
  }

  public onPlayerLeave(room: WorldRoom, player: WorldPenguin): void {
    if (!this.active) return;
    const currentDate = this.data.getDate();

    let respondents = 0;
    const shuffledNpcs = shuffle(this.getNpcsInRoom(room));

    for (const npc of shuffledNpcs) {
      if (respondents >= 2) break;
      const dialogue = PERSONALITY_DIALOGUE[npc.personalityTrait];
      const pool: DialoguePool = [
        ...(dialogue.onPlayerLeave[room.id] ?? []),
        ...(dialogue.onPlayerLeave['any'] ?? []),
      ];
      const entry = pickFromPool(pool, currentDate, npc, room);
      if (entry !== undefined) {
        this.scheduleSteps(npc, room, entry.steps, respondents * 1200);
        respondents++;
      }
    }
  }

  public onPlayerChat(room: WorldRoom, _player: WorldPenguin, message: string): void {
    if (!this.active) return;
    this.handleChatMessage(room, message, null);
  }

  /** Called from dispatchAction when an NPC speaks, so other NPCs can react to it */
  private onNpcChat(room: WorldRoom, speaker: NpcPenguin, message: string): void {
    // Use a short delay so the speaker's bubble appears before a responder reacts
    setTimeout(() => {
      if (!this.active) return;
      this.handleChatMessage(room, message, speaker);
    }, randInt(1500, 3500));
  }

  /**
   * Core keyword-matching logic shared by player chat and NPC chat.
   * @param originNpc  The NPC who spoke (null if originating from a player).
   *                   Excluded from respondents so an NPC never responds to itself.
   */
  private handleChatMessage(room: WorldRoom, message: string, originNpc: NpcPenguin | null): void {
    const currentDate = this.data.getDate();
    const lower = message.toLowerCase();
    const now = Date.now();

    let respondents = 0;
    const allNpcs = this.getNpcsInRoom(room).filter(n => n !== originNpc);
    const shuffledNpcs = shuffle(allNpcs);

    for (const npc of shuffledNpcs) {
      if (respondents >= (originNpc ? 1 : 3)) break; // fewer NPC→NPC responses to keep it natural
      const dialogue = PERSONALITY_DIALOGUE[npc.personalityTrait];

      for (let i = 0; i < dialogue.onPlayerChat.length; i++) {
        const trigger = dialogue.onPlayerChat[i];
        
        // Find all keywords from this trigger that match the message
        const matchedKws = trigger.keywords.filter(kw => lower.includes(kw));
        if (matchedKws.length === 0) continue;

        // Prevent NPC-to-NPC keyword chain loops: if ALL matched keywords are currently
        // blacklisted in this room, ignore the trigger
        const blockedKws = this.roomRecentKeywords.get(room.id);
        if (blockedKws && matchedKws.every(kw => blockedKws.has(kw))) {
          continue;
        }

        const cooldownKey = `${npc.id}:chat:${i}`;
        const lastFired = this.chatCooldowns.get(cooldownKey) ?? 0;
        const cooldown = trigger.cooldownMs ?? 30_000;
        if (now - lastFired < cooldown) continue;

        const entry = pickFromPool(trigger.responses, currentDate, npc, room);
        if (entry !== undefined) {
          this.chatCooldowns.set(cooldownKey, now);
          
          // Blacklist the matched keywords in this room for 15 seconds so NPCs
          // don't bounce the same topic endlessly back and forth
          const chatMsgs = entry.steps.filter(s => s.action.type === 'chat');
          if (chatMsgs.length > 0) {
            let cur = this.roomRecentKeywords.get(room.id);
            if (!cur) {
              cur = new Set<string>();
              this.roomRecentKeywords.set(room.id, cur);
            }
            for (const kw of matchedKws) {
              cur.add(kw);
              setTimeout(() => {
                const s = this.roomRecentKeywords.get(room.id);
                if (s) s.delete(kw);
              }, 15_000);
            }
          }
          
          this.scheduleSteps(npc, room, entry.steps, respondents * 1500);
          respondents++;
          break; // one trigger per NPC per message
        }
      }
    }
  }

  public onPlayerEmote(room: WorldRoom, _player: WorldPenguin, emoteId: number): void {
    if (!this.active) return;
    const currentDate = this.data.getDate();

    let respondents = 0;
    const shuffledNpcs = shuffle(this.getNpcsInRoom(room));

    for (const npc of shuffledNpcs) {
      if (respondents >= 2) break;
      const dialogue = PERSONALITY_DIALOGUE[npc.personalityTrait];

      for (const trigger of dialogue.onPlayerEmote) {
        if (trigger.emoteId !== emoteId) continue;
        if (Math.random() >= trigger.chance) continue;

        const entry = pickFromPool(trigger.responses, currentDate, npc, room);
        if (entry !== undefined) {
          this.scheduleSteps(npc, room, entry.steps, respondents * 1200);
          respondents++;
          break;
        }
      }
    }
  }

  public onPlayerSnowball(room: WorldRoom, originPlayer: WorldPenguin | null, targetX: number, targetY: number): void {
    if (!this.active) return;
    const currentDate = this.data.getDate();
    const now = Date.now();
    const isSeptemberSnowForts = room.id === SNOW_FORTS_ROOM_ID && isGreaterOrEqual(currentDate, '2005-09-12');

    let respondents = 0;
    const shuffledNpcs = shuffle(this.getNpcsInRoom(room));

    for (const npc of shuffledNpcs) {
      if (respondents >= (isSeptemberSnowForts ? 4 : 2)) break;
      const state = room.playerStates.find(([occ]) => occ.id === npc.id);
      if (!state) continue;

      const npcX = state[1].x;
      const npcY = state[1].y;
      
      // Calculate distance between snowball target and NPC
      const dx = targetX - npcX;
      const dy = targetY - npcY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Snow Forts encourage broader splashy snowball fights.
      const hitRadius = isSeptemberSnowForts ? 110 : 80;
      if (distance > hitRadius) continue;

      // Ensure NPC has a cooldown on getting hit to prevent spam
      const cooldownKey = `${npc.id}:snowball_hit`;
      const lastHit = this.chatCooldowns.get(cooldownKey) ?? 0;
      const snowballCooldownMs = isSeptemberSnowForts ? 5_000 : 10_000;
      if (now - lastHit < snowballCooldownMs) continue;

      const dialogue = PERSONALITY_DIALOGUE[npc.personalityTrait];
      const entry = pickFromPool(dialogue.onPlayerSnowball, currentDate, npc, room);
      
      if (entry !== undefined) {
        this.chatCooldowns.set(cooldownKey, now);
        
        // If the entry includes a snowball response targeted at 'origin', we need to resolve it here
        // so that the extra delay doesn't result in a stale target. 
        // We can just dynamically replace 'origin' with the originPlayer's current coords in dispatchAction.
        // To do that easily, let's just let dispatchAction handle 'origin' properly if we store the latest attacker.
        // We'll store it on the NPC! Wait, we can't easily change the NPC object right now without adding a property.
        // Let's just modify the steps directly to include x/y for the origin target!
        const resolvedSteps = entry.steps.map(step => {
          if (step.action.type === 'snowball' && step.action.target === 'origin' && originPlayer) {
            const originState = room.getState(originPlayer);
            return {
              ...step,
              action: { ...step.action, x: originState.x, y: originState.y }
            };
          }
          return step;
        });

        this.scheduleSteps(npc, room, resolvedSteps, respondents * 1200);
        respondents++;
      }
    }
  }

  // ── Action Dispatch ────────────────────────────────────────

  private scheduleSteps(npc: NpcPenguin, room: WorldRoom, steps: DialogueStep[], extraDelayMs = 0): void {
    for (const step of steps) {
      this.scheduleStep(npc, room, step, extraDelayMs);
    }
  }

  private scheduleStep(npc: NpcPenguin, room: WorldRoom, step: DialogueStep, extraDelayMs = 0): void {
    setTimeout(() => {
      if (!this.active) return;
      // Verify NPC is still in the expected room
      if (this.npcRooms.get(npc) !== room) return;
      this.dispatchAction(npc, room, step.action);
    }, step.delayMs + extraDelayMs);
  }

  private dispatchAction(npc: NpcPenguin, room: WorldRoom, action: NpcAction): void {
    const targets = room.players;

    switch (action.type) {
      case 'chat':
        if (targets.length === 0) return;
        this.msg.send(targets, 'sm', String(npc.id), action.message);
        npc.recentMessages.push(action.message);
        if (npc.recentMessages.length > 10) {
          npc.recentMessages.shift();
        }
        this.roomLastSpoken.set(room.id, Date.now());
        // Let other NPCs in the room react to what this NPC said
        this.onNpcChat(room, npc, action.message);
        break;
      case 'emote':
        if (targets.length === 0) return;
        this.msg.send(targets, 'se', npc.id, action.emoteId);
        break;
      case 'move': {
        if (targets.length > 0) {
          this.msg.send(targets, 'sp', npc.id, action.x, action.y);
        }
        room.updatePosition(npc as any, action.x, action.y);
        this.scheduleNightClubDance(npc, room, NIGHT_CLUB_POST_MOVE_DANCE_DELAY_MS);
        break;
      }
      case 'frame': {
        const frame = room.id === NIGHT_CLUB_ROOM_ID && action.frame === 1
          ? DANCE_FRAME
          : action.frame;

        if (targets.length > 0) {
          this.msg.send(targets, 'sf', npc.id, frame);
        }
        room.updateFrame(npc as any, frame);
        break;
      }
      case 'snowball': {
        if (targets.length === 0) return;
        let targetX = action.x ?? 0;
        let targetY = action.y ?? 0;

        if (action.target === 'random-player') {
          const players = room.players;
          if (players.length > 0) {
            const player = randFrom(players);
            const state = room.getState(player);
            targetX = state.x;
            targetY = state.y;
          }
        } else if (action.target === 'random-npc') {
          const npcs = this.getNpcsInRoom(room).filter(n => n.id !== npc.id);
          if (npcs.length > 0) {
            const randomNpc = randFrom(npcs);
            const state = room.playerStates.find(([occ]) => occ.id === randomNpc.id);
            if (state) {
              targetX = state[1].x;
              targetY = state[1].y;
            }
          }
        } else if (action.target === 'origin') {
          // If the NPC has a stored target from a recent hit, we could use it here.
          // For now, if x/y are provided, use them. Otherwise default to 0.
        }

        this.msg.send(targets, 'sb', npc.id, targetX, targetY);
        break;
      }
      case 'hockey_puck': {
        if (targets.length === 0) return;
        if (!this.world.updatePuck(action.x, action.y, room)) return;

        if (room.id === ICE_RINK_ROOM_ID && this.data.isPreCpip() && isLower(this.data.getDate(), RINK_SCOREBOARD_DATE)) {
          this.msg.send(targets, 'zm', action.x, action.y);
        } else {
          this.msg.send(targets, 'zm', npc.id, action.x, action.y, action.speedX ?? 0, action.speedY ?? 0);
        }
        break;
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  private getNpcsInRoom(room: WorldRoom): NpcPenguin[] {
    return [...this.npcRooms.entries()]
      .filter(([, r]) => r === room)
      .map(([npc]) => npc);
  }

  /** Whether this module should be active for the given date string */
  public static isActiveDate(date: string): boolean {
    return ACTIVE_DATES.has(date);
  }
}
