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
import { PenguinMessenger } from '@server/socket-server/messenger';
import { World } from '@server/socket-server/world/world';
import { WorldRoom } from '@server/socket-server/world/world-room';
import { WorldPenguin } from '@server/socket-server/world/world-penguin';
import { WorldTable } from '@server/socket-server/world/world-table';
import { getPenguinString } from '@server/socket-server/handlers/join';
import { isRareItem } from './npc-clothing';
import { NpcPenguin, MancalaSkill } from './npc-penguin';
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
const NPC_COUNT = 100;

/** The date string this module is active for */
const ACTIVE_DATE = '2005-08-22';

/** 
 * All room IDs that existed and were accessible on 2005-08-22.
 * Town (100) is duplicated to double its spawn weight.
 */
const ROOM_POOL: number[] = [
  100, // Town
  100, // Town (double weight)
  110, // Coffee Shop
  111, // Book Room
  120, // Dance Club
  121, // Dance Lounge
  130, // Gift Shop
  200, // Ski Village
  800, // Dock
  802, // Ice Rink
  320, // Dojo
  221, // Lodge Attic
];

/**
 * Valid spawn rectangle per room [xMin, yMin, xMax, yMax].
 * NPCs pick a random point within this area when entering a room.
 * Values are approximate — adjust if penguins appear clipped.
 */
const SPAWN_ZONES: Record<number, [number, number, number, number]> = {
  100: [200, 300, 750, 480], // Town
  110: [150, 300, 600, 480], // Coffee Shop
  111: [150, 250, 600, 420], // Book Room
  120: [200, 300, 650, 480], // Dance Club
  121: [150, 280, 600, 450], // Dance Lounge
  130: [180, 300, 550, 460], // Gift Shop
  200: [150, 320, 650, 480], // Ski Village
  800: [250, 350, 700, 480], // Dock
  802: [150, 200, 750, 480], // Ice Rink
  320: [200, 250, 600, 480], // Dojo
  221: [150, 200, 500, 380], // Lodge Attic
};

/**
 * Approximate positions for NPCs to teleport to when joining a mancala table
 * in the Book Room (111). These put the NPC right beside the table.
 */
