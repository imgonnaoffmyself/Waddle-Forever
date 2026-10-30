// ============================================================
// Ambient Dialogue & Multi-Bot Dialogue Chains (Non-Club Penguin)
// Partitioned by Age Groups & Personality Groups
// All lines strictly <= 48 characters (client limit)
// ============================================================

import { choose, randomInt } from '@common/utils';
import { isLower } from '@server/routes/versions';
import { PersonalityTrait } from './npc-types';

export type BotAgeGroup = '8 and under' | '9 to 12' | '13 to 17' | '18 and over';
export const BOT_AGE_GROUPS: BotAgeGroup[] = ['8 and under', '9 to 12', '13 to 17', '18 and over'];

export function sampleRandomAgeGroup(isDev?: boolean, isModerator?: boolean): BotAgeGroup {
  if (isDev || isModerator) return '18 and over';
  const r = Math.random();
  if (r < 0.15) return '8 and under';
  if (r < 0.60) return '9 to 12';
  if (r < 0.88) return '13 to 17';
  return '18 and over';
}

export interface DialogueChainStep {
  who: 'a' | 'b';
  text?: string;
  delayMs?: number;
  emoteId?: number;
  frame?: number;
}

export interface DialogueChain {
  id: string;
  topic: string;
  ageGroup?: BotAgeGroup | 'any';
  preferredTraitsA?: PersonalityTrait[];
  preferredTraitsB?: PersonalityTrait[];
  gate?: { before?: string; after?: string };
  steps: DialogueChainStep[];
}

export interface AmbientChatTrigger {
  keywords: string[];
  cooldownMs?: number;
  primaryResponses: Record<BotAgeGroup, string[]> | string[];
  followUpResponses?: string[];
}

// ─────────────────────────────────────────────────────────────
// Solo Ambient Lines: Partitioned by Age Group & Personality
// ─────────────────────────────────────────────────────────────

