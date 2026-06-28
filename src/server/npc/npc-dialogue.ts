// ============================================================
// NPC Module — Dialogue Content
// ============================================================
//
// All dialogue is keyed by PersonalityTrait.
// Within each trait, dialogue is further keyed by room ID or 'any'.
//
// Timeline gates:
//   after: '2005-09-12'   — Snow Forts open, beta continues, party feels closer
//   after: '2005-09-13'   — Astro Barrier launches in Dance Lounge (121); party is 8 days out
//   before: '2005-09-21'  — upcoming Club Penguin Party hype
//   before: '2005-10-24'  — ongoing beta complaints, empty newspaper
//   (No gate)             — always available on 2005-08-22
//
// Room IDs (2005-08-22 / 2005-09-12 accessible rooms):
//   100  Town
//   110  Coffee Shop
//   111  Book Room
//   120  Dance Club
//   121  Dance Lounge
//   130  Gift Shop
//   200  Ski Village
//   800  Dock
//   801  Snow Forts       (opens on 2005-09-12)
//   802  Ice Rink
//   320  Dojo
//   221  Lodge Attic  (attic is in the 2005-08-22 data)
//
// Emote IDs used (pre-CPIP safe set):
//   1 = smile/happy  2 = sad  3 = surprise  4 = angry
//   5 = heart  6 = music note  7 = snowflake  8 = question mark
//   9 = exclamation  10 = thumbs up  11 = coffee  12 = sun
//   13 = moon  14 = puffball (flower)  21 = dollar sign
//   22 = igloo  23 = fish  24 = puffle  25 = cake
//
// Frame IDs (pre-CPIP):
//   1 = normal  2 = walk  13 = sit  25 = wave  26 = dance

import { PersonalityDialogue, PersonalityTrait } from './npc-types';

