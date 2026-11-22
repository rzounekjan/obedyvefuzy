import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RhythmAudioEngine } from './audioEngine';
import { createTablewareModelLibrary, type TablewareModelLibrary } from './itemModels';
import { generateLevelChart, getLevelById, ITEMS, LEAD_IN_BEATS } from './levels';
import { createProceduralTextures, type ProceduralTexturePack } from './textures';
import type {
  GamePhase,
  HitJudgement,
  HitStats,
  HudSnapshot,
  ItemType,
  LanePrompt,
  LevelDefinition,
  NoteEvent,
} from './types';

// --- Track Layout Constants ---
const LANE_COUNT = 4;
const LANE_WIDTH = 1.85;
const TRACK_WIDTH = LANE_COUNT * LANE_WIDTH; // 7.4
const TRACK_LENGTH = 56;
const STRIKE_Z = 3.2;
const SPAWN_Z = -39;
const UNITS_PER_BEAT = 4.6;

// Timing windows (in seconds) — crisp & fair
const PERFECT_SEC = 0.088;
const GREAT_SEC = 0.165;
const GOOD_SEC = 0.245;
const MISS_PASS_SEC = 0.265;

const LANE_X: readonly [number, number, number, number] = [
  -1.5 * LANE_WIDTH,
  -0.5 * LANE_WIDTH,
  0.5 * LANE_WIDTH,
  1.5 * LANE_WIDTH,
];

// Reusable math objects outside render loop (zero GC)
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _ndc = new THREE.Vector2();

interface ActiveTileVisual {
  note: NoteEvent;
  group: THREE.Group;
  trayMesh: THREE.Mesh;
  rimMat: THREE.MeshStandardMaterial;
  itemGroup: THREE.Group;
  hitAnim: number; // 0 = active, >0 = pop & fade animation
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

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class RhythmEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onLevelComplete?: (levelId: number, snapshot: HudSnapshot) => void;

  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private envTexture: THREE.Texture;
  private textures: ProceduralTexturePack;
  private modelLib: TablewareModelLibrary;
  public audio: RhythmAudioEngine;

  // Frame loop management
  private frameId = 0;
  private disposed = false;
  private lastTimeMs = 0;
  private lastHudEmitMs = 0;
  private elapsedIdle = 0;

  // Game state
  private phase: GamePhase = 'title';
  private currentLevel: LevelDefinition = getLevelById(1);
  private notes: NoteEvent[] = [];
  private activeVisuals: Map<number, ActiveTileVisual> = new Map();
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
  private laneFlashKind: (HitJudgement | null)[] = [null, null, null, null];
  private laneFlashSeq: number[] = [0, 0, 0, 0];
  private laneFlashTimer: number[] = [0, 0, 0, 0];
  private lanePressSpring: number[] = [0, 0, 0, 0];

  // Visual juice & beat reactivity
  private cameraShake = 0;
  private beatPulse = 0;
  private lastBeatInt = -1;
  private hitstopTimer = 0;
  private currentBeat = 0;

  // Scene objects
  private beatLines: THREE.Mesh[] = [];
  private strikePads: THREE.Mesh[] = [];
  private strikePadMats: THREE.MeshStandardMaterial[] = [];
  private strikeBarGlowMat!: THREE.MeshStandardMaterial;
  private eqBarsLeft: THREE.Mesh[] = [];
  private eqBarsRight: THREE.Mesh[] = [];
  private chandelierLights: THREE.PointLight[] = [];
  private chandelierBulbs: THREE.MeshStandardMaterial[] = [];
  private accentSpotLight!: THREE.PointLight;

  // Title showcase hero turntable
  private showcaseGroup: THREE.Group;
  private showcaseItemMesh: THREE.Group | null = null;
  private showcaseItemType: ItemType = 'knife';

  // Pooled effects (zero GC)
  private shockwaves: ShockwaveRing[] = [];
  private particles: Particle[] = [];
  private particleMesh!: THREE.InstancedMesh;
  private readonly MAX_PARTICLES = 240;

  // Raycasting for direct 3D lane tap
  private raycaster = new THREE.Raycaster();
  private laneProxies: THREE.Mesh[] = [];

  // Shared tile geometries & materials
  private geoTileBase: THREE.BoxGeometry;
  private geoTileRim: THREE.BoxGeometry;
  private geoContactPlane: THREE.PlaneGeometry;
  private matTileBody: THREE.MeshStandardMaterial;
  private matTileBodyUnique: THREE.MeshStandardMaterial;
  private matContactShadow: THREE.MeshBasicMaterial;

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

    this.isSoftwareGl = detectSoftwareWebGL();

    // 1. Renderer setup (Three.js r160+ PBR & Software-GL Guard)
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // 2. Scene & Horizon-matched Atmospheric Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x120e0b);
    this.scene.fog = new THREE.FogExp2(0x120e0b, 0.026);

    // 3. Camera
    const aspect = (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 120);
    this.camera.position.set(0, 6.6, 10.6);
    this.camera.lookAt(0, 0.4, -4.5);

    // 4. Studio Environment Map (RoomEnvironment on every device)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmrem.dispose();

