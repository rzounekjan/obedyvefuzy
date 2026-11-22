export type ItemType =
  | 'knife'
  | 'fork'
  | 'spoon'
  | 'cloth'
  | 'plate'
  | 'water'
  | 'beer'
  | 'shot'
  | 'napkin'
  | 'wine';

export type HitJudgement = 'perfect' | 'great' | 'good' | 'miss';

export type CalloutTone = 'positive' | 'negative';

export type ServiceCalloutKind =
  | 'super-service'
  | 'best'
  | 'bad-service'
  | 'manager'
  | 'fired-warning';

export interface ServiceCallout {
  kind: ServiceCalloutKind;
  label: string;
  tone: CalloutTone;
  seq: number;
}

export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export type MusicStyle = 'dubstep' | 'disco' | 'rnb';

export type MusicTrackId =
  | 'rnb-heartbreak'
  | 'rnb-raindrops'
  | 'rnb-cant-do'
  | 'disco-beach'
  | 'disco-funky'
  | 'disco-ultralounge'
  | 'dubstep-blank'
  | 'dubstep-bensound'
  | 'dubstep-savage'
  | 'dubstep-falling';

export type SciFiSfxMode = 'laser' | 'plasma' | 'photon';

export interface MusicTrack {
  id: MusicTrackId;
  index: number;
  style: MusicStyle;
  styleLabel: string;
  genre: string;
  shortGenre: string;
  title: string;
  artist: string;
  sourceLabel: string;
  youtubeId: string;
  startSeconds: number;
  bpm: number;
  accentHex: string;
  rootMidi: number;
  scaleIntervals: number[];
  chordProgression: number[][];
  sfxMode: SciFiSfxMode;
  sfxDescription: string;
}

export interface ItemDefinition {
  id: ItemType;
  name: string;
  shortName: string;
  accentHex: string;
  accentInt: number;
  emissiveInt: number;
  soundCharacter: string;
}

export interface LevelDefinition {
  id: number;
  name: string;
  subtitle: string;
  uniqueItem: ItemType;
  laneItems: [ItemType, ItemType, ItemType, ItemType];
  allItemsCycle?: boolean;
  bpm: number;
  durationBeats: number;
  difficulty: 'Lehká' | 'Střední' | 'Pokročilá' | 'Mistrovská';
  rootMidi: number;
  scaleIntervals: number[];
  chordProgression: number[][];
  grooveStyle: 'bistro' | 'swing' | 'waltz' | 'funk' | 'polka' | 'lounge' | 'finale';
  doubleNoteChance: number;
  offbeatChance: number;
  accentColor: string;
  accentInt: number;
}

export interface NoteEvent {
  id: number;
  beat: number;
  lane: 0 | 1 | 2 | 3;
  item: ItemType;
  isUnique: boolean;
  midiNote: number;
  hitState: 'pending' | 'hit' | 'missed';
  hitTime?: number;
}

export interface LanePrompt {
  lane: 0 | 1 | 2 | 3;
  item: ItemType;
  isUnique: boolean;
  /** 0 = far away, 1 = right on the strike line, >1 = slightly past */
  proximity: number;
  /** True when the note is inside the hittable timing window */
  inHitWindow: boolean;
  /** True when this lane belongs to the immediate next row arriving at the strike bar */
  isNextRow: boolean;
  /** True if there is an active approaching note in this lane */
  hasNote: boolean;
  /** Recent press feedback timestamp / judgement */
  flashKind: HitJudgement | null;
  flashSeq: number;
}

export interface HitStats {
  perfect: number;
  great: number;
  good: number;
  miss: number;
  uniqueHits: number;
  totalNotes: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  levelId: number;
  musicTrackId: MusicTrackId;
  score: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
  tempoIntegrity: number; // 0..100
  progress: number; // 0..1
  bpm: number;
  currentBeat: number;
  beatPulse: number; // 0..1
  lastJudgement: HitJudgement | null;
  lastJudgementIsUnique: boolean;
  lastJudgementPoints: number;
  judgementSeq: number;
  serviceCallout: ServiceCallout | null;
  lanePrompts: [LanePrompt, LanePrompt, LanePrompt, LanePrompt];
  stats: HitStats;
  accuracy: number; // 0..100
  stars: 0 | 1 | 2 | 3;
}

export interface LevelProgress {
  bestScore: number;
  bestAccuracy: number;
  maxCombo: number;
  stars: 0 | 1 | 2 | 3;
}

export type ProgressMap = Record<number, LevelProgress>;