// ─────────────────────────────────────────────────────────────
// FRIENDLY
// ─────────────────────────────────────────────────────────────
const FRIENDLY: PersonalityDialogue = {
  onPlayerJoin: {
    'any': [
      {
        steps: [
          { delayMs: 800,  action: { type: 'frame', frame: 25 } }, // wave
          { delayMs: 1200, action: { type: 'chat',  message: 'hey!! welcome :)' } },
        ],
      },
      {
        steps: [
          { delayMs: 600,  action: { type: 'chat', message: 'oh hi!!' } },
        ],
      },
      {
        steps: [
          { delayMs: 900,  action: { type: 'emote', emoteId: 1 } }, // smile
          { delayMs: 1500, action: { type: 'chat',  message: 'welcome to the island!!' } },
        ],
      },
    ],
    100: [ // Town — extra enthusiastic
      {
        steps: [
          { delayMs: 700,  action: { type: 'frame', frame: 25 } },
          { delayMs: 1300, action: { type: 'chat',  message: 'hey hey!! glad you made it to the beta :D' } },
        ],
      },
    ],
  },

  onPlayerLeave: {
    'any': [
      {
        steps: [
          { delayMs: 400, action: { type: 'chat', message: 'aw bye!!' } },
        ],
      },
      {
        steps: [
          { delayMs: 500, action: { type: 'emote', emoteId: 2 } }, // sad
        ],
      },
    ],
  },

  onIdle: {
    'any': [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'this island is so cool :)' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'love it here already' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'wonder who else is online right now!' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i hope i can make lots of friends' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'it\'s such a nice day out' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'waddling around is fun' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'everyone is so nice :)' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'im gonna explore the whole map today' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'has anyone seen a cool new room?' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'the games here are actually pretty fun' } }] },
      {
        steps: [
          { delayMs: 0,    action: { type: 'frame', frame: 26 } }, // dance
          { delayMs: 4000, action: { type: 'frame', frame: 1  } },
        ],
      },
      {
        gate: { before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'great. a party on wednesday. going to be so laggy.' } }],
      },
      {
        gate: { after: '2005-09-13', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'new game AND a party this week. they really went for it' } }],
      },
      {
        gate: { after: '2005-09-13' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'have you tried astro barrier? its upstairs in the dance club' } }],
      },
      {
        gate: { before: '2005-10-24' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'still finding bugs lol but its still fun' } }],
      },
      {
        gate: { before: '2005-10-24' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'i used to play penguin chat 3 so i had to sign up for the big update' } }],
      },
      {
        gate: { before: '2005-10-24' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'club penguin is such a cute name for the big update' } }],
      },
    ],
    100: [ // Town
      {
        steps: [
          { delayMs: 0, action: { type: 'chat', message: 'wow actually people on here today :)' } },
        ],
      },
      {
        steps: [
          { delayMs: 0, action: { type: 'chat', message: 'the island feels kinda small but i love it' } },
        ],
      },
      {
        gate: { before: '2005-09-21' },
        steps: [
          { delayMs: 0,    action: { type: 'chat', message: 'the cp team is gonna be here wednesday!!' } },
          { delayMs: 3000, action: { type: 'chat', message: 'so cool!!' } },
        ],
      },
    ],
    110: [ // Coffee Shop
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'anyone wanna play bean counters?' } }] },
      { steps: [{ delayMs: 0, action: { type: 'emote', emoteId: 11 } }, { delayMs: 1500, action: { type: 'chat', message: 'love the coffee shop :)' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'the coffee smell in here is so good!!' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'bean counters is my fave right now' } }] },
    ],
    111: [ // Book Room
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'anyone actually playing mancala here??' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'its nice and quiet up here' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i like reading up here' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'the mancala tables look cool' } }] },
    ],
    120: [ // Dance Club
      { steps: [{ delayMs: 0, action: { type: 'frame', frame: 26 } }, { delayMs: 3000, action: { type: 'chat', message: 'i love the music in here!!' } }, { delayMs: 6000, action: { type: 'frame', frame: 1 } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'dance party!!' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'the music is so good in here' } }] },
    ],
    121: [ // Dance Lounge
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'why are there just couches here lol' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'nice and chill up here' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'kinda quiet compared to downstairs' } }] },
      {
        gate: { after: '2005-09-13' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'astro barrier is so fun!! i keep coming back up here' } }],
      },
      {
        gate: { after: '2005-09-13' },
        steps: [
          { delayMs: 0,    action: { type: 'chat',  message: 'have you tried astro barrier yet??' } },
          { delayMs: 3000, action: { type: 'chat',  message: 'its upstairs in the dance club!!' } },
        ],
      },
      {
        gate: { after: '2005-09-13' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'i cant believe they added a new game!! astro barrier is amazing!!' } }],
      },
    ],
    130: [ // Gift Shop
      { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 0, action: { type: 'chat', message: 'just got something from the catalogue :)' } }] },
      { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 0, action: { type: 'chat', message: 'i love the grass skirt' } }] },
      { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 0, action: { type: 'chat', message: 'what should i buy next' } }] },
      { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 0, action: { type: 'chat', message: 'i wish i could buy stuff in here..' } }] },
    ],
    800: [ // Dock
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'anyone good at ballistic biscuit??' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i love it out here by the water' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'the boat looks cool' } }] },
    ],
    801: [ // Snow Forts
      {
        gate: { after: '2005-09-12', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'the snow forts are so cool!! they just opened!!' } }],
      },
      {
        gate: { after: '2005-09-12', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'this is the best room for snowball fights already' } }],
      },
      {
        gate: { after: '2005-09-12', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'the party is getting close!! maybe they decorate the forts too' } }],
      },
    ],
    802: [ // Ice Rink
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'the puck goes wherever it wants lol' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i keep slipping on the ice!!' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'im pretending this is a serious hockey game' } }] },
    ],
    200: [ // Ski Village
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'not much to do here yet but still cool' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i wonder what they will add here' } }] },
    ],
    320: [ // Dojo
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i actually found the secret room!!' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'this room is so mysterious :o' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'what even is this place?' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'the loading screen said dojo.. but there\'s nothing here' } }] },
    ],
    221: [ // Lodge Attic
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'nice little hideout up here' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'cozy spot!!' } }] },
    ],
  },

  onPlayerChat: [
    {
      keywords: ['hi', 'hello', 'hey', 'sup', 'yo'],
      cooldownMs: 20_000,
      responses: [
        { condition: (npc, room) => room && room.id === 110, steps: [{ delayMs: 800, action: { type: 'chat', message: 'hey!! are you grabbing a coffee?' } }] },
        { condition: (npc, room) => room && room.id === 100, steps: [{ delayMs: 1000, action: { type: 'chat', message: 'hi!! town is so crowded today!!' } }] },
        { steps: [{ delayMs: 800, action: { type: 'chat', message: 'heyy!!' } }] },
        { steps: [{ delayMs: 600, action: { type: 'chat', message: 'hi!!! :D' } }] },
        { steps: [{ delayMs: 700, action: { type: 'frame', frame: 25 } }, { delayMs: 1200, action: { type: 'chat', message: 'hey there!!' } }] },
        { steps: [{ delayMs: 600, action: { type: 'chat', message: 'hello!' } }] },
        { steps: [{ delayMs: 800, action: { type: 'chat', message: 'hi hi!!' } }] },
      ],
    },
    {
      keywords: ['bye', 'cya', 'see ya', 'gtg', 'brb'],
      cooldownMs: 15_000,
      responses: [
        { steps: [{ delayMs: 500, action: { type: 'chat', message: 'byeeee!!' } }] },
        { steps: [{ delayMs: 600, action: { type: 'chat', message: 'aww cya!!' } }] },
        { steps: [{ delayMs: 500, action: { type: 'chat', message: 'see you later!!' } }] },
        { steps: [{ delayMs: 400, action: { type: 'chat', message: 'bye!' } }] },
      ],
    },
    {
      keywords: ['party', 'celebration'],
      cooldownMs: 45_000,
      responses: [
        {
          gate: { before: '2005-09-21' },
          steps: [{ delayMs: 1000, action: { type: 'chat', message: 'omg YES!! the sept 21 party!! i want a hat!!' } }],
        },
        {
          steps: [{ delayMs: 800, action: { type: 'chat', message: 'yeah!! :D' } }],
        },
      ],
    },
    {
      keywords: ['newspaper', 'news'],
      cooldownMs: 60_000,
      responses: [
        {
          gate: { before: '2005-09-21' },
          steps: [{ delayMs: 1000, action: { type: 'chat', message: 'a party on sept 21. i bet the hats look stupid.' } }],
        },
        {
          gate: { before: '2005-10-24' },
          steps: [{ delayMs: 1000, action: { type: 'chat', message: 'haha yeah the newspaper is all lorem ipsum rn' } }],
        },
      ],
    },
    {
      keywords: ['beta', 'test', 'bug'],
      cooldownMs: 60_000,
      responses: [
        {
          gate: { before: '2005-10-24' },
          steps: [
            { delayMs: 800,  action: { type: 'chat', message: 'yeah still in beta lol' } },
            { delayMs: 3500, action: { type: 'chat', message: 'found any bugs??' } },
          ],
        },
      ],
    },
    {
      keywords: ['club penguin', 'big update', 'penguin chat', 'pc3'],
      cooldownMs: 60_000,
      responses: [
        {
          gate: { before: '2005-10-24' },
          steps: [{ delayMs: 800, action: { type: 'chat', message: 'i came over from penguin chat 3 to try the big update :)' } }],
        },
        {
          gate: { before: '2005-10-24' },
          steps: [{ delayMs: 1000, action: { type: 'chat', message: 'some people still call club penguin the big update lol' } }],
        },
      ],
    },
    {
      keywords: ['dance', 'dancing'],
      cooldownMs: 20_000,
      responses: [
        {
          steps: [
            { delayMs: 500,  action: { type: 'frame', frame: 26 } },
            { delayMs: 4000, action: { type: 'frame', frame: 1  } },
          ],
        },
      ],
    },
    {
      keywords: ['cool', 'awesome', 'nice', 'great'],
      cooldownMs: 15_000,
      responses: [
        { steps: [{ delayMs: 600, action: { type: 'chat', message: 'ikr!!' } }] },
        { steps: [{ delayMs: 500, action: { type: 'emote', emoteId: 10 } }] }, // thumbs up
      ],
    },
    {
      keywords: ['lol', 'haha', 'lmao', 'rofl'],
      cooldownMs: 15_000,
      responses: [
        { steps: [{ delayMs: 500, action: { type: 'chat', message: 'hehe' } }] },
        { steps: [{ delayMs: 600, action: { type: 'chat', message: 'lol' } }] },
        { steps: [{ delayMs: 400, action: { type: 'emote', emoteId: 1 } }] },
      ],
    },
    {
      keywords: ['puffle', 'pet'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 700, action: { type: 'chat', message: 'whats a puffle??' } }] },
        { steps: [{ delayMs: 800, action: { type: 'chat', message: 'idk what a puffle is tbh' } }] },
      ],
    },
    {
      keywords: ['pizza', 'food', 'hungry'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 700, action: { type: 'chat', message: 'im so hungry tbh' } }] },
        { steps: [{ delayMs: 900, action: { type: 'chat', message: 'i want pizza' } }] },
      ],
    },
    {
      keywords: ['ninja'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'ninjas? never heard of em' } }] },
      ],
    },
    {
      keywords: ['dojo'],
      cooldownMs: 45_000,
      responses: [
        { condition: (npc, room) => room && room.id !== 320, steps: [{ delayMs: 1000, action: { type: 'chat', message: 'shh!! the dojo is a secret!!' } }] },
        { condition: (npc, room) => room && room.id !== 320, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'theres a secret dojo room hidden on the map :o' } }] },
        { condition: (npc, room) => room && room.id === 320, steps: [{ delayMs: 1000, action: { type: 'chat', message: 'yeah.. we\'re literally in it right now :o' } }] },
        { condition: (npc, room) => room && room.id === 320, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'we found it!! this is the dojo!!' } }] },
      ],
    },
    {
      keywords: ['snow forts', 'snow fort', 'forts'],
      cooldownMs: 45_000,
      responses: [
        {
          gate: { before: '2005-09-12' },
          steps: [{ delayMs: 1000, action: { type: 'chat', message: 'snow forts?? what are those??' } }],
        },
        {
          gate: { before: '2005-09-12' },
          steps: [{ delayMs: 1200, action: { type: 'chat', message: 'wait there are snow forts now?? where??' } }],
        },
        {
          gate: { after: '2005-09-12' },
          steps: [{ delayMs: 900, action: { type: 'chat', message: 'oh the snow forts!! best place for snowball fights :)' } }],
        },
        {
          gate: { after: '2005-09-12' },
          steps: [{ delayMs: 1100, action: { type: 'chat', message: 'yeah!! they opened by the rink and theyre super fun' } }],
        },
      ],
    },
    {
      keywords: ['friend', 'buddy', 'add me'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'i\'d add you but my friend list is broken :(' } }] },
        { steps: [{ delayMs: 1200, action: { type: 'chat', message: 'sorry i cant add anyone right now!!' } }] },
      ],
    },
    {
      keywords: ['ballistic', 'biscuit', 'hydro', 'score'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'my high score in ballistic biscuit is terrible lol' } }] },
        { steps: [{ delayMs: 1200, action: { type: 'chat', message: 'i keep falling off the tube' } }] },
      ],
    },
    {
      keywords: ['bean', 'counter', 'bags', 'coffee'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'i dropped so many bags in bean counters today' } }] },
      ],
    },
    {
      keywords: ['mancala', 'play'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'i wanna learn mancala but idk how yet' } }] },
      ],
    },
    {
      keywords: ['clothes', 'shirt', 'hat', 'buy', 'shop', 'member'],
      cooldownMs: 45_000,
      responses: [
        { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 1000, action: { type: 'chat', message: 'i wish i had membership so i could buy clothes!!' } }] },
        { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'so many coins but cant buy anything lol' } }] },
        { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 1000, action: { type: 'chat', message: 'i love buying new clothes from the catalog!!' } }] },
        { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 1200, action: { type: 'chat', message: 'im saving up for a cool hat' } }] },
      ],
    },
    {
      keywords: ['coin', 'coins', 'money', 'rich', 'broke'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 800, action: { type: 'chat', message: 'i have so many coins from bean counters!!' } }] },
        { steps: [{ delayMs: 900, action: { type: 'chat', message: 'coins are so easy to get if you play games all day' } }] },
        { steps: [{ delayMs: 700, action: { type: 'chat', message: 'im trying to save up but i keep spending lol' } }] },
        { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 800, action: { type: 'chat', message: 'tons of coins but nothing to spend them on :(' } }] },
      ],
    },
    {
      keywords: ['game', 'games', 'play', 'minigame', 'minigames', 'fun'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 800, action: { type: 'chat', message: 'bean counters is my fave game right now!!' } }] },
        { steps: [{ delayMs: 900, action: { type: 'chat', message: 'have you tried ballistic biscuit yet??' } }] },
        { steps: [{ delayMs: 700, action: { type: 'chat', message: 'the games here are so fun :D' } }] },
        { steps: [{ delayMs: 800, action: { type: 'chat', message: 'i love playing games on this island!!' } }] },
      ],
    },
    {
      keywords: ['crap', 'dang', 'damn', 'heck', 'shoot', 'crud'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 600, action: { type: 'chat', message: 'hey watch the language!!' } }] },
        { steps: [{ delayMs: 800, action: { type: 'chat', message: 'whoa there..' } }] },
        { steps: [{ delayMs: 600, action: { type: 'chat', message: 'umm..' } }] },
      ],
    },
    {
      keywords: ['cuss', 'curse', 'ass', 'idiot', 'stupid', 'dumb', 'jerk'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 600, action: { type: 'chat', message: 'excuse me?? not cool!' } }] },
        { steps: [{ delayMs: 700, action: { type: 'chat', message: 'hey!! be nice!!' } }] },
        { steps: [{ delayMs: 500, action: { type: 'emote', emoteId: 2 } }] },
        { steps: [{ delayMs: 600, action: { type: 'chat', message: 'wow rude...' } }] },
      ],
    },
    {
      keywords: ['freak', 'freaking', 'wtf', 'omfg', 'shut up', 'hate you', 'hate this'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 400, action: { type: 'chat', message: 'WHOA!! calm down!!' } }] },
        { steps: [{ delayMs: 500, action: { type: 'emote', emoteId: 4 } }, { delayMs: 1500, action: { type: 'chat', message: 'not okay!!' } }] },
        { steps: [{ delayMs: 400, action: { type: 'chat', message: 'ummm okay...' } }] },
        { steps: [{ delayMs: 500, action: { type: 'chat', message: 'thats not very nice!!' } }] },
      ],
    },
    {
      keywords: ['fuck', 'shit', 'dick', 'cock', 'retard', 'nigga', 'bitch', 'bastard', 'piss'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 500, action: { type: 'chat', message: 'hey!! you really shouldn\'t say that!!' } }] },
        { steps: [{ delayMs: 600, action: { type: 'emote', emoteId: 2 } }, { delayMs: 1500, action: { type: 'chat', message: 'that\'s really not okay!!' } }] },
        { steps: [{ delayMs: 500, action: { type: 'chat', message: 'woah... that\'s a bad word!!' } }] },
        { steps: [{ delayMs: 400, action: { type: 'chat', message: 'please don\'t say things like that!!' } }] },
      ],
    },
    {
      keywords: ['nigger', 'faggot', 'fag', 'troon', 'dyke', 'smd', 'kys', 'kms', 'go die', 'kill yourself'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 300, action: { type: 'emote', emoteId: 2 } }, { delayMs: 1200, action: { type: 'chat', message: 'i\'m reporting you!!' } }] },
        { steps: [{ delayMs: 400, action: { type: 'chat', message: 'that is DISGUSTING. i\'m reporting you!!' } }] },
        { steps: [{ delayMs: 300, action: { type: 'emote', emoteId: 4 } }, { delayMs: 1500, action: { type: 'chat', message: 'you should be BANNED for that!!' } }] },
        { steps: [{ delayMs: 400, action: { type: 'chat', message: 'wow. just wow. get out of here!!' } }] },
      ],
    },
  ],

  onPlayerSnowball: [
    {
      gate: { after: '2005-09-12', before: '2005-09-21' },
      condition: (_npc, room) => room && room.id === 801,
      chance: 0.9,
      steps: [
        { delayMs: 500, action: { type: 'chat', message: 'snow forts battle!!' } },
        { delayMs: 1000, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 1800, action: { type: 'snowball', target: 'random-player' } },
      ],
    },
    {
      gate: { after: '2005-09-12', before: '2005-09-21' },
      condition: (_npc, room) => room && room.id === 801,
      chance: 0.85,
      steps: [
        { delayMs: 400, action: { type: 'chat', message: 'hold the fort!!' } },
        { delayMs: 900, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 1500, action: { type: 'snowball', target: 'random-player' } },
      ],
    },
    {
      gate: { after: '2005-09-12', before: '2005-09-21' },
      condition: (_npc, room) => room && room.id === 801,
      chance: 0.8,
      steps: [
        { delayMs: 600, action: { type: 'emote', emoteId: 7 } },
        { delayMs: 1200, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 2200, action: { type: 'chat', message: 'red fort vs blue fort!!' } },
      ],
    },
    { chance: 0.6, steps: [{ delayMs: 1500, action: { type: 'chat', message: 'haha good shot!' } }, { delayMs: 1000, action: { type: 'snowball', target: 'origin' } }] },
    { chance: 0.5, steps: [{ delayMs: 1000, action: { type: 'chat', message: 'hey!!' } }, { delayMs: 1000, action: { type: 'snowball', target: 'origin' } }] },
    { chance: 0.4, steps: [{ delayMs: 1500, action: { type: 'emote', emoteId: 2 } }, { delayMs: 1000, action: { type: 'snowball', target: 'origin' } }] },
    { chance: 0.3, steps: [{ delayMs: 1000, action: { type: 'chat', message: 'snowball fight!!' } }, { delayMs: 1000, action: { type: 'snowball', target: 'origin' } }, { delayMs: 2000, action: { type: 'snowball', target: 'origin' } }] },
  ],

  onPlayerEmote: [
    {
      emoteId: 1, // smile
      chance: 0.6,
      responses: [{ steps: [{ delayMs: 800, action: { type: 'emote', emoteId: 1 } }] }],
    },
    {
      emoteId: 25, // wave
      chance: 0.7,
      responses: [{ steps: [{ delayMs: 600, action: { type: 'frame', frame: 25 } }] }],
    },
    {
      emoteId: 2, // sad
      chance: 0.5,
      responses: [{ steps: [{ delayMs: 900, action: { type: 'chat', message: 'aww whats wrong??' } }] }],
    },
  ],

  onPlayerRareItem: [
    { steps: [{ delayMs: 1200, action: { type: 'chat', message: 'whoa where did you get that??' } }] },
    { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'omg i didnt know that existed :o' } }] },
    { steps: [{ delayMs: 900,  action: { type: 'emote', emoteId: 3 } }] }, // surprise
  ],

  npcExchanges: [
    {
      gate: { before: '2005-09-21' },
      cooldownMs: 180_000,
      chance: 0.1,
      steps: [
        { who: 'a', step: { delayMs: 0,    action: { type: 'chat', message: 'did you read the newspaper?' } } },
        { who: 'b', step: { delayMs: 2000, action: { type: 'chat', message: 'yeah it is literally just lorem ipsum lol' } } },
        { who: 'a', step: { delayMs: 3000, action: { type: 'chat', message: 'the quick-snow comic was funny though' } } },
      ],
    },
    {
      gate: { before: '2005-10-24' },
      cooldownMs: 150_000,
      chance: 0.1,
      steps: [
        { who: 'a', step: { delayMs: 0,    action: { type: 'chat', message: 'the newspaper is literally just lorem ipsum' } } },
        { who: 'b', step: { delayMs: 2500, action: { type: 'chat', message: 'yeah they didnt even finish it' } } },
        { who: 'a', step: { delayMs: 2000, action: { type: 'chat', message: '"CLUB PENGUIN OPENS" but its in beta lol' } } },
      ],
    },
    {
      cooldownMs: 120_000,
      chance: 0.1,
      steps: [
        { who: 'a', step: { delayMs: 0,    action: { type: 'chat', message: 'this island is so small lol' } } },
        { who: 'b', step: { delayMs: 2000, action: { type: 'chat', message: 'yeah but its growing' } } },
        { who: 'a', step: { delayMs: 2000, action: { type: 'chat', message: 'true :)' } } },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// SHY
// ─────────────────────────────────────────────────────────────
const SHY: PersonalityDialogue = {
  onPlayerJoin: {
    'any': [
      { chance: 0.3, steps: [{ delayMs: 2000, action: { type: 'chat', message: 'oh.. hi' } }] },
      { chance: 0.2, steps: [{ delayMs: 2500, action: { type: 'emote', emoteId: 1 } }] },
    ],
  },

  onPlayerLeave: {
    'any': [
      { chance: 0.25, steps: [{ delayMs: 1000, action: { type: 'chat', message: 'oh.. bye' } }] },
    ],
  },

  onIdle: {
    'any': [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: '...' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'um.. hello anyone?' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i kinda want to go home..' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'too many people here..' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'is it cold or is it just me..' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'just looking around..' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'hope no one talks to me lol..' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i wish i was invisible sometimes..' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i lost my map..' } }] },
      { steps: [{ delayMs: 0, action: { type: 'emote', emoteId: 8 } }] }, // question mark
      {
        gate: { before: '2005-10-24' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'the newspaper is literally in latin..' } }],
      },
      {
        gate: { before: '2005-10-24' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'i only joined because i used to play penguin chat 3..' } }],
      },
      {
        gate: { before: '2005-10-24' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'everyone still calling club penguin the big update is kinda confusing..' } }],
      },
      {
        gate: { before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'a club penguin party.. sounds crowded..' } }],
      },
    ],
    110: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i like the coffee shop its cozy' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'the coffee smell is nice..' } }] },
    ],
    111: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'nice and quiet up here..' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'the mancala tables look fun.. maybe one day' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i like hiding out up here..' } }] },
    ],
    120: [
      { steps: [{ delayMs: 0, action: { type: 'frame', frame: 26 } }, { delayMs: 5000, action: { type: 'frame', frame: 1 } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'the music in here is kinda loud..' } }] },
    ],
    121: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'just sitting here..' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'the lounge is nice..' } }] },
      {
        gate: { after: '2005-09-13' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'i keep playing astro barrier alone up here..' } }],
      },
      {
        gate: { after: '2005-09-13' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'astro barrier is less stressful when no one is watching..' } }],
      },
    ],
    130: [
      { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 0, action: { type: 'chat', message: 'just browsing..' } }] },
      { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 0, action: { type: 'chat', message: 'i cant buy anything here..' } }] },
    ],
    800: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'the water looks cold..' } }] },
    ],
    801: [
      {
        gate: { after: '2005-09-12', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'the snow forts are busy already..' } }],
      },
      {
        gate: { after: '2005-09-12', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'i liked it more when town and the rink were separate..' } }],
      },
      {
        gate: { after: '2005-09-12', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'the party is getting close.. which means more people..' } }],
      },
    ],
    200: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'not much going on here yet..' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'kinda empty out here..' } }] },
    ],
    802: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'the puck has a mind of its own..' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'slippery out here..' } }] },
    ],
    320: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'this secret room is so weird..' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'there\'s nothing in here..' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'it\'s very empty..' } }] },
    ],
    221: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'nice and quiet up here..' } }] },
    ],
  },

  onPlayerChat: [
    {
      keywords: ['hi', 'hello', 'hey'],
      cooldownMs: 30_000,
      responses: [
        { condition: (npc, room) => room && room.id === 111, chance: 0.6, steps: [{ delayMs: 2000, action: { type: 'chat', message: 'oh.. hi. im just reading..' } }] },
        { condition: (npc, room) => room && room.id === 130, chance: 0.6, steps: [{ delayMs: 2200, action: { type: 'chat', message: 'hi.. im just looking at shirts..' } }] },
        { chance: 0.5, steps: [{ delayMs: 2500, action: { type: 'chat', message: 'oh.. hey' } }] },
        { chance: 0.3, steps: [{ delayMs: 2000, action: { type: 'emote', emoteId: 1 } }] },
        { chance: 0.4, steps: [{ delayMs: 2000, action: { type: 'chat', message: 'hi..' } }] },
        { chance: 0.3, steps: [{ delayMs: 2200, action: { type: 'chat', message: 'um hello' } }] },
      ],
    },
    {
      keywords: ['bye', 'cya', 'see ya', 'gtg', 'brb'],
      cooldownMs: 15_000,
      responses: [
        { chance: 0.5, steps: [{ delayMs: 1500, action: { type: 'chat', message: 'oh.. bye' } }] },
        { chance: 0.4, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'bye..' } }] },
        { chance: 0.3, steps: [{ delayMs: 1500, action: { type: 'emote', emoteId: 2 } }] },
      ],
    },
    {
      keywords: ['newspaper', 'news'],
      cooldownMs: 60_000,
      responses: [
        {
          gate: { before: '2005-09-21' },
          steps: [{ delayMs: 1800, action: { type: 'chat', message: 'a party on sept 21. i bet the hats look stupid.' } }],
        },
        {
          gate: { before: '2005-10-24' },
          steps: [{ delayMs: 1800, action: { type: 'chat', message: 'yeah.. its pretty empty isnt it' } }],
        },
      ],
    },
    {
      keywords: ['mancala'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 2000, action: { type: 'chat', message: 'i keep meaning to try it..' } }] },
      ],
    },
    {
      keywords: ['beta', 'bug'],
      cooldownMs: 60_000,
      responses: [
        {
          gate: { before: '2005-10-24' },
          steps: [{ delayMs: 2000, action: { type: 'chat', message: 'yeah.. still beta. found a few things' } }],
        },
      ],
    },
    {
      keywords: ['club penguin', 'big update', 'penguin chat', 'pc3'],
      cooldownMs: 60_000,
      responses: [
        {
          gate: { before: '2005-10-24' },
          steps: [{ delayMs: 2000, action: { type: 'chat', message: 'i knew about it from penguin chat 3.. before they called it club penguin' } }],
        },
        {
          gate: { before: '2005-10-24' },
          steps: [{ delayMs: 2200, action: { type: 'chat', message: 'the big update was a less scary name somehow..' } }],
        },
      ],
    },
    {
      keywords: ['lol', 'haha', 'lmao'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'heh..' } }] },
      ],
    },
    {
      keywords: ['dojo'],
      cooldownMs: 45_000,
      responses: [
        { condition: (npc, room) => room && room.id !== 320, steps: [{ delayMs: 2500, action: { type: 'chat', message: 'ive never found the dojo.. sounds hard to find' } }] },
        { condition: (npc, room) => room && room.id !== 320, steps: [{ delayMs: 2000, action: { type: 'chat', message: 'i heard there\'s a secret room somewhere..' } }] },
        { condition: (npc, room) => room && room.id === 320, steps: [{ delayMs: 2000, action: { type: 'chat', message: 'oh.. i\'m in it right now..' } }] },
      ],
    },
    {
      keywords: ['snow forts', 'snow fort', 'forts'],
      cooldownMs: 45_000,
      responses: [
        {
          gate: { before: '2005-09-12' },
          steps: [{ delayMs: 2200, action: { type: 'chat', message: 'snow forts..? i dont think ive heard of those..' } }],
        },
        {
          gate: { before: '2005-09-12' },
          steps: [{ delayMs: 2500, action: { type: 'chat', message: 'what are the snow forts? another hidden room?' } }],
        },
        {
          gate: { after: '2005-09-12' },
          steps: [{ delayMs: 2200, action: { type: 'chat', message: 'oh.. the snow forts are kind of scary when everyone starts throwing snowballs' } }],
        },
        {
          gate: { after: '2005-09-12' },
          steps: [{ delayMs: 2000, action: { type: 'chat', message: 'i know the snow forts.. theyre by the rink right?' } }],
        },
      ],
    },
    {
      keywords: ['friend', 'buddy', 'add me'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'im a bit too shy to add friends right now..' } }] },
      ],
    },
    {
      keywords: ['ballistic', 'biscuit', 'hydro', 'score'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'i tried ballistic biscuit and fell off right away..' } }] },
      ],
    },
    {
      keywords: ['bean', 'counter', 'bags', 'coffee'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'bean counters is too stressful for me' } }] },
      ],
    },
    {
      keywords: ['mancala', 'play'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'i dont know how to play mancala.. maybe someday' } }] },
      ],
    },
    {
      keywords: ['clothes', 'shirt', 'hat', 'buy', 'shop', 'member'],
      cooldownMs: 45_000,
      responses: [
        { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 1500, action: { type: 'chat', message: 'i wish i had membership so i could get a hat' } }] },
        { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 1800, action: { type: 'chat', message: 'i have coins but nothing to buy..' } }] },
        { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 1500, action: { type: 'chat', message: 'i finally bought a hat..' } }] },
        { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 1800, action: { type: 'chat', message: 'i like the clothes here.' } }] },
      ],
    },
    {
      keywords: ['coin', 'coins', 'money', 'rich', 'broke'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'i have a lot of coins..' } }] },
        { steps: [{ delayMs: 1800, action: { type: 'chat', message: 'been farming bean counters..' } }] },
        { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 1500, action: { type: 'chat', message: 'coins arent useful without membership..' } }] },
      ],
    },
    {
      keywords: ['game', 'games', 'play', 'minigame', 'minigames', 'fun'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'games are fun.. when i can find them' } }] },
        { steps: [{ delayMs: 1800, action: { type: 'chat', message: 'i like bean counters its calm..' } }] },
        { steps: [{ delayMs: 1200, action: { type: 'chat', message: 'ballistic biscuit is kinda scary..' } }] },
        {
          gate: { after: '2005-09-13' },
          steps: [{ delayMs: 1500, action: { type: 'chat', message: 'astro barrier is.. actually kind of fun? when nobody is around..' } }],
        },
      ],
    },
    {
      keywords: ['astro', 'astro barrier', 'barrier'],
      cooldownMs: 45_000,
      responses: [
        {
          gate: { after: '2005-09-13' },
          steps: [{ delayMs: 1800, action: { type: 'chat', message: 'oh.. yeah astro barrier.. i tried it when nobody was looking' } }],
        },
        {
          gate: { after: '2005-09-13' },
          steps: [{ delayMs: 2000, action: { type: 'chat', message: 'its upstairs in the club.. not many people know about it yet i think..' } }],
        },
      ],
    },
    {
      keywords: ['crap', 'dang', 'damn', 'heck', 'shoot', 'crud'],
      cooldownMs: 20_000,
      responses: [
        { chance: 0.5, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'um..' } }] },
        { chance: 0.4, steps: [{ delayMs: 1500, action: { type: 'emote', emoteId: 8 } }] },
      ],
    },
    {
      keywords: ['cuss', 'curse', 'ass', 'idiot', 'stupid', 'dumb', 'jerk'],
      cooldownMs: 20_000,
      responses: [
        { chance: 0.5, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'please dont say that..' } }] },
        { chance: 0.4, steps: [{ delayMs: 1500, action: { type: 'emote', emoteId: 2 } }] },
        { chance: 0.4, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'thats mean..' } }] },
      ],
    },
    {
      keywords: ['freak', 'freaking', 'wtf', 'omfg', 'shut up', 'hate you', 'hate this'],
      cooldownMs: 20_000,
      responses: [
        { chance: 0.6, steps: [{ delayMs: 800, action: { type: 'emote', emoteId: 2 } }] },
        { chance: 0.4, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'why are you so angry..' } }] },
        { chance: 0.3, steps: [{ delayMs: 1500, action: { type: 'chat', message: 'ok i don\'t wanna be here anymore..' } }] },
      ],
    },
    {
      keywords: ['fuck', 'shit', 'dick', 'cock', 'retard', 'nigga', 'bitch', 'bastard', 'piss'],
      cooldownMs: 20_000,
      responses: [
        { chance: 0.6, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'please don\'t say that..' } }] },
        { chance: 0.5, steps: [{ delayMs: 1000, action: { type: 'emote', emoteId: 2 } }] },
        { chance: 0.4, steps: [{ delayMs: 1500, action: { type: 'chat', message: 'that\'s a bad word..' } }] },
      ],
    },
    {
      keywords: ['nigger', 'faggot', 'fag', 'troon', 'dyke', 'smd', 'kys', 'kms', 'go die', 'kill yourself'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 800,  action: { type: 'emote', emoteId: 2 } }] },
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'i\'m reporting you..' } }] },
        { steps: [{ delayMs: 1200, action: { type: 'chat', message: 'that\'s really awful..' } }] },
      ],
    },
  ],

  onPlayerSnowball: [
    {
      gate: { after: '2005-09-12', before: '2005-09-21' },
      condition: (_npc, room) => room && room.id === 801,
      chance: 0.8,
      steps: [
        { delayMs: 700, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 1500, action: { type: 'chat', message: 'i knew someone would start that..' } },
      ],
    },
    {
      gate: { after: '2005-09-12', before: '2005-09-21' },
      condition: (_npc, room) => room && room.id === 801,
      chance: 0.7,
      steps: [
        { delayMs: 800, action: { type: 'emote', emoteId: 2 } },
        { delayMs: 1400, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 2200, action: { type: 'chat', message: 'please dont make me defend the fort..' } },
      ],
    },
    {
      gate: { after: '2005-09-12', before: '2005-09-21' },
      condition: (_npc, room) => room && room.id === 801,
      chance: 0.7,
      steps: [
        { delayMs: 700, action: { type: 'chat', message: 'ok fine. im defending this side.' } },
        { delayMs: 1400, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 2200, action: { type: 'snowball', target: 'random-player' } },
      ],
    },
    { chance: 0.6, steps: [{ delayMs: 1000, action: { type: 'emote', emoteId: 8 } }, { delayMs: 2000, action: { type: 'chat', message: 'why did you do that..' } }] },
    { chance: 0.5, steps: [{ delayMs: 800, action: { type: 'chat', message: 'ah!!' } }, { delayMs: 500, action: { type: 'frame', frame: 24 } }, { delayMs: 3000, action: { type: 'frame', frame: 1 } }] }, // hide
    { chance: 0.4, steps: [{ delayMs: 1500, action: { type: 'chat', message: 'please stop..' } }] },
    { chance: 0.3, steps: [{ delayMs: 1000, action: { type: 'snowball', target: 'origin' } }, { delayMs: 1500, action: { type: 'chat', message: 'leave me alone..' } }] },
  ],

  onPlayerEmote: [
    {
      emoteId: 25, // wave
      chance: 0.4,
      responses: [{ steps: [{ delayMs: 1500, action: { type: 'frame', frame: 25 } }] }],
    },
  ],

  onPlayerRareItem: [
    { chance: 0.3, steps: [{ delayMs: 2000, action: { type: 'chat', message: 'oh.. where did you get that' } }] },
  ],

  npcExchanges: [
    {
      gate: { before: '2005-10-24' },
      cooldownMs: 180_000,
      chance: 0.1,
      steps: [
        { who: 'a', step: { delayMs: 0,    action: { type: 'chat', message: 'penguin chat 3 players really did all sign up for the big update huh' } } },
        { who: 'b', step: { delayMs: 2500, action: { type: 'chat', message: 'yeah.. and now its called club penguin' } } },
        { who: 'a', step: { delayMs: 2000, action: { type: 'chat', message: 'i still forget the new name sometimes..' } } },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// GRUMPY
// ─────────────────────────────────────────────────────────────
const GRUMPY: PersonalityDialogue = {
  onPlayerJoin: {
    'any': [
      { chance: 0.2, steps: [{ delayMs: 1500, action: { type: 'chat', message: 'great more people' } }] },
    ],
  },

  onPlayerLeave: {
    'any': [
      { chance: 0.3, steps: [{ delayMs: 600, action: { type: 'chat', message: 'finally' } }] },
      { chance: 0.2, steps: [{ delayMs: 500, action: { type: 'emote', emoteId: 4 } }] }, // angry
    ],
  },

  onIdle: {
    'any': [
      { steps: [{ delayMs: 0, action: { type: 'emote', emoteId: 4 } }] }, // angry
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'this island is so small i keep going in circles' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'im bored.' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'why is everyone waddling so fast' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'nothing to do here' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'my feet are freezing' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i want to go home' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'ugh.' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'don\'t look at me' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i lost my snowball' } }] },
      {
        gate: { before: '2005-10-24' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'how long is this beta gonna last' } }],
      },
      {
        gate: { before: '2005-10-24' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'penguin chat 3 was simpler. this big update better be worth it.' } }],
      },
      {
        gate: { before: '2005-10-24' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'club penguin is a better name than "the big update" i guess.' } }],
      },
      {
        gate: { before: '2005-10-24' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'newspaper is literally just lorem ipsum. great.' } }],
      },
      {
        gate: { before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'yeah yeah a party. wake me up when it\'s here' } }],
      },
    ],
    100: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'same people walking around the town every day' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'everyone just stands here.' } }] },
    ],
    110: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'coffee shop is too crowded.' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'bean counters is the only reason to be here.' } }] },
    ],
    111: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'at least it\'s quiet up here.' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'mancala is useless if nobody knows the rules.' } }] },
    ],
    800: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i keep falling off the biscuit. every time.' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'my high score is pathetic' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'the dock smells like fish.' } }] },
    ],
    801: [
      {
        gate: { after: '2005-09-12', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'new room. same snow. wow.' } }],
      },
      {
        gate: { after: '2005-09-12', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'the snow forts turned the walk to the rink into a war zone.' } }],
      },
      {
        gate: { after: '2005-09-12', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'party is in nine days and everyone is already unbearable.' } }],
      },
    ],
    802: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'the puck just did a weird little jump' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'what even is the point of an ice rink if nobody chases the puck' } }] },
    ],
    200: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'literally nothing to do here' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'why is this place so empty.' } }] },
    ],
    121: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'just a bunch of couches. amazing.' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'upstairs. nothing here either.' } }] },
      {
        gate: { after: '2005-09-13' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'astro barrier. so now theres a crowd up here too.' } }],
      },
      {
        gate: { after: '2005-09-13' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'the new game is fine i guess. the music loop is annoying.' } }],
      },
    ],
    130: [
      { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 0, action: { type: 'chat', message: 'not enough items in the catalog' } }] },
      { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 0, action: { type: 'chat', message: 'can\'t even buy anything. pointless being here.' } }] },
    ],
    320: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i found the secret room. it\'s just an empty room.' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'nothing in here. great secret.' } }] },
    ],
    221: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'a hidden attic. with nothing in it.' } }] },
    ],
  },

  onPlayerChat: [
    {
      keywords: ['hi', 'hello', 'hey'],
      cooldownMs: 40_000,
      responses: [
        { chance: 0.4, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'hi.' } }] },
        { chance: 0.3, steps: [{ delayMs: 1500, action: { type: 'chat', message: 'what.' } }] },
        { chance: 0.4, steps: [{ delayMs: 1000, action: { type: 'chat', message: 'don\'t talk to me.' } }] },
        { chance: 0.3, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'hello. bye.' } }] },
      ],
    },
    {
      keywords: ['bye', 'cya', 'see ya', 'gtg', 'brb'],
      cooldownMs: 15_000,
      responses: [
        { chance: 0.5, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'finally.' } }] },
        { chance: 0.4, steps: [{ delayMs: 1000, action: { type: 'chat', message: 'good.' } }] },
        { chance: 0.5, steps: [{ delayMs: 800, action: { type: 'chat', message: 'bye.' } }] },
      ],
    },
    {
      keywords: ['bug', 'glitch', 'broken'],
      cooldownMs: 45_000,
      responses: [
        {
          gate: { before: '2005-10-24' },
          steps: [
            { delayMs: 800,  action: { type: 'chat', message: 'yeah. lots of bugs. its a mess.' } },
            { delayMs: 3500, action: { type: 'emote', emoteId: 4 } },
          ],
        },
      ],
    },
    {
      keywords: ['club penguin', 'big update', 'penguin chat', 'pc3'],
      cooldownMs: 45_000,
      responses: [
        {
          gate: { before: '2005-10-24' },
          steps: [{ delayMs: 1000, action: { type: 'chat', message: 'i came from penguin chat 3. thats the only reason im here.' } }],
        },
        {
          gate: { before: '2005-10-24' },
          steps: [{ delayMs: 1200, action: { type: 'chat', message: 'the big update finally got a real name. good.' } }],
        },
      ],
    },
    {
      keywords: ['newspaper', 'news'],
      cooldownMs: 60_000,
      responses: [
        {
          gate: { before: '2005-10-24' },
          steps: [{ delayMs: 1000, action: { type: 'chat', message: "the newspaper? its just lorem ipsum lol" } }],
        },
      ],
    },
    {
      keywords: ['party'],
      cooldownMs: 60_000,
      responses: [
        {
          gate: { before: '2005-09-21' },
          steps: [{ delayMs: 1200, action: { type: 'chat', message: 'sure. wake me up when it actually happens' } }],
        },
      ],
    },
    {
      keywords: ['puck', 'rink', 'hockey'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 800, action: { type: 'chat', message: 'the puck is real. the hockey is mostly imagination.' } }] },
      ],
    },
    {
      keywords: ['biscuit', 'ballistic'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 800, action: { type: 'chat', message: 'i have a terrible score. dont ask.' } }] },
      ],
    },
    {
      keywords: ['astro', 'astro barrier', 'barrier'],
      cooldownMs: 45_000,
      responses: [
        {
          gate: { after: '2005-09-13' },
          steps: [{ delayMs: 1200, action: { type: 'chat', message: 'yeah i tried it. the music loop alone made me leave.' } }],
        },
        {
          gate: { after: '2005-09-13' },
          steps: [{ delayMs: 1000, action: { type: 'chat', message: 'new game. upstairs in the club. not that exciting.' } }],
        },
        {
          gate: { after: '2005-09-13' },
          steps: [{ delayMs: 1200, action: { type: 'chat', message: 'its fine. crowded the lounge though.' } }],
        },
      ],
    },
    {
      keywords: ['cool', 'awesome', 'great', 'nice'],
      cooldownMs: 20_000,
      responses: [
        { chance: 0.5, steps: [{ delayMs: 1000, action: { type: 'chat', message: "sure." } }] },
      ],
    },
    {
      keywords: ['lol', 'haha', 'lmao'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'whats so funny.' } }] },
        { steps: [{ delayMs: 1200, action: { type: 'emote', emoteId: 4 } }] },
      ],
    },
    {
      keywords: ['dojo'],
      cooldownMs: 45_000,
      responses: [
        { condition: (npc, room) => room && room.id !== 320, steps: [{ delayMs: 1500, action: { type: 'chat', message: 'dojo is literally just an empty room right now' } }] },
        { condition: (npc, room) => room && room.id !== 320, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'yeah it\'s a secret room. not that impressive.' } }] },
        { condition: (npc, room) => room && room.id === 320, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'we\'re in the dojo. it\'s empty. impressive.' } }] },
      ],
    },
    {
      keywords: ['snow forts', 'snow fort', 'forts'],
      cooldownMs: 45_000,
      responses: [
        {
          gate: { before: '2005-09-12' },
          steps: [{ delayMs: 1200, action: { type: 'chat', message: 'snow forts? no idea what youre talking about.' } }],
        },
        {
          gate: { before: '2005-09-12' },
          steps: [{ delayMs: 1400, action: { type: 'chat', message: 'what snow forts. did they build them in your imagination?' } }],
        },
        {
          gate: { after: '2005-09-12' },
          steps: [{ delayMs: 1200, action: { type: 'chat', message: 'yeah i know the snow forts. too many snowballs.' } }],
        },
        {
          gate: { after: '2005-09-12' },
          steps: [{ delayMs: 1500, action: { type: 'chat', message: 'they exist. theyre loud. thats all i need to know.' } }],
        },
      ],
    },
    {
      keywords: ['friend', 'buddy', 'add me'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'im not adding anybody. leave me alone.' } }] },
      ],
    },
    {
      keywords: ['bean', 'counter', 'bags', 'coffee'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'bean counters is rigged.' } }] },
      ],
    },
    {
      keywords: ['mancala', 'play'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'i dont care about mancala.' } }] },
      ],
    },
    {
      keywords: ['clothes', 'shirt', 'hat', 'buy', 'shop', 'member'],
      cooldownMs: 45_000,
      responses: [
        { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 1500, action: { type: 'chat', message: 'i cant even buy clothes. great game.' } }] },
        { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 1800, action: { type: 'chat', message: 'rich but not a member so it doesnt matter.' } }] },
        { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 1500, action: { type: 'chat', message: 'the clothes here are too expensive' } }] },
        { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 1800, action: { type: 'chat', message: 'i waste all my coins on shirts' } }] },
      ],
    },
    {
      keywords: ['coin', 'coins', 'money', 'rich', 'broke'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 1200, action: { type: 'chat', message: 'yeah whatever. coins are useless anyway.' } }] },
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'i have plenty. nothing worth buying.' } }] },
        { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'tons of coins, zero membership. fantastic.' } }] },
      ],
    },
    {
      keywords: ['game', 'games', 'play', 'minigame', 'minigames', 'fun'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 1200, action: { type: 'chat', message: 'bean counters is okay i guess.' } }] },
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'i keep losing on ballistic biscuit. it\'s rigged.' } }] },
        { steps: [{ delayMs: 1200, action: { type: 'chat', message: 'fun? on this island? sure.' } }] },
      ],
    },
    {
      keywords: ['crap', 'dang', 'damn', 'heck', 'shoot', 'crud'],
      cooldownMs: 20_000,
      responses: [
        { chance: 0.5, steps: [{ delayMs: 1000, action: { type: 'chat', message: 'same.' } }] },
        { chance: 0.4, steps: [{ delayMs: 1200, action: { type: 'emote', emoteId: 4 } }] },
        { chance: 0.4, steps: [{ delayMs: 800,  action: { type: 'chat', message: 'my thoughts exactly.' } }] },
      ],
    },
    {
      keywords: ['cuss', 'curse', 'ass', 'idiot', 'stupid', 'dumb', 'jerk'],
      cooldownMs: 20_000,
      responses: [
        { chance: 0.5, steps: [{ delayMs: 1000, action: { type: 'chat', message: 'watch it.' } }] },
        { chance: 0.4, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'great. language.' } }] },
        { chance: 0.3, steps: [{ delayMs: 1000, action: { type: 'emote', emoteId: 4 } }] },
      ],
    },
    {
      keywords: ['freak', 'freaking', 'wtf', 'omfg', 'shut up', 'hate you', 'hate this'],
      cooldownMs: 20_000,
      responses: [
        { chance: 0.5, steps: [{ delayMs: 800,  action: { type: 'chat', message: 'calm down.' } }] },
        { chance: 0.4, steps: [{ delayMs: 1000, action: { type: 'emote', emoteId: 4 } }, { delayMs: 2000, action: { type: 'chat', message: 'rein it in.' } }] },
        { chance: 0.3, steps: [{ delayMs: 800,  action: { type: 'chat', message: 'oh great. exactly what i needed.' } }] },
      ],
    },
    {
      keywords: ['fuck', 'shit', 'dick', 'cock', 'retard', 'nigga', 'bitch', 'bastard', 'piss'],
      cooldownMs: 20_000,
      responses: [
        { chance: 0.5, steps: [{ delayMs: 1000, action: { type: 'chat', message: 'watch your mouth.' } }] },
        { chance: 0.4, steps: [{ delayMs: 800,  action: { type: 'emote', emoteId: 4 } }, { delayMs: 1800, action: { type: 'chat', message: 'seriously.' } }] },
        { chance: 0.5, steps: [{ delayMs: 1000, action: { type: 'chat', message: 'language.' } }] },
      ],
    },
    {
      keywords: ['nigger', 'faggot', 'fag', 'troon', 'dyke', 'smd', 'kys', 'kms', 'go die', 'kill yourself'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 800,  action: { type: 'emote', emoteId: 4 } }, { delayMs: 1800, action: { type: 'chat', message: 'get reported.' } }] },
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'that\'s disgusting. get out.' } }] },
        { steps: [{ delayMs: 800,  action: { type: 'chat', message: 'i\'m reporting you. done.' } }] },
      ],
    },
  ],

  onPlayerSnowball: [
    {
      gate: { after: '2005-09-12', before: '2005-09-21' },
      condition: (_npc, room) => room && room.id === 801,
      chance: 0.9,
      steps: [
        { delayMs: 400, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 900, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 1500, action: { type: 'snowball', target: 'random-player' } },
        { delayMs: 2100, action: { type: 'chat', message: 'you picked the wrong fort.' } },
      ],
    },
    {
      gate: { after: '2005-09-12', before: '2005-09-21' },
      condition: (_npc, room) => room && room.id === 801,
      chance: 0.85,
      steps: [
        { delayMs: 400, action: { type: 'chat', message: 'back off my wall.' } },
        { delayMs: 900, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 1500, action: { type: 'snowball', target: 'origin' } },
      ],
    },
    {
      gate: { after: '2005-09-12', before: '2005-09-21' },
      condition: (_npc, room) => room && room.id === 801,
      chance: 0.8,
      steps: [
        { delayMs: 500, action: { type: 'chat', message: 'this is literally what the forts are for.' } },
        { delayMs: 1100, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 1900, action: { type: 'snowball', target: 'random-player' } },
      ],
    },
    { chance: 0.6, steps: [{ delayMs: 1000, action: { type: 'emote', emoteId: 12 } }, { delayMs: 1500, action: { type: 'chat', message: 'stop throwing snowballs at me.' } }] }, // angry
    { chance: 0.5, steps: [{ delayMs: 800, action: { type: 'chat', message: 'im reporting you.' } }] },
    { chance: 0.4, steps: [{ delayMs: 500, action: { type: 'snowball', target: 'origin' } }, { delayMs: 1000, action: { type: 'snowball', target: 'origin' } }, { delayMs: 1500, action: { type: 'chat', message: 'how do you like it.' } }] },
    { chance: 0.3, steps: [{ delayMs: 1000, action: { type: 'chat', message: 'knock it off.' } }] },
  ],

  onPlayerEmote: [
    {
      emoteId: 1, // smile
      chance: 0.5,
      responses: [{ steps: [{ delayMs: 1000, action: { type: 'emote', emoteId: 4 } }] }], // angry back
    },
    {
      emoteId: 25, // wave
      chance: 0.3,
      responses: [{ steps: [{ delayMs: 1200, action: { type: 'chat', message: '...' } }] }],
    },
  ],

  onPlayerRareItem: [
    { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'where did you get that. not fair.' } }] },
  ],

  npcExchanges: [
    {
      gate: { before: '2005-10-24' },
      cooldownMs: 180_000,
      chance: 0.1,
      steps: [
        { who: 'a', step: { delayMs: 0,    action: { type: 'chat', message: 'how long are we gonna be in beta testing' } } },
        { who: 'b', step: { delayMs: 2500, action: { type: 'chat', message: 'no idea lol' } } },
        { who: 'a', step: { delayMs: 2000, action: { type: 'chat', message: 'great. just great.' } } },
        { who: 'a', step: { delayMs: 1500, action: { type: 'emote', emoteId: 4  } } },
      ],
    },
    {
      cooldownMs: 180_000,
      chance: 0.1,
      steps: [
        { who: 'a', step: { delayMs: 0,    action: { type: 'chat', message: 'that puck is impossible to aim' } } },
        { who: 'b', step: { delayMs: 2000, action: { type: 'chat', message: 'just pretend that was a pass' } } },
        { who: 'a', step: { delayMs: 2000, action: { type: 'chat', message: 'best hockey game on the island' } } },
      ],
    },
    {
      gate: { after: '2005-09-13', before: '2005-09-21' },
      cooldownMs: 180_000,
      chance: 0.1,
      steps: [
        { who: 'a', step: { delayMs: 0,    action: { type: 'chat', message: 'did you try astro barrier' } } },
        { who: 'b', step: { delayMs: 2500, action: { type: 'chat', message: 'yeah. the music never stops.' } } },
        { who: 'a', step: { delayMs: 2000, action: { type: 'chat', message: 'great. another reason to hate the club.' } } },
        { who: 'a', step: { delayMs: 1500, action: { type: 'emote', emoteId: 4  } } },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// EXCITABLE
// ─────────────────────────────────────────────────────────────
const EXCITABLE: PersonalityDialogue = {
  onPlayerJoin: {
    'any': [
      {
        steps: [
          { delayMs: 500,  action: { type: 'frame', frame: 25 } },
          { delayMs: 900,  action: { type: 'chat',  message: 'HEY!! :D :D' } },
          { delayMs: 2500, action: { type: 'emote', emoteId: 1 } },
        ],
      },
      {
        steps: [
          { delayMs: 400,  action: { type: 'emote', emoteId: 9 } }, // exclamation
          { delayMs: 1000, action: { type: 'chat',  message: 'WOAH SOMEONE JOINED!!' } },
        ],
      },
    ],
  },

  onPlayerLeave: {
    'any': [
      { steps: [{ delayMs: 300, action: { type: 'chat',  message: 'NOOO COME BACK' } }] },
      { steps: [{ delayMs: 400, action: { type: 'emote', emoteId: 2 } }] }, // sad
    ],
  },

  onIdle: {
    'any': [
      {
        steps: [
          { delayMs: 0,    action: { type: 'frame', frame: 26 } },
          { delayMs: 5000, action: { type: 'frame', frame: 1  } },
        ],
      },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'THIS ISLAND IS SO COOL' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'I LOVE BEING A PENGUIN' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'ANYONE WANNA PLAY A GAME?!?!' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'IM SO ENERGETIC TODAY' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'I CANT STOP WADDLING AROUND' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'WHERE IS EVERYONE' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'WHEEEEEE' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'I DRANK TOO MUCH COFFEE' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'WADDLE WADDLE WADDLE' } }] },
      { steps: [{ delayMs: 0, action: { type: 'emote', emoteId: 9 } }] }, // exclamation
      {
        gate: { before: '2005-09-21' },
        steps: [
          { delayMs: 0,    action: { type: 'chat',  message: 'CLUB PENGUIN PARTY ON WEDNESDAY AHHH!!! :D :D :D' } },
          { delayMs: 2000, action: { type: 'frame', frame: 26 } },
          { delayMs: 5000, action: { type: 'frame', frame: 1  } },
        ],
      },
      {
        gate: { after: '2005-09-13', before: '2005-09-21' },
        steps: [
          { delayMs: 0,    action: { type: 'chat',  message: 'ASTRO BARRIER AND A PARTY IN EIGHT DAYS!!! THIS WEEK IS INSANE!!!' } },
          { delayMs: 2500, action: { type: 'frame', frame: 26 } },
          { delayMs: 5500, action: { type: 'frame', frame: 1  } },
        ],
      },
      {
        gate: { after: '2005-09-13' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'ASTRO BARRIER IS THE BEST THING THEY HAVE EVER ADDED' } }],
      },
      {
        gate: { before: '2005-10-24' },
        steps: [
          { delayMs: 0, action: { type: 'chat', message: 'BETA TEST IS SO FUN even with the bugs lol' } },
        ],
      },
      {
        gate: { before: '2005-10-24' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'I PLAYED PENGUIN CHAT 3 AND NOW WE GET THE BIG UPDATE!!!' } }],
      },
      {
        gate: { before: '2005-10-24' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'CLUB PENGUIN IS THE BEST NAME EVER FOR THE BIG UPDATE!!!' } }],
      },
    ],
    120: [
      {
        steps: [
          { delayMs: 0,    action: { type: 'frame', frame: 26 } },
          { delayMs: 1000, action: { type: 'chat',  message: 'THE MUSIC IS SO GOOD!!' } },
          { delayMs: 5000, action: { type: 'frame', frame: 1  } },
        ],
      },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'I COULD DANCE ALL DAY LETS GOOO' } }] },
    ],
    121: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'WHY ARE WE SITTING UP HERE!! LETS GO DANCE!!' } }] },
      {
        gate: { after: '2005-09-13' },
        steps: [
          { delayMs: 0,    action: { type: 'chat',  message: 'ASTRO BARRIER IS IN HERE NOW OMGG' } },
          { delayMs: 2000, action: { type: 'frame', frame: 26 } },
          { delayMs: 5000, action: { type: 'frame', frame: 1  } },
        ],
      },
      {
        gate: { after: '2005-09-13' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'HAVE YOU PLAYED ASTRO BARRIER YET??? ITS SO HARD BUT AMAZING' } }],
      },
      {
        gate: { after: '2005-09-13' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'NEW GAME AND PARTY IN EIGHT DAYS I LITERALLY CANNOT CONTAIN MYSELF' } }],
      },
    ],
    130: [
      { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 0, action: { type: 'chat', message: 'I WANT EVERYTHING IN THE CATALOG' } }] },
      { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 0, action: { type: 'chat', message: 'CLOTHES CLOTHES CLOTHES YES!!' } }] },
      { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 0, action: { type: 'chat', message: 'I WISH I COULD BUY THESE OUTFITS!!' } }] },
    ],
    800: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'BALLISTIC BISCUIT IS SO HARD BUT SO FUN' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'I WANNA GO SWIMMING!!' } }] },
    ],
    801: [
      {
        gate: { after: '2005-09-12', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'SNOW FORTS!!! BEST ROOM EVER!!!' } }],
      },
      {
        gate: { after: '2005-09-12', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'TOWN TO RINK TO FORTS TO RINK TO TOWN AHHH!!!' } }],
      },
      {
        gate: { after: '2005-09-12', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'ONLY NINE DAYS UNTIL THE PARTY LETS GOOOO' } }],
      },
    ],
    802: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'I AM PLAYING HOCKEY VERY SERIOUSLY AND BADLY' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'SLIDING ON THE ICE IS SO FUN WEEEE' } }] },
    ],
    110: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'BEAN COUNTERS LETS GO' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'I DRANK SO MUCH COFFEE AAAA' } }] },
    ],
    111: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'MANCALA TIIIIME' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'ITS TOO QUIET IN HERE LETS MAKE SOME NOISE' } }] },
    ],
    200: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'SNOW SNOW SNOW YAY' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'I WONDER WHAT THEY WILL BUILD HERE!!!' } }] },
    ],
    100: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'THE TOWN IS PACKED YAY!!' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'HI EVERYONE IN TOWN!!!' } }] },
    ],
    320: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'WOAH THE DOJO IS REAL!!!' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'ITS EMPTY BUT ITS STILL AWESOME!!!' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'NINJAS NINJAS NINJAS YES!!!' } }] },
    ],
    221: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'WOW A HIDDEN ATTIC THIS IS SO COOL' } }] },
    ],
  },

  onPlayerChat: [
    {
      keywords: ['hi', 'hello', 'hey'],
      cooldownMs: 15_000,
      responses: [
        { steps: [{ delayMs: 400, action: { type: 'chat', message: 'HI!!!! :D' } }] },
        { steps: [{ delayMs: 300, action: { type: 'emote', emoteId: 1 } }, { delayMs: 800, action: { type: 'chat', message: 'HEYYY!!' } }] },
        { steps: [{ delayMs: 400, action: { type: 'chat', message: 'OMG HI!!!' } }] },
        { steps: [{ delayMs: 500, action: { type: 'chat', message: 'HELLO THERE!!!' } }] },
      ],
    },
    {
      keywords: ['party'],
      cooldownMs: 30_000,
      responses: [
        {
          gate: { before: '2005-09-21' },
          steps: [
            { delayMs: 400,  action: { type: 'chat',  message: 'YES YES YES A PARTY!!!' } },
            { delayMs: 1500, action: { type: 'frame', frame: 26 } },
            { delayMs: 5000, action: { type: 'frame', frame: 1  } },
          ],
        },
        { steps: [{ delayMs: 400, action: { type: 'chat', message: 'YES LETS PARTY!!' } }] },
      ],
    },
    {
      keywords: ['dance', 'dancing'],
      cooldownMs: 20_000,
      responses: [
        {
          steps: [
            { delayMs: 300,  action: { type: 'frame', frame: 26 } },
            { delayMs: 4000, action: { type: 'frame', frame: 1  } },
          ],
        },
      ],
    },
    {
      keywords: ['cool', 'awesome', 'nice', 'great'],
      cooldownMs: 10_000,
      responses: [
        { steps: [{ delayMs: 300, action: { type: 'chat', message: 'IKRR!!' } }] },
        { steps: [{ delayMs: 400, action: { type: 'emote', emoteId: 10 } }] }, // thumbs up
      ],
    },
    {
      keywords: ['club penguin', 'big update', 'penguin chat', 'pc3'],
      cooldownMs: 30_000,
      responses: [
        {
          gate: { before: '2005-10-24' },
          steps: [{ delayMs: 300, action: { type: 'chat', message: 'YES!! I SIGNED UP BECAUSE OF PENGUIN CHAT 3!!!' } }],
        },
        {
          gate: { before: '2005-10-24' },
          steps: [{ delayMs: 400, action: { type: 'chat', message: 'THE BIG UPDATE BECOMING CLUB PENGUIN IS SO COOL!!!' } }],
        },
      ],
    },
    {
      keywords: ['bye', 'cya', 'gtg'],
      cooldownMs: 15_000,
      responses: [
        { steps: [{ delayMs: 300, action: { type: 'chat', message: 'NOOO BYEEE' } }] },
        { steps: [{ delayMs: 400, action: { type: 'chat', message: 'BYE BYE!!!' } }] },
        { steps: [{ delayMs: 300, action: { type: 'chat', message: 'DONT GO!!!' } }] },
        { steps: [{ delayMs: 500, action: { type: 'chat', message: 'CYA SOON!!!' } }] },
      ],
    },
    {
      keywords: ['lol', 'haha', 'lmao', 'rofl'],
      cooldownMs: 10_000,
      responses: [
        { steps: [{ delayMs: 300, action: { type: 'chat', message: 'HAHAHA' } }] },
        { steps: [{ delayMs: 400, action: { type: 'chat', message: 'LOL' } }] },
      ],
    },
    {
      keywords: ['dojo'],
      cooldownMs: 30_000,
      responses: [
        { condition: (npc, room) => room && room.id !== 320, steps: [{ delayMs: 500, action: { type: 'chat', message: 'THE DOJO IS SO SECRET I LOVE IT' } }] },
        { condition: (npc, room) => room && room.id !== 320, steps: [{ delayMs: 400, action: { type: 'chat', message: 'I WANT TO FIND THE SECRET DOJO!!!' } }] },
        { condition: (npc, room) => room && room.id === 320, steps: [{ delayMs: 300, action: { type: 'chat', message: 'WE FOUND THE DOJO!!! ITS SO EMPTY BUT STILL COOL' } }] },
      ],
    },
    {
      keywords: ['snow forts', 'snow fort', 'forts'],
      cooldownMs: 30_000,
      responses: [
        {
          gate: { before: '2005-09-12' },
          steps: [{ delayMs: 400, action: { type: 'chat', message: 'SNOW FORTS??? WHAT IS THAT??' } }],
        },
        {
          gate: { before: '2005-09-12' },
          steps: [{ delayMs: 500, action: { type: 'chat', message: 'WAIT WHAT I HAVENT SEEN SNOW FORTS ANYWHERE!!!' } }],
        },
        {
          gate: { after: '2005-09-12' },
          steps: [{ delayMs: 300, action: { type: 'chat', message: 'THE SNOW FORTS ARE AMAZING!!! ITS LIKE A HUGE SNOWBALL BATTLE ZONE!!!' } }],
        },
        {
          gate: { after: '2005-09-12' },
          steps: [{ delayMs: 300, action: { type: 'chat', message: 'YES!!! THE SNOW FORTS BY THE RINK!!! I LOVE IT THERE!!!' } }],
        },
      ],
    },
    {
      keywords: ['friend', 'buddy', 'add me'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 500, action: { type: 'chat', message: 'I WOULD LOVE TO BE FRIENDS BUT IT WONT LET ME' } }] },
      ],
    },
    {
      keywords: ['ballistic', 'biscuit', 'hydro', 'score'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 500, action: { type: 'chat', message: 'MY SCORE IN BALLISTIC BISCUIT IS AWESOME' } }] },
      ],
    },
    {
      keywords: ['bean', 'counter', 'bags', 'coffee'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 500, action: { type: 'chat', message: 'BEAN COUNTERS IS SO HARD BUT SO FUN' } }] },
      ],
    },
    {
      keywords: ['mancala', 'play'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 500, action: { type: 'chat', message: 'I CANT WAIT TO LEARN MANCALA' } }] },
      ],
    },
    {
      keywords: ['clothes', 'shirt', 'hat', 'buy', 'shop', 'member'],
      cooldownMs: 30_000,
      responses: [
        { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 500, action: { type: 'chat', message: 'I WANT EVERYTHING IN THE SHOP BUT NO MEMBERSHIP' } }] },
        { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 600, action: { type: 'chat', message: 'SO MANY COINS FROM MINIGAMES BUT NOTHING TO BUY' } }] },
        { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 500, action: { type: 'chat', message: 'I BOUGHT SO MANY CLOTHES TODAY' } }] },
        { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 600, action: { type: 'chat', message: 'I LOVE BEING A MEMBER' } }] },
      ],
    },
    {
      keywords: ['coin', 'coins', 'money', 'rich', 'broke'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 400, action: { type: 'chat', message: 'COINS!!! I LOVE COINS!!!' } }] },
        { steps: [{ delayMs: 500, action: { type: 'chat', message: 'I HAVE SO MANY COINS FROM MINIGAMES' } }] },
        { steps: [{ delayMs: 400, action: { type: 'chat', message: 'BEAN COUNTERS GIVES THE BEST COINS' } }] },
        { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 400, action: { type: 'chat', message: 'I HAVE SO MANY COINS AND NOTHING TO BUY' } }] },
      ],
    },
    {
      keywords: ['game', 'games', 'play', 'minigame', 'minigames', 'fun'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 300, action: { type: 'chat', message: 'YES LETS PLAY A GAME!!!' } }] },
        { steps: [{ delayMs: 400, action: { type: 'chat', message: 'BEAN COUNTERS RIGHT NOW LETS GO' } }] },
        { steps: [{ delayMs: 300, action: { type: 'chat', message: 'IM SO GOOD AT BALLISTIC BISCUIT' } }] },
        { steps: [{ delayMs: 400, action: { type: 'chat', message: 'THE GAMES ON THIS ISLAND ARE AMAZING' } }] },
        {
          gate: { after: '2005-09-13' },
          steps: [{ delayMs: 300, action: { type: 'chat', message: 'ASTRO BARRIER JUST LAUNCHED IN THE DANCE LOUNGE GO PLAY IT NOW!!!' } }],
        },
      ],
    },
    {
      keywords: ['astro', 'astro barrier', 'barrier'],
      cooldownMs: 30_000,
      responses: [
        {
          gate: { after: '2005-09-13' },
          steps: [
            { delayMs: 300,  action: { type: 'chat',  message: 'YES!!! ASTRO BARRIER!!! ITS SO GOOD!!!' } },
            { delayMs: 1500, action: { type: 'frame', frame: 26 } },
            { delayMs: 4500, action: { type: 'frame', frame: 1  } },
          ],
        },
        {
          gate: { after: '2005-09-13' },
          steps: [{ delayMs: 400, action: { type: 'chat', message: 'I PLAYED ASTRO BARRIER FOR LIKE AN HOUR STRAIGHT' } }],
        },
        {
          gate: { after: '2005-09-13' },
          steps: [{ delayMs: 300, action: { type: 'chat', message: 'GO TO THE DANCE LOUNGE ITS IN THERE UPSTAIRS!!! SO FUN!!!' } }],
        },
      ],
    },
    {
      keywords: ['crap', 'dang', 'damn', 'heck', 'shoot', 'crud'],
      cooldownMs: 20_000,
      responses: [
        { chance: 0.6, steps: [{ delayMs: 300, action: { type: 'chat', message: 'WOAH LANGUAGE' } }] },
        { chance: 0.5, steps: [{ delayMs: 400, action: { type: 'emote', emoteId: 3 } }] },
      ],
    },
    {
      keywords: ['cuss', 'curse', 'ass', 'idiot', 'stupid', 'dumb', 'jerk'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 300, action: { type: 'chat', message: 'HEY NOT COOL!!!' } }] },
        { steps: [{ delayMs: 400, action: { type: 'emote', emoteId: 2 } }, { delayMs: 1200, action: { type: 'chat', message: 'DONT SAY THAT!!!' } }] },
        { steps: [{ delayMs: 300, action: { type: 'chat', message: 'THATS MEAN!!!' } }] },
      ],
    },
    {
      keywords: ['freak', 'freaking', 'wtf', 'omfg', 'shut up', 'hate you', 'hate this'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 200, action: { type: 'chat', message: 'WHOA WHOA WHOA CALM DOWN!!!' } }] },
        { steps: [{ delayMs: 300, action: { type: 'emote', emoteId: 4 } }, { delayMs: 1000, action: { type: 'chat', message: 'THATS NOT OKAY!!!' } }] },
        { steps: [{ delayMs: 200, action: { type: 'chat', message: 'SOMEONE GET A MOD!!!' } }] },
      ],
    },
    {
      keywords: ['fuck', 'shit', 'dick', 'cock', 'retard', 'nigga', 'bitch', 'bastard', 'piss'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 300, action: { type: 'chat', message: 'WOAH THAT IS A VERY BAD WORD!!!' } }] },
        { steps: [{ delayMs: 400, action: { type: 'emote', emoteId: 2 } }, { delayMs: 1000, action: { type: 'chat', message: 'DONT SAY THAT!!!' } }] },
        { steps: [{ delayMs: 300, action: { type: 'chat', message: 'EXCUSE ME?? NOT COOL!!!' } }] },
      ],
    },
    {
      keywords: ['nigger', 'faggot', 'fag', 'troon', 'dyke', 'smd', 'kys', 'kms', 'go die', 'kill yourself'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 200, action: { type: 'chat', message: 'IM REPORTING YOU RIGHT NOW!!!' } }] },
        { steps: [{ delayMs: 300, action: { type: 'emote', emoteId: 4 } }, { delayMs: 800,  action: { type: 'chat', message: 'THAT IS ABSOLUTELY NOT OKAY!!!' } }] },
        { steps: [{ delayMs: 200, action: { type: 'chat', message: 'YOU SHOULD BE BANNED FOREVER!!!' } }] },
      ],
    },
  ],

  onPlayerSnowball: [
    {
      gate: { after: '2005-09-12', before: '2005-09-21' },
      condition: (_npc, room) => room && room.id === 801,
      chance: 0.95,
      steps: [
        { delayMs: 300, action: { type: 'chat', message: 'FORT FIGHT!!!' } },
        { delayMs: 500, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 900, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 1400, action: { type: 'snowball', target: 'random-player' } },
      ],
    },
    {
      gate: { after: '2005-09-12', before: '2005-09-21' },
      condition: (_npc, room) => room && room.id === 801,
      chance: 0.9,
      steps: [
        { delayMs: 300, action: { type: 'chat', message: 'NO MERCY FOR THE OTHER FORT!!!' } },
        { delayMs: 700, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 1100, action: { type: 'snowball', target: 'random-player' } },
        { delayMs: 1600, action: { type: 'snowball', target: 'random-player' } },
      ],
    },
    {
      gate: { after: '2005-09-12', before: '2005-09-21' },
      condition: (_npc, room) => room && room.id === 801,
      chance: 0.85,
      steps: [
        { delayMs: 400, action: { type: 'emote', emoteId: 9 } },
        { delayMs: 700, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 1100, action: { type: 'snowball', target: 'random-player' } },
        { delayMs: 1800, action: { type: 'chat', message: 'DEFEND THE FORT!!!' } },
      ],
    },
    { chance: 0.6, steps: [{ delayMs: 500, action: { type: 'chat', message: 'SNOWBALL FIGHT!!!' } }, { delayMs: 500, action: { type: 'snowball', target: 'origin' } }, { delayMs: 1000, action: { type: 'snowball', target: 'origin' } }] },
    { chance: 0.5, steps: [{ delayMs: 800, action: { type: 'snowball', target: 'origin' } }, { delayMs: 1000, action: { type: 'chat', message: 'TAKE THAT!!!' } }] },
    { chance: 0.4, steps: [{ delayMs: 1000, action: { type: 'emote', emoteId: 1 } }, { delayMs: 500, action: { type: 'snowball', target: 'random-player' } }] },
    { chance: 0.3, steps: [{ delayMs: 500, action: { type: 'chat', message: 'WOOO HOOOO' } }, { delayMs: 1000, action: { type: 'frame', frame: 26 } }, { delayMs: 4000, action: { type: 'frame', frame: 1 } }] },
  ],

  onPlayerEmote: [
    {
      emoteId: 26, // dance frame
      chance: 0.8,
      responses: [{ steps: [{ delayMs: 400, action: { type: 'frame', frame: 26 } }, { delayMs: 4000, action: { type: 'frame', frame: 1 } }] }],
    },
    {
      emoteId: 1, // smile
      chance: 0.7,
      responses: [{ steps: [{ delayMs: 400, action: { type: 'emote', emoteId: 9 } }] }], // exclamation
    },
  ],

  onPlayerRareItem: [
    { steps: [{ delayMs: 700, action: { type: 'chat', message: 'WOAH WHERE DID YOU GET THAT?!' } }] },
    { steps: [{ delayMs: 500, action: { type: 'emote', emoteId: 3 } }, { delayMs: 1500, action: { type: 'chat', message: 'OMG THAT ITEM!!' } }] },
  ],

  npcExchanges: [
    {
      gate: { before: '2005-09-21' },
      cooldownMs: 180_000,
      chance: 0.1,
      steps: [
        { who: 'a', step: { delayMs: 0,    action: { type: 'chat',  message: 'DUDE DID YOU HEAR ABOUT THE PARTY HAT' } } },
        { who: 'b', step: { delayMs: 2000, action: { type: 'chat',  message: 'yeah on wednesday right?' } } },
        { who: 'a', step: { delayMs: 1500, action: { type: 'chat',  message: 'IM SO EXCITED I HOPE ITS A GOOD HAT' } } },
        { who: 'a', step: { delayMs: 1000, action: { type: 'frame', frame: 26 } } },
        { who: 'a', step: { delayMs: 4000, action: { type: 'frame', frame: 1  } } },
      ],
    },
    {
      cooldownMs: 180_000,
      chance: 0.1,
      steps: [
        { who: 'a', step: { delayMs: 0,    action: { type: 'chat', message: 'THIS GAME IS SO GOOD' } } },
        { who: 'b', step: { delayMs: 2000, action: { type: 'chat', message: 'lol yeah its pretty fun' } } },
        { who: 'a', step: { delayMs: 1500, action: { type: 'chat', message: 'BEST GAME EVER' } } },
      ],
    },
    {
      gate: { after: '2005-09-13', before: '2005-09-21' },
      cooldownMs: 150_000,
      chance: 0.12,
      steps: [
        { who: 'a', step: { delayMs: 0,    action: { type: 'chat',  message: 'ASTRO BARRIER AND THE PARTY IN ONE WEEK AHHHH' } } },
        { who: 'b', step: { delayMs: 2000, action: { type: 'chat',  message: 'I KNOW RIGHT this week is actually insane' } } },
        { who: 'a', step: { delayMs: 1500, action: { type: 'chat',  message: 'I CANT STOP PLAYING ASTRO BARRIER' } } },
        { who: 'a', step: { delayMs: 1000, action: { type: 'frame', frame: 26 } } },
        { who: 'a', step: { delayMs: 4000, action: { type: 'frame', frame: 1  } } },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// CURIOUS
// ─────────────────────────────────────────────────────────────
const CURIOUS: PersonalityDialogue = {
  onPlayerJoin: {
    'any': [
      { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'oh hey, who are you?' } }] },
      { steps: [{ delayMs: 1200, action: { type: 'chat', message: 'new here?' } }] },
    ],
  },

  onPlayerLeave: {
    'any': [
      { chance: 0.4, steps: [{ delayMs: 600, action: { type: 'chat', message: 'where are you going?' } }] },
    ],
  },

  onIdle: {
    'any': [
      { steps: [{ delayMs: 0, action: { type: 'emote', emoteId: 8 } }] }, // question mark
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i wonder if they will add more rooms' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'how many people are playing the beta right now?' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'how long did it take to build this place?' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i wonder if the snow ever melts' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'is there anything outside the map?' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'do you think they\'ll add more games?' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'how many coins do you think exist on the island?' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'what happens if you stay on the island all night?' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'are we the first penguins here?' } }] },
      {
        gate: { before: '2005-10-24' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'do you think all the beta testers came from penguin chat 3?' } }],
      },
      {
        gate: { before: '2005-10-24' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'when did everyone stop calling club penguin the big update?' } }],
      },
      {
        gate: { before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'do you think the cp team will talk to us at the party?' } }],
      },
      {
        gate: { before: '2005-10-24' },
        steps: [
          { delayMs: 0,    action: { type: 'chat', message: 'why is the newspaper written in gibberish?' } },
          { delayMs: 3000, action: { type: 'chat', message: 'its latin i think? lorem ipsum' } },
          { delayMs: 2000, action: { type: 'emote', emoteId: 8 } },
        ],
      },
    ],
    111: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'do you think the mancala tables actually work??' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i wonder who built the book room' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'how many books are actually in these shelves?' } }] },
    ],
    320: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'what is this place even' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'is someone actually a ninja??' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i wonder why the dojo is completely empty' } }] },
    ],
    802: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'why does the puck move like that?' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i wonder if there is a way to aim it' } }] },
    ],
    200: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i heard they might add stuff to ski village' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'do you think we will be able to ski?' } }] },
    ],
    100: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'how many rooms are there now?' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i wonder how many penguins are in town today' } }] },
    ],
    130: [
      { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 0, action: { type: 'chat', message: 'i wonder when new items get added to the catalog' } }] },
      { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 0, action: { type: 'chat', message: 'i wonder if non-members will ever get items' } }] },
    ],
    110: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'how do they make the coffee here?' } }] },
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'what even is in bean counters?' } }] },
    ],
    120: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i wonder where the music is coming from' } }] },
    ],
    121: [
      {
        gate: { before: '2005-09-13' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'what is the point of the lounge if there are no games?' } }],
      },
      {
        gate: { after: '2005-09-13' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'how long do you think astro barrier has been here? did they just add it?' } }],
      },
      {
        gate: { after: '2005-09-13' },
        steps: [
          { delayMs: 0,    action: { type: 'chat', message: 'i wonder what level you can actually get to in astro barrier' } },
          { delayMs: 3000, action: { type: 'emote', emoteId: 8 } },
        ],
      },
      {
        gate: { after: '2005-09-13' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'how did they get astro barrier into the dance lounge? it just appeared' } }],
      },
    ],
    800: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'how deep do you think the water is?' } }] },
    ],
    801: [
      {
        gate: { after: '2005-09-12', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'why did they put the snow forts exactly here?' } }],
      },
      {
        gate: { after: '2005-09-12', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'do you think the snow forts changed how everyone walks around the island?' } }],
      },
      {
        gate: { after: '2005-09-12', before: '2005-09-21' },
        steps: [{ delayMs: 0, action: { type: 'chat', message: 'if the party is close do you think the forts get decorations too?' } }],
      },
    ],
    221: [
      { steps: [{ delayMs: 0, action: { type: 'chat', message: 'i wonder what this attic was used for' } }] },
    ],
  },

  onPlayerChat: [
    {
      keywords: ['hi', 'hello', 'hey'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'oh hi! where are you from?' } }] },
        { steps: [{ delayMs: 800,  action: { type: 'chat', message: 'hey! been here long?' } }] },
        { steps: [{ delayMs: 900,  action: { type: 'chat', message: 'hi there! what are you up to?' } }] },
        { steps: [{ delayMs: 1100, action: { type: 'chat', message: 'hello! are you exploring too?' } }] },
      ],
    },
    {
      keywords: ['bye', 'cya', 'see ya', 'gtg', 'brb'],
      cooldownMs: 15_000,
      responses: [
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'oh going so soon?' } }] },
        { steps: [{ delayMs: 1200, action: { type: 'chat', message: 'bye! where are you off to?' } }] },
        { steps: [{ delayMs: 800,  action: { type: 'chat', message: 'see you later!' } }] },
      ],
    },
    {
      keywords: ['party'],
      cooldownMs: 45_000,
      responses: [
        {
          gate: { before: '2005-09-21' },
          steps: [
            { delayMs: 800,  action: { type: 'chat', message: 'ooh what kind of party do you think it will be?' } },
          ],
        },
      ],
    },
    {
      keywords: ['newspaper', 'news'],
      cooldownMs: 60_000,
      responses: [
        {
          gate: { before: '2005-10-24' },
          steps: [{ delayMs: 1000, action: { type: 'chat', message: 'yeah its just empty pages right now.. wonder why' } }],
        },
      ],
    },
    {
      keywords: ['mancala', 'play'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 800, action: { type: 'chat', message: 'ooh do you know how to play mancala??' } }] },
      ],
    },
    {
      keywords: ['dojo'],
      cooldownMs: 45_000,
      responses: [
        { condition: (npc, room) => room && room.id !== 320, steps: [{ delayMs: 1500, action: { type: 'chat', message: 'what is the dojo? is it really just an empty room?' } }] },
        { condition: (npc, room) => room && room.id !== 320, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'i heard there\'s a hidden room somewhere on the map' } }] },
        { condition: (npc, room) => room && room.id === 320, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'well.. found the dojo. just a big empty room.' } }] },
        { condition: (npc, room) => room && room.id === 320, steps: [{ delayMs: 1500, action: { type: 'chat', message: 'i wonder why the dojo is just completely empty?' } }] },
      ],
    },
    {
      keywords: ['snow forts', 'snow fort', 'forts'],
      cooldownMs: 45_000,
      responses: [
        {
          gate: { before: '2005-09-12' },
          steps: [{ delayMs: 1200, action: { type: 'chat', message: 'snow forts? hmm.. i havent seen those on the island yet' } }],
        },
        {
          gate: { before: '2005-09-12' },
          steps: [{ delayMs: 1500, action: { type: 'chat', message: 'what are the snow forts supposed to be? a new room?' } }],
        },
        {
          gate: { after: '2005-09-12' },
          steps: [{ delayMs: 1200, action: { type: 'chat', message: 'oh the snow forts! they changed that whole area near the rink' } }],
        },
        {
          gate: { after: '2005-09-12' },
          steps: [{ delayMs: 1500, action: { type: 'chat', message: 'i think the snow forts made the island feel a lot more active' } }],
        },
      ],
    },
    {
      keywords: ['friend', 'buddy', 'add me'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'i tried adding friends but my list doesnt work!' } }] },
      ],
    },
    {
      keywords: ['ballistic', 'biscuit', 'hydro', 'score'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'whats the highest score on ballistic biscuit?' } }] },
      ],
    },
    {
      keywords: ['bean', 'counter', 'bags', 'coffee'],
      cooldownMs: 45_000,
      responses: [
        { steps: [{ delayMs: 1500, action: { type: 'chat', message: 'how many coffee bags have you caught so far?' } }] },
      ],
    },
    {
      keywords: ['room', 'place', 'where'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 900, action: { type: 'chat', message: 'yeah i keep exploring to find new places' } }] },
      ],
    },
    {
      keywords: ['item', 'catalog', 'catalogue', 'clothes', 'wear', 'shirt', 'hat', 'buy', 'shop', 'member'],
      cooldownMs: 30_000,
      responses: [
        { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'will non-members ever get to buy clothes?' } }] },
        { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 900,  action: { type: 'chat', message: 'i wonder when they add new items' } }] },
        { condition: npc => npc.membership.isMember,  steps: [{ delayMs: 1200, action: { type: 'chat', message: 'how many items are there in the catalog right now?' } }] },
      ],
    },
    {
      keywords: ['coin', 'coins', 'money', 'rich', 'broke'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 900,  action: { type: 'chat', message: 'how much can you actually earn in bean counters?' } }] },
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'i wonder what the richest penguin has' } }] },
        { condition: npc => !npc.membership.isMember, steps: [{ delayMs: 900, action: { type: 'chat', message: 'i wonder if coins will be more useful one day' } }] },
      ],
    },
    {
      keywords: ['game', 'games', 'play', 'minigame', 'minigames', 'fun'],
      cooldownMs: 30_000,
      responses: [
        { steps: [{ delayMs: 900,  action: { type: 'chat', message: 'do you think they\'ll add more games?' } }] },
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'i wonder how ballistic biscuit was invented' } }] },
        { steps: [{ delayMs: 900,  action: { type: 'chat', message: 'what\'s your high score on bean counters?' } }] },
        {
          gate: { after: '2005-09-13' },
          steps: [{ delayMs: 900, action: { type: 'chat', message: 'have you tried astro barrier yet? it just appeared in the dance lounge' } }],
        },
        {
          gate: { after: '2005-09-13' },
          steps: [{ delayMs: 1000, action: { type: 'chat', message: 'i wonder how many levels astro barrier actually has' } }],
        },
      ],
    },
    {
      keywords: ['astro', 'astro barrier', 'barrier'],
      cooldownMs: 45_000,
      responses: [
        {
          gate: { after: '2005-09-13' },
          steps: [
            { delayMs: 900,  action: { type: 'chat', message: 'oh yeah astro barrier just appeared in the dance lounge' } },
            { delayMs: 3000, action: { type: 'chat', message: 'i wonder when they actually finished making it' } },
          ],
        },
        {
          gate: { after: '2005-09-13' },
          steps: [{ delayMs: 800, action: { type: 'chat', message: 'i wonder if astro barrier has a secret ending' } }],
        },
        {
          gate: { after: '2005-09-13' },
          steps: [{ delayMs: 1000, action: { type: 'chat', message: 'how are the graphics in astro barrier even done?' } }],
        },
      ],
    },
    {
      keywords: ['crap', 'dang', 'damn', 'heck', 'shoot', 'crud'],
      cooldownMs: 20_000,
      responses: [
        { chance: 0.5, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'oh..' } }] },
        { chance: 0.4, steps: [{ delayMs: 1200, action: { type: 'emote', emoteId: 8 } }] },
      ],
    },
    {
      keywords: ['cuss', 'curse', 'ass', 'idiot', 'stupid', 'dumb', 'jerk'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'wow why so mean?' } }] },
        { steps: [{ delayMs: 1200, action: { type: 'emote', emoteId: 2 } }] },
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'is that really necessary?' } }] },
      ],
    },
    {
      keywords: ['freak', 'freaking', 'wtf', 'omfg', 'shut up', 'hate you', 'hate this'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 800,  action: { type: 'chat', message: 'whoa.. you okay?' } }] },
        { steps: [{ delayMs: 1000, action: { type: 'emote', emoteId: 2 } }, { delayMs: 2000, action: { type: 'chat', message: 'that\'s a bit much..' } }] },
        { steps: [{ delayMs: 800,  action: { type: 'chat', message: 'i have many questions about why you\'re so upset' } }] },
      ],
    },
    {
      keywords: ['fuck', 'shit', 'dick', 'cock', 'retard', 'nigga', 'bitch', 'bastard', 'piss'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'why would you even say that?' } }] },
        { steps: [{ delayMs: 1200, action: { type: 'emote', emoteId: 2 } }, { delayMs: 2200, action: { type: 'chat', message: 'is that really necessary?' } }] },
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'that\'s kind of a bad word you know?' } }] },
      ],
    },
    {
      keywords: ['nigger', 'faggot', 'fag', 'troon', 'dyke', 'smd', 'kys', 'kms', 'go die', 'kill yourself'],
      cooldownMs: 20_000,
      responses: [
        { steps: [{ delayMs: 800,  action: { type: 'emote', emoteId: 2 } }, { delayMs: 1800, action: { type: 'chat', message: 'i\'m reporting you. that is not okay.' } }] },
        { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'why would anyone say something like that?' } }] },
        { steps: [{ delayMs: 800,  action: { type: 'chat', message: 'that\'s disgusting. reported.' } }] },
      ],
    },
  ],

  onPlayerSnowball: [
    {
      gate: { after: '2005-09-12', before: '2005-09-21' },
      condition: (_npc, room) => room && room.id === 801,
      chance: 0.85,
      steps: [
        { delayMs: 600, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 1200, action: { type: 'snowball', target: 'random-npc' } },
        { delayMs: 2000, action: { type: 'chat', message: 'interesting. the forts really do make this room chaotic.' } },
      ],
    },
    {
      gate: { after: '2005-09-12', before: '2005-09-21' },
      condition: (_npc, room) => room && room.id === 801,
      chance: 0.8,
      steps: [
        { delayMs: 500, action: { type: 'chat', message: 'counterattack from the wall.' } },
        { delayMs: 1100, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 1700, action: { type: 'snowball', target: 'random-player' } },
      ],
    },
    {
      gate: { after: '2005-09-12', before: '2005-09-21' },
      condition: (_npc, room) => room && room.id === 801,
      chance: 0.75,
      steps: [
        { delayMs: 700, action: { type: 'chat', message: 'i wonder if the walls help aim' } },
        { delayMs: 1300, action: { type: 'snowball', target: 'origin' } },
        { delayMs: 2100, action: { type: 'snowball', target: 'random-player' } },
      ],
    },
    { chance: 0.6, steps: [{ delayMs: 1000, action: { type: 'chat', message: 'how did you make that?' } }] },
    { chance: 0.5, steps: [{ delayMs: 1500, action: { type: 'snowball', target: 'origin' } }, { delayMs: 1500, action: { type: 'chat', message: 'fascinating physics' } }] },
    { chance: 0.4, steps: [{ delayMs: 1000, action: { type: 'emote', emoteId: 8 } }, { delayMs: 2000, action: { type: 'chat', message: 'why did you throw that at me?' } }] },
    { chance: 0.3, steps: [{ delayMs: 500, action: { type: 'snowball', target: 'random-npc' } }, { delayMs: 1500, action: { type: 'chat', message: 'testing if i can hit someone else..' } }] },
  ],

  onPlayerEmote: [
    {
      emoteId: 8, // question mark
      chance: 0.6,
      responses: [{ steps: [{ delayMs: 900, action: { type: 'emote', emoteId: 8 } }] }],
    },
    {
      emoteId: 3, // surprise
      chance: 0.5,
      responses: [{ steps: [{ delayMs: 700, action: { type: 'chat', message: 'what happened??' } }] }],
    },
  ],

  onPlayerRareItem: [
    { steps: [{ delayMs: 1200, action: { type: 'chat', message: 'wait where did you get that item from??' } }] },
    { steps: [{ delayMs: 1000, action: { type: 'chat', message: 'how do you have that? is it obtainable?' } }] },
    { steps: [{ delayMs: 900,  action: { type: 'emote', emoteId: 8 } }, { delayMs: 2000, action: { type: 'chat', message: 'what IS that' } }] },
  ],

  npcExchanges: [
    {
      cooldownMs: 180_000,
      chance: 0.1,
      steps: [
        { who: 'a', step: { delayMs: 0,    action: { type: 'chat', message: 'do you think the puck listens to us?' } } },
        { who: 'b', step: { delayMs: 2500, action: { type: 'chat', message: 'no, and that is why it is winning' } } },
        { who: 'a', step: { delayMs: 2000, action: { type: 'chat', message: 'then i am larping as the referee' } } },
      ],
    },
    {
      gate: { before: '2005-09-21' },
      cooldownMs: 180_000,
      chance: 0.1,
      steps: [
        { who: 'a', step: { delayMs: 0,    action: { type: 'chat', message: 'what do you think the party will look like?' } } },
        { who: 'b', step: { delayMs: 2500, action: { type: 'chat', message: 'no idea honestly' } } },
        { who: 'a', step: { delayMs: 2000, action: { type: 'chat', message: 'hopefully they decorate the whole island :o' } } },
      ],
    },
    {
      gate: { before: '2005-10-24' },
      cooldownMs: 180_000,
      chance: 0.1,
      steps: [
        { who: 'a', step: { delayMs: 0,    action: { type: 'chat', message: 'were all the beta testers from penguin chat 3?' } } },
        { who: 'b', step: { delayMs: 2500, action: { type: 'chat', message: 'i think so. thats how i heard about the big update' } } },
        { who: 'a', step: { delayMs: 2000, action: { type: 'chat', message: 'club penguin is definitely easier to say though' } } },
      ],
    },
    {
      gate: { after: '2005-09-13', before: '2005-09-21' },
      cooldownMs: 180_000,
      chance: 0.12,
      steps: [
        { who: 'a', step: { delayMs: 0,    action: { type: 'chat', message: 'did you see that astro barrier just appeared in the dance lounge?' } } },
        { who: 'b', step: { delayMs: 2500, action: { type: 'chat', message: 'yeah! i tried it. it just starts and keeps going' } } },
        { who: 'a', step: { delayMs: 2000, action: { type: 'chat', message: 'i wonder if anyone actually knows how many levels there are' } } },
        { who: 'a', step: { delayMs: 1500, action: { type: 'emote', emoteId: 8 } } },
      ],
    },
  ],
};