export const AMBIENT_SOLO_BY_AGE_AND_TRAIT: Record<BotAgeGroup, Record<PersonalityTrait, string[]>> = {
  // ── 8 and under ──────────────────────────────────────────
  '8 and under': {
    friendly: [
      'i drew a rainbow today! :)',
      'my puppy gave me kisses earlier!',
      'i like sharing crayons in art class',
      'chocolate milk is so yummy!',
      'my teacher gave me a gold star sticker :D',
      'recess is the best time ever!!'
    ],
    shy: [
      'my teddy bear is watching me play...',
      'i have to go to sleep at 8:00...',
      'i like quiet coloring time...',
      'sometimes the school hallway is loud...',
      'holding my mom\'s hand walking to school...',
      'playing with stuffed animals in my room...'
    ],
    grumpy: [
      'my mom made me eat broccoli ugh',
      'i don\'t wanna take a nap!',
      'my brother won\'t share his toys with me',
      'bedtime is so unfair',
      'i scraped my knee on the playground ouch',
      'i don\'t wanna wear my winter coat!!'
    ],
    excitable: [
      'LOOK AT MY NEW TOY CAR VROOM VROOM!!',
      'I ATE TWO CUPCAKES TODAY WOOOO!!',
      'I CAN JUMP SO HIGH WATCH ME!!',
      'MY BIRTHDAY IS COMING UP YAY!!',
      'WE PLAYED DUCK DUCK GOOSE TODAY!!',
      'CARTOON TIME ON TV RIGHT NOW!!'
    ],
    curious: [
      'why is the sky blue?',
      'how do birds fly so high in the air?',
      'do fish ever sleep in the water?',
      'where do clouds go after it rains?',
      'how big is a real dinosaur vs a house?',
      'why do dogs have tails that wag?'
    ]
  },

  // ── 9 to 12 ──────────────────────────────────────────────
  '9 to 12': {
    friendly: [
      'finished my homework, time to relax :)',
      'wanna trade pokemon on game boy later?',
      'cafeteria pizza was actually good today',
      'sunny day to ride bikes around the block!',
      'cinnamon toast crunch is top tier cereal',
      'eating hot pizza rolls from the microwave :D'
    ],
    shy: [
      'i have a book report tomorrow, so nervous...',
      'reading in the library during lunch...',
      'hope the teacher doesn\'t call on me today...',
      'reading books under my blanket with a torch...',
      'i like playing games in my quiet room...',
      'my cat is purring next to me while i work...'
    ],
    grumpy: [
      'fractions homework is literally impossible',
      'my brother keeps bugging me for the pc ugh',
      'cafeteria mystery meat is gross again',
      'teacher gave us so much weekend reading ugh',
      'my mouse ball was stuck and i lost my game',
      'why do we have to learn long division anyway'
    ],
    excitable: [
      'JUST BEAT THE HARDEST LEVEL IN MARIO WOO!!',
      'NO SCHOOL ON MONDAY YESSSSSS!!',
      'SPONGEBOB MARATHON ALL WEEKEND BABY!!',
      'PRACTICING TRAMPOLINE FLIPS ALL DAY!!',
      'JUST SCORED A GOAL IN SOCCER TODAY!!',
      'KICKFLIP PRACTICE WITH FRIENDS LETS GO!!'
    ],
    curious: [
      'what superpower would you choose if you could?',
      'how do microwaves actually heat up snacks?',
      'what is your favorite starter pokemon ever?',
      'wonder what space looks like up close',
      'why do cats purr when you pet them?',
      'how do they put prizes in cereal boxes?'
    ]
  },

  // ── 13 to 17 ─────────────────────────────────────────────
  '13 to 17': {
    friendly: [
      'making a new ipod playlist right now :D',
      'history essay done, such a big relief :)',
      'anyone have good pop-punk band recs?',
      'heading to the mall food court this weekend',
      'skating with the crew after high school',
      'hot cocoa and late night gaming is the best'
    ],
    shy: [
      'headphones on so nobody talks to me...',
      'studying late in my room with desk lamp on...',
      'social battery at zero percent today...',
      'prefer chatting online over talking in person...',
      'quiet late nights listening to emo bands...',
      'doodling in the margins of my notebook...'
    ],
    grumpy: [
      'why schedule tests on monday mornings?!',
      'my pc fan sounds like a jet taking off lol',
      'waking up at 6am should be illegal honestly',
      'working my weekend grocery shift tomorrow ugh',
      'internet dropped mid-download, pain is real',
      'group projects where i do all the work suck'
    ],
    excitable: [
      'GOT MY DRIVER PERMIT TODAY LETS GOOO!!',
      'CONCERT TICKETS SECURED HYPED AS HECK!!',
      'STAYING UP ALL NIGHT CALLING MY BESTIES!!',
      'NEW ALBUM DROPPED AND IT IS PURE FIRE!!',
      'FRIDAY NIGHT FOOTBALL GAME WAS SO HYPE!!',
      'ROAD TRIP WITH MY FRIENDS THIS SUMMER WOO!!'
    ],
    curious: [
      'wonder what college will be like soon',
      'reading about black holes, mind is blown',
      'what career path are you guys aiming for?',
      'high school feels like a simulation lol',
      'how did people survive before the web?',
      'analyzing movie twists at 1 AM instead of sleep'
    ]
  },

  // ── 18 and over ──────────────────────────────────────────
  '18 and over': {
    friendly: [
      'taking a quick break between college classes :)',
      'buddy sent me a link to this over AIM lol',
      'coffee is keeping me functional today haha',
      'hope everyone has a great week! :)',
      'shooting the shit with the homies online',
      'making a late night run to taco bell later'
    ],
    shy: [
      'hiding in my dorm dodging campus noise...',
      'too tired to party, chilling online tonight...',
      'retail shift was exhausting today...',
      'quiet evenings after work are pure bliss...',
      'just listening to my ipod and relaxing...',
      'introvert recharge evening in progress...'
    ],
    grumpy: [
      'roommate left a pile of dirty dishes again',
      'campus wifi is crawling at dialup speeds today',
      'prof assigned a 15-page paper over break ugh',
      'morning commute traffic was a complete mess',
      'broke my last good headphones this morning',
      'gas prices went up again this week, so lame'
    ],
    excitable: [
      'SUBMITTED MY PAPER FREEDOM AT LAST!!',
      'ROAD TRIP WITH THE CREW THIS WEEKEND LETS GO!!',
      'WEEKEND OFF WITH NO SHIFTS LETS GOOO!!',
      'COFFEE KICKED IN AND I FEEL UNSTOPPABLE!!',
      'BURNING THE COOLEST MIX CD RIGHT NOW!!',
      'MIDTERMS ARE OVER WOOOO WE ARE FREE!!'
    ],
    curious: [
      'what major are you taking in college?',
      'anyone here into web design or coding?',
      'what music cds have you bought lately?',
      'anyone stay up late on aim or msn messenger?',
      'flash games are getting pretty impressive',
      'studying in the campus computer lab tonight'
    ]
  }
};

export function getAmbientSoloLine(ageGroup: BotAgeGroup, personalityTrait: PersonalityTrait): string {
  const byAge = AMBIENT_SOLO_BY_AGE_AND_TRAIT[ageGroup];
  const traitLines = byAge ? byAge[personalityTrait] : undefined;
  if (traitLines && traitLines.length > 0) {
    const line = choose(traitLines);
    return line.length <= 48 ? line : line.slice(0, 48);
  }
  if (byAge) {
    const allForAge = Object.values(byAge).flat();
    if (allForAge.length > 0) {
      const line = choose(allForAge);
      return line.length <= 48 ? line : line.slice(0, 48);
    }
  }
  return 'waddling around and having fun :)';
}

export function getAllEligibleSoloLinesForAge(ageGroup: BotAgeGroup): string[] {
  const byAge = AMBIENT_SOLO_BY_AGE_AND_TRAIT[ageGroup];
  if (!byAge) return ['hi', 'hello!'];
  return Object.values(byAge).flat().map(l => l.length <= 48 ? l : l.slice(0, 48));
}

// ─────────────────────────────────────────────────────────────
// Multi-Bot Dialogue Chains: Partitioned by Age Groups
// All steps strictly <= 48 characters
// ─────────────────────────────────────────────────────────────

