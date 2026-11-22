import type { ItemDefinition, ItemType, LevelDefinition, MusicTrack, NoteEvent } from './types';

export const LANE_KEYS: readonly [string, string, string, string] = ['D', 'F', 'J', 'K'];
export const ALT_LANE_KEYS: readonly [string, string, string, string] = ['1', '2', '3', '4'];

export const ITEM_ORDER: ItemType[] = [
  'knife',
  'fork',
  'spoon',
  'cloth',
  'plate',
  'water',
  'beer',
  'shot',
  'napkin',
  'wine',
];

export const ITEMS: Record<ItemType, ItemDefinition> = {
  knife: {
    id: 'knife',
    name: 'Obědový nůž',
    shortName: 'Nůž',
    accentHex: '#e2b86b',
    accentInt: 0xe2b86b,
    emissiveInt: 0x8f6420,
    soundCharacter: 'Ostrý kovový cinkot čepele',
  },
  fork: {
    id: 'fork',
    name: 'Obědová vidlička',
    shortName: 'Vidlička',
    accentHex: '#cbd5e1',
    accentInt: 0xcbd5e1,
    emissiveInt: 0x5c728a,
    soundCharacter: 'Rezonanční tón ladičky',
  },
  spoon: {
    id: 'spoon',
    name: 'Obědová lžička',
    shortName: 'Lžička',
    accentHex: '#f0c475',
    accentInt: 0xf0c475,
    emissiveInt: 0x996b1f,
    soundCharacter: 'Jemný zvonivý úder',
  },
  cloth: {
    id: 'cloth',
    name: 'Hadr na stůl',
    shortName: 'Hadr',
    accentHex: '#d96b52',
    accentInt: 0xd96b52,
    emissiveInt: 0x87321e,
    soundCharacter: 'Rytmický švih a marimba',
  },
  plate: {
    id: 'plate',
    name: 'Talíř',
    shortName: 'Talíř',
    accentHex: '#f5efe6',
    accentInt: 0xf5efe6,
    emissiveInt: 0xa6895b,
    soundCharacter: 'Čistý porcelánový akord',
  },
  water: {
    id: 'water',
    name: 'Sklenice s vodou',
    shortName: 'Voda',
    accentHex: '#67c8e0',
    accentInt: 0x67c8e0,
    emissiveInt: 0x1e6f87,
    soundCharacter: 'Křišťálová kapka a sklo',
  },
  beer: {
    id: 'beer',
    name: 'Sklenice s pivem',
    shortName: 'Pivo',
    accentHex: '#f5a623',
    accentInt: 0xf5a623,
    emissiveInt: 0xa35f08,
    soundCharacter: 'Půllitrový cinkot a dechy',
  },
  shot: {
    id: 'shot',
    name: 'Panák',
    shortName: 'Panák',
    accentHex: '#f28b50',
    accentInt: 0xf28b50,
    emissiveInt: 0x994214,
    soundCharacter: 'Krátký ostrý křišťál',
  },
  napkin: {
    id: 'napkin',
    name: 'Ubrousek',
    shortName: 'Ubrousek',
    accentHex: '#e6d3b3',
    accentInt: 0xe6d3b3,
    emissiveInt: 0x8c7146,
    soundCharacter: 'Hedvábný harfový rozklad',
  },
  wine: {
    id: 'wine',
    name: 'Láhev vína',
    shortName: 'Víno',
    accentHex: '#c84b61',
    accentInt: 0xc84b61,
    emissiveInt: 0x7d192c,
    soundCharacter: 'Otevření korku a klavír',
  },
};

