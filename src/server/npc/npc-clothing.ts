// ============================================================
// NPC Module — Clothing Pools for 2005-08-22
// ============================================================
//
// Weights:
//   10  = in the 2005-08-22 clothing catalogue (normal sale item)
//    2  = off-sale (present in clientFiles but not clothingCatalog.newItems)
//    1  = secret item (Viking Helmet, obtainable via hidden means)
//   N   = empty slot (no item worn; varies per slot)
//
// Available in the 2005-08-22 clothing catalogue (newItems):
//   201 Red Shirt (body), 404 Tan Cowboy Hat (head), 405 Green Ball Cap (head),
//   401 Sombrero (head), 452 Viking Helmet (head, SECRET), 220 Hockey Stick (hand),
//   131 Green Snorkel (face), 103 3D Glasses (face), 408 Flower Hat (head),
//   212 Grass Skirt (body), 481 Headphones (head), 219 Blue Duffle Coat (body),
//   221 Black Hoodie (body), 102 Dark Vision Goggles (face), 214 Black Bowtie (neck),
//   101 Black Sunglasses (face)
//
// Off-sale items known to exist in client data at this date but not for sale:
//   (Items present in the 2005-08-22 clientFiles list but not in clothingCatalog.newItems)
//   e.g. items like 104, 106–110, 171–177, 181, 216, 222, 233–240, 244, 252, 261–263,
//        301, 351–352, 363, 366, 402, 406–407, 410, 412–414, 417–425, 453, 456, 484, 500–524, 550–551

import { ClothingSlot, WeightedClothingItem } from './npc-types';

export type ClothingOutfit = Record<ClothingSlot, number>;

/**
 * Weighted clothing pools per slot for the 2005-08-22 timeline.
 * Slot value 0 means no item is worn in that slot.
 */
export const CLOTHING_POOLS: Record<ClothingSlot, WeightedClothingItem[]> = {
  head: [
    { id: 0,   weight: 12 }, // no hat
    { id: 404, weight: 10 }, // Tan Cowboy Hat
    { id: 405, weight: 10 }, // Green Ball Cap
    { id: 401, weight: 10 }, // Sombrero
    { id: 408, weight: 10 }, // Flower Hat
    { id: 481, weight: 10 }, // Headphones
    { id: 452, weight: 1  }, // Viking Helmet (secret)
  ],
  face: [
    { id: 0,   weight: 14 }, // no face item
    { id: 131, weight: 10 }, // Green Snorkel
    { id: 103, weight: 10 }, // 3D Glasses
    { id: 102, weight: 10 }, // Dark Vision Goggles
    { id: 101, weight: 10 }, // Black Sunglasses
  ],
  neck: [
    { id: 0,   weight: 20 }, // no neck item
    { id: 214, weight: 10 }, // Black Bowtie
  ],
  body: [
    { id: 0,   weight: 8  }, // no body item
    { id: 201, weight: 10 }, // Red Shirt
    { id: 212, weight: 10 }, // Grass Skirt
    { id: 219, weight: 10 }, // Blue Duffle Coat
    { id: 221, weight: 10 }, // Black Hoodie
  ],
  hand: [
    { id: 0,   weight: 18 }, // no hand item
    { id: 220, weight: 10 }, // Hockey Stick
  ],
  feet:       [{ id: 0, weight: 1 }], // no footwear available at this date
  pin:        [{ id: 0, weight: 1 }], // no pins yet
  background: [{ id: 0, weight: 1 }], // no backgrounds yet
};

/** Color IDs available in 2005-08-22 (items 1–12 are all the penguin colors) */
export const COLOR_POOL: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Set of item IDs that are considered "rare" at this date:
 * present in the game client but not available in the current catalogue.
 * When a player wears one of these, NPCs may comment on it.
 */
export const RARE_ITEM_IDS = new Set<number>([
  // Off-sale items from clientFiles not in clothingCatalog.newItems for 2005-08-22
  104, 106, 107, 108, 109, 110,
  171, 172, 173, 174, 175, 176, 177, 181,
  216, 218, 222, 233, 234, 235, 237, 238, 240, 244, 252, 253,
  261, 262, 263, 301,
  351, 352, 363, 366,
  402, 406, 407, 410, 412, 413, 414, 417, 418, 419, 420, 421, 422, 423, 424, 425,
  453, 456, 484,
  500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515,
  516, 517, 518, 519, 520, 521, 522, 523, 524,
  550, 551,
  // Viking Helmet is in-catalogue but secret — NOT treated as rare for NPC comments
  // (it's so secret NPCs wouldn't dare mention it)
]);

/** Returns true if the item ID is considered rare / off-sale at 2005-08-22 */
export function isRareItem(id: number): boolean {
  return RARE_ITEM_IDS.has(id);
}

/** Sample one item from a weighted pool using weighted random selection */
function sampleWeighted(pool: WeightedClothingItem[]): number {
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const item of pool) {
    rand -= item.weight;
    if (rand <= 0) {
      return item.id;
    }
  }
  return pool[pool.length - 1].id;
}

/** Sample a random color from the color pool */
export function sampleColor(): number {
  return COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];
}

/** Resolve a full random outfit by sampling each clothing slot's weighted pool */
export function sampleClothing(isMember: boolean): ClothingOutfit {
  const slots: ClothingSlot[] = ['head', 'face', 'neck', 'body', 'hand', 'feet', 'pin', 'background'];
  const result = {} as ClothingOutfit;
  
  if (!isMember) {
    for (const slot of slots) {
      result[slot] = 0;
    }
    return result;
  }

  for (const slot of slots) {
    result[slot] = sampleWeighted(CLOTHING_POOLS[slot]);
  }
  return result;
}
