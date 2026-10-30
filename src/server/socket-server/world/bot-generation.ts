import { choose, clamp, findFirstIndexEqualOrGreater, randomInt } from "@common/utils";
import { AMULET_ID, MAX_WATER_RANK, WATER_AWARDS } from "@server/game-data/ninja";
import { getTestingItems } from "@server/game-logic/items-testing";
import { CardJitsuProgress, getFireReward, getSnowReward, MAX_FIRE_RANK, MAX_SNOW_RANK, SNOW_NINJA_RANK } from "@server/game-logic/ninja-progress";
import { addDays, getDaysDelta, isGreaterOrEqual, isLower, isLowerOrEqual, Version, versionToEpoch } from "@server/routes/versions";
import { GameData } from "@server/timelines/game-data";
import { getAddedCatalogIndex, getIncludedCatalogIndex } from "@server/timelines/items";
import { BotAttributes, generateRandomOutfit } from "./bot";
import { DateReference } from "@server/updates";
import { getDate, START_DATE } from "@server/timelines/dates";
import { getDefaultPenguin, PenguinJson } from "@server/database/database";
import { getExploreItems } from "@server/game-logic/items-explore";
import { getNintendoItems, IBITZ_ITEMS } from "@server/game-logic/items-transfer";
import { getMissionItems } from "@server/game-logic/items-mission";
import { NPC_NAME_POOL } from "@server/npc/npc-names";
import { PersonalityTrait } from "@server/npc/npc-types";
import { DEV_NPC_NAMES, DEV_NPC_TRAITS } from "@server/npc/npc-manager";
import { sampleRandomAgeGroup } from "@server/npc/ambient-dialogue";

// TODO -> Easter Egg names
//         Game Day NPCs
//         Richer library of name parts
const NAME_PARTS_A = [
  'Cool', 'Snow', 'Ice', 'Fluffy', 'Turbo', 'Frosty', 'Mega', 'Blue',
  'Puffle', 'Wacky', 'Sunny', 'Rocket', 'Jolly', 'Waddle', 'Chill', 'Zippy'
];
const NAME_PARTS_B = [
  'Penguin', 'Flipper', 'Waddler', 'Bean', 'Beak', 'Berg', 'Wing', 'Paws',
  'Puff', 'Slider', 'Nugget', 'Pop', 'Hopper', 'Dude', 'Star', 'Fish'
];

const MEMBER_CHANCE = 0.6;

function addClothingItems(inventory: Set<number>, data: GameData, startDate: Version, member: boolean, buyChance: number): void {
  const addedIndex = getAddedCatalogIndex();
  const includedIndex = getIncludedCatalogIndex();

  const startIndex = findFirstIndexEqualOrGreater(startDate, addedIndex, ({ date }, d) => {
    return isGreaterOrEqual(date, d);
  });
  const endIndex = findFirstIndexEqualOrGreater(data.getDate(), addedIndex, ({ date }, d) => {
    return isGreaterOrEqual(date, d);
  })

  const buyItem = (item: number) => {
    if ((member || data.getItem(item)?.isMember === false) && Math.random() < buyChance) {
      inventory.add(item);
    }
  }

  // add all items in first catalog, then only add new items for next catalogs
  includedIndex[startIndex].items.forEach(buyItem);

  for (let i = startIndex + 1; i <= endIndex; i++) {
    addedIndex[i].newItems.forEach(buyItem);
  }
}

function addTestingItems(inventory: Set<number>, today: Version, startDate: Version, getChance: number) {
  const testingItems = getTestingItems();
  testingItems.forEach(({ date, items }) => {
    if (isGreaterOrEqual(today, date) && isLowerOrEqual(startDate, date)) {
      items.forEach(item => {
        if (Math.random() < getChance) {
          inventory.add(item);
        }
      })
    }
  });
}

function addExploreItems(inventory: Set<number>, today: Version, getChance: number) {
  const exploreItems = getExploreItems();
  exploreItems.forEach(({ date, items }) => {
    if (isGreaterOrEqual(today, date)) {
      items.forEach(item => {
        if (Math.random() < getChance) {
          inventory.add(item);
        }
      })
    }
  });
}

function addNintendoItems(
  inventory: Set<number>,
  startDate: Version,
  today: Version, playChance: number, buyChance: number) {
  if (isGreaterOrEqual(startDate, getDate('nintendo-shutdown')) || Math.random() < playChance) {
    return;
  }

  const nintendoItems = getNintendoItems();
  nintendoItems.forEach(({ date, items }) => {
    if (isGreaterOrEqual(today, date)) {
      items.forEach(i => {
        if (Math.random() < buyChance) {
          inventory.add(i);
        }
      });
    }
  })
}

function addIbitzItems(inventory: Set<number>, today: Version, useChance: number, buyChance: number) {
  if (isLower(today, getDate('ibitz-release')) || Math.random() < useChance) {
    return;
  }
  IBITZ_ITEMS.forEach(i => {
    if (Math.random() < buyChance) {
      inventory.add(i);
    }
  });
}