export const AMBIENT_DIALOGUE_CHAINS: DialogueChain[] = [
  // ── 8 and under ──────────────────────────────────────────
  {
    id: 'under8-playground-tag',
    topic: 'playground',
    ageGroup: '8 and under',
    preferredTraitsA: ['friendly', 'excitable'],
    preferredTraitsB: ['friendly', 'excitable'],
    steps: [
      { who: 'a', text: 'do you wanna play tag at recess?', delayMs: 0 },
      { who: 'b', text: "yes!! you're it!", frame: 25, delayMs: 2200 },
      { who: 'a', text: "no you're it! you can't catch me haha", delayMs: 2500 },
      { who: 'b', text: 'i am running so fast vroom!!', delayMs: 2300 }
    ]
  },
  {
    id: 'under8-favorite-animal',
    topic: 'animals',
    ageGroup: '8 and under',
    preferredTraitsA: ['curious', 'friendly'],
    preferredTraitsB: ['friendly', 'shy'],
    steps: [
      { who: 'a', text: 'what is your favorite animal in the world?', delayMs: 0 },
      { who: 'b', text: 'bunnies! they have fluffy tails and hop fast', delayMs: 2500 },
      { who: 'a', text: 'i love puppies most! they give kisses :D', delayMs: 2700 },
      { who: 'b', text: 'puppies are so cute too :3', emoteId: 1, delayMs: 2200 }
    ]
  },
  {
    id: 'under8-juice-box',
    topic: 'food',
    ageGroup: '8 and under',
    preferredTraitsA: ['excitable', 'friendly'],
    preferredTraitsB: ['friendly', 'curious'],
    steps: [
      { who: 'a', text: 'i drank my whole juice box in one big slurp!', delayMs: 0 },
      { who: 'b', text: 'did it make the loud straw sound?', delayMs: 2600 },
      { who: 'a', text: 'YES! SLURRRRP haha my mom laughed!', delayMs: 2600 },
      { who: 'b', text: 'juice box cheers! :D', emoteId: 9, delayMs: 2100 }
    ]
  },
  {
    id: 'under8-bedtime-nightlight',
    topic: 'bedtime',
    ageGroup: '8 and under',
    preferredTraitsA: ['shy', 'friendly'],
    preferredTraitsB: ['shy', 'friendly'],
    steps: [
      { who: 'a', text: 'do you have a night light in your room...?', delayMs: 0 },
      { who: 'b', text: 'yeah, mine is shaped like a glowing star :)', delayMs: 2500 },
      { who: 'a', text: 'mine is a moon... i don\'t like darkness...', delayMs: 2900 },
      { who: 'b', text: 'stars keep the monsters away :D', emoteId: 1, delayMs: 2500 }
    ]
  },
  {
    id: 'under8-bedtime-protest',
    topic: 'bedtime',
    ageGroup: '8 and under',
    preferredTraitsA: ['grumpy', 'excitable'],
    preferredTraitsB: ['grumpy', 'excitable'],
    steps: [
      { who: 'a', text: 'my mom says it is bedtime already ugh!!', delayMs: 0 },
      { who: 'b', text: 'bedtime is the absolute worst!!', delayMs: 2200 },
      { who: 'a', text: 'i am not even sleepy!! look i am wide awake!', delayMs: 2700 },
      { who: 'b', text: 'hide under your blanket and play toys haha', delayMs: 2400 }
    ]
  },
  {
    id: 'under8-dinosaur-roar',
    topic: 'cartoons',
    ageGroup: '8 and under',
    preferredTraitsA: ['excitable'],
    preferredTraitsB: ['excitable', 'friendly'],
    steps: [
      { who: 'a', text: 'DID YOU WATCH THE DINOSAUR CARTOON?!', delayMs: 0 },
      { who: 'b', text: 'YEAH! THE T-REX ROARED SO BIG AND LOUD!', delayMs: 2400 },
      { who: 'a', text: 'ROAAARRRR!! I AM A BIG SCARY T-REX NOW!!', delayMs: 2500 },
      { who: 'b', text: 'ROOOOOAAARRR!! DINO DANCE!!', frame: 26, delayMs: 2300 }
    ]
  },
  {
    id: 'under8-cloud-shapes',
    topic: 'curious',
    ageGroup: '8 and under',
    preferredTraitsA: ['curious'],
    preferredTraitsB: ['curious', 'friendly'],
    steps: [
      { who: 'a', text: 'look at that cloud! it looks like a bunny', delayMs: 0 },
      { who: 'b', text: 'wait i see it too! with big long ears!', delayMs: 2400 },
      { who: 'a', text: 'how do clouds make funny shapes in the sky?', delayMs: 2700 },
      { who: 'b', text: 'maybe the wind squishes them like play-doh :D', emoteId: 1, delayMs: 2400 }
    ]
  },

  // ── 9 to 12 ──────────────────────────────────────────────
  {
    id: '9to12-math-homework',
    topic: 'school',
    ageGroup: '9 to 12',
    preferredTraitsA: ['grumpy', 'friendly'],
    preferredTraitsB: ['grumpy', 'friendly'],
    steps: [
      { who: 'a', text: 'ugh so much fractions homework tonight', delayMs: 0 },
      { who: 'b', text: 'same, improper fractions make zero sense', delayMs: 2600 },
      { who: 'a', text: 'i am just gonna guess on the last problems lol', delayMs: 2800 },
      { who: 'b', text: 'haha mood, hope teacher doesn\'t check', emoteId: 10, delayMs: 2400 }
    ]
  },
  {
    id: '9to12-pizza-rolls',
    topic: 'food',
    ageGroup: '9 to 12',
    preferredTraitsA: ['friendly', 'excitable'],
    preferredTraitsB: ['friendly', 'excitable'],
    steps: [
      { who: 'a', text: 'eating microwave pizza rolls right now :D', delayMs: 0 },
      { who: 'b', text: 'careful, the inside is boiling lava lol', delayMs: 2500 },
      { who: 'a', text: 'already burned my tongue haha worth it', delayMs: 2900 },
      { who: 'b', text: 'dip them in ranch dressing, trust me on this!', delayMs: 2400 }
    ]
  },
  {
    id: '9to12-spongebob-chocolate',
    topic: 'cartoons',
    ageGroup: '9 to 12',
    preferredTraitsA: ['excitable', 'friendly'],
    preferredTraitsB: ['excitable', 'friendly'],
    steps: [
      { who: 'a', text: 'did anyone watch spongebob yesterday?', delayMs: 0 },
      { who: 'b', text: 'yeah the chocolate bar salesman episode lol', delayMs: 2400 },
      { who: 'a', text: 'CHOCOLATEEEE!! that guy screaming kills me lol', delayMs: 2800 },
      { who: 'b', text: 'classic episode honestly, so iconic :D', emoteId: 1, delayMs: 2800 }
    ]
  },
  {
    id: '9to12-nintendo-mario-kart',
    topic: 'gaming',
    ageGroup: '9 to 12',
    preferredTraitsA: ['curious', 'excitable'],
    preferredTraitsB: ['friendly', 'excitable'],
    steps: [
      { who: 'a', text: 'anyone else play mario kart on nintendo ds?', delayMs: 0 },
      { who: 'b', text: 'yeah! rainbow road always destroys me lol', delayMs: 2500 },
      { who: 'a', text: 'falling off the edge five times in a row haha', delayMs: 2800 },
      { who: 'b', text: 'and blue shells right before the finish line!', delayMs: 2700 }
    ]
  },
  {
    id: '9to12-pokemon-starter',
    topic: 'gaming',
    ageGroup: '9 to 12',
    preferredTraitsA: ['curious', 'friendly'],
    preferredTraitsB: ['curious', 'friendly'],
    steps: [
      { who: 'a', text: 'finally beat the pokemon elite four today', delayMs: 0 },
      { who: 'b', text: 'nice!! who was your starter pokemon?', delayMs: 2400 },
      { who: 'a', text: 'mudkip all the way! swampert is unbeatable', delayMs: 2700 },
      { who: 'b', text: 'treecko fan here, but swampert is awesome :D', delayMs: 3000 }
    ]
  },
  {
    id: '9to12-sibling-computer-fight',
    topic: 'life',
    ageGroup: '9 to 12',
    preferredTraitsA: ['grumpy'],
    preferredTraitsB: ['friendly', 'grumpy'],
    steps: [
      { who: 'a', text: 'my brother is standing behind my chair glaring', delayMs: 0 },
      { who: 'b', text: 'he wants his turn on the pc doesn\'t he?', delayMs: 2600 },
      { who: 'a', text: 'yep lol. told him 5 more minutes like thrice', delayMs: 2800 },
      { who: 'b', text: 'the classic sibling pc struggle haha', delayMs: 2300 }
    ]
  },
  {
    id: '9to12-trampoline-flips',
    topic: 'sports',
    ageGroup: '9 to 12',
    preferredTraitsA: ['excitable', 'friendly'],
    preferredTraitsB: ['friendly', 'curious'],
    steps: [
      { who: 'a', text: 'was jumping on my trampoline before this', delayMs: 0 },
      { who: 'b', text: 'can you do a front flip on it?', delayMs: 2400 },
      { who: 'a', text: 'almost landed one! used couch cushions lol', delayMs: 2900 },
      { who: 'b', text: 'haha don\'t let your mom catch you with them!', delayMs: 2700 }
    ]
  },
  {
    id: '9to12-superpower-debate',
    topic: 'random',
    ageGroup: '9 to 12',
    preferredTraitsA: ['curious'],
    preferredTraitsB: ['curious', 'friendly'],
    steps: [
      { who: 'a', text: 'what superpower would you choose if you could?', delayMs: 0 },
      { who: 'b', text: 'definitely flying, skip all school traffic', delayMs: 2600 },
      { who: 'a', text: 'i\'d teleport, wake up at 7:59 for homeroom', delayMs: 3100 },
      { who: 'b', text: 'that is actually pure genius lol', delayMs: 2300 }
    ]
  },

  // ── 13 to 17 ─────────────────────────────────────────────
  {
    id: '13to17-music-ipod',
    topic: 'music',
    ageGroup: '13 to 17',
    preferredTraitsA: ['friendly', 'curious'],
    preferredTraitsB: ['friendly', 'curious'],
    steps: [
      { who: 'a', text: 'burning a new custom cd on my pc right now', delayMs: 0 },
      { who: 'b', text: 'nice! what tracks are you putting on it?', delayMs: 2500 },
      { who: 'a', text: 'green day, blink-182, and my chem :D', delayMs: 2900 },
      { who: 'b', text: 'solid tracklist! custom burned cds hit so good', delayMs: 2600 }
    ]
  },
  {
    id: '13to17-monday-test-agony',
    topic: 'school',
    ageGroup: '13 to 17',
    preferredTraitsA: ['grumpy'],
    preferredTraitsB: ['grumpy', 'friendly'],
    steps: [
      { who: 'a', text: 'chemistry test period 1 on monday. why.', delayMs: 0 },
      { who: 'b', text: 'that should literally be a crime against us', delayMs: 2500 },
      { who: 'a', text: 'i am on three hours of sleep and pure panic', delayMs: 2800 },
      { who: 'b', text: 'chug an energy drink, you need it lol', emoteId: 10, delayMs: 2500 }
    ]
  },
  {
    id: '13to17-driver-permit-hype',
    topic: 'life',
    ageGroup: '13 to 17',
    preferredTraitsA: ['excitable'],
    preferredTraitsB: ['friendly', 'excitable'],
    steps: [
      { who: 'a', text: 'PASSED MY DRIVER PERMIT TEST TODAY!!', delayMs: 0 },
      { who: 'b', text: 'YOOOO congrats!! freedom on wheels incoming!', delayMs: 2500 },
      { who: 'a', text: 'can\'t wait to blast cds with windows down!!', delayMs: 2800 },
      { who: 'b', text: 'just don\'t hit the curb when parking haha', delayMs: 2500 }
    ]
  },
  {
    id: '13to17-quiet-late-nights',
    topic: 'chill',
    ageGroup: '13 to 17',
    preferredTraitsA: ['shy'],
    preferredTraitsB: ['shy', 'friendly'],
    steps: [
      { who: 'a', text: 'i love how peaceful the house is at 1 AM...', delayMs: 0 },
      { who: 'b', text: 'same, everyone is asleep and world is quiet', delayMs: 2600 },
      { who: 'a', text: 'just headphones on listening to indie tunes...', delayMs: 2900 },
      { who: 'b', text: 'best hours of the night honestly, zero stress', emoteId: 1, delayMs: 2500 }
    ]
  },
  {
    id: '13to17-future-career-talk',
    topic: 'future',
    ageGroup: '13 to 17',
    preferredTraitsA: ['curious'],
    preferredTraitsB: ['curious', 'friendly'],
    steps: [
      { who: 'a', text: 'know what you want to study after school?', delayMs: 0 },
      { who: 'b', text: 'probably comp sci or graphic design, you?', delayMs: 2700 },
      { who: 'a', text: 'thinking game design, wanna build 2D worlds', delayMs: 3100 },
      { who: 'b', text: 'honestly go for it, that sounds amazing!', delayMs: 2500 }
    ]
  },
  {
    id: '13to17-skatepark-session',
    topic: 'sports',
    ageGroup: '13 to 17',
    preferredTraitsA: ['friendly', 'excitable'],
    preferredTraitsB: ['friendly', 'excitable'],
    steps: [
      { who: 'a', text: 'hit the skatepark with the crew after class', delayMs: 0 },
      { who: 'b', text: 'nice! land any clean tricks?', delayMs: 2400 },
      { who: 'a', text: 'landed a heelflip down the 3-stair! ten tries', delayMs: 3000 },
      { who: 'b', text: 'let\'s goooo! bruised shins were worth it', frame: 25, delayMs: 2600 }
    ]
  },
  {
    id: '13to17-pc-fan-helicopter',
    topic: 'tech',
    ageGroup: '13 to 17',
    preferredTraitsA: ['grumpy', 'curious'],
    preferredTraitsB: ['friendly', 'curious'],
    steps: [
      { who: 'a', text: 'my pc fan sounds like a helicopter lol', delayMs: 0 },
      { who: 'b', text: 'open side panel and hit it with compressed air', delayMs: 2700 },
      { who: 'a', text: 'a cloud of dust came out like smoke whew', delayMs: 2900 },
      { who: 'b', text: 'dust bunnies were paying rent in there lol', delayMs: 2400 }
    ]
  },

  // ── 18 and over ──────────────────────────────────────────
  {
    id: '18plus-dorm-shenanigans',
    topic: 'dorm',
    ageGroup: '18 and over',
    preferredTraitsA: ['friendly', 'grumpy'],
    preferredTraitsB: ['friendly', 'curious'],
    steps: [
      { who: 'a', text: 'my roommate ate my leftover pizza again lol', delayMs: 0 },
      { who: 'b', text: 'classic dorm life, gotta label your food haha', delayMs: 2600 },
      { who: 'a', text: 'i put a note on it and everything!', delayMs: 2900 },
      { who: 'b', text: 'notes mean nothing to a hungry roommate lol', emoteId: 1, delayMs: 2600 }
    ]
  },
  {
    id: '18plus-coffee-addiction',
    topic: 'college',
    ageGroup: '18 and over',
    preferredTraitsA: ['friendly', 'grumpy'],
    preferredTraitsB: ['friendly', 'excitable'],
    steps: [
      { who: 'a', text: 'on my third mug of coffee today already haha', delayMs: 0 },
      { who: 'b', text: 'third mug? rookie numbers during finals lol', delayMs: 2500 },
      { who: 'a', text: 'college midterms are draining my soul right now', delayMs: 2800 },
      { who: 'b', text: 'hang in there, semester break is coming!', emoteId: 9, delayMs: 2600 }
    ]
  },
  {
    id: '18plus-cd-burning',
    topic: 'music',
    ageGroup: '18 and over',
    preferredTraitsA: ['friendly', 'curious'],
    preferredTraitsB: ['friendly', 'excitable'],
    steps: [
      { who: 'a', text: 'making a new mix CD for the car ride home', delayMs: 0 },
      { who: 'b', text: 'nice, what tracks are you burning onto it?', delayMs: 2600 },
      { who: 'a', text: 'some green day, the killers, and coldplay', delayMs: 2900 },
      { who: 'b', text: 'solid playlist, 700mb well spent haha', emoteId: 1, delayMs: 2400 }
    ]
  },
  {
    id: '18plus-post-work-shift',
    topic: 'work',
    ageGroup: '18 and over',
    preferredTraitsA: ['shy', 'friendly'],
    preferredTraitsB: ['friendly', 'shy'],
    steps: [
      { who: 'a', text: 'got off an 8-hour shift, feet are killing me', delayMs: 0 },
      { who: 'b', text: 'retail or food service?', delayMs: 2300 },
      { who: 'a', text: 'retail... holiday rush customers are relentless', delayMs: 2800 },
      { who: 'b', text: 'sit back, put feet up and relax for tonight', delayMs: 2500 }
    ]
  },
  {
    id: '18plus-finals-finished',
    topic: 'college',
    ageGroup: '18 and over',
    preferredTraitsA: ['excitable'],
    preferredTraitsB: ['excitable', 'friendly'],
    steps: [
      { who: 'a', text: 'OFFICIALLY DONE WITH FINALS AHHHHH!!', delayMs: 0 },
      { who: 'b', text: 'LETS GOOOOO!! how did turning that in feel?', delayMs: 2500 },
      { who: 'a', text: 'boulder lifted off my chest!! partying tonight!', delayMs: 3100 },
      { who: 'b', text: 'celebrate hard, you definitely earned it! :D', frame: 26, delayMs: 2600 }
    ]
  },
  {
    id: '18plus-campus-lan',
    topic: 'gaming',
    ageGroup: '18 and over',
    preferredTraitsA: ['curious', 'friendly'],
    preferredTraitsB: ['curious', 'friendly'],
    steps: [
      { who: 'a', text: 'my buddy sent me this game link over AIM', delayMs: 0 },
      { who: 'b', text: 'lol same, told me to make a penguin and join', delayMs: 2700 },
      { who: 'a', text: 'beats studying for geology in the library', delayMs: 2800 },
      { who: 'b', text: 'anything beats geology midterms honestly haha', delayMs: 2800 }
    ]
  },

  // ── Universal / Any Age Group ────────────────────────────
  {
    id: 'universal-knock-knock-orange',
    topic: 'jokes',
    ageGroup: 'any',
    steps: [
      { who: 'a', text: 'knock knock!', delayMs: 0 },
      { who: 'b', text: "who's there?", delayMs: 2200 },
      { who: 'a', text: 'orange', delayMs: 2000 },
      { who: 'b', text: 'orange who?', delayMs: 2100 },
      { who: 'a', text: "orange you glad we're chatting! :D", delayMs: 2500 },
      { who: 'b', text: 'haha classic joke', emoteId: 1, delayMs: 2200 }
    ]
  },
  {
    id: 'universal-dino-snore',
    topic: 'jokes',
    ageGroup: 'any',
    steps: [
      { who: 'a', text: 'what do you call a sleeping dinosaur?', delayMs: 0 },
      { who: 'b', text: 'what?', delayMs: 2200 },
      { who: 'a', text: 'a dino-snore! haha', delayMs: 2300 },
      { who: 'b', text: 'corny joke but i laughed anyway lol', emoteId: 1, delayMs: 2600 }
    ]
  },
  {
    id: 'universal-fake-noodle-impasta',
    topic: 'jokes',
    ageGroup: 'any',
    steps: [
      { who: 'a', text: 'what do you call a fake noodle?', delayMs: 0 },
      { who: 'b', text: 'what?', delayMs: 2100 },
      { who: 'a', text: 'an IMPASTA! haha', delayMs: 2300 },
      { who: 'b', text: 'lol terrible and amazing at the same time', emoteId: 1, delayMs: 2800 }
    ]
  },
  {
    id: 'universal-cat-keyboard',
    topic: 'pets',
    ageGroup: 'any',
    steps: [
      { who: 'a', text: 'my cat just fell asleep on my keyboard lol', delayMs: 0 },
      { who: 'b', text: 'haha did she type random letters?', delayMs: 2500 },
      { who: 'a', text: "yeah like asdfghjk... she's purring though :3", delayMs: 2900 },
      { who: 'b', text: 'aww, cannot move your hands now by law haha', delayMs: 2400 }
    ]
  },
  {
    id: 'universal-rainy-sunny-weather',
    topic: 'weather',
    ageGroup: 'any',
    steps: [
      { who: 'a', text: 'it has been pouring rain all day here', delayMs: 0 },
      { who: 'b', text: "really? it's super sunny where i live!", delayMs: 2500 },
      { who: 'a', text: 'lucky! i had to stay inside all afternoon', delayMs: 2700 },
      { who: 'b', text: 'at least you get to play computer games :D', delayMs: 2600 }
    ]
  },
  {
    id: 'universal-favorite-color',
    topic: 'random',
    ageGroup: 'any',
    steps: [
      { who: 'a', text: "random question: what's your favorite color?", delayMs: 0 },
      { who: 'b', text: 'blue! especially electric blue', delayMs: 2400 },
      { who: 'a', text: 'nice choice, mine is bright forest green :)', delayMs: 2600 },
      { who: 'b', text: 'both great colors!', delayMs: 2100 }
    ]
  }
];