const BETA_TEST_PARTY_GATE = { after: '2005-09-21', before: '2005-09-22' } as const;

FRIENDLY.onIdle.any?.push(
  { gate: BETA_TEST_PARTY_GATE, steps: [{ delayMs: 0, action: { type: 'chat', message: 'beta test party day!! there are penguins everywhere :)' } }] },
  { gate: BETA_TEST_PARTY_GATE, steps: [{ delayMs: 0, action: { type: 'chat', message: 'almost everyone has a party hat on and it looks so cute' } }] },
);
FRIENDLY.onPlayerChat.unshift({
  keywords: ['party hat', 'hat box', 'hat boxes', 'get a party hat', 'get the party hat'],
  cooldownMs: 20_000,
  responses: [
    { gate: BETA_TEST_PARTY_GATE, steps: [{ delayMs: 700, action: { type: 'chat', message: 'walk to one of the hat boxes in town!! they have the party hats :)' } }] },
  ],
});
FRIENDLY.npcExchanges.push({
  gate: BETA_TEST_PARTY_GATE,
  cooldownMs: 180_000,
  chance: 0.16,
  condition: (_npc, other) => other.isDev,
  steps: [
    { who: 'a', step: { delayMs: 0, action: { type: 'chat', message: 'wait are you one of the penguins making the game?' } } },
    { who: 'b', step: { delayMs: 2000, action: { type: 'chat', message: 'yeah! we are still building it, thanks for testing with us' } } },
    { who: 'a', step: { delayMs: 2500, action: { type: 'chat', message: 'that is so cool. thanks for letting us be here :)' } } },
  ],
});

