import fs from 'fs';
import path from 'path';
import { HTTP_PORT } from '../../common/constants';

export const SNOW_DELTA = 3;

export const WORLD_DELTA = 2;

export const LOGIN_DELTA = 1;

export const SNOW_PORT = HTTP_PORT + SNOW_DELTA;

export const WORLD_PORT = HTTP_PORT + WORLD_DELTA;

export const LOGIN_PORT = HTTP_PORT + LOGIN_DELTA;

export function getServerPopulation(): number {
  const seed = Math.random()
  if (seed < 0.1) {
    return 1
  } else if (seed < 0.2) {
    return 2
  } else if (seed < 0.3) {
    return 3
  } else if (seed < 0.6) {
    return 4
  } else if (seed < 0.8) {
    return 5
  } else {
    return 6
  }
}

/**
 * Returns a population value for pre-CPIP clients.
 * For chatVersion < 506 (e.g. 291, 299, 339), clients calculate bars by player count:
 * <50 -> 1 bar, <100 -> 2 bars, <200 -> 3 bars, <400 -> 4 bars, <500 -> 5 bars, >=500 -> 6 bars.
 * For chatVersion >= 506 (e.g. 506, 604), clients directly call gotoAndStop(Number(Pop)) with 1-6.
 */
export function getPreCpipServerPopulation(isBlizzard: boolean, chatVersion: number): number {
  const level = isBlizzard ? 5 : getServerPopulation();
  if (chatVersion >= 506) {
    return level;
  }
  switch (level) {
    case 1:
      return Math.floor(Math.random() * 40) + 5;
    case 2:
      return Math.floor(Math.random() * 40) + 55;
    case 3:
      return Math.floor(Math.random() * 80) + 110;
    case 4:
      return Math.floor(Math.random() * 150) + 220;
    case 5:
      return Math.floor(Math.random() * 80) + 410;
    case 6:
      return Math.floor(Math.random() * 50) + 500;
    default:
      return Math.floor(Math.random() * 40) + 5;
  }
}

/**
 * Generates comma-delimited world population parameter 'w' for pre-CPIP login.php.
 * Format for each entry is `id|population`.
 */
export function getPreCpipWorldPopulations(chatVersion: number): string {
  const entries: string[] = [];
  const handledIds = new Set<number>();

  // 1. Blizzard (id 100)
  entries.push(`100|${getPreCpipServerPopulation(true, chatVersion)}`);
  handledIds.add(100);

  // 2. Pre-CPIP classic server ID ranges
  const precpipRanges: [number, number][] = [
    [101, 165],
    [200, 215],
    [300, 315],
    [400, 405]
  ];

  for (const [start, end] of precpipRanges) {
    for (let id = start; id <= end; id++) {
      if (!handledIds.has(id)) {
        handledIds.add(id);
        entries.push(`${id}|${getPreCpipServerPopulation(false, chatVersion)}`);
      }
    }
  }

  // 3. Servers in serverList
  for (const server of serverList) {
    if (!handledIds.has(server.id)) {
      handledIds.add(server.id);
      const isBlizzard = server.name === 'Blizzard';
      entries.push(`${server.id}|${getPreCpipServerPopulation(isBlizzard, chatVersion)}`);
    }
  }

  return entries.join(',');
}

type PenguinServer = {
  name: string
  id: number
}

type ServerLang = 'en' | 'pt' | 'fr' | 'es'

type LanguageServer = Array<{
  servers: string[],
  lang: ServerLang
}>

type LanguageServerID = Array<{
  servers: Array<{ name: string, id: number }>,
  lang: ServerLang
}>