export function getEligibleDialogueChains(
  currentDate: string,
  ageGroupA?: BotAgeGroup,
  ageGroupB?: BotAgeGroup,
  traitA?: PersonalityTrait,
  traitB?: PersonalityTrait
): DialogueChain[] {
  return AMBIENT_DIALOGUE_CHAINS.filter(chain => {
    // 1. Timeline gate check
    if (chain.gate?.after && isLower(currentDate, chain.gate.after)) return false;
    if (chain.gate?.before && !isLower(currentDate, chain.gate.before)) return false;

    // 2. Age group check
    if (chain.ageGroup && chain.ageGroup !== 'any') {
      if (ageGroupA && ageGroupB) {
        if (chain.ageGroup !== ageGroupA && chain.ageGroup !== ageGroupB) return false;
      } else if (ageGroupA && chain.ageGroup !== ageGroupA) {
        return false;
      }
    }

    // 3. Trait preference check
    if (traitA && chain.preferredTraitsA && !chain.preferredTraitsA.includes(traitA)) {
      return false;
    }
    if (traitB && chain.preferredTraitsB && !chain.preferredTraitsB.includes(traitB)) {
      return false;
    }

    return true;
  });
}

// ─────────────────────────────────────────────────────────────
// Ambient Player Chat Triggers
// All responses strictly <= 48 characters
// ─────────────────────────────────────────────────────────────