export const LEVELS: LevelDefinition[] = [
  {
    id: 1,
    name: 'Obědový nůž',
    subtitle: 'Ranní prostírání v bistru',
    uniqueItem: 'knife',
    laneItems: ['knife', 'plate', 'napkin', 'water'],
    bpm: 96,
    durationBeats: 64,
    difficulty: 'Lehká',
    rootMidi: 60, // C major
    scaleIntervals: [0, 2, 4, 7, 9, 12, 14, 16],
    chordProgression: [
      [48, 52, 55, 59],
      [45, 48, 52, 55],
      [41, 45, 48, 52],
      [43, 47, 50, 53],
    ],
    grooveStyle: 'bistro',
    doubleNoteChance: 0,
    offbeatChance: 0.08,
    accentColor: '#e2b86b',
    accentInt: 0xe2b86b,
  },
  {
    id: 2,
    name: 'Obědová vidlička',
    subtitle: 'Polední swingový servis',
    uniqueItem: 'fork',
    laneItems: ['knife', 'fork', 'plate', 'napkin'],
    bpm: 104,
    durationBeats: 68,
    difficulty: 'Lehká',
    rootMidi: 62, // D major
    scaleIntervals: [0, 2, 4, 7, 9, 12, 14, 16],
    chordProgression: [
      [50, 54, 57, 61],
      [47, 50, 54, 57],
      [43, 47, 50, 54],
      [45, 49, 52, 55],
    ],
    grooveStyle: 'swing',
    doubleNoteChance: 0.04,
    offbeatChance: 0.14,
    accentColor: '#cbd5e1',
    accentInt: 0xcbd5e1,
  },
  {
    id: 3,
    name: 'Obědová lžička',
    subtitle: 'Polévkový valčík',
    uniqueItem: 'spoon',
    laneItems: ['fork', 'spoon', 'plate', 'water'],
    bpm: 110,
    durationBeats: 72,
    difficulty: 'Lehká',
    rootMidi: 65, // F major
    scaleIntervals: [0, 2, 4, 5, 7, 9, 12, 14],
    chordProgression: [
      [53, 57, 60, 64],
      [50, 53, 57, 60],
      [46, 50, 53, 57],
      [48, 52, 55, 58],
    ],
    grooveStyle: 'waltz',
    doubleNoteChance: 0.06,
    offbeatChance: 0.18,
    accentColor: '#f0c475',
    accentInt: 0xf0c475,
  },
  {
    id: 4,
    name: 'Hadr na stůl',
    subtitle: 'Rychlý úklid mezi chody',
    uniqueItem: 'cloth',
    laneItems: ['cloth', 'plate', 'spoon', 'napkin'],
    bpm: 114,
    durationBeats: 76,
    difficulty: 'Střední',
    rootMidi: 67, // G mixolydian / funk
    scaleIntervals: [0, 2, 4, 7, 9, 10, 12, 14],
    chordProgression: [
      [43, 47, 50, 53],
      [48, 52, 55, 58],
      [45, 48, 52, 55],
      [50, 54, 57, 60],
    ],
    grooveStyle: 'funk',
    doubleNoteChance: 0.1,
    offbeatChance: 0.26,
    accentColor: '#d96b52',
    accentInt: 0xd96b52,
  },
  {
    id: 5,
    name: 'Talíř',
    subtitle: 'Porcelánový hlavní chod',
    uniqueItem: 'plate',
    laneItems: ['knife', 'plate', 'fork', 'cloth'],
    bpm: 120,
    durationBeats: 80,
    difficulty: 'Střední',
    rootMidi: 64, // E minor / dorian
    scaleIntervals: [0, 2, 3, 5, 7, 9, 10, 12],
    chordProgression: [
      [52, 55, 59, 62],
      [48, 52, 55, 59],
      [45, 48, 52, 55],
      [47, 51, 54, 57],
    ],
    grooveStyle: 'bistro',
    doubleNoteChance: 0.14,
    offbeatChance: 0.3,
    accentColor: '#f5efe6',
    accentInt: 0xf5efe6,
  },
  {
    id: 6,
    name: 'Sklenice s vodou',
    subtitle: 'Křišťálová svěžest',
    uniqueItem: 'water',
    laneItems: ['water', 'plate', 'spoon', 'napkin'],
    bpm: 124,
    durationBeats: 80,
    difficulty: 'Střední',
    rootMidi: 63, // Eb major
    scaleIntervals: [0, 2, 4, 7, 9, 12, 14, 16],
    chordProgression: [
      [51, 55, 58, 62],
      [48, 51, 55, 58],
      [44, 48, 51, 55],
      [46, 50, 53, 56],
    ],
    grooveStyle: 'lounge',
    doubleNoteChance: 0.16,
    offbeatChance: 0.34,
    accentColor: '#67c8e0',
    accentInt: 0x67c8e0,
  },
  {
    id: 7,
    name: 'Sklenice s pivem',
    subtitle: 'Český půllitr v plném tempu',
    uniqueItem: 'beer',
    laneItems: ['beer', 'cloth', 'plate', 'shot'],
    bpm: 128,
    durationBeats: 84,
    difficulty: 'Pokročilá',
    rootMidi: 65, // F lively polka-groove
    scaleIntervals: [0, 2, 4, 5, 7, 9, 10, 12],
    chordProgression: [
      [41, 45, 48, 53],
      [46, 50, 53, 58],
      [48, 52, 55, 58],
      [41, 45, 48, 53],
    ],
    grooveStyle: 'polka',
    doubleNoteChance: 0.2,
    offbeatChance: 0.38,
    accentColor: '#f5a623',
    accentInt: 0xf5a623,
  },
  {
    id: 8,
    name: 'Panák',
    subtitle: 'Ostrý večerní přípitek',
    uniqueItem: 'shot',
    laneItems: ['beer', 'shot', 'water', 'cloth'],
    bpm: 134,
    durationBeats: 88,
    difficulty: 'Pokročilá',
    rootMidi: 69, // A minor funk-club
    scaleIntervals: [0, 2, 3, 5, 7, 10, 12, 14],
    chordProgression: [
      [45, 48, 52, 55],
      [41, 45, 48, 52],
      [43, 47, 50, 55],
      [40, 44, 47, 50],
    ],
    grooveStyle: 'funk',
    doubleNoteChance: 0.22,
    offbeatChance: 0.42,
    accentColor: '#f28b50',
    accentInt: 0xf28b50,
  },
  {
    id: 9,
    name: 'Ubrousek',
    subtitle: 'Slavnostní večerní tabule',
    uniqueItem: 'napkin',
    laneItems: ['napkin', 'knife', 'fork', 'wine'],
    bpm: 140,
    durationBeats: 92,
    difficulty: 'Mistrovská',
    rootMidi: 62, // D minor dramatic
    scaleIntervals: [0, 2, 3, 5, 7, 8, 10, 12],
    chordProgression: [
      [50, 53, 57, 60],
      [46, 50, 53, 57],
      [43, 46, 50, 53],
      [45, 49, 52, 55],
    ],
    grooveStyle: 'swing',
    doubleNoteChance: 0.25,
    offbeatChance: 0.46,
    accentColor: '#e6d3b3',
    accentInt: 0xe6d3b3,
  },
  {
    id: 10,
    name: 'Láhev vína',
    subtitle: 'Grand Finále všech deseti předmětů',
    uniqueItem: 'wine',
    laneItems: ['wine', 'plate', 'beer', 'knife'],
    allItemsCycle: true,
    bpm: 148,
    durationBeats: 96,
    difficulty: 'Mistrovská',
    rootMidi: 67, // G grand finale
    scaleIntervals: [0, 2, 4, 7, 9, 12, 14, 16],
    chordProgression: [
      [43, 47, 50, 54],
      [40, 43, 47, 50],
      [48, 52, 55, 59],
      [50, 54, 57, 60],
    ],
    grooveStyle: 'finale',
    doubleNoteChance: 0.28,
    offbeatChance: 0.5,
    accentColor: '#c84b61',
    accentInt: 0xc84b61,
  },
];

