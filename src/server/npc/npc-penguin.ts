// ============================================================
// NPC Module — NPC Entity Class
// ============================================================
//
// A lightweight penguin-like entity with a negative ID.
// Never touches the database. Satisfies the RoomOccupant interface
// defined in world-room.ts so it can be placed in rooms and
// formatted into join strings via getPenguinString().

import { sampleClothing, sampleColor, ClothingOutfit } from './npc-clothing';
import { PersonalityTrait } from './npc-types';

export type MancalaSkill = 'clueless' | 'novice' | 'intermediate' | 'expert';

function sampleMancalaSkill(): MancalaSkill {
  const r = Math.random();
  if (r < 0.50) return 'clueless';
  if (r < 0.75) return 'novice';
  if (r < 0.90) return 'intermediate';
  return 'expert';
}

/** Counter for assigning unique negative IDs to each NPC */
let npcIdCounter = -1;

export class NpcPenguin {
  readonly id: number;
  readonly name: string;
  readonly personalityTrait: PersonalityTrait;
  readonly mancalaSkill: MancalaSkill;

  // RoomOccupant-compatible fields
  readonly inventory: ClothingOutfit & { color: number };
  readonly membership: { isMember: boolean };
  readonly time = { age: 0 } as const;
  readonly avatar = { id: 0 } as const;

  /** Track recently spoken chat messages to avoid consecutive repetition */
  recentMessages: string[] = [];

  /** Track recently chosen dialogue sequences to prevent repeating entire topics */
  recentTopics: any[] = [];

  constructor(name: string, trait: PersonalityTrait) {
    this.id = npcIdCounter--;
    this.name = name;
    this.personalityTrait = trait;
    this.mancalaSkill = sampleMancalaSkill();

    // 70% chance to be a member
    const isMember = Math.random() < 0.7;
    this.membership = { isMember };

    const outfit = sampleClothing(isMember);
    this.inventory = {
      color:      sampleColor(),
      head:       outfit.head,
      face:       outfit.face,
      neck:       outfit.neck,
      body:       outfit.body,
      hand:       outfit.hand,
      feet:       outfit.feet,
      pin:        outfit.pin,
      background: outfit.background,
    };
  }

  /** Reset the ID counter — called on each NpcManager.activate() so IDs restart cleanly */
  static resetIdCounter(): void {
    npcIdCounter = -1;
  }
}
