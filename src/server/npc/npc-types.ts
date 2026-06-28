// ============================================================
// NPC Module — Shared Type Definitions
// ============================================================

import type { NpcPenguin } from './npc-penguin';

/** The five personality archetypes that drive dialogue selection */
export type PersonalityTrait = 'friendly' | 'shy' | 'grumpy' | 'excitable' | 'curious';

/** Clothing slots that an NPC can wear items in */
export type ClothingSlot = 'head' | 'face' | 'neck' | 'body' | 'hand' | 'feet' | 'pin' | 'background';

/** A single thing an NPC does, after waiting delayMs milliseconds */
export type NpcAction =
  | { type: 'chat';  message: string }
  | { type: 'emote'; emoteId: number }
  | { type: 'move';  x: number; y: number }
  | { type: 'frame'; frame: number }  // e.g. wave=25, sit=13, dance=26
  | { type: 'snowball'; target?: 'random-player' | 'random-npc' | 'origin'; x?: number; y?: number }
  | { type: 'hockey_puck'; x: number; y: number; speedX?: number; speedY?: number }
  | { type: 'join_table'; tableId: number };

/** One timed step in a response sequence */
export type DialogueStep = {
  delayMs: number;
  action: NpcAction;
};

/**
 * Timeline gate — all fields are optional.
 * A gate passes when: current date >= after (if set) AND current date < before (if set).
 */
export type TimelineGate = {
  /** Gate passes only if current timeline date is strictly before this date string */
  before?: string;
  /** Gate passes only if current timeline date is on or after this date string */
  after?: string;
};

/**
 * One entry in a dialogue pool.
 * When a trigger fires, all eligible entries (gate passes, chance roll passes) are
 * collected and one is chosen at random.
 */
export type DialoguePoolEntry = {
  gate?: TimelineGate;
  /** 0–1 probability this entry is even eligible. Defaults to 1. */
  chance?: number;
  /** Optional function to determine if this NPC qualifies to use this entry */
  condition?: (npc: NpcPenguin, room: any) => boolean;
  steps: DialogueStep[];
};

/** A pool of possible response sequences; one eligible entry is chosen at random */
export type DialoguePool = DialoguePoolEntry[];

/** Triggers NPC response when a player's chat message contains any of the keywords */
export type ChatTrigger = {
  keywords: string[];
  /** Minimum time (ms) before this trigger can fire again for the same NPC. Default 30_000. */
  cooldownMs?: number;
  responses: DialoguePool;
};

/** Triggers NPC response when a player sends a specific emote */
export type EmoteTrigger = {
  emoteId: number;
  chance: number;
  responses: DialoguePool;
};

/**
 * A spontaneous dialogue exchange between two NPCs in the same room.
 * 'a' = the NPC that owns this exchange definition (the one checking the trigger).
 * 'b' = any other NPC currently in the same room.
 */
export type NpcExchange = {
  gate?: TimelineGate;
  cooldownMs: number;
  chance: number;
  condition?: (npcA: NpcPenguin, npcB: NpcPenguin, room: any) => boolean;
  steps: Array<{ who: 'a' | 'b'; step: DialogueStep }>;
};

/** Per-personality dialogue organized by room (keyed by room ID or 'any') */
export type RoomDialogueMap = Partial<Record<number | 'any', DialoguePool>>;

/** All dialogue for one personality trait */
export type PersonalityDialogue = {
  onPlayerJoin:    RoomDialogueMap;
  onPlayerLeave:   RoomDialogueMap;
  onIdle:          RoomDialogueMap;
  onPlayerChat:    ChatTrigger[];
  onPlayerEmote:   EmoteTrigger[];
  onPlayerSnowball: DialoguePool;
  onPlayerRareItem: DialoguePool;
  npcExchanges:    NpcExchange[];
};

/** Weighted item for clothing slot sampling */
export type WeightedClothingItem = {
  gate?: TimelineGate;
  id: number;
  /** Higher = more likely. In-catalogue: 10, off-sale: 2, secret: 1 */
  weight: number;
};