function addMissionItems(inventory: Set<number>, startDate: Version, today: Version, getChance: number) {
  const missionItems = getMissionItems();
  missionItems.forEach(({ date, items }) => {
    if (isGreaterOrEqual(today, date) && (isLower(startDate, getDate('missions-unavailable')) || isGreaterOrEqual(today, getDate('missions-return')))) {
      items.forEach(item => {
        if (Math.random() < getChance) {
          inventory.add(item);
        }
      })
    }
  });
}


function addNinjaItems(inventory: Set<number>, rank: number): void {
  for (let i = 0; i < rank; i++) {
    inventory.add(CardJitsuProgress.ITEM_AWARDS[i]);
  }  
}

function addElementalItems(inventory: Set<number>, data: GameData, member: boolean, fire: number, water: number, snow: number): void {
  if (!member && data.isElementalMember()) {
    return;
  }

  if (fire > 0) {
    inventory.add(AMULET_ID);
  }

  for (let i = 1; i <= Math.min(fire, MAX_FIRE_RANK - 1); i++) {
    inventory.add(getFireReward(i));
  }

  for (let i = 0; i < Math.min(water, MAX_WATER_RANK - 1); i++) {
    inventory.add(WATER_AWARDS[i]);
  }

  for (let i = 1; i <= Math.min(snow, MAX_SNOW_RANK - 1); i++) {
    const item = getSnowReward(i);
    if (item !== null && (member || data.getItem(item)?.isMember === false)) {
      inventory.add(item);
    }
  }
}

// for simplicity the member items won't be added (but this could be changed if there was a reason for it)
function generateRandomInventory(
  data: GameData,
  startDate: Version,
  starterColor: number,
  member: boolean,
  ninjaRank: number,
  fireRank: number,
  waterRank: number,
  snowRank: number,
  attrs: BotAttributes
) {

  const inventory = new Set<number>([starterColor]);

  const today = data.getDate();
  addClothingItems(inventory, data, startDate, member, attrs.collectorMania);
  addTestingItems(inventory, today, startDate, attrs.tester);
  addNinjaItems(inventory, ninjaRank);
  addElementalItems(inventory, data, member, fireRank, waterRank, snowRank);
  addExploreItems(inventory, today, attrs.exploreFan);
  addNintendoItems(inventory, startDate, today, attrs.transferFan, attrs.collectorMania);
  addIbitzItems(inventory, today, attrs.transferFan, attrs.collectorMania);
  addMissionItems(inventory, startDate, today, attrs.agentFan);

  return [...inventory];
}

function generateNinjaStats(
  today: Version,
  startDate: Version,
  ninjaAttr: number
): [number, number, number, number] {
  // simplified model of: first fire, then water, then snow
  // TODO expand this model later
  const data: Array<[DateReference, number]> = [
    ['card-jitsu-release', CardJitsuProgress.HIGHEST_RANK],
    ['fire-release', MAX_FIRE_RANK],
    ['water-release', MAX_WATER_RANK],
    ['snow-release', MAX_SNOW_RANK]
  ]

  let dateToStart = startDate;
  const ranks: [number, number, number, number] = [0, 0, 0, 0];
  let ageToFinish: number | undefined = undefined;

  let i = 0;
  for (const [ref, max] of data) {
    const release = getDate(ref);
    const playStart = isGreaterOrEqual(release, dateToStart) ? release : dateToStart;
    const delta = getDaysDelta(playStart, today);
    if (delta < 0) {
      return ranks;
    }
    if (ageToFinish === undefined) {
      // function setup such that
      // attr = 0 -> never finish
      // attr = 1 -> takes one day
      // attr = 0.5 -> takes a month (average)
      // multiply by two to make it the average value multiplied by random
      ageToFinish = ((15 * Math.log(ninjaAttr)) / (-0.69314718056) + 1) * Math.random() * 2;
    }

    const progress = clamp(delta / ageToFinish, 0, 1);
    const rank = Math.floor(max * progress);
    
    ranks[i] = rank;
    if (rank < max) {
      return ranks;
    } else {
      dateToStart = addDays(playStart, ageToFinish);
    }
    i++;
  }
}

