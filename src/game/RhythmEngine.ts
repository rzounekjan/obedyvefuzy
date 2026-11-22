import * as THREE from 'three';
import { RhythmAudioEngine } from './audioEngine';
import { createTablewareModelLibrary, type TablewareModelLibrary } from './itemModels';
import { generateLevelChart, getLevelById, ITEMS, LEAD_IN_BEATS } from './levels';
import { DEFAULT_MUSIC_TRACK_ID, getMusicTrackById } from './musicLibrary';
import type {
  GamePhase,
  HitJudgement,
  HitStats,
  HudSnapshot,
  ItemType,
  LanePrompt,
  LevelDefinition,
  MusicTrack,
  MusicTrackId,
  NoteEvent,
  ServiceCallout,
} from './types';

// --- Track Layout Constants (100% Decoupled from Music BPM for Silky-Smooth Constant Velocity) ---
const LANE_COUNT = 4;
const LANE_WIDTH = 1.85;
const TRACK_WIDTH = LANE_COUNT * LANE_WIDTH; // 7.4
const TRACK_LENGTH = 56;
const STRIKE_Z = 3.2;
const SPAWN_Z = -39;
const SCROLL_UNITS_PER_SEC = 10.6; // Constant smooth optical glide velocity independent of BPM
const HIGHWAY_BAR_COUNT = 12;
const HIGHWAY_BAR_SPACING = 4.2;
const LEAD_IN_SEC = 2.15;

// Timing windows (in seconds) — crisp, fair & 100% locked to visual strike-bar alignment
const PERFECT_SEC = 0.09;
const GREAT_SEC = 0.165;
const GOOD_SEC = 0.245;
const MISS_PASS_SEC = 0.265;

const LANE_X: readonly [number, number, number, number] = [
  -1.5 * LANE_WIDTH,
  -0.5 * LANE_WIDTH,
  0.5 * LANE_WIDTH,
  1.5 * LANE_WIDTH,
];

const ALL_ITEM_TYPES: readonly ItemType[] = [
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

// Reusable math objects outside render loop (zero GC)
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _baseColor = new THREE.Color();
const _targetColor = new THREE.Color();
const _ndc = new THREE.Vector2();
const _trackPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _planeHit = new THREE.Vector3();

interface ActiveTileVisual {
  note: NoteEvent;
  noteTimeSec: number;
  itemType: ItemType;
  baseItemScale: number;
  baseAccentHex: number;
  group: THREE.Group;
  trayMesh: THREE.Mesh;
  rimMat: THREE.MeshBasicMaterial;
  itemGroup: THREE.Group;
  hitAnim: number; // 0 = active, >0 = pop animation
  missedAnim: number;
}

interface ShockwaveRing {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  maxAge: number;
  active: boolean;
}

interface Particle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  scale: number;
  rotSpeed: number;
  rot: number;
  color: THREE.Color;
}

interface GpuTier {
  isSoftwareGl: boolean;
  isMobileLite: boolean;
}

function detectGpuTier(): GpuTier {
  let gpu = '';
  let isSoftwareGl = false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) {
      isSoftwareGl = true;
    } else {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      gpu = String(gl.getParameter(param) || '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    }
  } catch {
    isSoftwareGl = true;
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isTouchDevice =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(ua));
  const isEntryMobileGpu =
    /Mali-G57|Mali-G52|Mali-G31|Mali-G72|Mali-T|Adreno\s*\(TM\)\s*(3\d\d|4\d\d|5\d\d|61\d|62\d)|PowerVR|IMG/i.test(
      gpu,
    );

  return {
    isSoftwareGl,
    isMobileLite: !isSoftwareGl && (isTouchDevice || isEntryMobileGpu),
  };
}

/**
 * Pure Unlit Flat-Vector Arcade 3D Rhythm Engine.
 * - Zero lighting calculations (100% MeshBasicMaterial)
 * - Zero reflections / environment cubemaps
 * - Zero shadows (no shadow maps, no contact shadow decals)
 * - Zero transparency (100% opaque early-Z friendly geometry)
 * - Responsive camera framing & adaptive DPR for silky 60 FPS on Motorola Moto G14
 */