const MANCALA_TABLE_NPC_POS: Record<number, [number, number]> = {
  100: [220, 330],
  101: [310, 330],
  102: [400, 330],
  103: [490, 330],
  104: [580, 330],
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

function spawnPosForRoom(roomId: number): [number, number] {
  const zone = SPAWN_ZONES[roomId] ?? [300, 350, 600, 480];
  const [xMin, yMin, xMax, yMax] = zone;
  return [randInt(xMin, xMax), randInt(yMin, yMax)];
}

/** Check whether the current timeline date passes a TimelineGate */
function gatePass(gate: TimelineGate | undefined, currentDate: string): boolean {
  if (gate === undefined) return true;
  if (gate.before !== undefined && !isLower(currentDate, gate.before)) return false;
  if (gate.after  !== undefined && !isGreaterOrEqual(currentDate, gate.after)) return false;
  return true;
}

/** Pick one eligible entry from a DialoguePool; returns undefined if none qualify */
function pickFromPool(pool: DialoguePool, currentDate: string, npc?: NpcPenguin, room?: WorldRoom): DialoguePoolEntry | undefined {
  const eligible = pool.filter(entry => {
    if (!gatePass(entry.gate, currentDate)) return false;
    if (npc && entry.condition && !entry.condition(npc, room)) return false;

    // Repetition prevention: ensure this entry wasn't recently chosen as a topic
    if (npc && npc.recentTopics.includes(entry)) {
      return false;
    }

    // Secondary repetition prevention: ensure this entry doesn't contain a chat string the NPC recently said
    if (npc && npc.recentMessages.length > 0) {
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
  
  if (npc) {
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

  /** NPCs currently seated at a mancala table (suppresses roaming and ambient movement) */
  private npcMancalaTables = new Set<NpcPenguin>();

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
    const betaHasAllAccess = isLower(currentDate, '2005-10-24');

    // Sample names without replacement
    const namePool = [...NPC_NAME_POOL];
    const traits: PersonalityTrait[] = ['friendly', 'shy', 'grumpy', 'excitable', 'curious'];

    for (let i = 0; i < NPC_COUNT; i++) {
      const nameIdx = randInt(0, namePool.length - 1);
      const name = namePool.splice(nameIdx, 1)[0];
      const trait = randFrom(traits);
      const isMember = betaHasAllAccess || Math.random() < 0.7;
      const npc = new NpcPenguin(name, trait, isMember);
      this.npcs.push(npc);

      const roomId = randFrom(ROOM_POOL);
      this.spawnNpc(npc, roomId);
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
      room.removeOccupant(npc);
      this.msg.send(this.getActivePlayers(room), 'rp', npc.id);
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

    room.addOccupant(npc, x, y);
    this.npcRooms.set(npc, room);

    // Broadcast new NPC to real players already in the room
    this.msg.send(this.getActivePlayers(room), 'ap', getPenguinString(this.data, npc, { x, y, frame: 1 }));

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
    // Don't roam while playing mancala
    if (this.npcMancalaTables.has(npc)) { this.scheduleDwell(npc); return; }
    const currentRoom = this.npcRooms.get(npc);
    if (currentRoom === undefined) return;

    // Remove from current room
    currentRoom.removeOccupant(npc);
    this.msg.send(this.getActivePlayers(currentRoom), 'rp', npc.id);

    // Pick a new room (avoid same room if possible)
    const eligible = ROOM_POOL.filter(id => id !== currentRoom.id);
    const newRoomId = eligible.length > 0 ? randFrom(eligible) : randFrom(ROOM_POOL);
    const newRoom = this.world.getRoom(newRoomId);
    const [x, y] = spawnPosForRoom(newRoomId);

    newRoom.addOccupant(npc, x, y);
    this.npcRooms.set(npc, newRoom);

    // Broadcast arrival to players in new room
    this.msg.send(this.getActivePlayers(newRoom), 'ap', getPenguinString(this.data, npc, { x, y, frame: 1 }));

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
    // Don't wander while playing mancala
    if (this.npcMancalaTables.has(npc)) { this.scheduleAmbient(npc); return; }

    const room = this.npcRooms.get(npc);
    if (room !== undefined && this.getActivePlayers(room).length > 0) {
      // 70% chance to waddle to a new spot, 30% chance to do a random frame (wave, sit, dance)
      if (Math.random() < 0.7) {
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

  // ── Idle Dialogue ──────────────────────────────────────────

  private scheduleIdle(npc: NpcPenguin): void {
    const delay = randInt(IDLE_MIN_MS, IDLE_MAX_MS);
    const timer = setTimeout(() => this.fireIdle(npc), delay);
    this.idleTimers.set(npc, timer);
  }

  private fireIdle(npc: NpcPenguin): void {
    if (!this.active) return;

    const room = this.npcRooms.get(npc);
    if (room === undefined || this.getActivePlayers(room).length === 0) {
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

      const npcB = randFrom(otherNpcs);
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

    const hasRareItem = wornIds.some(id => isRareItem(id));

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

    let respondents = 0;
    const shuffledNpcs = shuffle(this.getNpcsInRoom(room));

    for (const npc of shuffledNpcs) {
      if (respondents >= 2) break;
      const state = room.playerStates.find(([occ]) => occ === npc);
      if (!state) continue;

      const npcX = state[1].x;
      const npcY = state[1].y;
      
      // Calculate distance between snowball target and NPC
      const dx = targetX - npcX;
      const dy = targetY - npcY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Hit radius of 80 units
      if (distance > 80) continue;

      // Ensure NPC has a cooldown on getting hit to prevent spam
      const cooldownKey = `${npc.id}:snowball_hit`;
      const lastHit = this.chatCooldowns.get(cooldownKey) ?? 0;
      if (now - lastHit < 10_000) continue; // 10 second cooldown per NPC

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
    const targets = this.getActivePlayers(room);
    if (targets.length === 0) return;

    switch (action.type) {
      case 'chat':
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
        this.msg.send(targets, 'se', npc.id, action.emoteId);
        break;
      case 'move': {
        this.msg.send(targets, 'sp', npc.id, action.x, action.y);
        room.updateOccupantPosition(npc, action.x, action.y);
        break;
      }
      case 'frame':
        this.msg.send(targets, 'sf', npc.id, action.frame);
        room.updateOccupantFrame(npc, action.frame);
        break;
      case 'snowball': {
        let targetX = action.x ?? 0;
        let targetY = action.y ?? 0;

        if (action.target === 'random-player') {
          const players = this.getActivePlayers(room);
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
            const state = room.playerStates.find(([occ]) => occ === randomNpc);
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
      case 'join_table': {
        const table = room.getTable(action.tableId);
        
        const before = table.getCount();
        const seatId = table.getSeatIndex(npc) ?? table.assignSeatIndex(npc);
        console.log(`[NPC join_table] NPC "${npc.name}" joining table ${action.tableId}: before=${before}, seatId=${seatId}, joined=${JSON.stringify((table as any).joined)}, started=${table.hasStarted()}`);
        
        // Ensure table resets if it was empty
        if (seatId !== 99 && before === 0) { // 99 is TABLE_SPECTATOR_SEAT
          table.reset();
          console.log(`[NPC join_table] Table ${action.tableId} was empty, reset.`);
        }

        if (seatId !== 99) {
          const count = table.getCount();
          if (count !== before) {
            this.msg.send(this.getActivePlayers(room), 'ut', table.getId(), table.getCount());
          }
          
          // The table is now joined by the NPC.
          // Simulate the `jz` flow: mark joined and notify real players.
          table.setJoined(seatId);
          this.msg.send(table.realPlayers, 'uz', seatId, npc.name);
          console.log(`[NPC join_table] After setJoined: joined=${JSON.stringify((table as any).joined)}, everyoneJoined=${table.hasEveryoneJoined()}, realPlayers=${table.realPlayers.map(p => p.name).join(', ') || 'none'}`);

          // If both sides are now joined, start the game.
          if (!table.hasStarted() && table.hasEveryoneJoined()) {
            console.log(`[NPC join_table] Starting game on table ${action.tableId}, turn=${table.getTurn()}`);
            table.setStarted();
            this.msg.send(table.realPlayers, 'sz', table.getTurn());

            // NPC seat 0 goes first — fire their move
            if (table.getTurn() === seatId) {
              console.log(`[NPC join_table] NPC goes first, firing handleMancalaTurn`);
              this.handleMancalaTurn(npc, room, action.tableId);
            }
          } else {
            console.log(`[NPC join_table] Game not started yet: hasStarted=${table.hasStarted()}, everyoneJoined=${table.hasEveryoneJoined()}`);
          }
        } else {
          console.log(`[NPC join_table] NPC "${npc.name}" became spectator at table ${action.tableId} (full)`);
        }
        break;
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  /**
   * Called when a real player has sat alone at a Mancala table.
   * Picks a free NPC in the room and has them join the table as the opponent.
   */
  public onPlayerJoinedMancala(room: WorldRoom, table: WorldTable): void {
    const mancalaIds = [100, 101, 102, 103, 104];
    console.log(`[NPC] onPlayerJoinedMancala called for table ${table.getId()}`);

    // Find NPCs in this room not already seated at any Mancala table
    const freeNpcs = this.getNpcsInRoom(room).filter(npc => {
      return !mancalaIds.some(id => {
        const t = room.getTable(id);
        const idx = t.getSeatIndex(npc);
        return idx !== undefined && idx !== WorldTable.TABLE_SPECTATOR_SEAT;
      });
    });

    console.log(`[NPC] onPlayerJoinedMancala: freeNpcs=${freeNpcs.map(n => n.name).join(', ') || 'none'}, totalNpcsInRoom=${this.getNpcsInRoom(room).length}`);

    if (freeNpcs.length === 0) return;

    const chosenNpc = randFrom(freeNpcs);
    console.log(`[NPC] NPC "${chosenNpc.name}" selected to play Mancala at table ${table.getId()}`);

    // Mark as in-game: suppress roaming/ambient
    this.npcMancalaTables.add(chosenNpc);
    const dwellTimer = this.dwellTimers.get(chosenNpc);
    if (dwellTimer) { clearTimeout(dwellTimer); this.dwellTimers.delete(chosenNpc); }
    const ambientTimer = this.ambientTimers.get(chosenNpc);
    if (ambientTimer) { clearTimeout(ambientTimer); this.ambientTimers.delete(chosenNpc); }
    const idleTimer = this.idleTimers.get(chosenNpc);
    if (idleTimer) { clearTimeout(idleTimer); this.idleTimers.delete(chosenNpc); }

    // Waddle the NPC to the table
    const pos = MANCALA_TABLE_NPC_POS[table.getId()];
    if (pos) {
      this.dispatchAction(chosenNpc, room, { type: 'move', x: pos[0], y: pos[1] });
    }

    // Wait for them to walk to the table (approx 3.5s), then sit and join the game
    setTimeout(() => {
      if (this.npcRooms.get(chosenNpc) !== room) return;

      // Determine which way to face based on the player's position
      // Find the player at the table
      const seats = table.getSeats();
      const playerOpponent = seats.find(s => s instanceof WorldPenguin) as WorldPenguin | undefined;
      
      let sitFrame = 19; // Default West
      if (playerOpponent && pos) {
        const stateEntry = room.playerStates.find(([occ]) => occ === playerOpponent);
        if (stateEntry) {
          const playerState = stateEntry[1];
          const dx = playerState.x - pos[0];
          const dy = playerState.y - pos[1]; // Y increases downwards in Flash
          
          let angle = Math.atan2(dy, dx);
          if (angle < 0) angle += 2 * Math.PI;
          
          const index = Math.round(angle / (Math.PI / 4)) % 8;
          // Indices correspond to: E, SE, S, SW, W, NW, N, NE
          const frameMap = [23, 24, 17, 18, 19, 20, 21, 22];
          sitFrame = frameMap[index];
        }
      }
      
      this.dispatchAction(chosenNpc, room, { type: 'frame', frame: sitFrame });

      console.log(`[NPC] Dispatching join_table for NPC "${chosenNpc.name}" to table ${table.getId()}`);
      this.dispatchAction(chosenNpc, room, { type: 'join_table', tableId: table.getId() });

      // Brief greeting on join
      const greetings: Record<MancalaSkill, string[]> = {
        clueless:     ["what do i do again lol", "um.. how do you play this", "i think i know how to play!"],
        novice:       ["im not very good but ill try!", "lets play!", "i hope i do ok lol"],
        intermediate: ["good luck!", "lets have a good game", "im ready when you are!"],
        expert:       ["good luck, you'll need it ;)", "lets play", "get ready"],
      };
      const lines = greetings[chosenNpc.mancalaSkill];
      this.dispatchAction(chosenNpc, room, { type: 'chat', message: randFrom(lines) });
    }, 3500);
  }

  /** Pick a mancala move for an NPC based on their skill level */
  private pickMancalaMove(
    skill: MancalaSkill,
    board: number[],
    seatId: number,
    validMoves: number[],
    mancalaTable: any
  ): number {
    // Clueless: pure random
    if (skill === 'clueless') return randFrom(validMoves);

    const playerMancala = seatId === 0 ? 6 : 13;

    if (!mancalaTable.applyMancalaMove) return randFrom(validMoves);

    // Score all valid moves
    const scored = validMoves.map(move => {
      const boardClone = [...board];
      const result: { command: string; nextTurn: number; gameOver: boolean } =
        mancalaTable.applyMancalaMove(boardClone, seatId, move);
      let score = 0;

      // Extra turn bonus
      if (result.nextTurn === seatId) score += 100;
      // Stones captured
      score += (boardClone[playerMancala] - board[playerMancala]) * 10;
      // Capture opponent stones via 'c' command
      if (result.command === 'c') score += 50;

      return { move, score };
    });
    scored.sort((a, b) => b.score - a.score);

    if (skill === 'novice') {
      // 40% chance of picking the best move, otherwise random
      if (Math.random() < 0.4) return scored[0].move;
      return randFrom(validMoves);
    }

    if (skill === 'intermediate') {
      // 70% best, 20% second best (if exists), 10% random
      const r = Math.random();
      if (r < 0.70) return scored[0].move;
      if (r < 0.90 && scored.length > 1) return scored[1].move;
      return randFrom(validMoves);
    }

    // Expert: always best move, tiny random noise to seem human
    if (scored.length > 1 && scored[0].score === scored[1].score) {
      return randFrom([scored[0].move, scored[1].move]);
    }
    return scored[0].move;
  }

  public handleMancalaTurn(npc: NpcPenguin, room: WorldRoom, tableId: number): void {
    const table = room.getTable(tableId);
    if (!table || table.hasEnded()) return;

    const seatId = table.getSeatIndex(npc);
    if (seatId === undefined || seatId === 99) return;

    const boardStateStr = table.serializeBoard();
    if (!boardStateStr) return;

    const board = boardStateStr.split(',').map(Number);
    const startIdx = seatId === 0 ? 0 : 7;
    const endIdx = seatId === 0 ? 5 : 12;

    const validMoves: number[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      if (board[i] > 0) validMoves.push(i);
    }

    if (validMoves.length === 0) return;

    const mancalaTable = table as any;
    const chosenCup = this.pickMancalaMove(npc.mancalaSkill, board, seatId, validMoves, mancalaTable);

    // Skill-based think time
    const thinkTime: Record<MancalaSkill, [number, number]> = {
      clueless:     [3000, 7000],
      novice:       [2000, 5000],
      intermediate: [1500, 4000],
      expert:       [800, 2500],
    };
    const [minT, maxT] = thinkTime[npc.mancalaSkill];

    // Occasional mid-game chatter
    const chatChance: Record<MancalaSkill, number> = {
      clueless: 0.3, novice: 0.15, intermediate: 0.08, expert: 0.05
    };
    if (Math.random() < chatChance[npc.mancalaSkill]) {
      const midGameLines: Record<MancalaSkill, string[]> = {
        clueless:     ["wait how do i do this again", "oops lol", "um..", "i have no idea what im doing"],
        novice:       ["hmm", "lets see..", "okay okay", "i think i got this"],
        intermediate: ["interesting...", "hmm let me think", "ok"],
        expert:       ["hmm", "...", "ok"],
      };
      setTimeout(() => {
        if (this.npcRooms.get(npc) !== room || table.hasEnded()) return;
        this.dispatchAction(npc, room, { type: 'chat', message: randFrom(midGameLines[npc.mancalaSkill]) });
      }, randInt(300, minT - 100));
    }

    setTimeout(() => {
      if (!this.active || table.hasEnded() || table.getTurn() !== seatId) return;

      const [endState, zmArgs] = table.sendMove([chosenCup]);
      console.log(`[NPC zm] NPC "${npc.name}" (${npc.mancalaSkill}) played cup ${chosenCup} on table ${tableId}: endState=${JSON.stringify(endState)}, zmArgs=${JSON.stringify(zmArgs)}, newTurn=${table.getTurn()}`);

      if (zmArgs !== null) {
        this.msg.send(table.realPlayers, 'zm', ...zmArgs);
      }

      if (endState !== null) {
        console.log(`[NPC zo] Game over on table ${tableId} after NPC move. Sending zo.`);
        this.msg.send(table.realPlayers, 'zo', ...endState);
        this.msg.send(room.players, 'ut', table.getId(), table.getCount());

        // Determine winner: compare mancala cup scores
        const finalBoard = table.serializeBoard().split(',').map(Number);
        const npcScore = seatId === 0 ? finalBoard[6] : finalBoard[13];
        const oppScore = seatId === 0 ? finalBoard[13] : finalBoard[6];
        const npcWon = npcScore > oppScore;

        this.fireMancalaEndReaction(npc, room, npcWon, table.realPlayers);
        table.resetRound();
        return;
      }

      // Extra turn
      if (!table.hasEnded() && table.getTurn() === seatId) {
        console.log(`[NPC zm] NPC "${npc.name}" gets another turn on table ${tableId}`);
        this.handleMancalaTurn(npc, room, tableId);
      }
    }, randInt(minT, maxT));
  }

  /** Releases the NPC from a mancala game and restarts their roaming/ambient timers */
  public releaseMancalaNpc(npc: NpcPenguin): void {
    if (this.npcMancalaTables.has(npc)) {
      this.npcMancalaTables.delete(npc);
      
      const room = this.npcRooms.get(npc);
      if (room) {
        this.dispatchAction(npc, room, { type: 'frame', frame: 1 });
      }

      this.scheduleDwell(npc);
      this.scheduleAmbient(npc);
      this.scheduleIdle(npc);
    }
  }

  /** Fire post-game reaction chat/emote/snowball based on skill and personality */
  public fireMancalaEndReaction(npc: NpcPenguin, room: WorldRoom, won: boolean, players: WorldPenguin[]): void {
    this.releaseMancalaNpc(npc);
    setTimeout(() => {
      if (this.npcRooms.get(npc) !== room) return;

      if (won) {
        const winLines: Record<MancalaSkill, string[]> = {
          clueless:     ["wait i won?? lol", "yay!!! i did it!!", "haha i won somehow!"],
          novice:       ["yes!! good game!", "i won! nice game :)", "woohoo!"],
          intermediate: ["good game!", "nice match!", "gg"],
          expert:       ["gg", "good game", "as expected ;)"],
        };
        this.msg.send(this.getActivePlayers(room), 'sm', String(npc.id), randFrom(winLines[npc.mancalaSkill]));
        // emote: happy = 1
        setTimeout(() => this.msg.send(this.getActivePlayers(room), 'se', npc.id, 1), 800);
      } else {
        const loseLines: Record<MancalaSkill, string[]> = {
          clueless:     ["oh well lol", "i never know what im doing anyway", "good job!!"],
          novice:       ["aww good game", "ill get you next time!", "nice one"],
          intermediate: ["good game, well played", "gg", "nicely done"],
          expert:       ["impressive", "gg, i underestimated you", "well played"],
        };
        this.msg.send(this.getActivePlayers(room), 'sm', String(npc.id), randFrom(loseLines[npc.mancalaSkill]));

        // Grumpy/excitable NPCs may throw a snowball at the winner on loss
        const throwsSnowball =
          (npc.personalityTrait === 'grumpy' && Math.random() < 0.6) ||
          (npc.personalityTrait === 'excitable' && Math.random() < 0.3);

        if (throwsSnowball && players.length > 0) {
          setTimeout(() => {
            if (this.npcRooms.get(npc) !== room) return;
            const target = randFrom(players);
            const state = room.playerStates.find(([occ]) => occ === target);
            if (state) {
              this.msg.send(this.getActivePlayers(room), 'sb', npc.id, state[1].x, state[1].y);
            }
          }, randInt(1200, 2500));
        }
      }
    }, randInt(500, 1500));
  }

  /** Fire a reaction when the player quits the game early */
  public fireMancalaAbortedReaction(npc: NpcPenguin, room: WorldRoom): void {
    if (this.npcRooms.get(npc) !== room) return;

    const abortLines: Record<MancalaSkill, string[]> = {
      clueless:     ["wait where did you go", "aw i wanted to play", "did i do something wrong?"],
      novice:       ["hey we didn't finish!", "aww bye then", "i guess i win?"],
      intermediate: ["i win by default!", "quitting already?", "bye then!"],
      expert:       ["too scared to finish? ;)", "another easy win", "coward."],
    };
    
    // Slight delay so the player leaving animation happens first
    setTimeout(() => {
      if (this.npcRooms.get(npc) !== room) return;
      this.msg.send(this.getActivePlayers(room), 'sm', String(npc.id), randFrom(abortLines[npc.mancalaSkill]));
    }, 1000);
  }

  private getNpcsInRoom(room: WorldRoom): NpcPenguin[] {
    return [...this.npcRooms.entries()]
      .filter(([, r]) => r === room)
      .map(([npc]) => npc);
  }

  private getActivePlayers(room: WorldRoom): WorldPenguin[] {
    return room.realPlayers.filter(p => !p.deadInternet);
  }

  /** Whether this module should be active for the given date string */
  public static isActiveDate(date: string): boolean {
    return date === ACTIVE_DATE;
  }
}