SHY.onIdle.any?.push(
  { gate: BETA_TEST_PARTY_GATE, steps: [{ delayMs: 0, action: { type: 'chat', message: 'there are so many penguins here today..' } }] },
  { gate: BETA_TEST_PARTY_GATE, steps: [{ delayMs: 0, action: { type: 'chat', message: 'i got my party hat from the town box.. i think there are a few of them' } }] },
);
SHY.onPlayerChat.unshift({
  keywords: ['party hat', 'hat box', 'hat boxes', 'get a party hat', 'get the party hat'],
  cooldownMs: 20_000,
  responses: [
    { gate: BETA_TEST_PARTY_GATE, steps: [{ delayMs: 1200, action: { type: 'chat', message: 'um.. try walking to one of the hat boxes in town' } }] },
  ],
});
SHY.npcExchanges.push({
  gate: BETA_TEST_PARTY_GATE,
  cooldownMs: 180_000,
  chance: 0.14,
  condition: (_npc, other) => other.isDev,
  steps: [
    { who: 'a', step: { delayMs: 0, action: { type: 'chat', message: 'um.. are you really from the team?' } } },
    { who: 'b', step: { delayMs: 2200, action: { type: 'chat', message: 'yeah, still fixing bugs and adding things while beta is live' } } },
    { who: 'a', step: { delayMs: 2600, action: { type: 'chat', message: 'oh.. okay. thanks for making it' } } },
  ],
});