/** Deterministic PRNG so every level has a reproducible, learnable chart */
function createSeededRandom(seed: number): () => number {
  let s = (seed * 1664525 + 1013904223) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const LEAD_IN_BEATS = 4;

/**
 * Generates a musical Magic-Tiles style beatmap for a level.
 * Guarantees comfortable D/F/J/K flow, musical phrasing, and prominent
 * placement of the level's signature unique tableware item.
 */
export function generateLevelChart(level: LevelDefinition, musicTrack?: MusicTrack): NoteEvent[] {
  const rand = createSeededRandom(level.id * 7919 + level.bpm * 31);
  const notes: NoteEvent[] = [];
  let nextId = 1;

  const activeRootMidi = musicTrack?.rootMidi ?? level.rootMidi;
  const activeScale = musicTrack?.scaleIntervals ?? level.scaleIntervals;

  // Find which lane holds the unique item by default (fallback 0)
  const uniqueLaneIdx = Math.max(0, level.laneItems.indexOf(level.uniqueItem)) as 0 | 1 | 2 | 3;
  let lastLane: 0 | 1 | 2 | 3 = uniqueLaneIdx;

  // Melodic motif pattern (8-beat phrase repeated with variation)
  const motifDegrees = [0, 2, 4, 2, 5, 4, 3, 1];

  const pickScaleMidi = (beatIndex: number, lane: number, isUnique: boolean): number => {
    const motif = motifDegrees[beatIndex % motifDegrees.length];
    const deg = (motif + (isUnique ? 2 : lane)) % activeScale.length;
    return activeRootMidi + activeScale[deg];
  };

  const pickItemForLane = (lane: 0 | 1 | 2 | 3, beatIndex: number, forceUnique: boolean): { item: ItemType; isUnique: boolean } => {
    if (forceUnique) {
      return { item: level.uniqueItem, isUnique: true };
    }
    if (level.allItemsCycle) {
      // Grand Finale cycles through all 10 items across phrases while spotlighting wine
      const nonWine = ITEM_ORDER.filter((t) => t !== 'wine');
      const idx = (Math.floor(beatIndex / 4) * 3 + lane) % nonWine.length;
      return { item: nonWine[idx], isUnique: false };
    }
    const item = level.laneItems[lane];
    return { item, isUnique: item === level.uniqueItem };
  };

  // Start after LEAD_IN_BEATS so the player sees the first row gliding toward them
  for (let b = 0; b < level.durationBeats; b++) {
    const beat = LEAD_IN_BEATS + b;
    const barPos = b % 4;
    const phraseIndex = Math.floor(b / 8);

    // Give a brief musical breathing space on the very last beat of every 16-beat phrase on easy levels
    if (level.id <= 2 && b % 16 === 15) {
      continue;
    }

    // Choose primary lane with ergonomic horizontal movement
    let lane: 0 | 1 | 2 | 3;
    const isDownbeat = barPos === 0;
    const isAccentBeat = barPos === 0 || (barPos === 2 && phraseIndex % 2 === 1);

    if (isDownbeat && b % 8 === 0) {
      lane = uniqueLaneIdx;
    } else {
      const r = rand();
      if (r < 0.34) {
        // Step right
        lane = ((lastLane + 1) % 4) as 0 | 1 | 2 | 3;
      } else if (r < 0.68) {
        // Step left
        lane = ((lastLane + 3) % 4) as 0 | 1 | 2 | 3;
      } else if (r < 0.85) {
        // Jump across center
        lane = ((lastLane + 2) % 4) as 0 | 1 | 2 | 3;
      } else {
        // Intentional repeat on rhythmic pulse
        lane = lastLane;
      }
    }

    // Spotlight the unique item on strong musical accents
    const forceUnique = isAccentBeat && (lane === uniqueLaneIdx || rand() < 0.45);
    const chosen = pickItemForLane(lane, b, forceUnique);

    notes.push({
      id: nextId++,
      beat,
      lane,
      item: chosen.item,
      isUnique: chosen.isUnique,
      midiNote: pickScaleMidi(b, lane, chosen.isUnique),
      hitState: 'pending',
    });

    // Optional double-note chord row on strong beats for mid/high levels
    if (
      b > 4 &&
      b < level.durationBeats - 4 &&
      (barPos === 0 || barPos === 2) &&
      rand() < level.doubleNoteChance
    ) {
      // Pick comfortable two-hand pair: left hand (0,1) + right hand (2,3)
      const secondLane: 0 | 1 | 2 | 3 =
        lane < 2 ? (rand() < 0.5 ? 2 : 3) : rand() < 0.5 ? 0 : 1;
      const secondChosen = pickItemForLane(secondLane, b + 1, false);
      notes.push({
        id: nextId++,
        beat,
        lane: secondLane,
        item: secondChosen.item,
        isUnique: secondChosen.isUnique,
        midiNote: pickScaleMidi(b + 2, secondLane, secondChosen.isUnique) + 4,
        hitState: 'pending',
      });
    }

    // Optional eighth-note offbeat syncopation for lively Magic Tiles flow
    const allowOffbeat = b < level.durationBeats - 2 && !(barPos === 3 && level.id <= 3);
    if (allowOffbeat && rand() < level.offbeatChance) {
      const offLane = ((lane + (rand() < 0.5 ? 1 : 3)) % 4) as 0 | 1 | 2 | 3;
      const offChosen = pickItemForLane(offLane, b, offLane === uniqueLaneIdx && rand() < 0.4);
      notes.push({
        id: nextId++,
        beat: beat + 0.5,
        lane: offLane,
        item: offChosen.item,
        isUnique: offChosen.isUnique,
        midiNote: pickScaleMidi(b + 1, offLane, offChosen.isUnique),
        hitState: 'pending',
      });
      lastLane = offLane;
    } else {
      lastLane = lane;
    }
  }

  // Grand finishing flourish note of the level's unique item
  const finalBeat = LEAD_IN_BEATS + level.durationBeats + 1;
  notes.push({
    id: nextId++,
    beat: finalBeat,
    lane: uniqueLaneIdx,
    item: level.uniqueItem,
    isUnique: true,
    midiNote: activeRootMidi + 12,
    hitState: 'pending',
  });

  notes.sort((a, b) => a.beat - b.beat || a.lane - b.lane);
  return notes;
}

export function getLevelById(id: number): LevelDefinition {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}