const Languages: LanguageServer = [
  { lang: 'en', servers: [
    'Blizzard',
    'Ice Berg',
    'White Out',
    'Slushy',
    'Flurry',
    'Snow Angel',
    'Snow Day',
    'Frostbite',
    'Icicle',
    'Tundra',
    'Snow Cone',
    'Alpine',
    'Ice Breaker',
    'Snow Globe',
    'Snow Fort',
    'Mammoth',
    'Grizzly',
    'Winter Land',
    'Freezer',
    'Avalanche',
    'Powder Ball',
    'Summit',
    'Flippers',
    'Yeti',
    'Sub Zero',
    'Ice Cold',
    'Crystal',
    'Snow Bank',
    'Ice Palace',
    'Tuxedo',
    'Abominable',
    'Half Pipe',
    'Snow Board',
    'Alaska',
    'Thermal',
    'Toboggan',
    'Husky',
    'Snow Plow',
    'Ice Age',
    'Sabertooth',
    'Parka',
    'Hibernate',
    'Sleet',
    'Vanilla',
    'Christmas',
    'Klondike',
    'Icebound',
    'White House',
    'Fjord',
    'Big Foot',
    'Rocky Road',
    'Rainbow',
    'Arctic',
    'Shiver',
    'Matterhorn',
    'Bobsled',
    'Ice Box',
    'Bunny Hill',
    'Walrus',
    'Deep Snow',
    'Snowmobile',
    'Northern Lights',
    'Southern Lights',
    'Ice Shelf',
    'Ascent',
    'Snowcap',
    'Hockey',
    'Jack Frost',
    'Oyster',
    'Pine Needles',
    'Hypothermia',
    'Zipline',
    'North Pole',
    'Glacier',
    'Aurora',
    'Mukluk',
    'Great White',
    'Snow Shoe',
    'Yukon',
    'Polar Bear',
    'Chinook',
    'Wool Socks',
    'Snowbound',
    'Ice Pond',
    'Snowfall',
    'Caribou',
    'Deep Freeze',
    'Cold Front',
    'Frozen',
    'Snow Flake',
    'Frosty',
    'Snow Drift',
    'Mittens',
    'Breeze',
    'Crunch',
    'Wind Chill',
    'Iceland',
    'Belly Slide',
    'Sherbet',
    'South Pole',
    'Big Surf',
    'Sasquatch',
    'Kosciuszko',
    'Down Under',
    'Beanie',
    'Outback',
    'Snowy River',
    'Big Snow',
    'Brumby',
    'Cold Snap',
    'Permafrost',
    'Below Zero',
    'Snow Ball',
    'Ice Pack',
    'Ice Cream',
    'Bubblegum',
    'Altitude',
    'Canoe',
    'Ice Rink',
    'Ice Cave',
    'Boots',
    'Ice Cube',
    'Bonza',
    'Polar',
    'Dry Ice',
    'Snow Covered',
    'Glacial',
    'Pantagonia',
    'Antarctic',
    'Downhill',
    'Elevation',
    'Tea',
    'Misty',
    'Adventure',
    'Beanbag',
    'Cream Soda',
    'Fiesta',
    'Grasshopper',
    'Hot Chocolate',
    'Jackhammer',
    'Migrator',
    'Mullet',
    'Puddle',
    'Sardine',
    'Skates',
    'Berg',
    'Cozy',
    'Sparkle',
    'Slippers',
    'Mountain',
    'Cabin',
    'Fog',
    'Cloudy',
    'Sled'
  ] },
  { lang: 'pt', servers: [
    'Avalanche'
  ] },
  { lang: 'fr', servers: [
    'Yeti'
  ] },
  { lang: 'es', servers: [
    'Glaciar'
  ] }
]

let i = 0;
const locales: LanguageServerID = Languages.map((locale) => {
  return {
    lang: locale.lang,
    servers: locale.servers.map((name) => {
      const id = 3000 + i
      i++
      return { name, id }
    })
  }
})

const serverList: PenguinServer[] = locales.reduce<PenguinServer[]>((accumulator, currentValue) => {
  return [ ...accumulator, ...currentValue.servers]
}, [])

export default serverList;