GRUMPY.onIdle.any?.push(
  { gate: BETA_TEST_PARTY_GATE, steps: [{ delayMs: 0, action: { type: 'chat', message: 'whole island is packed. just what i needed.' } }] },
  { gate: BETA_TEST_PARTY_GATE, steps: [{ delayMs: 0, action: { type: 'chat', message: 'everybody has the same party hat on. very original.' } }] },
);
GRUMPY.onPlayerChat.unshift({
  keywords: ['party hat', 'hat box', 'hat boxes', 'get a party hat', 'get the party hat'],
  cooldownMs: 20_000,
  responses: [
    { gate: BETA_TEST_PARTY_GATE, steps: [{ delayMs: 900, action: { type: 'chat', message: 'town. one of the hat boxes. hard to miss.' } }] },
  ],
});
GRUMPY.npcExchanges.push({
  gate: BETA_TEST_PARTY_GATE,
  cooldownMs: 180_000,
  chance: 0.15,
  condition: (_npc, other) => other.isDev,
  steps: [
    { who: 'a', step: { delayMs: 0, action: { type: 'chat', message: 'so when are you fixing the bugs and finishing the newspaper' } } },
    { who: 'b', step: { delayMs: 2200, action: { type: 'chat', message: 'hopefully soon. beta is exactly when we catch stuff like that' } } },
    { who: 'a', step: { delayMs: 2600, action: { type: 'chat', message: 'good. because the lorem ipsum is getting old.' } } },
  ],
});