function generateRandomPenguin(
  data: GameData,
  attrs: BotAttributes,
  forcedName?: string,
  isDev?: boolean
): PenguinJson {
  const isLaunchDay = data.getDate() === '2005-10-24';
  const name = forcedName ?? ((Math.random() < 0.6 && NPC_NAME_POOL.length > 0)
    ? choose(NPC_NAME_POOL)
    : `${choose(NAME_PARTS_A)}${choose(NAME_PARTS_B)}${randomInt(1, 999)}`);

  let startDate: Version;
  let isMember: boolean;
  let startingCoins: number;
  let isAgent = false;
  let isBetaTester = false;

  if (isDev) {
    startDate = '2005-08-22';
    isMember = true;
    startingCoins = randomInt(5000, 10000);
    if (data.getDate() === '2005-09-21' || isLaunchDay) {
      isBetaTester = true;
      if (isLaunchDay) {
        isAgent = true;
      }
    }
  } else if (isLaunchDay) {
    // 18% former beta testers, 82% newcomers
    isBetaTester = Math.random() < 0.18;
    if (isBetaTester) {
      const age = randomInt(1, Math.max(1, getDaysDelta(START_DATE, data.getDate())));
      startDate = addDays(data.getDate(), -age);
      // Former beta testers get a free month to start + 2000-3500 coins gift
      isMember = true;
      startingCoins = randomInt(2000, 3500);
      // Secret agent feature: accounts old enough (>= 30 days) that pass quiz
      if (age >= 30 && attrs.agentFan > 0.4) {
        isAgent = true;
      }
    } else {
      // Newcomers
      startDate = '2005-10-24';
      // Paid memberships introduced: non-members can now pop up alongside paid members
      isMember = Math.random() < 0.4; // 40% paid members, 60% non-members
      startingCoins = randomInt(500, 1200);
      isAgent = false;
    }
  } else {
    const age = randomInt(0, getDaysDelta(START_DATE, data.getDate()));
    startDate = addDays(data.getDate(), -age);
    isMember = Math.random() <= MEMBER_CHANCE;
    startingCoins = 500;
  }

  const starterColor = choose(data.getStarterColors());
  const base = getDefaultPenguin(
    name,
    starterColor,
    isMember,
    versionToEpoch(startDate),
    data.getDate()
  );
  base.coins = startingCoins;
  base.is_agent = isAgent;
  base.is_member = isMember;
  if (isMember) {
    base.membership_expires = Date.now() + 30 * 86400 * 1000;
  }

  const [ninjaRank, fireRank, waterRank, snowRank] = generateNinjaStats(data.getDate(), startDate, attrs.ninjaFan);

  const inventory = generateRandomInventory(
    data,
    startDate,
    starterColor,
    isMember,
    ninjaRank,
    fireRank,
    snowRank,
    waterRank,
    attrs
  );

  if (isDev && (data.getDate() === '2005-09-21' || isLaunchDay)) {
    inventory.push(413); // Beta Party Hat
    if (isLaunchDay) {
      inventory.push(800); // Spy Phone
    }
  } else if (isLaunchDay) {
    if (isBetaTester && attrs.tester > 0.4 && !inventory.includes(413)) {
      inventory.push(413);
    }
    if (isAgent && !inventory.includes(800)) {
      inventory.push(800);
    }
  }

  const outfit = generateRandomOutfit(data, inventory, isMember);
  if (isDev && data.getDate() === '2005-09-21') {
    outfit.head = 413;
  } else if (isDev && isLaunchDay && Math.random() < 0.5) {
    outfit.head = 413;
  } else if (isLaunchDay && isBetaTester && inventory.includes(413) && Math.random() < 0.5) {
    outfit.head = 413;
  }

  return {
    ...base,
    ...outfit,
    inventory,
    is_agent: isAgent,
    fireNinja: fireRank === MAX_FIRE_RANK,
    waterNinja: waterRank === MAX_WATER_RANK,
    snowNinja: snowRank >= SNOW_NINJA_RANK,
    // never let a bot be written to the penguin database
    noSave: true
  };
}

export function generateRandomBot(
  data: GameData,
  forcedName?: string,
  forcedTrait?: PersonalityTrait,
  isDev?: boolean
): [BotAttributes, PenguinJson] {
  const trait = forcedTrait ?? (forcedName ? DEV_NPC_TRAITS[forcedName as any] : undefined) ?? choose(['friendly', 'shy', 'grumpy', 'excitable', 'curious']);
  const attrs: BotAttributes = {
    personalityTrait: trait,
    ageGroup: sampleRandomAgeGroup(isDev),
    danceFan: Math.random(),
    snowballFan: Math.random(),
    waveFan: Math.random(),
    sitFan: Math.random(),
    chatFan: Math.random(),
    emoteFan: Math.random(),
    walkFan: Math.random(),
    emptyRoomTolerance: Math.random(),
    roomDistraction: Math.random(),
    iglooFan: Math.random(),
    secretsFan: Math.random(),
    followability: Math.random(),
    mythsFan: Math.random(),
    stampsFan: Math.random(),
    musicFan: Math.random(),
    collectorMania: Math.random(),
    tester: Math.random(),
    ninjaFan: Math.random(),
    exploreFan: Math.random(),
    transferFan: Math.random(),
    agentFan: Math.random()
  };
  return [attrs, generateRandomPenguin(data, attrs, forcedName, isDev)];
}

export function generateBots(data: GameData, amount: number): Array<[BotAttributes, PenguinJson]> {
  const bots: Array<[BotAttributes, PenguinJson]> = [];
  if (data.getDate() === '2005-09-21' || data.getDate() === '2005-10-24') {
    for (const name of DEV_NPC_NAMES) {
      if (bots.length >= amount) break;
      bots.push(generateRandomBot(data, name, DEV_NPC_TRAITS[name], true));
    }
  }
  while (bots.length < amount) {
    bots.push(generateRandomBot(data));
  }
  return bots;
}