export const AMBIENT_PLAYER_CHAT_TRIGGERS: AmbientChatTrigger[] = [
  // School / Homework
  {
    keywords: ['homework', 'math', 'test', 'exam', 'teacher', 'class', 'school', 'history', 'science', 'presentation'],
    cooldownMs: 25_000,
    primaryResponses: {
      '8 and under': [
        'spelling test tomorrow wish me luck!',
        'my teacher gave me a sticker today :D',
        'recess was so fun today!',
        'i like art class the best :)'
      ],
      '9 to 12': [
        'ugh fractions homework is taking forever :(',
        'science class had me falling asleep lol',
        'good luck on your test! you got this!',
        'counting down the days till summer break!'
      ],
      '13 to 17': [
        'high school homework is the worst :(',
        'chemistry test on monday should be illegal lol',
        'finished my history essay, big relief',
        'ready for the weekend, this week was tiring'
      ],
      '18 and over': [
        'college midterms are draining my soul haha',
        'good luck with your studies, hang in there!',
        'cramming for midterms in the campus library',
        'prof assigned so much reading over break ugh'
      ]
    },
    followUpResponses: [
      "i'm so ready for the weekend already",
      'what subject are you working on?',
      'teacher gave us so much reading tonight',
      'counting down the days till summer vacation!'
    ]
  },

  // Pizza
  {
    keywords: ['pizza'],
    cooldownMs: 20_000,
    primaryResponses: {
      '8 and under': [
        'pizza is my favorite food ever!! :D',
        'cheese pizza with big crust is so yummy!',
        'pizza party!! yay!!'
      ],
      '9 to 12': [
        'pepperoni with extra cheese is top tier :D',
        'eating microwave pizza rolls right now haha',
        'now i want a slice of pizza so bad lol'
      ],
      '13 to 17': [
        'pizza night is the best night of the week',
        'large pepperoni pizza for late night gaming :D',
        'now you got my stomach growling haha'
      ],
      '18 and over': [
        'cold leftover pizza is college gourmet haha',
        'local pizzeria pizza beats everything else',
        'making homemade pizza from scratch tonight :)'
      ]
    },
    followUpResponses: [
      'extra cheese all the way!',
      'now my stomach is growling lol',
      'pizza night is the best night of the week'
    ]
  },

  // General Food / Eating
  {
    keywords: ['hungry', 'food', 'snack', 'dinner', 'lunch', 'eat', 'eating', 'tacos', 'burger', 'cereal', 'cookies'],
    cooldownMs: 20_000,
    primaryResponses: {
      '8 and under': [
        'my mom is making yummy dinner soon!',
        'i ate two cookies earlier :D',
        'mac and cheese is the best food ever!!'
      ],
      '9 to 12': [
        'eating snacks while gaming is the best combo',
        'cereal for dinner is honestly elite',
        'what are you gonna eat? share with us! :P'
      ],
      '13 to 17': [
        'making a midnight snack raid in the kitchen',
        'french fries with extra salt, yes please',
        'eating goldfish crackers while playing'
      ],
      '18 and over': [
        'trying to decide what to cook tonight...',
        'living off coffee and snacks during exams haha',
        'warm homemade soup hits the spot after work'
      ]
    },
    followUpResponses: [
      'save some snacks for the rest of us haha',
      'now you got everyone hungry lol'
    ]
  },

  // Dogs & Puppies
  {
    keywords: ['dog', 'dogs', 'puppy', 'puppies'],
    cooldownMs: 25_000,
    primaryResponses: {
      '8 and under': [
        'i love doggies so much!! they wag tails!!',
        'puppies are the cutest in the universe! :D',
        'my dog gives me big puppy hugs!'
      ],
      '9 to 12': [
        'dogs are the absolute best! what breed?',
        'my dog barks at every single leaf outside lol',
        'taking my golden retriever for a walk soon'
      ],
      '13 to 17': [
        'my dog is sleeping right by my desk right now',
        'dogs barking at the mailman is so funny',
        'i love taking my dog to the park on weekends'
      ],
      '18 and over': [
        'petting my dog after a long shift is the best',
        'dogs are so loyal and wonderful companions :)',
        'my dog is curled up at my feet fast asleep'
      ]
    },
    followUpResponses: [
      'dogs barking at the mailman is so funny',
      'i wish i could adopt ten puppies honestly'
    ]
  },

  // Cats & Kittens
  {
    keywords: ['cat', 'cats', 'kitten', 'kittens'],
    cooldownMs: 25_000,
    primaryResponses: {
      '8 and under': [
        'kitties are so soft and cute!! :3',
        'my kitty purrs like a tiny motor!',
        'i love petting cats when they are sleepy'
      ],
      '9 to 12': [
        'my cat fell asleep on my warm keyboard lol',
        'does your cat do funny 3 AM zoomies? haha',
        'cats purring is the most relaxing sound ever'
      ],
      '13 to 17': [
        'my cat knocked a pen off my desk and stared',
        'cats sleeping in pretzel positions is peak fun',
        'my cat thinks she owns my bedroom honestly'
      ],
      '18 and over': [
        'a cat purring in your lap melts all stress',
        'cats are introverted royalty and i love that',
        'my cat is judging my life choices right now'
      ]
    },
    followUpResponses: [
      'my cat stares at blank walls like ghosts lol',
      'cats are secretly hilarious'
    ]
  },

  // Cartoons & SpongeBob
  {
    keywords: ['spongebob', 'cartoon', 'cartoons', 'patrick', 'squidward'],
    cooldownMs: 25_000,
    primaryResponses: {
      '8 and under': [
        'SPONGEBOB IS SO FUNNY HAHA!!',
        'watching saturday morning cartoons in pjs!',
        'patrick star is so silly :D'
      ],
      '9 to 12': [
        'spongebob quotes live in my head forever lol',
        'CHOCOLATEEEE!! that episode is legendary',
        'watching cartoons with snacks after school'
      ],
      '13 to 17': [
        'older spongebob seasons are peak comedic art',
        'cartoon network marathons on friday nights!',
        'squidward gets more relatable every year lol'
      ],
      '18 and over': [
        'spongebob quotes with roommates never get old',
        'squidward is so relatable when working retail',
        'spongebob movie was hilarious in theaters'
      ]
    },
    followUpResponses: [
      'cartoon network marathons on friday nights!',
      'cartoons make any day ten times better'
    ]
  },

  // Video Games & Consoles
  {
    keywords: ['nintendo', 'pokemon', 'mario', 'ds', 'gameboy', 'gamecube', 'playstation', 'xbox'],
    cooldownMs: 25_000,
    primaryResponses: {
      '8 and under': [
        'i love playing mario!! jumping on goombas!!',
        'pikachu is so cute!! pika pika!',
        'video games are my favorite thing to do!'
      ],
      '9 to 12': [
        'mario kart on the ds ruins friendships haha',
        'who is your favorite starter pokemon ever?',
        'playing game boy advance road trip games'
      ],
      '13 to 17': [
        'smash bros tournaments with friends get wild',
        'nintendo handheld games will always be iconic',
        'staying up till 2 AM beating a tough game'
      ],
      '18 and over': [
        'smash melee tournaments in our dorm get loud',
        'gamecube and ds games are so addictive haha',
        'playing mario kart with roommates late at night'
      ]
    },
    followUpResponses: [
      'super smash bros tournaments get so heated lol',
      'handheld games on road trips are the best'
    ]
  },

  // Jokes & Riddles
  {
    keywords: ['joke', 'jokes', 'funny', 'riddle', 'tell me a joke'],
    cooldownMs: 20_000,
    primaryResponses: {
      '8 and under': [
        'why did duck cross road? to buy quackers! haha',
        'sleeping dinosaur? a dino-snore! :D',
        'knock knock! who\'s there? banana! banana who?'
      ],
      '9 to 12': [
        'what do you call fake noodle? an IMPASTA! haha',
        'cookie went to doctor because he felt crummy!',
        'not your cheese? NACHO CHEESE lol'
      ],
      '13 to 17': [
        'why don\'t skeletons fight? no guts haha',
        'factory making okay items? a satisfactory lol',
        'scarecrow won award? outstanding in his field'
      ],
      '18 and over': [
        'broke arm in 2 places? stop going there lol',
        'why do programmers wear glasses? cannot C# lol',
        'reading about anti-gravity, can\'t put it down'
      ]
    },
    followUpResponses: [
      'haha that was so corny but i love it',
      'lol 10 out of 10 dad joke',
      'classic silly joke right there haha'
    ]
  }
];

export function getAmbientPlayerChatResponse(
  trigger: AmbientChatTrigger,
  ageGroup: BotAgeGroup
): string {
  let response: string;
  if (Array.isArray(trigger.primaryResponses)) {
    response = choose(trigger.primaryResponses);
  } else {
    const byAge = trigger.primaryResponses[ageGroup];
    if (byAge && byAge.length > 0) {
      response = choose(byAge);
    } else {
      const fallback = Object.values(trigger.primaryResponses).flat();
      response = choose(fallback);
    }
  }
  return response.length <= 48 ? response : response.slice(0, 48);
}