EXCITABLE.onIdle.any?.push(
  { gate: BETA_TEST_PARTY_GATE, steps: [{ delayMs: 0, action: { type: 'chat', message: 'THE BETA TEST PARTY IS LIVE!!! LOOK AT ALL THESE PENGUINS!!!' } }] },
  { gate: BETA_TEST_PARTY_GATE, steps: [{ delayMs: 0, action: { type: 'chat', message: 'EVERYONE HAS PARTY HATS AHHHH THIS IS SO COOL' } }] },
);
EXCITABLE.onPlayerChat.unshift({
  keywords: ['party hat', 'hat box', 'hat boxes', 'get a party hat', 'get the party hat'],
  cooldownMs: 20_000,
  responses: [
    { gate: BETA_TEST_PARTY_GATE, steps: [{ delayMs: 300, action: { type: 'chat', message: 'GO TO TOWN!! THE HAT BOXES HAVE THE PARTY HATS!!!' } }] },
  ],
});
EXCITABLE.npcExchanges.push({
  gate: BETA_TEST_PARTY_GATE,
  cooldownMs: 150_000,
  chance: 0.18,
  condition: (_npc, other) => other.isDev,
  steps: [
    { who: 'a', step: { delayMs: 0, action: { type: 'chat', message: 'WAIT ARE YOU REALLY ONE OF THE DEVS?!' } } },
    { who: 'b', step: { delayMs: 1800, action: { type: 'chat', message: 'yeah!! thanks for showing up to the beta test party' } } },
    { who: 'a', step: { delayMs: 2200, action: { type: 'chat', message: 'THIS GAME RULES PLEASE KEEP MAKING MORE STUFF!!!' } } },
  ],
});