    // 5. Textures, Models & Audio
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);
    this.modelLib = createTablewareModelLibrary(this.textures, this.isSoftwareGl);
    this.audio = new RhythmAudioEngine();

    // Shared tile coaster geometries/materials
    this.geoTileBase = new THREE.BoxGeometry(LANE_WIDTH - 0.24, 0.14, 1.56);
    this.geoTileRim = new THREE.BoxGeometry(LANE_WIDTH - 0.18, 0.05, 1.62);
    this.geoContactPlane = new THREE.PlaneGeometry(1.18, 1.18);
    this.matTileBody = new THREE.MeshStandardMaterial({
      color: 0x1e1713,
      roughness: 0.42,
      metalness: 0.22,
    });
    this.matTileBodyUnique = new THREE.MeshStandardMaterial({
      color: 0x332211,
      roughness: 0.28,
      metalness: 0.58,
      emissive: 0x4a2c05,
      emissiveIntensity: 0.35,
    });
    this.matContactShadow = new THREE.MeshBasicMaterial({
      map: this.textures.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.52,
    });

    // 6. Build Lighting, Bistro Environment, Track, Equalizers, Effects & Title Showcase
    this.buildLighting();
    this.buildEnvironmentAndTrack();
    this.buildPooledEffects();

    this.showcaseGroup = new THREE.Group();
    this.showcaseGroup.position.set(0, 0.45, 2.2);
    this.buildShowcasePedestal();
    this.scene.add(this.showcaseGroup);
    this.setShowcaseLevel(1);

    // Pre-compile shaders on hardware GPU
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

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
    this.tick();
  }

  private buildLighting(): void {
    // Cool indigo/slate hemisphere fill vs warm amber key light
    const hemi = new THREE.HemisphereLight(0x8fa8d4, 0x2b190d, 0.72);
    this.scene.add(hemi);

    // Warm bistro directional key light (single shadow caster)
    const key = new THREE.DirectionalLight(0xffe0b2, 1.85);
    key.position.set(7, 14, 9);
    if (!this.isSoftwareGl) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 42;
      const d = 14;
      key.shadow.camera.left = -d;
      key.shadow.camera.right = d;
      key.shadow.camera.top = d;
      key.shadow.camera.bottom = -d;
      key.shadow.bias = -0.0005;
      key.shadow.normalBias = 0.02;
    }
    this.scene.add(key);

    // Cool rim backlight separating cutlery & glass from dark hall
    const rim = new THREE.DirectionalLight(0x7fb4e8, 0.9);
    rim.position.set(-8, 8, -14);
    this.scene.add(rim);

    // Beat-reactive strike zone accent light
    this.accentSpotLight = new THREE.PointLight(0xe2b86b, 2.2, 22, 1.6);
    this.accentSpotLight.position.set(0, 3.6, STRIKE_Z);
    this.scene.add(this.accentSpotLight);
  }

  private buildEnvironmentAndTrack(): void {
    // Subtle dark dining hall floor extending to horizon fog
    const hallFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 110),
      new THREE.MeshStandardMaterial({
        color: 0x16110e,
        roughness: 0.85,
        metalness: 0.08,
      }),
    );
    hallFloor.rotation.x = -Math.PI / 2;
    hallFloor.position.set(0, -0.45, -16);
    this.scene.add(hallFloor);

    // Main elevated Walnut Dining Track
    const trackDeck = new THREE.Mesh(
      new THREE.BoxGeometry(TRACK_WIDTH + 0.5, 0.44, TRACK_LENGTH),
      new THREE.MeshStandardMaterial({
        map: this.textures.woodAlbedo,
        roughnessMap: this.textures.woodRoughness,
        roughness: 0.56,
        metalness: 0.08,
      }),
    );
    trackDeck.position.set(0, -0.22, -16);
    trackDeck.receiveShadow = true;
    this.scene.add(trackDeck);

    // Brushed Brass outer rails
    const railMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4a24c,
      metalness: 0.9,
      roughness: 0.24,
      anisotropy: 0.6,
    });
    const railGeo = new THREE.BoxGeometry(0.18, 0.14, TRACK_LENGTH);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(side * (TRACK_WIDTH / 2 + 0.22), 0.07, -16);
      this.scene.add(rail);
    }

    // Subtle brass lane divider inlays (offset Y >= 0.02 + polygonOffset to avoid Z-fighting)
    const dividerMat = new THREE.MeshStandardMaterial({
      color: 0x8f6b32,
      metalness: 0.85,
      roughness: 0.3,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const dividerGeo = new THREE.BoxGeometry(0.04, 0.025, TRACK_LENGTH);
    for (let i = 1; i < LANE_COUNT; i++) {
      const x = -TRACK_WIDTH / 2 + i * LANE_WIDTH;
      const div = new THREE.Mesh(dividerGeo, dividerMat);
      div.position.set(x, 0.02, -16);
      this.scene.add(div);
    }

    // Scrolling horizontal beat bars along the track
    const beatLineGeo = new THREE.BoxGeometry(TRACK_WIDTH - 0.12, 0.022, 0.075);
    const beatLineMat = new THREE.MeshStandardMaterial({
      color: 0x6b5028,
      emissive: 0x8c5f18,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.6,
    });
    for (let i = 0; i < 12; i++) {
      const line = new THREE.Mesh(beatLineGeo, beatLineMat);
      line.position.set(0, 0.025, STRIKE_Z - i * UNITS_PER_BEAT);
      this.scene.add(line);
      this.beatLines.push(line);
    }

    // Glowing Brass Strike Bar across all 4 lanes at z = STRIKE_Z
    this.strikeBarGlowMat = new THREE.MeshStandardMaterial({
      color: 0xf4c873,
      emissive: 0xd99b38,
      emissiveIntensity: 1.0,
      metalness: 0.78,
      roughness: 0.2,
    });
    const strikeBar = new THREE.Mesh(
      new THREE.BoxGeometry(TRACK_WIDTH + 0.24, 0.055, 0.14),
      this.strikeBarGlowMat,
    );
    strikeBar.position.set(0, 0.032, STRIKE_Z);
    this.scene.add(strikeBar);

    // 4 Interactive 3D Strike Pads (one per lane) + invisible raycast proxy planes on Layer 1
    const padGeo = new THREE.BoxGeometry(LANE_WIDTH - 0.18, 0.08, 1.38);
    const proxyGeo = new THREE.PlaneGeometry(LANE_WIDTH, 14);
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });

    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const padMat = new THREE.MeshStandardMaterial({
        color: 0x261c16,
        emissive: 0x3b2611,
        emissiveIntensity: 0.25,
        metalness: 0.55,
        roughness: 0.3,
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(LANE_X[lane], 0.02, STRIKE_Z);
      pad.receiveShadow = true;
      this.scene.add(pad);
      this.strikePads.push(pad);
      this.strikePadMats.push(padMat);

      // Raycast hit proxy covering lower lane area for easy direct canvas clicking/tapping
      const proxy = new THREE.Mesh(proxyGeo, proxyMat);
      proxy.rotation.x = -Math.PI / 2;
      proxy.position.set(LANE_X[lane], 0.06, STRIKE_Z - 3.5);
      proxy.userData = { lane };
      proxy.layers.set(1);
      this.scene.add(proxy);
      this.laneProxies.push(proxy);
    }
    this.raycaster.layers.set(1);

    // Flanking Beat-Synchronized 3D Spectrum Equalizer Columns (12 per side)
    const eqGeo = new THREE.BoxGeometry(0.32, 1.0, 0.55);
    eqGeo.translate(0, 0.5, 0); // pivot at bottom
    const pillarBaseGeo = new THREE.BoxGeometry(0.54, 0.26, 0.78);
    const pillarBaseMat = new THREE.MeshStandardMaterial({
      color: 0x221813,
      roughness: 0.55,
      metalness: 0.35,
    });

    for (let i = 0; i < 12; i++) {
      const z = STRIKE_Z - 2.2 - i * 3.1;
      for (const side of [-1, 1]) {
        const x = side * (TRACK_WIDTH / 2 + 1.25);

        const plinth = new THREE.Mesh(pillarBaseGeo, pillarBaseMat);
        plinth.position.set(x, -0.32, z);
        this.scene.add(plinth);

        const barMat = new THREE.MeshStandardMaterial({
          color: 0xe6b55c,
          emissive: 0xc88424,
          emissiveIntensity: 0.75,
          metalness: 0.65,
          roughness: 0.22,
        });
        const bar = new THREE.Mesh(eqGeo, barMat);
        bar.position.set(x, -0.19, z);
        bar.scale.y = 0.6 + (i % 3) * 0.25;
        this.scene.add(bar);

        if (side < 0) this.eqBarsLeft.push(bar);
        else this.eqBarsRight.push(bar);
      }
    }

    // Overhead Bistro Pendant Chandeliers stretching down the hall
    const cordGeo = new THREE.CylinderGeometry(0.018, 0.018, 3.8, 6);
    const shadeGeo = new THREE.ConeGeometry(0.46, 0.32, 16, 1, true);
    const bulbGeo = new THREE.SphereGeometry(0.14, 12, 10);
    const shadeMat = new THREE.MeshPhysicalMaterial({
      color: 0x2c2018,
      metalness: 0.75,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.7 });

    for (let i = 0; i < 5; i++) {
      const z = -2 - i * 8.5;
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xfff0cc,
        emissive: 0xffb84d,
        emissiveIntensity: 1.5,
        roughness: 0.2,
      });
      this.chandelierBulbs.push(bulbMat);

      for (const side of [-1, 1]) {
        const grp = new THREE.Group();
        grp.position.set(side * 4.4, 5.2, z);
        const cord = new THREE.Mesh(cordGeo, cordMat);
        cord.position.y = 1.9;
        const shade = new THREE.Mesh(shadeGeo, shadeMat);
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.y = -0.1;
        grp.add(cord, shade, bulb);
        this.scene.add(grp);
      }

      if (i < 2) {
        const pt = new THREE.PointLight(0xffc978, 1.2, 18, 1.8);
        pt.position.set(0, 4.6, z);
        this.scene.add(pt);
        this.chandelierLights.push(pt);
      }
    }
  }

  private buildShowcasePedestal(): void {
    // Elegant walnut & brass turntable visible on Title Screen
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.65, 0.28, 36),
      new THREE.MeshStandardMaterial({
        color: 0x261912,
        roughness: 0.4,
        metalness: 0.25,
      }),
    );
    base.position.y = -0.14;
    base.receiveShadow = true;
    this.showcaseGroup.add(base);

    const brassTrim = new THREE.Mesh(
      new THREE.TorusGeometry(1.46, 0.045, 12, 48),
      new THREE.MeshPhysicalMaterial({
        color: 0xe2b86b,
        metalness: 0.92,
        roughness: 0.18,
      }),
    );
    brassTrim.rotation.x = Math.PI / 2;
    brassTrim.position.y = 0.0;
    this.showcaseGroup.add(brassTrim);

    const velvetTop = new THREE.Mesh(
      new THREE.CylinderGeometry(1.38, 1.38, 0.04, 36),
      new THREE.MeshStandardMaterial({
        color: 0x3b181f,
        roughness: 0.85,
        metalness: 0.05,
      }),
    );
    velvetTop.position.y = 0.02;
    velvetTop.receiveShadow = true;
    this.showcaseGroup.add(velvetTop);
  }

  private buildPooledEffects(): void {
    // 1. Pooled expanding shockwave rings at strike bar
    const ringGeo = new THREE.RingGeometry(0.45, 0.62, 28);
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xf4c873,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, 0.08, STRIKE_Z);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shockwaves.push({ mesh, mat, age: 0, maxAge: 0.36, active: false });
    }

    // 2. Pooled 3D Sparkle Particles via InstancedMesh
    const pGeo = new THREE.OctahedronGeometry(0.085, 0);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, this.MAX_PARTICLES);
    this.particleMesh.frustumCulled = false;

    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(0, -100, 0),
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 0.5,
        scale: 0,
        rotSpeed: 4,
        rot: 0,
        color: new THREE.Color(0xf4c873),
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, _color.setHex(0xf4c873));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.particleMesh);
  }

  public setShowcaseLevel(levelId: number): void {
    const level = getLevelById(levelId);
    this.currentLevel = level;
    this.showcaseItemType = level.uniqueItem;

    if (this.showcaseItemMesh) {
      this.showcaseGroup.remove(this.showcaseItemMesh);
      this.showcaseItemMesh = null;
    }

    const mesh = this.modelLib.createItemMesh(level.uniqueItem);
    mesh.scale.multiplyScalar(1.65);
    mesh.position.y = 0.05;
    this.showcaseGroup.add(mesh);
    this.showcaseItemMesh = mesh;

    this.accentSpotLight.color.setHex(level.accentInt);
    this.emitHud(true);
  }

  public startLevel(levelId: number): void {
    const level = getLevelById(levelId);
    this.currentLevel = level;
    this.clearActiveTiles();

    this.notes = generateLevelChart(level);
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
    this.lastBeatInt = -1;
    this.currentBeat = 0;
    this.cameraShake = 0;
    this.hitstopTimer = 0;
    this.laneFlashKind = [null, null, null, null];
    this.laneFlashTimer = [0, 0, 0, 0];

    this.showcaseGroup.visible = false;
    this.accentSpotLight.color.setHex(level.accentInt);
    this.phase = 'playing';

    this.audio.startTrack(level);
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
    this.audio.resume();
    this.emitHud(true);
  }

  public returnToTitle(levelId?: number): void {
    this.audio.stop();
    this.clearActiveTiles();
    this.phase = 'title';
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
   * Player presses a lane (via D/F/J/K, 1/2/3/4, Top Symbol Bar click, or 3D lane click).
   */
  public triggerLane(lane: 0 | 1 | 2 | 3): void {
    if (this.phase !== 'playing') return;

    this.lanePressSpring[lane] = 1.0;

    const secPerBeat = 60 / this.currentLevel.bpm;
    let bestNote: NoteEvent | null = null;
    let bestAbsSec = Infinity;

    for (let i = 0; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.hitState !== 'pending' || n.lane !== lane) continue;
      const diffSec = Math.abs((n.beat - this.currentBeat) * secPerBeat);
      if (diffSec < bestAbsSec) {
        bestAbsSec = diffSec;
        bestNote = n;
      }
      // Notes are sorted by beat; once far in the future we can stop
      if ((n.beat - this.currentBeat) * secPerBeat > GOOD_SEC + 0.1) break;
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
      bestNote.hitTime = this.currentBeat;

      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      const mult = this.getMultiplier();
      const gained = basePts * mult;
      this.score += gained;
      this.tempoIntegrity = Math.min(100, this.tempoIntegrity + healthGain);
      this.stats[judgement] += 1;

      this.lastJudgement = judgement;
      this.lastJudgementIsUnique = bestNote.isUnique;
      this.lastJudgementPoints = gained;
      this.judgementSeq += 1;

      this.laneFlashKind[lane] = judgement;
      this.laneFlashSeq[lane] += 1;
      this.laneFlashTimer[lane] = 0.28;

      // Visual & Audio feedback
      const itemDef = ITEMS[bestNote.item];
      const burstColor = bestNote.isUnique ? 0xffd269 : itemDef.accentInt;
      this.spawnShockwave(LANE_X[lane], burstColor, bestNote.isUnique ? 1.35 : 1.0);
      this.spawnParticleBurst(
        LANE_X[lane],
        0.55,
        STRIKE_Z,
        burstColor,
        bestNote.isUnique ? 28 : judgement === 'perfect' ? 18 : 11,
      );

      // Brief tactile hitstop on unique note perfect hits
      if (bestNote.isUnique && judgement === 'perfect') {
        this.hitstopTimer = 0.032;
        this.beatPulse = Math.min(1.2, this.beatPulse + 0.45);
      }

      const visual = this.activeVisuals.get(bestNote.id);
      if (visual) {
        visual.hitAnim = 0.001;
      }

      this.audio.playItemHit(bestNote.item, bestNote.midiNote, judgement, bestNote.isUnique);
      this.emitHud(true);
    } else {
      // Empty tap / mistimed tap penalty
      this.registerMiss(lane, false);
    }
  }

  private registerMiss(lane: 0 | 1 | 2 | 3, fromPassedNote: boolean): void {
    this.combo = 0;
    this.stats.miss += 1;
    this.tempoIntegrity = Math.max(0, this.tempoIntegrity - (fromPassedNote ? 12 : 7));

    this.lastJudgement = 'miss';
    this.lastJudgementIsUnique = false;
    this.lastJudgementPoints = 0;
    this.judgementSeq += 1;

    this.laneFlashKind[lane] = 'miss';
    this.laneFlashSeq[lane] += 1;
    this.laneFlashTimer[lane] = 0.3;

    this.cameraShake = Math.min(0.45, this.cameraShake + 0.22);
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
        sw.maxAge = 0.36;
        sw.mesh.position.set(x, 0.09, STRIKE_Z);
        sw.mesh.scale.setScalar(0.65 * scaleMult);
        sw.mesh.visible = true;
        sw.mat.color.setHex(colorHex);
        sw.mat.opacity = 0.92;
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
        p.maxAge = 0.42 + Math.random() * 0.34;
        p.pos.set(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.4);
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.6 + Math.random() * 3.8;
        p.vel.set(Math.cos(angle) * speed, 3.2 + Math.random() * 4.4, Math.sin(angle) * speed * 0.8);
        p.scale = 0.65 + Math.random() * 0.95;
        p.rotSpeed = (Math.random() - 0.5) * 12;
        p.rot = Math.random() * Math.PI;
        p.color.setHex(spawned % 3 === 0 ? 0xfff5dc : colorHex);
        spawned++;
      }
    }
  }

  private createTileVisual(note: NoteEvent): ActiveTileVisual {
    const group = new THREE.Group();

    const trayMat = note.isUnique ? this.matTileBodyUnique : this.matTileBody;
    const trayMesh = new THREE.Mesh(this.geoTileBase, trayMat);
    trayMesh.position.y = 0.07;
    trayMesh.receiveShadow = true;
    trayMesh.castShadow = true;
    group.add(trayMesh);

    const itemDef = ITEMS[note.item];
    const rimMat = new THREE.MeshStandardMaterial({
      color: note.isUnique ? 0xffd269 : itemDef.accentInt,
      emissive: note.isUnique ? 0xd48d1e : itemDef.emissiveInt,
      emissiveIntensity: note.isUnique ? 1.15 : 0.65,
      metalness: 0.72,
      roughness: 0.22,
    });
    const rimMesh = new THREE.Mesh(this.geoTileRim, rimMat);
    rimMesh.position.y = 0.14;
    group.add(rimMesh);

    // Grounded contact shadow on top of the tray
    const shadowPlane = new THREE.Mesh(this.geoContactPlane, this.matContactShadow);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.168;
    group.add(shadowPlane);

    // 3D procedural tableware item seated cleanly on top of the coaster
    const itemGroup = this.modelLib.createItemMesh(note.item);
    itemGroup.position.y = 0.168;
    itemGroup.scale.multiplyScalar(note.isUnique ? 1.08 : 0.95);
    group.add(itemGroup);

    group.position.set(LANE_X[note.lane], 0, SPAWN_Z);
    this.scene.add(group);

    return {
      note,
      group,
      trayMesh,
      rimMat,
      itemGroup,
      hitAnim: 0,
      missedAnim: 0,
    };
  }

  private removeTileVisual(id: number, visual: ActiveTileVisual): void {
    this.scene.remove(visual.group);
    visual.rimMat.dispose();
    this.activeVisuals.delete(id);
  }

  private clearActiveTiles(): void {
    this.activeVisuals.forEach((v) => {
      this.scene.remove(v.group);
      v.rimMat.dispose();
    });
    this.activeVisuals.clear();
  }

  private handleCanvasPointerDown(e: PointerEvent): void {
    if (this.phase !== 'playing') return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(_ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.laneProxies, false);
    if (hits.length > 0) {
      const lane = hits[0].object.userData.lane as 0 | 1 | 2 | 3;
      this.triggerLane(lane);
    }
  }

  private handleResize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private updateSimulation(dt: number, nowMs: number): void {
    // Decay visual springs
    this.beatPulse = Math.max(0, this.beatPulse - dt * 3.4);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 2.2);

    for (let i = 0; i < LANE_COUNT; i++) {
      this.lanePressSpring[i] = Math.max(0, this.lanePressSpring[i] - dt * 6.5);
      if (this.laneFlashTimer[i] > 0) {
        this.laneFlashTimer[i] = Math.max(0, this.laneFlashTimer[i] - dt);
        if (this.laneFlashTimer[i] === 0) {
          this.laneFlashKind[i] = null;
        }
      }
    }

    if (this.phase === 'title') {
      this.elapsedIdle += dt;
      // Gentle atmospheric turntable & camera pan on Title Screen
      const orbitAngle = Math.sin(this.elapsedIdle * 0.28) * 0.42;
      const targetCamX = Math.sin(orbitAngle) * 3.8;
      const targetCamY = 3.2 + Math.sin(this.elapsedIdle * 0.45) * 0.25;
      const targetCamZ = 7.4 + Math.cos(orbitAngle) * 0.8;

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 3.5, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 3.5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 3.5, dt);
      this.camera.lookAt(0, 1.05, 1.5);

      if (this.showcaseItemMesh) {
        this.showcaseItemMesh.rotation.y = this.elapsedIdle * 0.72;
        this.showcaseItemMesh.position.y = 0.08 + Math.sin(this.elapsedIdle * 1.9) * 0.06;
      }

      // Idle ambient equalizer breathing
      this.updateBeatVisuals(this.elapsedIdle * 1.6, 0.25 + 0.15 * Math.sin(this.elapsedIdle * 2.2), dt);
      this.updateParticlesAndShockwaves(dt);
      return;
    }

    // Playing / Paused / Victory / GameOver camera settle
    const playCamY = 6.55 - this.beatPulse * 0.12;
    const playCamZ = 10.45 - this.beatPulse * 0.16;
    const shakeX = this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake * 0.42 : 0;
    const shakeY = this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake * 0.28 : 0;

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, shakeX, 12, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, playCamY + shakeY, 10, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, playCamZ, 10, dt);
    this.camera.lookAt(0, 0.35, -4.4);

    if (this.phase === 'playing') {
      this.audio.update();
      this.currentBeat = this.audio.getCurrentBeat();

      const beatFloor = Math.floor(this.currentBeat);
      if (beatFloor > this.lastBeatInt && beatFloor >= 0) {
        this.lastBeatInt = beatFloor;
        this.beatPulse = Math.min(1.0, 0.78 + Math.min(this.combo, 30) * 0.008);
      }

      const simDt = this.hitstopTimer > 0 ? dt * 0.25 : dt;
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);

      this.updateNotesAndTiles(simDt);
      this.updateBeatVisuals(this.currentBeat, this.beatPulse, dt);

      // Check song completion
      const endBeat = LEAD_IN_BEATS + this.currentLevel.durationBeats + 3.2;
      if (this.currentBeat >= endBeat && this.phase === 'playing') {
        this.phase = 'victory';
        this.audio.stop();
        this.audio.playVictoryFanfare();
        const snap = this.buildHudSnapshot();
        this.onHudUpdate(snap);
        this.onLevelComplete?.(this.currentLevel.id, snap);
        return;
      }

      if (nowMs - this.lastHudEmitMs >= 33) {
        this.emitHud(false);
        this.lastHudEmitMs = nowMs;
      }
    } else {
      this.updateBeatVisuals(this.currentBeat, this.beatPulse * 0.4, dt);
    }

    this.updateParticlesAndShockwaves(dt);
  }

  private updateNotesAndTiles(dt: number): void {
    const secPerBeat = 60 / this.currentLevel.bpm;
    const spawnLookaheadBeats = (STRIKE_Z - SPAWN_Z) / UNITS_PER_BEAT;

    // 1. Spawn incoming notes within visible track distance & detect missed notes
    for (let i = 0; i < this.notes.length; i++) {
      const note = this.notes[i];
      const deltaBeats = note.beat - this.currentBeat;

      if (note.hitState === 'pending') {
        if (deltaBeats <= spawnLookaheadBeats && deltaBeats > -2.5) {
          if (!this.activeVisuals.has(note.id)) {
            this.activeVisuals.set(note.id, this.createTileVisual(note));
          }
        }

        // Did note pass beyond the strike window?
        if (-deltaBeats * secPerBeat > MISS_PASS_SEC) {
          note.hitState = 'missed';
          const vis = this.activeVisuals.get(note.id);
          if (vis) vis.missedAnim = 0.001;
          this.registerMiss(note.lane, true);
          if (this.phase !== 'playing') return;
        }
      }
    }

    // 2. Animate active tile meshes
    const toRemove: [number, ActiveTileVisual][] = [];
    this.activeVisuals.forEach((vis, id) => {
      if (vis.hitAnim > 0) {
        vis.hitAnim += dt * 4.8;
        const t = Math.min(1, vis.hitAnim);
        const s = 1 + t * 0.48;
        vis.group.scale.set(s, 1 + t * 0.9, s);
        vis.group.position.y = t * 1.4;
        vis.itemGroup.rotation.y += dt * 14;
        vis.rimMat.emissiveIntensity = 2.6 * (1 - t);
        if (t >= 1) {
          toRemove.push([id, vis]);
        }
        return;
      }

      if (vis.missedAnim > 0) {
        vis.missedAnim += dt * 3.5;
        const t = Math.min(1, vis.missedAnim);
        vis.group.position.z = STRIKE_Z + (this.currentBeat - vis.note.beat) * UNITS_PER_BEAT;
        vis.group.position.y = -t * 0.8;
        vis.rimMat.color.setHex(0xd93838);
        vis.rimMat.emissive.setHex(0x8c1919);
        if (t >= 1) {
          toRemove.push([id, vis]);
        }
        return;
      }

      // Position strictly synced to beat clock
      const deltaBeats = vis.note.beat - this.currentBeat;
      const z = STRIKE_Z - deltaBeats * UNITS_PER_BEAT;
      vis.group.position.z = z;

      // Subtle beat-synchronized bounce & rotation of the 3D tableware item
      const beatFrac = ((this.currentBeat % 1) + 1) % 1;
      const bounce = Math.max(0, Math.sin(beatFrac * Math.PI)) * 0.09;
      vis.itemGroup.position.y = 0.168 + bounce;
      vis.itemGroup.rotation.y =
        vis.note.isUnique
          ? this.currentBeat * 1.35 + vis.note.lane * 0.5
          : Math.sin(this.currentBeat * 1.2 + vis.note.id) * 0.28;

      // Glow intensifies as tile enters the strike zone
      const proximity = THREE.MathUtils.clamp(1 - Math.abs(deltaBeats) * 0.55, 0, 1);
      vis.rimMat.emissiveIntensity = (vis.note.isUnique ? 1.0 : 0.55) + proximity * 1.25;
    });

    for (const [id, vis] of toRemove) {
      this.removeTileVisual(id, vis);
    }
  }

  private updateBeatVisuals(beatVal: number, pulse: number, dt: number): void {
    // Scroll track beat divider bars smoothly with beat
    const frac = ((beatVal % 1) + 1) % 1;
    for (let i = 0; i < this.beatLines.length; i++) {
      this.beatLines[i].position.z = STRIKE_Z + frac * UNITS_PER_BEAT - i * UNITS_PER_BEAT;
    }

    // Pulse strike bar & accent light with the beat
    const comboBoost = Math.min(this.combo, 30) / 30;
    this.strikeBarGlowMat.emissiveIntensity = 0.75 + pulse * 1.35 + comboBoost * 0.5;
    this.accentSpotLight.intensity = 1.9 + pulse * 2.1 + comboBoost * 0.8;

    // Pulse chandelier bulbs
    for (let i = 0; i < this.chandelierBulbs.length; i++) {
      this.chandelierBulbs[i].emissiveIntensity = 1.2 + pulse * 1.1;
    }
    for (let i = 0; i < this.chandelierLights.length; i++) {
      this.chandelierLights[i].intensity = 1.05 + pulse * 0.75;
    }

    // Update 4 strike pad depression & hit color flash
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const pad = this.strikePads[lane];
      const mat = this.strikePadMats[lane];
      pad.position.y = 0.02 - this.lanePressSpring[lane] * 0.045;

      const flash = this.laneFlashKind[lane];
      if (flash === 'perfect') {
        mat.emissive.setHex(0xf5b942);
        mat.emissiveIntensity = 1.8;
      } else if (flash === 'great') {
        mat.emissive.setHex(0x4ac98c);
        mat.emissiveIntensity = 1.5;
      } else if (flash === 'good') {
        mat.emissive.setHex(0x5fa8d3);
        mat.emissiveIntensity = 1.2;
      } else if (flash === 'miss') {
        mat.emissive.setHex(0xd93838);
        mat.emissiveIntensity = 1.5;
      } else {
        mat.emissive.setHex(0x3b2611);
        mat.emissiveIntensity = 0.25 + pulse * 0.35 + this.lanePressSpring[lane] * 0.6;
      }
    }

    // Equalizer side columns react to beat & wave down the hall
    for (let i = 0; i < this.eqBarsLeft.length; i++) {
      const wave = 0.5 + 0.5 * Math.sin(beatVal * Math.PI * 1.0 - i * 0.55);
      const targetScaleY = 0.35 + (wave * 0.9 + pulse * 1.45) * (1 + comboBoost * 0.45);
      const lBar = this.eqBarsLeft[i];
      const rBar = this.eqBarsRight[i];
      lBar.scale.y = THREE.MathUtils.damp(lBar.scale.y, targetScaleY, 14, dt);
      rBar.scale.y = THREE.MathUtils.damp(rBar.scale.y, targetScaleY, 14, dt);

      const lMat = lBar.material as THREE.MeshStandardMaterial;
      const rMat = rBar.material as THREE.MeshStandardMaterial;
      lMat.emissiveIntensity = 0.45 + pulse * 1.1;
      rMat.emissiveIntensity = 0.45 + pulse * 1.1;
    }
  }

  private updateParticlesAndShockwaves(dt: number): void {
    // Update shockwaves
    for (let i = 0; i < this.shockwaves.length; i++) {
      const sw = this.shockwaves[i];
      if (!sw.active) continue;
      sw.age += dt;
      const t = sw.age / sw.maxAge;
      if (t >= 1) {
        sw.active = false;
        sw.mesh.visible = false;
        continue;
      }
      const easeOut = 1 - Math.pow(1 - t, 3);
      sw.mesh.scale.setScalar(0.65 + easeOut * 2.1);
      sw.mat.opacity = (1 - t) * 0.85;
    }

    // Update instanced particles
    let dirty = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      dirty = true;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      const t = p.age / p.maxAge;
      p.vel.y -= 10.5 * dt;
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
    const secPerBeat = 60 / this.currentLevel.bpm;

    // Find earliest pending beat across all lanes to highlight the immediate approaching row!
    let nextRowBeat = Infinity;
    const nearestPerLane: (NoteEvent | null)[] = [null, null, null, null];

    for (let i = 0; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.hitState !== 'pending') continue;
      if (n.beat < nextRowBeat) nextRowBeat = n.beat;
      if (!nearestPerLane[n.lane]) {
        nearestPerLane[n.lane] = n;
      }
      if (nearestPerLane[0] && nearestPerLane[1] && nearestPerLane[2] && nearestPerLane[3]) {
        break;
      }
    }

    const prompts: LanePrompt[] = [];
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const n = nearestPerLane[lane];
      if (n) {
        const beatsAway = n.beat - this.currentBeat;
        const secAway = Math.abs(beatsAway * secPerBeat);
        // Normalized 0..1 proximity over a 4-beat approach window
        const proximity = THREE.MathUtils.clamp(1 - beatsAway / 4.0, 0, 1.15);
        prompts.push({
          lane: lane as 0 | 1 | 2 | 3,
          item: n.item,
          isUnique: n.isUnique,
          proximity,
          inHitWindow: secAway <= GOOD_SEC,
          isNextRow: Math.abs(n.beat - nextRowBeat) < 0.05 && beatsAway <= 4.5,
          hasNote: true,
          flashKind: this.laneFlashKind[lane],
          flashSeq: this.laneFlashSeq[lane],
        });
      } else {
        const fallbackItem = this.currentLevel.laneItems[lane];
        prompts.push({
          lane: lane as 0 | 1 | 2 | 3,
          item: fallbackItem,
          isUnique: fallbackItem === this.currentLevel.uniqueItem,
          proximity: 0,
          inHitWindow: false,
          isNextRow: false,
          hasNote: false,
          flashKind: this.laneFlashKind[lane],
          flashSeq: this.laneFlashSeq[lane],
        });
      }
    }

    const judged = this.stats.perfect + this.stats.great + this.stats.good + this.stats.miss;
    const weighted = this.stats.perfect * 1 + this.stats.great * 0.78 + this.stats.good * 0.45;
    const accuracy = judged > 0 ? Math.round((weighted / judged) * 100) : 100;
    const stars: 0 | 1 | 2 | 3 =
      this.phase === 'gameover'
        ? 0
        : accuracy >= 90
          ? 3
          : accuracy >= 75
            ? 2
            : 1;

    const totalBeats = LEAD_IN_BEATS + this.currentLevel.durationBeats + 2;
    const progress = THREE.MathUtils.clamp(this.currentBeat / totalBeats, 0, 1);

    return {
      phase: this.phase,
      levelId: this.currentLevel.id,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      multiplier: this.getMultiplier(),
      tempoIntegrity: Math.round(this.tempoIntegrity),
      progress,
      bpm: this.currentLevel.bpm,
      currentBeat: this.currentBeat,
      beatPulse: this.beatPulse,
      lastJudgement: this.lastJudgement,
      lastJudgementIsUnique: this.lastJudgementIsUnique,
      lastJudgementPoints: this.lastJudgementPoints,
      judgementSeq: this.judgementSeq,
      lanePrompts: prompts as [LanePrompt, LanePrompt, LanePrompt, LanePrompt],
      stats: { ...this.stats },
      accuracy,
      stars,
    };
  }

  private emitHud(force: boolean): void {
    if (force) {
      this.lastHudEmitMs = performance.now();
    }
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

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTimeMs) / 1000;
    this.lastTimeMs = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    this.updateSimulation(dt, now);
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
    this.audio.dispose();
    this.modelLib.dispose();
    this.textures.dispose();
    this.envTexture.dispose();

    this.geoTileBase.dispose();
    this.geoTileRim.dispose();
    this.geoContactPlane.dispose();
    this.matTileBody.dispose();
    this.matTileBodyUnique.dispose();
    this.matContactShadow.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