export class RhythmEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onLevelComplete?: (levelId: number, snapshot: HudSnapshot) => void;

  private isSoftwareGl: boolean;
  private isMobileLite: boolean;
  private lowPower: boolean;
  private maxPixelRatio: number;
  private currentPixelRatio: number;
  private perfFrameCount = 0;
  private perfFrameTimeAcc = 0;
  private perfHeadroomStreak = 0;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private modelLib: TablewareModelLibrary;
  public audio: RhythmAudioEngine;

  // Frame loop management & smooth VSync clock (100% decoupled from AudioContext quantum steps)
  private frameId = 0;
  private disposed = false;
  private lastTimeMs = 0;
  private prevSmoothDt = 0;
  private elapsedIdle = 0;

  // Game state
  private phase: GamePhase = 'title';
  private currentLevel: LevelDefinition = getLevelById(1);
  private currentTrack: MusicTrack = getMusicTrackById(DEFAULT_MUSIC_TRACK_ID);
  private notes: NoteEvent[] = [];
  private noteTimesSec: Float64Array = new Float64Array(0);
  private nextSpawnIdx = 0;
  private nextMissIdx = 0;
  private activeVisuals: Map<number, ActiveTileVisual> = new Map();
  private tilePool: Map<ItemType, ActiveTileVisual[]> = new Map();
  private toRemoveIds: number[] = [];
  private toRemoveVisuals: ActiveTileVisual[] = [];
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private tempoIntegrity = 100;
  private stats: HitStats = {
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
    uniqueHits: 0,
    totalNotes: 0,
  };
  private lastJudgement: HitJudgement | null = null;
  private lastJudgementIsUnique = false;
  private lastJudgementPoints = 0;
  private judgementSeq = 0;
  private hitStreak = 0;
  private missStreak = 0;
  private wasTempoBelow30 = false;
  private serviceCallout: ServiceCallout | null = null;
  private calloutSeq = 0;
  private laneFlashKind: (HitJudgement | null)[] = [null, null, null, null];
  private laneFlashSeq: number[] = [0, 0, 0, 0];
  private laneFlashTimer: number[] = [0, 0, 0, 0];
  private lanePressSpring: number[] = [0, 0, 0, 0];
  private lastEmittedProgressPct = -1;
  private cachedLanePrompts: [LanePrompt, LanePrompt, LanePrompt, LanePrompt];

  // Smooth continuous simulation timeline (seconds) — decoupled from BPM
  private simTimeSec = 0;
  private endTimeSec = 30;
  private pulsePhase = 0;
  private hitFlashPulse = 0;
  private playCameraSettled = false;
  private levelAccentColor = new THREE.Color(0xffd166);

  // Responsive viewport-adaptive camera metrics (ensures all 4 lanes fit on portrait phones)
  private portraitFactor = 0;
  private playCamBaseY = 6.55;
  private playCamBaseZ = 10.45;
  private playLookY = 0.35;
  private playLookZ = -4.4;

  // Scene objects (100% MeshBasicMaterial — zero lights, zero shadows, zero transparency)
  private beatLinesMesh!: THREE.InstancedMesh;
  private beatLineMat!: THREE.MeshBasicMaterial;
  private strikePads: THREE.Mesh[] = [];
  private strikePadMats: THREE.MeshBasicMaterial[] = [];
  private strikePadTrimMats: THREE.MeshBasicMaterial[] = [];
  private strikeBarMat!: THREE.MeshBasicMaterial;
  private eqMesh!: THREE.InstancedMesh;
  private eqPositionsX: Float32Array = new Float32Array(0);
  private eqPositionsZ: Float32Array = new Float32Array(0);
  private eqScalesY: Float32Array = new Float32Array(0);
  private eqBarMat!: THREE.MeshBasicMaterial;
  private archTrimMat!: THREE.MeshBasicMaterial;
  private showcaseTrimMat!: THREE.MeshBasicMaterial;

  // Title showcase hero turntable
  private showcaseGroup: THREE.Group;
  private showcaseItemMesh: THREE.Group | null = null;

  // Pooled effects (zero GC, 100% opaque, O(1) idle early-out)
  private shockwaves: ShockwaveRing[] = [];
  private activeShockwaveCount = 0;
  private particles: Particle[] = [];
  private activeParticleCount = 0;
  private particleMesh!: THREE.InstancedMesh;
  private maxParticles = 120;

  // Raycaster for direct 3D lane tap against mathematical y=0 plane
  private raycaster = new THREE.Raycaster();

  // Shared tile geometries & unlit opaque materials
  private geoTileOutline: THREE.BoxGeometry;
  private geoTileBase: THREE.BoxGeometry;
  private geoTileRim: THREE.BoxGeometry;
  private matTileOutline: THREE.MeshBasicMaterial;
  private matTileBody: THREE.MeshBasicMaterial;
  private matTileBodyUnique: THREE.MeshBasicMaterial;

  // Tracked environment geometries/materials for clean dispose
  private disposableEnvGeos: THREE.BufferGeometry[] = [];
  private disposableEnvMats: THREE.Material[] = [];

  // Bound event listeners
  private boundResize: () => void;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundContextLost: (e: Event) => void;
  private boundContextRestored: () => void;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onLevelComplete?: (levelId: number, snapshot: HudSnapshot) => void,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onLevelComplete = onLevelComplete;

    const tier = detectGpuTier();
    this.isSoftwareGl = tier.isSoftwareGl;
    this.isMobileLite = tier.isMobileLite;
    this.lowPower = this.isSoftwareGl || this.isMobileLite;
    this.maxParticles = this.lowPower ? 56 : 140;

    // Silky-smooth 60 FPS pixel ratio budget (disabling MSAA & alpha compositing on Mali-G57 slashes fillrate ~60%)
    const dpr = window.devicePixelRatio || 1;
    this.maxPixelRatio = this.isSoftwareGl ? 1 : this.isMobileLite ? Math.min(dpr, 1.15) : Math.min(dpr, 2);
    this.currentPixelRatio = this.maxPixelRatio;

    this.cachedLanePrompts = this.createStaticLanePrompts(this.currentLevel);

    // 1. Renderer setup — unlit opaque arcade (zero alpha blend, zero MSAA on mobile, zero shadows, zero stencil)
    this.renderer = new THREE.WebGLRenderer({
      alpha: false,
      antialias: !this.lowPower,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setPixelRatio(this.currentPixelRatio);
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // 2. Scene — deep solid arcade midnight backdrop (no lights, no environment map, no fog)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0a16);

    // 3. Camera (responsive framing for desktop landscape & portrait mobile)
    const initW = container.clientWidth || window.innerWidth;
    const initH = Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(48, initW / initH, 0.1, 140);
    this.updateResponsiveCamera(initW, initH);
    this.camera.position.set(0, this.playCamBaseY, this.playCamBaseZ);
    this.camera.lookAt(0, this.playLookY, this.playLookZ);

    // 4. Vector Model Library & Audio
    this.modelLib = createTablewareModelLibrary();
    this.audio = new RhythmAudioEngine();

    // Shared flat arcade tile coaster geometries & opaque unlit materials
    this.geoTileOutline = new THREE.BoxGeometry(LANE_WIDTH - 0.14, 0.12, 1.66);
    this.geoTileRim = new THREE.BoxGeometry(LANE_WIDTH - 0.2, 0.15, 1.6);
    this.geoTileBase = new THREE.BoxGeometry(LANE_WIDTH - 0.34, 0.18, 1.46);

    this.matTileOutline = new THREE.MeshBasicMaterial({ color: 0x090814 });
    this.matTileBody = new THREE.MeshBasicMaterial({ color: 0x242048 });
    this.matTileBodyUnique = new THREE.MeshBasicMaterial({ color: 0x4f3006 });

    // 5. Build Unlit Arcade Track, Equalizers, Portal Arches, Effects & Showcase
    this.buildArcadeTrackAndEnvironment();
    this.buildPooledEffects();

    this.showcaseGroup = new THREE.Group();
    this.showcaseGroup.position.set(0, 0.45, 2.2);
    this.buildShowcasePedestal();
    this.scene.add(this.showcaseGroup);
    this.setShowcaseLevel(1);

    // Pre-warm tile pool & compile shaders on startup for zero mid-song stutter
    this.prewarmTilePool();
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
    this.hidePrewarmedPool();

    // Listeners
    this.boundResize = this.handleResize.bind(this);
    this.boundPointerDown = this.handleCanvasPointerDown.bind(this);
    this.boundContextLost = (e: Event) => {
      e.preventDefault();
      this.cancelLoop();
    };
    this.boundContextRestored = () => {
      this.lastTimeMs = performance.now();
      this.scheduleNextTick();
    };

    window.addEventListener('resize', this.boundResize);
    this.renderer.domElement.addEventListener('pointerdown', this.boundPointerDown);
    this.renderer.domElement.addEventListener('webglcontextlost', this.boundContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.boundContextRestored);

    this.emitHud(true);
    this.lastTimeMs = performance.now();
    this.tick(this.lastTimeMs);
  }

  private freezeStaticObject(obj: THREE.Object3D): void {
    obj.matrixAutoUpdate = false;
    obj.updateMatrix();
  }

  private createStaticLanePrompts(level: LevelDefinition): [LanePrompt, LanePrompt, LanePrompt, LanePrompt] {
    return [0, 1, 2, 3].map((lane) => {
      const item = level.laneItems[lane];
      return {
        lane: lane as 0 | 1 | 2 | 3,
        item,
        isUnique: item === level.uniqueItem,
        proximity: 0,
        inHitWindow: false,
        isNextRow: false,
        hasNote: false,
        flashKind: null,
        flashSeq: 0,
      };
    }) as [LanePrompt, LanePrompt, LanePrompt, LanePrompt];
  }

  private trackEnvGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.disposableEnvGeos.push(g);
    return g;
  }

  private trackEnvMat<T extends THREE.Material>(m: T): T {
    this.disposableEnvMats.push(m);
    return m;
  }

  private buildArcadeTrackAndEnvironment(): void {
    // Crisp solid dark arcade floor grid backdrop
    const floorGeo = this.trackEnvGeo(new THREE.PlaneGeometry(90, 110));
    const floorMat = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0x0b0a16 }));
    const hallFloor = new THREE.Mesh(floorGeo, floorMat);
    hallFloor.rotation.x = -Math.PI / 2;
    hallFloor.position.set(0, -0.45, -16);
    this.freezeStaticObject(hallFloor);
    this.scene.add(hallFloor);

    // Chunky dark outline base beneath the 4-lane highway
    const deckOutline = new THREE.Mesh(
      this.trackEnvGeo(new THREE.BoxGeometry(TRACK_WIDTH + 0.72, 0.36, TRACK_LENGTH)),
      this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0x090814 })),
    );
    deckOutline.position.set(0, -0.22, -16);
    this.freezeStaticObject(deckOutline);
    this.scene.add(deckOutline);

    // 4 alternating flat arcade lane strips (high contrast, zero texture overhead)
    const laneGeo = this.trackEnvGeo(new THREE.PlaneGeometry(LANE_WIDTH - 0.04, TRACK_LENGTH));
    const laneMatEven = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0x16142e }));
    const laneMatOdd = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0x1f1c3d }));
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const strip = new THREE.Mesh(laneGeo, lane % 2 === 0 ? laneMatEven : laneMatOdd);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(LANE_X[lane], -0.02, -16);
      this.freezeStaticObject(strip);
      this.scene.add(strip);
    }

    // Crisp outer arcade guard rails (bright amber top + hot-magenta inner trim)
    const railOuterGeo = this.trackEnvGeo(new THREE.BoxGeometry(0.22, 0.16, TRACK_LENGTH));
    const railInnerGeo = this.trackEnvGeo(new THREE.BoxGeometry(0.08, 0.2, TRACK_LENGTH));
    const railOuterMat = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0xff9f1c }));
    const railInnerMat = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0xff2a85 }));
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railOuterGeo, railOuterMat);
      rail.position.set(side * (TRACK_WIDTH / 2 + 0.22), 0.06, -16);
      this.freezeStaticObject(rail);
      this.scene.add(rail);

      const trim = new THREE.Mesh(railInnerGeo, railInnerMat);
      trim.position.set(side * (TRACK_WIDTH / 2 + 0.06), 0.06, -16);
      this.freezeStaticObject(trim);
      this.scene.add(trim);
    }

    // Crisp flat lane divider stripes (gold center divider, electric cyan side dividers)
    const dividerGeo = this.trackEnvGeo(new THREE.BoxGeometry(0.06, 0.03, TRACK_LENGTH));
    const divCyanMat = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    const divGoldMat = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    for (let i = 1; i < LANE_COUNT; i++) {
      const x = -TRACK_WIDTH / 2 + i * LANE_WIDTH;
      const div = new THREE.Mesh(dividerGeo, i === 2 ? divGoldMat : divCyanMat);
      div.position.set(x, 0.01, -16);
      this.freezeStaticObject(div);
      this.scene.add(div);
    }

    // Scrolling flat arcade speed bars batched into 1 single InstancedMesh draw call
    const beatLineGeo = this.trackEnvGeo(new THREE.BoxGeometry(TRACK_WIDTH - 0.1, 0.025, 0.1));
    this.beatLineMat = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0x3a346e }));
    this.beatLinesMesh = new THREE.InstancedMesh(beatLineGeo, this.beatLineMat, HIGHWAY_BAR_COUNT);
    this.beatLinesMesh.frustumCulled = false;
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.set(1, 1, 1);
    for (let i = 0; i < HIGHWAY_BAR_COUNT; i++) {
      _dummy.position.set(0, 0.015, STRIKE_Z - i * HIGHWAY_BAR_SPACING);
      _dummy.updateMatrix();
      this.beatLinesMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.beatLinesMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.beatLinesMesh);

    // Bold Arcade Strike Bar across all 4 lanes at z = STRIKE_Z
    this.strikeBarMat = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    const strikeBar = new THREE.Mesh(
      this.trackEnvGeo(new THREE.BoxGeometry(TRACK_WIDTH + 0.28, 0.06, 0.18)),
      this.strikeBarMat,
    );
    strikeBar.position.set(0, 0.03, STRIKE_Z);
    this.freezeStaticObject(strikeBar);
    this.scene.add(strikeBar);

    // 4 Opaque Arcade Strike Pads (framed dark pads that punch bright neon colors on hit)
    const padBorderGeo = this.trackEnvGeo(new THREE.BoxGeometry(LANE_WIDTH - 0.16, 0.06, 1.42));
    const padInnerGeo = this.trackEnvGeo(new THREE.BoxGeometry(LANE_WIDTH - 0.32, 0.08, 1.24));
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const trimMat = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      const padMat = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0x221d42 }));

      const padGroup = new THREE.Mesh(padBorderGeo, trimMat);
      padGroup.position.set(LANE_X[lane], 0.02, STRIKE_Z);
      const padInner = new THREE.Mesh(padInnerGeo, padMat);
      padInner.position.y = 0.01;
      this.freezeStaticObject(padInner);
      padGroup.add(padInner);

      this.scene.add(padGroup);
      this.strikePads.push(padGroup);
      this.strikePadMats.push(padMat);
      this.strikePadTrimMats.push(trimMat);
    }

    // Flanking Arcade Equalizer Columns batched into 1 single InstancedMesh draw call
    const eqGeo = this.trackEnvGeo(new THREE.BoxGeometry(0.36, 1.0, 0.56));
    eqGeo.translate(0, 0.5, 0);
    const plinthGeo = this.trackEnvGeo(new THREE.BoxGeometry(0.56, 0.26, 0.78));
    const plinthMat = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0x1b1738 }));
    this.eqBarMat = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0xff9f1c }));

    const eqCount = this.lowPower ? 7 : 11;
    const eqStep = this.lowPower ? 5.2 : 3.4;
    const totalEq = eqCount * 2;
    this.eqMesh = new THREE.InstancedMesh(eqGeo, this.eqBarMat, totalEq);
    this.eqMesh.frustumCulled = false;
    this.eqPositionsX = new Float32Array(totalEq);
    this.eqPositionsZ = new Float32Array(totalEq);
    this.eqScalesY = new Float32Array(totalEq);

    const plinthMesh = new THREE.InstancedMesh(plinthGeo, plinthMat, totalEq);
    plinthMesh.frustumCulled = false;

    let idx = 0;
    for (let i = 0; i < eqCount; i++) {
      const z = STRIKE_Z - 2.4 - i * eqStep;
      for (const side of [-1, 1]) {
        const x = side * (TRACK_WIDTH / 2 + 1.28);
        const initScaleY = 0.6 + (i % 3) * 0.22;
        this.eqPositionsX[idx] = x;
        this.eqPositionsZ[idx] = z;
        this.eqScalesY[idx] = initScaleY;

        _dummy.position.set(x, -0.32, z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        plinthMesh.setMatrixAt(idx, _dummy.matrix);

        _dummy.position.set(x, -0.19, z);
        _dummy.scale.set(1, initScaleY, 1);
        _dummy.updateMatrix();
        this.eqMesh.setMatrixAt(idx, _dummy.matrix);
        idx++;
      }
    }
    plinthMesh.instanceMatrix.needsUpdate = true;
    this.freezeStaticObject(plinthMesh);
    this.scene.add(plinthMesh);

    this.eqMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.eqMesh);

    // Overhead Flat-Vector Arcade Portal Arches (static frozen transforms)
    const postGeo = this.trackEnvGeo(new THREE.BoxGeometry(0.24, 5.4, 0.24));
    const beamGeo = this.trackEnvGeo(new THREE.BoxGeometry(TRACK_WIDTH + 3.4, 0.28, 0.28));
    const beamTrimGeo = this.trackEnvGeo(new THREE.BoxGeometry(TRACK_WIDTH + 3.1, 0.12, 0.34));
    const archBodyMat = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0x1c183b }));
    this.archTrimMat = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0xff2a85 }));

    const archCount = this.lowPower ? 4 : 5;
    for (let i = 0; i < archCount; i++) {
      const z = -4 - i * 8.5;
      const arch = new THREE.Group();
      arch.position.set(0, 0, z);

      const leftPost = new THREE.Mesh(postGeo, archBodyMat);
      leftPost.position.set(-(TRACK_WIDTH / 2 + 1.58), 2.5, 0);
      this.freezeStaticObject(leftPost);

      const rightPost = new THREE.Mesh(postGeo, archBodyMat);
      rightPost.position.set(TRACK_WIDTH / 2 + 1.58, 2.5, 0);
      this.freezeStaticObject(rightPost);

      const topBeam = new THREE.Mesh(beamGeo, archBodyMat);
      topBeam.position.set(0, 5.2, 0);
      this.freezeStaticObject(topBeam);

      const trim = new THREE.Mesh(beamTrimGeo, this.archTrimMat);
      trim.position.set(0, 5.02, 0);
      this.freezeStaticObject(trim);

      arch.add(leftPost, rightPost, topBeam, trim);
      this.freezeStaticObject(arch);
      this.scene.add(arch);
    }
  }

  private buildShowcasePedestal(): void {
    // Crisp flat-vector arcade turntable visible on Title Screen
    const segs = 20;
    const base = new THREE.Mesh(
      this.trackEnvGeo(new THREE.CylinderGeometry(1.48, 1.68, 0.28, segs)),
      this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0x1a1736 })),
    );
    base.position.y = -0.14;
    this.showcaseGroup.add(base);

    this.showcaseTrimMat = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    const trim = new THREE.Mesh(
      this.trackEnvGeo(new THREE.TorusGeometry(1.5, 0.06, 8, 24)),
      this.showcaseTrimMat,
    );
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 0.01;
    this.showcaseGroup.add(trim);

    const topDisc = new THREE.Mesh(
      this.trackEnvGeo(new THREE.CylinderGeometry(1.36, 1.36, 0.04, segs)),
      this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0x2a2457 })),
    );
    topDisc.position.y = 0.02;
    this.showcaseGroup.add(topDisc);
  }

  private buildPooledEffects(): void {
    // 1. Opaque expanding arcade shockwave rings at strike bar (zero transparency!)
    const ringGeo = this.trackEnvGeo(new THREE.RingGeometry(0.46, 0.62, 18));
    const ringCount = this.lowPower ? 8 : 12;
    for (let i = 0; i < ringCount; i++) {
      const mat = this.trackEnvMat(
        new THREE.MeshBasicMaterial({
          color: 0xffd166,
          side: THREE.DoubleSide,
        }),
      );
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, 0.09, STRIKE_Z);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shockwaves.push({ mesh, mat, age: 0, maxAge: 0.28, active: false });
    }

    // 2. Opaque pooled arcade vector diamond shards via InstancedMesh
    const pGeo = this.trackEnvGeo(new THREE.OctahedronGeometry(0.1, 0));
    const pMat = this.trackEnvMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, this.maxParticles);
    this.particleMesh.frustumCulled = false;

    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(0, -100, 0),
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 0.45,
        scale: 0,
        rotSpeed: 4,
        rot: 0,
        color: new THREE.Color(0xffd166),
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, _color.setHex(0xffd166));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.particleMesh);
  }

  public setShowcaseLevel(levelId: number): void {
    const level = getLevelById(levelId);
    this.currentLevel = level;
    this.cachedLanePrompts = this.createStaticLanePrompts(level);
    this.levelAccentColor.setHex(level.accentInt);

    if (this.showcaseItemMesh) {
      this.showcaseGroup.remove(this.showcaseItemMesh);
      this.showcaseItemMesh = null;
    }

    const mesh = this.modelLib.createItemMesh(level.uniqueItem);
    mesh.scale.multiplyScalar(1.65);
    mesh.position.y = 0.08;
    this.showcaseGroup.add(mesh);
    this.showcaseItemMesh = mesh;

    this.showcaseTrimMat.color.setHex(level.accentInt);
    this.archTrimMat.color.setHex(level.accentInt);
    this.emitHud(true);
  }

  public setMusicTrack(trackId: MusicTrackId): void {
    const track = getMusicTrackById(trackId);
    this.currentTrack = track;
    this.audio.cueMusicTrack(track);
    this.emitHud(true);
  }

  public startMusicPreview(trackId: MusicTrackId): void {
    const track = getMusicTrackById(trackId);
    this.currentTrack = track;
    this.audio.startPreview(track);
    this.emitHud(true);
  }

  public stopMusicPreview(): void {
    this.audio.stopPreview();
  }

  public startLevel(levelId: number, trackId?: MusicTrackId): void {
    const level = getLevelById(levelId);
    const track = trackId ? getMusicTrackById(trackId) : this.currentTrack;
    this.currentLevel = level;
    this.currentTrack = track;
    this.cachedLanePrompts = this.createStaticLanePrompts(level);
    this.levelAccentColor.setHex(level.accentInt);
    this.clearActiveTiles();

    this.notes = generateLevelChart(level, track);

    // Precompute smooth arrival timestamps strictly from the level's optimal arcade pace
    // (100% decoupled from the selected music track's BPM and AudioContext buffer quanta)
    const levelStepSec = 60 / level.bpm;
    this.noteTimesSec = new Float64Array(this.notes.length);
    for (let i = 0; i < this.notes.length; i++) {
      this.noteTimesSec[i] = LEAD_IN_SEC + (this.notes[i].beat - LEAD_IN_BEATS) * levelStepSec;
    }
    const lastNoteSec =
      this.notes.length > 0 ? this.noteTimesSec[this.notes.length - 1] : LEAD_IN_SEC + 30;
    this.endTimeSec = lastNoteSec + 1.65;
    this.nextSpawnIdx = 0;
    this.nextMissIdx = 0;

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.tempoIntegrity = 100;
    this.stats = {
      perfect: 0,
      great: 0,
      good: 0,
      miss: 0,
      uniqueHits: 0,
      totalNotes: this.notes.length,
    };
    this.lastJudgement = null;
    this.lastJudgementIsUnique = false;
    this.lastJudgementPoints = 0;
    this.hitStreak = 0;
    this.missStreak = 0;
    this.wasTempoBelow30 = false;
    this.serviceCallout = null;
    this.simTimeSec = 0;
    this.pulsePhase = 0;
    this.hitFlashPulse = 0;
    this.playCameraSettled = false;
    this.prevSmoothDt = 0;
    this.lastEmittedProgressPct = 0;
    this.perfFrameCount = 0;
    this.perfFrameTimeAcc = 0;
    this.perfHeadroomStreak = 0;
    this.laneFlashKind = [null, null, null, null];
    this.laneFlashTimer = [0, 0, 0, 0];

    this.showcaseGroup.visible = false;
    this.archTrimMat.color.setHex(level.accentInt);
    this.phase = 'playing';

    this.audio.startTrack(level, track);
    this.emitHud(true);
  }

  public pauseGame(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.audio.pause();
    this.emitHud(true);
  }

  public resumeGame(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.prevSmoothDt = 0;
    this.audio.resume();
    this.emitHud(true);
  }

  public returnToTitle(levelId?: number): void {
    this.audio.stop();
    this.clearActiveTiles();
    this.phase = 'title';
    this.playCameraSettled = false;
    this.showcaseGroup.visible = true;
    this.setShowcaseLevel(levelId ?? this.currentLevel.id);
    this.emitHud(true);
  }

  public toggleMute(): boolean {
    const next = !this.audio.isMuted();
    this.audio.setMuted(next);
    return next;
  }

  /**
   * Player presses a lane (via D/F/J/K, 1/2/3/4, or direct 3D lane tap).
   */
  public triggerLane(lane: 0 | 1 | 2 | 3): void {
    if (this.phase !== 'playing') return;

    this.lanePressSpring[lane] = 1.0;

    let bestNote: NoteEvent | null = null;
    let bestAbsSec = Infinity;

    for (let i = this.nextMissIdx; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.hitState !== 'pending') continue;
      const deltaSec = this.noteTimesSec[i] - this.simTimeSec;
      if (deltaSec > GOOD_SEC + 0.1) break;
      if (n.lane !== lane) continue;
      const absSec = Math.abs(deltaSec);
      if (absSec < bestAbsSec) {
        bestAbsSec = absSec;
        bestNote = n;
      }
    }

    if (bestNote && bestAbsSec <= GOOD_SEC) {
      let judgement: HitJudgement = 'good';
      let basePts = 40;
      let healthGain = 0.8;

      if (bestAbsSec <= PERFECT_SEC) {
        judgement = 'perfect';
        basePts = 100;
        healthGain = 4.0;
      } else if (bestAbsSec <= GREAT_SEC) {
        judgement = 'great';
        basePts = 70;
        healthGain = 2.0;
      }

      if (bestNote.isUnique) {
        basePts *= 2;
        this.stats.uniqueHits += 1;
      }

      bestNote.hitState = 'hit';
      bestNote.hitTime = this.simTimeSec;

      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.missStreak = 0;
      this.hitStreak += 1;
      const mult = this.getMultiplier();
      const gained = basePts * mult;
      this.score += gained;
      this.tempoIntegrity = Math.min(100, this.tempoIntegrity + healthGain);
      if (this.tempoIntegrity >= 30) {
        this.wasTempoBelow30 = false;
      }
      this.stats[judgement] += 1;

      if (this.hitStreak >= 6 && this.hitStreak % 6 === 0) {
        this.calloutSeq += 1;
        this.serviceCallout = {
          kind: 'best',
          label: 'JSI NEJLEPŠÍ',
          tone: 'positive',
          seq: this.calloutSeq,
        };
      } else if (this.hitStreak % 3 === 0) {
        this.calloutSeq += 1;
        this.serviceCallout = {
          kind: 'super-service',
          label: 'SUPER SERVIS',
          tone: 'positive',
          seq: this.calloutSeq,
        };
      }

      this.lastJudgement = judgement;
      this.lastJudgementIsUnique = bestNote.isUnique;
      this.lastJudgementPoints = gained;
      this.judgementSeq += 1;

      this.laneFlashKind[lane] = judgement;
      this.laneFlashSeq[lane] += 1;
      this.laneFlashTimer[lane] = 0.28;

      // Crisp arcade visual & audio feedback (zero hitstop stutter!)
      const itemDef = ITEMS[bestNote.item];
      const burstColor = bestNote.isUnique ? 0xffd166 : itemDef.accentInt;
      this.spawnShockwave(LANE_X[lane], burstColor, bestNote.isUnique ? 1.3 : 1.0);
      const particleCount = this.lowPower
        ? bestNote.isUnique
          ? 9
          : judgement === 'perfect'
            ? 6
            : 4
        : bestNote.isUnique
          ? 18
          : judgement === 'perfect'
            ? 12
            : 8;
      this.spawnParticleBurst(LANE_X[lane], 0.55, STRIKE_Z, burstColor, particleCount);

      if (judgement === 'perfect') {
        this.hitFlashPulse = Math.min(1.0, this.hitFlashPulse + (bestNote.isUnique ? 0.65 : 0.35));
      }

      const visual = this.activeVisuals.get(bestNote.id);
      if (visual) {
        visual.hitAnim = 0.001;
      }

      this.audio.playItemHit(bestNote.item, bestNote.midiNote, judgement, bestNote.isUnique);
      this.emitHud(true);
    } else {
      this.registerMiss(lane, false);
    }
  }

  private registerMiss(lane: 0 | 1 | 2 | 3, fromPassedNote: boolean): void {
    this.combo = 0;
    this.hitStreak = 0;
    this.missStreak += 1;
    this.stats.miss += 1;
    this.tempoIntegrity = Math.max(0, this.tempoIntegrity - (fromPassedNote ? 12 : 7));

    const droppedBelow30 = this.tempoIntegrity > 0 && this.tempoIntegrity < 30 && !this.wasTempoBelow30;
    if (this.tempoIntegrity < 30) {
      this.wasTempoBelow30 = true;
    }

    if (droppedBelow30) {
      this.calloutSeq += 1;
      this.serviceCallout = {
        kind: 'fired-warning',
        label: 'DOSTANEŠ PADÁKA',
        tone: 'negative',
        seq: this.calloutSeq,
      };
    } else if (this.tempoIntegrity > 0 && this.missStreak >= 6 && this.missStreak % 6 === 0) {
      this.calloutSeq += 1;
      this.serviceCallout = {
        kind: 'manager',
        label: 'JDE PO TOBĚ MANAŽER',
        tone: 'negative',
        seq: this.calloutSeq,
      };
    } else if (this.tempoIntegrity > 0 && this.missStreak % 3 === 0) {
      this.calloutSeq += 1;
      this.serviceCallout = {
        kind: 'bad-service',
        label: 'ŠPATNÝ SERVIS',
        tone: 'negative',
        seq: this.calloutSeq,
      };
    }

    this.lastJudgement = 'miss';
    this.lastJudgementIsUnique = false;
    this.lastJudgementPoints = 0;
    this.judgementSeq += 1;

    this.laneFlashKind[lane] = 'miss';
    this.laneFlashSeq[lane] += 1;
    this.laneFlashTimer[lane] = 0.3;

    this.audio.playMiss();

    if (this.tempoIntegrity <= 0) {
      this.phase = 'gameover';
      this.audio.stop();
      this.audio.playGameOverCadence();
    }
    this.emitHud(true);
  }

  private getMultiplier(): number {
    if (this.combo >= 30) return 4;
    if (this.combo >= 20) return 3;
    if (this.combo >= 10) return 2;
    return 1;
  }

  private spawnShockwave(x: number, colorHex: number, scaleMult = 1): void {
    for (let i = 0; i < this.shockwaves.length; i++) {
      const sw = this.shockwaves[i];
      if (!sw.active) {
        sw.active = true;
        sw.age = 0;
        sw.maxAge = 0.28;
        sw.mesh.position.set(x, 0.09, STRIKE_Z);
        sw.mesh.scale.setScalar(0.65 * scaleMult);
        sw.mesh.visible = true;
        sw.mat.color.setHex(colorHex);
        this.activeShockwaveCount += 1;
        return;
      }
    }
  }

  private spawnParticleBurst(x: number, y: number, z: number, colorHex: number, count: number): void {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.age = 0;
        p.maxAge = 0.34 + Math.random() * 0.24;
        p.pos.set(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.4);
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.8 + Math.random() * 3.8;
        p.vel.set(Math.cos(angle) * speed, 3.4 + Math.random() * 4.2, Math.sin(angle) * speed * 0.8);
        p.scale = 0.75 + Math.random() * 0.9;
        p.rotSpeed = (Math.random() - 0.5) * 12;
        p.rot = Math.random() * Math.PI;
        p.color.setHex(spawned % 3 === 0 ? 0xffffff : colorHex);
        this.activeParticleCount += 1;
        spawned++;
      }
    }
  }

  private buildFreshTileVisual(itemType: ItemType): ActiveTileVisual {
    const group = new THREE.Group();

    // Static coaster sub-meshes have frozen local matrices (only parent `group` updates per frame)
    const outlineMesh = new THREE.Mesh(this.geoTileOutline, this.matTileOutline);
    outlineMesh.position.y = 0.06;
    this.freezeStaticObject(outlineMesh);
    group.add(outlineMesh);

    const itemDef = ITEMS[itemType];
    const rimMat = new THREE.MeshBasicMaterial({ color: itemDef.accentInt });
    const rimMesh = new THREE.Mesh(this.geoTileRim, rimMat);
    rimMesh.position.y = 0.075;
    this.freezeStaticObject(rimMesh);
    group.add(rimMesh);

    const trayMesh = new THREE.Mesh(this.geoTileBase, this.matTileBody);
    trayMesh.position.y = 0.09;
    this.freezeStaticObject(trayMesh);
    group.add(trayMesh);

    // Single-draw-call merged flat-vector 3D tableware icon
    const itemGroup = this.modelLib.createItemMesh(itemType);
    const baseItemScale = itemGroup.scale.x;
    itemGroup.position.y = 0.19;
    group.add(itemGroup);

    group.position.set(0, 0, SPAWN_Z);
    this.scene.add(group);

    return {
      note: null as unknown as NoteEvent,
      noteTimeSec: 0,
      itemType,
      baseItemScale,
      baseAccentHex: itemDef.accentInt,
      group,
      trayMesh,
      rimMat,
      itemGroup,
      hitAnim: 0,
      missedAnim: 0,
    };
  }

  private prewarmTilePool(): void {
    // Pre-allocate 5 pooled tiles per item type (50 total) so ZERO allocations occur mid-song
    const perType = 5;
    for (const itemType of ALL_ITEM_TYPES) {
      const bucket: ActiveTileVisual[] = [];
      for (let c = 0; c < perType; c++) {
        const vis = this.buildFreshTileVisual(itemType);
        vis.group.visible = c === 0;
        bucket.push(vis);
      }
      this.tilePool.set(itemType, bucket);
    }
  }

  private hidePrewarmedPool(): void {
    this.tilePool.forEach((bucket) => {
      for (const vis of bucket) {
        vis.group.visible = false;
      }
    });
  }

  private createTileVisual(note: NoteEvent, noteTimeSec: number): ActiveTileVisual {
    const bucket = this.tilePool.get(note.item);
    const vis = bucket && bucket.length > 0 ? bucket.pop()! : this.buildFreshTileVisual(note.item);

    const itemDef = ITEMS[note.item];
    const accentHex = note.isUnique ? 0xffd166 : itemDef.accentInt;
    vis.note = note;
    vis.noteTimeSec = noteTimeSec;
    vis.baseAccentHex = accentHex;
    vis.hitAnim = 0;
    vis.missedAnim = 0;
    vis.trayMesh.material = note.isUnique ? this.matTileBodyUnique : this.matTileBody;
    vis.rimMat.color.setHex(accentHex);

    vis.group.scale.set(1, 1, 1);
    vis.group.position.set(LANE_X[note.lane], 0, SPAWN_Z);
    vis.itemGroup.position.y = 0.19;
    vis.itemGroup.rotation.set(0, 0, 0);
    vis.itemGroup.scale.setScalar(vis.baseItemScale * (note.isUnique ? 1.08 : 0.96));
    vis.group.visible = true;

    return vis;
  }

  private removeTileVisual(id: number, visual: ActiveTileVisual): void {
    visual.group.visible = false;
    this.activeVisuals.delete(id);
    const bucket = this.tilePool.get(visual.itemType);
    if (bucket) bucket.push(visual);
    else this.tilePool.set(visual.itemType, [visual]);
  }

  private clearActiveTiles(): void {
    this.activeVisuals.forEach((v) => {
      v.group.visible = false;
      const bucket = this.tilePool.get(v.itemType);
      if (bucket) bucket.push(v);
      else this.tilePool.set(v.itemType, [v]);
    });
    this.activeVisuals.clear();
  }

  private handleCanvasPointerDown(e: PointerEvent): void {
    if (this.phase !== 'playing') return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(_ndc, this.camera);
    if (this.raycaster.ray.intersectPlane(_trackPlane, _planeHit)) {
      if (_planeHit.z >= -24 && _planeHit.z <= STRIKE_Z + 7.5) {
        const halfTrack = TRACK_WIDTH * 0.5;
        if (_planeHit.x >= -halfTrack - 0.5 && _planeHit.x <= halfTrack + 0.5) {
          const rawLane = Math.floor((_planeHit.x + halfTrack) / LANE_WIDTH);
          const lane = THREE.MathUtils.clamp(rawLane, 0, LANE_COUNT - 1) as 0 | 1 | 2 | 3;
          this.triggerLane(lane);
        }
      }
    }
  }

  private updateResponsiveCamera(width: number, height: number): void {
    const rawAspect = width / Math.max(1, height);
    const aspect = Math.max(0.36, rawAspect);

    // 0 on desktop/landscape (>= 1.15), smoothly ramps to 1 on tall portrait phones (<= 0.45)
    const portraitT = THREE.MathUtils.clamp((1.15 - aspect) / (1.15 - 0.45), 0, 1);
    this.portraitFactor = portraitT;

    const fov = THREE.MathUtils.lerp(48, 56, portraitT);
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov * 0.5));

    // Guarantee all 4 lanes (TRACK_WIDTH = 7.4) + both outer arcade rails + side margin
    // remain completely inside the horizontal frustum at the front edge of the strike pads.
    const strikeFrontZ = STRIKE_Z + 0.85;
    const requiredHalfWidth = TRACK_WIDTH * 0.5 + 0.62;
    const desktopFrontDepth = 8.43;
    const frontDepth = Math.max(desktopFrontDepth, requiredHalfWidth / (aspect * tanHalfFov));

    const pitchDeg = THREE.MathUtils.lerp(22.66, 32.5, portraitT);
    const pitchRad = THREE.MathUtils.degToRad(pitchDeg);
    const sinP = Math.sin(pitchRad);
    const cosP = Math.cos(pitchRad);

    const strikeDepth = frontDepth + (strikeFrontZ - STRIKE_Z) * cosP;
    const strikeNdcY = THREE.MathUtils.lerp(-0.792, -0.60, portraitT);
    const strikeVerticalOffset = strikeNdcY * strikeDepth * tanHalfFov;

    this.playCamBaseY = strikeDepth * sinP - strikeVerticalOffset * cosP;
    this.playCamBaseZ = STRIKE_Z + strikeDepth * cosP + strikeVerticalOffset * sinP;
    this.playLookY = this.playCamBaseY - 16.09 * sinP;
    this.playLookZ = this.playCamBaseZ - 16.09 * cosP;

    this.camera.fov = fov;
    this.camera.aspect = rawAspect;
    this.camera.updateProjectionMatrix();
  }

  private handleResize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.updateResponsiveCamera(w, h);
    this.playCameraSettled = false;
    this.renderer.setSize(w, h);
  }

  private updateSimulation(dt: number): void {
    this.hitFlashPulse = Math.max(0, this.hitFlashPulse - dt * 4.0);

    for (let i = 0; i < LANE_COUNT; i++) {
      if (this.lanePressSpring[i] > 0) {
        this.lanePressSpring[i] = Math.max(0, this.lanePressSpring[i] - dt * 7.0);
      }
      if (this.laneFlashTimer[i] > 0) {
        this.laneFlashTimer[i] = Math.max(0, this.laneFlashTimer[i] - dt);
        if (this.laneFlashTimer[i] === 0) {
          this.laneFlashKind[i] = null;
        }
      }
    }

    if (this.phase === 'title') {
      this.elapsedIdle += dt;
      const orbitAngle = Math.sin(this.elapsedIdle * 0.28) * 0.42;
      const targetCamX = Math.sin(orbitAngle) * (3.8 - this.portraitFactor * 0.8);
      const targetCamY = 3.2 + this.portraitFactor * 0.75 + Math.sin(this.elapsedIdle * 0.45) * 0.25;
      const targetCamZ = 7.4 + this.portraitFactor * 2.5 + Math.cos(orbitAngle) * 0.8;

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 3.5, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 3.5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 3.5, dt);
      this.camera.lookAt(0, 1.05 - this.portraitFactor * 0.25, 1.5);

      if (this.showcaseItemMesh) {
        this.showcaseItemMesh.rotation.y = this.elapsedIdle * 0.9;
        this.showcaseItemMesh.position.y = 0.08 + Math.sin(this.elapsedIdle * 2.2) * 0.06;
      }

      this.updateHighwayAndEqualizer(this.elapsedIdle * 0.45, 0.22 + 0.14 * Math.sin(this.elapsedIdle * 2.4), dt);
      this.updateParticlesAndShockwaves(dt);
      return;
    }

    // Rock-steady gameplay camera: glides smoothly in from Title, then locks with ZERO jitter or bobbing
    if (!this.playCameraSettled) {
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, 0, 12, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.playCamBaseY, 12, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.playCamBaseZ, 12, dt);
      this.camera.lookAt(0, this.playLookY, this.playLookZ);

      if (
        Math.abs(this.camera.position.x) < 0.002 &&
        Math.abs(this.camera.position.y - this.playCamBaseY) < 0.002 &&
        Math.abs(this.camera.position.z - this.playCamBaseZ) < 0.002
      ) {
        this.camera.position.set(0, this.playCamBaseY, this.playCamBaseZ);
        this.camera.lookAt(0, this.playLookY, this.playLookZ);
        this.playCameraSettled = true;
      }
    }

    if (this.phase === 'playing') {
      this.audio.update();

      // Advance pure VSync monotonic clock (100% decoupled from BPM & AudioContext quanta)
      this.simTimeSec += dt;
      this.pulsePhase += dt * 3.2;

      const ambientWave = 0.22 + 0.16 * Math.sin(this.pulsePhase * 2.0);
      const visualPulse = Math.min(1, ambientWave + this.hitFlashPulse * 0.78);

      this.updateNotesAndTiles(dt);
      this.updateHighwayAndEqualizer(this.simTimeSec, visualPulse, dt);

      if (this.simTimeSec >= this.endTimeSec && this.phase === 'playing') {
        this.phase = 'victory';
        this.audio.stop();
        this.audio.playVictoryFanfare();
        const snap = this.buildHudSnapshot();
        this.onHudUpdate(snap);
        this.onLevelComplete?.(this.currentLevel.id, snap);
        return;
      }

      // Only emit React HUD update when integer progress % changes (eliminates ~90% of wasted React renders!)
      const progressPct = Math.round(THREE.MathUtils.clamp(this.simTimeSec / this.endTimeSec, 0, 1) * 100);
      if (progressPct !== this.lastEmittedProgressPct) {
        this.lastEmittedProgressPct = progressPct;
        this.emitHud(false);
      }
    } else {
      this.updateHighwayAndEqualizer(this.simTimeSec, this.hitFlashPulse * 0.35, dt);
    }

    this.updateParticlesAndShockwaves(dt);
  }

  private updateNotesAndTiles(dt: number): void {
    const spawnLookaheadSec = (STRIKE_Z - SPAWN_Z) / SCROLL_UNITS_PER_SEC;
    const totalNotes = this.notes.length;

    // O(1) amortized spawning cursor (never rescans already-spawned notes)
    while (this.nextSpawnIdx < totalNotes) {
      const noteTime = this.noteTimesSec[this.nextSpawnIdx];
      if (noteTime - this.simTimeSec > spawnLookaheadSec) break;
      const note = this.notes[this.nextSpawnIdx];
      if (note.hitState === 'pending' && !this.activeVisuals.has(note.id)) {
        this.activeVisuals.set(note.id, this.createTileVisual(note, noteTime));
      }
      this.nextSpawnIdx += 1;
    }

    // O(1) amortized miss-detection cursor
    while (this.nextMissIdx < totalNotes) {
      const note = this.notes[this.nextMissIdx];
      if (note.hitState !== 'pending') {
        this.nextMissIdx += 1;
        continue;
      }
      if (this.simTimeSec - this.noteTimesSec[this.nextMissIdx] > MISS_PASS_SEC) {
        note.hitState = 'missed';
        const vis = this.activeVisuals.get(note.id);
        if (vis) vis.missedAnim = 0.001;
        this.nextMissIdx += 1;
        this.registerMiss(note.lane, true);
        if (this.phase !== 'playing') return;
      } else {
        break;
      }
    }

    this.toRemoveIds.length = 0;
    this.toRemoveVisuals.length = 0;

    this.activeVisuals.forEach((vis, id) => {
      if (vis.hitAnim > 0) {
        vis.hitAnim += dt * 5.4;
        const t = Math.min(1, vis.hitAnim);
        const popScale = t < 0.35 ? 1 + t * 1.15 : Math.max(0.01, (1 - t) * 2.15);
        vis.group.scale.setScalar(popScale);
        vis.group.position.y = t * 1.45;
        vis.itemGroup.rotation.y += dt * 15;
        vis.rimMat.color.setHex(0xffffff);
        if (t >= 1) {
          this.toRemoveIds.push(id);
          this.toRemoveVisuals.push(vis);
        }
        return;
      }

      if (vis.missedAnim > 0) {
        vis.missedAnim += dt * 4.4;
        const t = Math.min(1, vis.missedAnim);
        vis.group.position.z = STRIKE_Z + (this.simTimeSec - vis.noteTimeSec) * SCROLL_UNITS_PER_SEC;
        vis.group.position.y = -t * 0.9;
        vis.group.scale.setScalar(Math.max(0.01, 1 - t));
        vis.rimMat.color.setHex(0xff3b6b);
        if (t >= 1) {
          this.toRemoveIds.push(id);
          this.toRemoveVisuals.push(vis);
        }
        return;
      }

      // Pure constant-velocity glide (zero BPM coupling, zero vertical bounce jitter!)
      const deltaSec = vis.noteTimeSec - this.simTimeSec;
      const z = STRIKE_Z - deltaSec * SCROLL_UNITS_PER_SEC;
      vis.group.position.z = z;

      // Smooth opaque pop-in at far horizon
      const horizonDist = z - SPAWN_Z;
      const entryScale = horizonDist < 3.6 ? THREE.MathUtils.clamp(horizonDist / 3.6, 0.05, 1) : 1;
      vis.group.scale.setScalar(entryScale);

      // Unique 2x items spin smoothly with continuous time; standard items stay rock-steady & readable
      if (vis.note.isUnique) {
        vis.itemGroup.rotation.y = this.simTimeSec * 2.2 + vis.note.lane * 0.5;
      }

      // Highlight tile rim smoothly as it approaches the strike bar
      const absDeltaSec = Math.abs(deltaSec);
      if (absDeltaSec < 0.65) {
        const proximity = 1 - absDeltaSec / 0.65;
        _baseColor.setHex(vis.baseAccentHex);
        _targetColor.setHex(0xffffff);
        vis.rimMat.color.copy(_baseColor).lerp(_targetColor, proximity * 0.58);
      } else {
        vis.rimMat.color.setHex(vis.baseAccentHex);
      }
    });

    for (let i = 0; i < this.toRemoveIds.length; i++) {
      this.removeTileVisual(this.toRemoveIds[i], this.toRemoveVisuals[i]);
    }
  }

  private updateHighwayAndEqualizer(timeSec: number, pulse: number, dt: number): void {
    // Scroll highway bars at the EXACT same constant world velocity as tiles (1 single InstancedMesh draw call!)
    const scrollOffset = ((timeSec * SCROLL_UNITS_PER_SEC) % HIGHWAY_BAR_SPACING + HIGHWAY_BAR_SPACING) % HIGHWAY_BAR_SPACING;
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.set(1, 1, 1);
    for (let i = 0; i < HIGHWAY_BAR_COUNT; i++) {
      _dummy.position.set(0, 0.015, STRIKE_Z + scrollOffset - i * HIGHWAY_BAR_SPACING);
      _dummy.updateMatrix();
      this.beatLinesMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.beatLinesMesh.instanceMatrix.needsUpdate = true;

    const comboBoost = Math.min(this.combo, 30) / 30;
    const pulseClamped = THREE.MathUtils.clamp(pulse, 0, 1);

    // Subtle flat color energy shifts on highway bars, strike bar & portal arches
    _baseColor.setHex(0x302b5e);
    _targetColor.setHex(0x5b52ad);
    this.beatLineMat.color.copy(_baseColor).lerp(_targetColor, pulseClamped * 0.65);

    _baseColor.setHex(0xffd166);
    _targetColor.setHex(0xffffff);
    this.strikeBarMat.color.copy(_baseColor).lerp(_targetColor, pulseClamped * 0.55);

    _baseColor.copy(this.levelAccentColor);
    _targetColor.setHex(0xffffff);
    this.archTrimMat.color.copy(_baseColor).lerp(_targetColor, pulseClamped * 0.4);

    // Update 4 strike pads press depression & crisp solid hit color flashes
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const pad = this.strikePads[lane];
      const innerMat = this.strikePadMats[lane];
      const trimMat = this.strikePadTrimMats[lane];
      pad.position.y = 0.02 - this.lanePressSpring[lane] * 0.04;

      const flash = this.laneFlashKind[lane];
      if (flash === 'perfect') {
        innerMat.color.setHex(0xffd166);
        trimMat.color.setHex(0xffffff);
      } else if (flash === 'great') {
        innerMat.color.setHex(0x06d6a0);
        trimMat.color.setHex(0xffffff);
      } else if (flash === 'good') {
        innerMat.color.setHex(0x38bdf8);
        trimMat.color.setHex(0xffffff);
      } else if (flash === 'miss') {
        innerMat.color.setHex(0xff3b6b);
        trimMat.color.setHex(0xffb3c6);
      } else {
        const press = this.lanePressSpring[lane];
        _baseColor.setHex(0x221d42);
        _targetColor.setHex(0x473d85);
        innerMat.color.copy(_baseColor).lerp(_targetColor, Math.min(1, pulseClamped * 0.3 + press * 0.75));
        _baseColor.setHex(lane === 1 || lane === 2 ? 0xffd166 : 0x38bdf8);
        _targetColor.setHex(0xffffff);
        trimMat.color.copy(_baseColor).lerp(_targetColor, Math.min(1, pulseClamped * 0.25 + press * 0.6));
      }
    }

    // Equalizer side columns batched into 1 single InstancedMesh (smooth continuous wave)
    _baseColor.setHex(0xff9f1c);
    _targetColor.setHex(0xff2a85);
    this.eqBarMat.color.copy(_baseColor).lerp(_targetColor, Math.min(1, pulseClamped * 0.55 + comboBoost * 0.4));

    const totalEq = this.eqPositionsX.length;
    const waveBase = timeSec * 5.2;
    _dummy.rotation.set(0, 0, 0);
    for (let idx = 0; idx < totalEq; idx++) {
      const pairIdx = idx >> 1;
      const wave = 0.5 + 0.5 * Math.sin(waveBase - pairIdx * 0.65);
      const targetScaleY = 0.38 + (wave * 0.9 + pulseClamped * 1.15) * (1 + comboBoost * 0.4);
      const nextY = THREE.MathUtils.damp(this.eqScalesY[idx], targetScaleY, 12, dt);
      this.eqScalesY[idx] = nextY;

      _dummy.position.set(this.eqPositionsX[idx], -0.19, this.eqPositionsZ[idx]);
      _dummy.scale.set(1, nextY, 1);
      _dummy.updateMatrix();
      this.eqMesh.setMatrixAt(idx, _dummy.matrix);
    }
    this.eqMesh.instanceMatrix.needsUpdate = true;
  }

  private updateParticlesAndShockwaves(dt: number): void {
    // O(1) early-out when zero shockwaves are active
    if (this.activeShockwaveCount > 0) {
      for (let i = 0; i < this.shockwaves.length; i++) {
        const sw = this.shockwaves[i];
        if (!sw.active) continue;
        sw.age += dt;
        const t = sw.age / sw.maxAge;
        if (t >= 1) {
          sw.active = false;
          sw.mesh.visible = false;
          this.activeShockwaveCount = Math.max(0, this.activeShockwaveCount - 1);
          continue;
        }
        const easeOut = 1 - Math.pow(1 - t, 3);
        sw.mesh.scale.setScalar(0.65 + easeOut * 1.85);
      }
    }

    // O(1) early-out when zero particles are active (avoids GPU buffer uploads when idle!)
    if (this.activeParticleCount === 0) return;

    let dirty = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      dirty = true;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        this.activeParticleCount = Math.max(0, this.activeParticleCount - 1);
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      const t = p.age / p.maxAge;
      p.vel.y -= 11.0 * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.rot += p.rotSpeed * dt;

      _dummy.position.copy(p.pos);
      _dummy.rotation.set(p.rot, p.rot * 0.7, 0);
      _dummy.scale.setScalar(p.scale * (1 - t));
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, p.color);
    }

    if (dirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private buildHudSnapshot(): HudSnapshot {
    const judged = this.stats.perfect + this.stats.great + this.stats.good + this.stats.miss;
    const weighted = this.stats.perfect * 1 + this.stats.great * 0.78 + this.stats.good * 0.45;
    const accuracy = judged > 0 ? Math.round((weighted / judged) * 100) : 100;
    const stars: 0 | 1 | 2 | 3 =
      this.phase === 'gameover' ? 0 : accuracy >= 90 ? 3 : accuracy >= 75 ? 2 : 1;

    const progress =
      this.endTimeSec > 0 ? THREE.MathUtils.clamp(this.simTimeSec / this.endTimeSec, 0, 1) : 0;

    return {
      phase: this.phase,
      levelId: this.currentLevel.id,
      musicTrackId: this.currentTrack.id,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      multiplier: this.getMultiplier(),
      tempoIntegrity: Math.round(this.tempoIntegrity),
      progress,
      bpm: this.currentTrack.bpm,
      currentBeat: this.simTimeSec * (this.currentLevel.bpm / 60),
      beatPulse: this.hitFlashPulse,
      lastJudgement: this.lastJudgement,
      lastJudgementIsUnique: this.lastJudgementIsUnique,
      lastJudgementPoints: this.lastJudgementPoints,
      judgementSeq: this.judgementSeq,
      serviceCallout: this.serviceCallout ? { ...this.serviceCallout } : null,
      lanePrompts: this.cachedLanePrompts,
      stats: { ...this.stats },
      accuracy,
      stars,
    };
  }

  private emitHud(_force: boolean): void {
    this.onHudUpdate(this.buildHudSnapshot());
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private cancelLoop(): void {
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.frameId = 0;
  }

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private updateAdaptiveResolution(rawDt: number): void {
    if (!this.isMobileLite || this.isSoftwareGl || this.phase !== 'playing') return;
    if (rawDt <= 0 || rawDt > 0.15) return;

    this.perfFrameCount += 1;
    this.perfFrameTimeAcc += rawDt;

    if (this.perfFrameCount < 40) return;

    const avgMs = (this.perfFrameTimeAcc / this.perfFrameCount) * 1000;
    this.perfFrameCount = 0;
    this.perfFrameTimeAcc = 0;

    if (avgMs > 19.5 && this.currentPixelRatio > 0.75) {
      this.perfHeadroomStreak = 0;
      this.currentPixelRatio = Math.max(0.75, Number((this.currentPixelRatio - 0.12).toFixed(2)));
      this.renderer.setPixelRatio(this.currentPixelRatio);
    } else if (avgMs < 15.5 && this.currentPixelRatio < this.maxPixelRatio) {
      this.perfHeadroomStreak += 1;
      if (this.perfHeadroomStreak >= 4) {
        this.perfHeadroomStreak = 0;
        this.currentPixelRatio = Math.min(
          this.maxPixelRatio,
          Number((this.currentPixelRatio + 0.08).toFixed(2)),
        );
        this.renderer.setPixelRatio(this.currentPixelRatio);
      }
    } else {
      this.perfHeadroomStreak = 0;
    }
  }

  private tick = (frameTimeMs?: number): void => {
    if (this.disposed) return;
    const now = typeof frameTimeMs === 'number' ? frameTimeMs : performance.now();
    const rawDt = now > this.lastTimeMs ? (now - this.lastTimeMs) / 1000 : 1 / 60;
    this.lastTimeMs = Math.max(this.lastTimeMs, now);

    const clampedDt = Math.min(Math.max(rawDt, 0.001), 0.05);
    // Sub-millisecond rAF jitter smoothing for glass-smooth visual frame pacing
    const dt =
      this.prevSmoothDt > 0 && Math.abs(clampedDt - this.prevSmoothDt) < this.prevSmoothDt * 0.35
        ? this.prevSmoothDt * 0.25 + clampedDt * 0.75
        : clampedDt;
    this.prevSmoothDt = dt;

    this.updateAdaptiveResolution(rawDt);
    this.updateSimulation(dt);
    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  };

  public dispose(): void {
    this.disposed = true;
    this.cancelLoop();

    window.removeEventListener('resize', this.boundResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.boundPointerDown);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.boundContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.boundContextRestored);

    this.clearActiveTiles();
    this.tilePool.forEach((bucket) => {
      for (const vis of bucket) {
        this.scene.remove(vis.group);
        vis.rimMat.dispose();
      }
    });
    this.tilePool.clear();

    this.audio.dispose();
    this.modelLib.dispose();

    this.geoTileOutline.dispose();
    this.geoTileBase.dispose();
    this.geoTileRim.dispose();
    this.matTileOutline.dispose();
    this.matTileBody.dispose();
    this.matTileBodyUnique.dispose();

    this.disposableEnvGeos.forEach((g) => g.dispose());
    this.disposableEnvMats.forEach((m) => m.dispose());

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