CURIOUS.onIdle.any?.push(
  { gate: BETA_TEST_PARTY_GATE, steps: [{ delayMs: 0, action: { type: 'chat', message: 'i wonder how they got this many penguins online at once' } }] },
  { gate: BETA_TEST_PARTY_GATE, steps: [{ delayMs: 0, action: { type: 'chat', message: 'do the hat boxes in town refill themselves somehow?' } }] },
);
CURIOUS.onPlayerChat.unshift({
  keywords: ['party hat', 'hat box', 'hat boxes', 'get a party hat', 'get the party hat'],
  cooldownMs: 20_000,
  responses: [
    { gate: BETA_TEST_PARTY_GATE, steps: [{ delayMs: 800, action: { type: 'chat', message: 'pretty sure you just walk to one of the hat boxes in town and pick one up' } }] },
  ],
});
CURIOUS.npcExchanges.push({
  gate: BETA_TEST_PARTY_GATE,
  cooldownMs: 180_000,
  chance: 0.16,
  condition: (_npc, other) => other.isDev,
  steps: [
    { who: 'a', step: { delayMs: 0, action: { type: 'chat', message: 'how do you even build a whole island like this?' } } },
    { who: 'b', step: { delayMs: 2200, action: { type: 'chat', message: 'one room and one bug fix at a time, mostly' } } },
    { who: 'a', step: { delayMs: 2600, action: { type: 'chat', message: 'huh. i have about fifty more questions' } } },
  ],
});

// ─────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────

export const PERSONALITY_DIALOGUE: Record<PersonalityTrait, PersonalityDialogue> = {
  friendly:  FRIENDLY,
  shy:       SHY,
  grumpy:    GRUMPY,
  excitable: EXCITABLE,
  curious:   CURIOUS,
};
