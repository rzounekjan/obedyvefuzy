import * as THREE from 'three';
import type { ItemType } from './types';

export interface TablewareModelLibrary {
  createItemMesh: (type: ItemType) => THREE.Group;
  dispose: () => void;
}

/**
 * Pure unlit, opaque flat-vector 3D arcade artwork library for all 10 tableware items.
 * Zero lights, zero reflections, zero shadows, zero transparency — 100% MeshBasicMaterial
 * layered vector shapes backed by a bold dark silhouette slab so every icon stays razor-sharp
 * from any angle and runs at locked 60 FPS even on entry-level mobile GPUs.
 */
export function createTablewareModelLibrary(): TablewareModelLibrary {
  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposableGeos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposableMats.push(m);
    return m;
  };

  // --- Shared Unlit Opaque Arcade Vector Palette (100% MeshBasicMaterial, zero alpha) ---
  const matCache = new Map<number, THREE.MeshBasicMaterial>();
  const flatMat = (hex: number): THREE.MeshBasicMaterial => {
    let m = matCache.get(hex);
    if (!m) {
      m = trackMat(
        new THREE.MeshBasicMaterial({
          color: hex,
          side: THREE.DoubleSide,
        }),
      );
      matCache.set(hex, m);
    }
    return m;
  };

  const C = {
    outline: 0x090814,
    white: 0xffffff,
    cream: 0xfff8e7,
    creamShade: 0xe6dcc8,
    silver: 0xe2e8f0,
    silverLight: 0xf8fafc,
    silverDark: 0x94a3b8,
    gold: 0xffd166,
    goldDark: 0xe09f24,
    wood: 0x9a4a1c,
    woodDark: 0x6b2f0e,
    red: 0xef476f,
    redBright: 0xff4d6d,
    redDark: 0x9e1b3b,
    clothRed: 0xe63946,
    clothPink: 0xf48c94,
    waterGlass: 0x7dd3fc,
    waterFill: 0x0ea5e9,
    waterLight: 0xe0f2fe,
    lemon: 0xfde047,
    lemonPulp: 0xfef08a,
    beer: 0xf59e0b,
    beerBright: 0xfbbf24,
    beerDark: 0xd97706,
    foam: 0xffffff,
    foamShade: 0xfef3c7,
    shotGlass: 0xbae6fd,
    spirit: 0xf97316,
    spiritLight: 0xfdba74,
    wineGreen: 0x16a34a,
    wineDark: 0x14532d,
    wineLight: 0x4ade80,
    wineFoil: 0xbe123c,
    cork: 0xd97706,
  } as const;

  // Helper: create rounded rectangle THREE.Shape centered at (cx, cy)
  function roundedRect(cx: number, cy: number, w: number, h: number, r: number): THREE.Shape {
    const hw = w * 0.5;
    const hh = h * 0.5;
    const rr = Math.min(r, hw, hh);
    const s = new THREE.Shape();
    s.moveTo(cx - hw + rr, cy - hh);
    s.lineTo(cx + hw - rr, cy - hh);
    s.quadraticCurveTo(cx + hw, cy - hh, cx + hw, cy - hh + rr);
    s.lineTo(cx + hw, cy + hh - rr);
    s.quadraticCurveTo(cx + hw, cy + hh, cx + hw - rr, cy + hh);
    s.lineTo(cx - hw + rr, cy + hh);
    s.quadraticCurveTo(cx - hw, cy + hh, cx - hw, cy + hh - rr);
    s.lineTo(cx - hw, cy - hh + rr);
    s.quadraticCurveTo(cx - hw, cy - hh, cx - hw + rr, cy - hh);
    return s;
  }

  function circleShape(cx: number, cy: number, r: number): THREE.Shape {
    const s = new THREE.Shape();
    s.absarc(cx, cy, r, 0, Math.PI * 2, false);
    return s;
  }

  function ellipseShape(cx: number, cy: number, rx: number, ry: number): THREE.Shape {
    const s = new THREE.Shape();
    s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, 0);
    return s;
  }

  function polyShape(pts: [number, number][]): THREE.Shape {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      s.lineTo(pts[i][0], pts[i][1]);
    }
    s.closePath();
    return s;
  }

  interface VectorLayerSpec {
    geo: THREE.BufferGeometry;
    mat: THREE.MeshBasicMaterial;
    zOffset: number; // positive distance from center plane; mirrored automatically on back face
  }

  interface VectorTokenBlueprint {
    slabGeo: THREE.BufferGeometry;
    layers: VectorLayerSpec[];
    halfDepth: number;
    yOffset: number;
    scale: number;
  }

  // Helper to prebuild an unlit double-sided flat-vector token with crisp 3D dark edge backing
  function buildBlueprint(
    outlineShape: THREE.Shape,
    layerDefs: { shape: THREE.Shape; color: number; depthRank: number; curveSegs?: number }[],
    options?: { depth?: number; yOffset?: number; scale?: number; outlineSegs?: number },
  ): VectorTokenBlueprint {
    const depth = options?.depth ?? 0.08;
    const halfDepth = depth * 0.5;
    const slabGeo = trackGeo(
      new THREE.ExtrudeGeometry(outlineShape, {
        depth,
        bevelEnabled: false,
        curveSegments: options?.outlineSegs ?? 12,
      }),
    );
    slabGeo.translate(0, 0, -halfDepth);

    const layers: VectorLayerSpec[] = layerDefs.map((ld) => ({
      geo: trackGeo(new THREE.ShapeGeometry(ld.shape, ld.curveSegs ?? 12)),
      mat: flatMat(ld.color),
      zOffset: halfDepth + 0.008 + ld.depthRank * 0.009,
    }));

    return {
      slabGeo,
      layers,
      halfDepth,
      yOffset: options?.yOffset ?? 0.02,
      scale: options?.scale ?? 1.0,
    };
  }

  // =========================================================================
  // 1. KNIFE (Obědový nůž) — Bold upright vector chef/dinner knife
  // =========================================================================
  const knifeOutline = polyShape([
    [-0.17, 0.0],
    [0.17, 0.0],
    [0.17, 0.56],
    [0.24, 0.62],
    [0.24, 1.38],
    [0.12, 1.54],
    [-0.17, 1.5],
    [-0.17, 0.0],
  ]);
  const knifeBlade = polyShape([
    [-0.1, 0.6],
    [0.17, 0.6],
    [0.17, 1.34],
    [0.08, 1.46],
    [-0.1, 1.42],
  ]);
  const knifeEdge = polyShape([
    [0.08, 0.62],
    [0.17, 0.62],
    [0.17, 1.34],
    [0.08, 1.44],
  ]);
  const knifeHandle = roundedRect(0.0, 0.3, 0.22, 0.5, 0.06);
  const knifeBolster = roundedRect(0.02, 0.58, 0.3, 0.1, 0.03);
  const bpKnife = buildBlueprint(
    knifeOutline,
    [
      { shape: knifeBlade, color: C.silver, depthRank: 0 },
      { shape: knifeEdge, color: C.white, depthRank: 1 },
      { shape: knifeHandle, color: C.wood, depthRank: 0 },
      { shape: knifeBolster, color: C.gold, depthRank: 1 },
      { shape: circleShape(0, 0.42, 0.035), color: C.gold, depthRank: 2, curveSegs: 8 },
      { shape: circleShape(0, 0.29, 0.035), color: C.gold, depthRank: 2, curveSegs: 8 },
      { shape: circleShape(0, 0.16, 0.035), color: C.gold, depthRank: 2, curveSegs: 8 },
    ],
    { scale: 0.94 },
  );

  // =========================================================================
  // 2. FORK (Obědová vidlička) — Crisp 4-tine arcade vector fork
  // =========================================================================
  const forkOutline = polyShape([
    [-0.14, 0.0],
    [0.14, 0.0],
    [0.13, 0.72],
    [0.34, 0.86],
    [0.34, 1.5],
    [-0.34, 1.5],
    [-0.34, 0.86],
    [-0.13, 0.72],
  ]);
  const forkHandle = roundedRect(0, 0.42, 0.16, 0.74, 0.06);
  const forkNeck = roundedRect(0, 0.92, 0.54, 0.18, 0.06);
  const forkBand = roundedRect(0, 0.24, 0.18, 0.1, 0.02);
  const forkTineX = [-0.21, -0.07, 0.07, 0.21];
  const bpFork = buildBlueprint(
    forkOutline,
    [
      { shape: forkHandle, color: C.silver, depthRank: 0 },
      { shape: forkNeck, color: C.silver, depthRank: 0 },
      ...forkTineX.map((tx) => ({
        shape: roundedRect(tx, 1.22, 0.075, 0.46, 0.03),
        color: C.silverLight,
        depthRank: 1,
      })),
      { shape: forkBand, color: C.gold, depthRank: 1 },
      { shape: roundedRect(0, 0.52, 0.06, 0.34, 0.02), color: C.white, depthRank: 2 },
    ],
    { scale: 0.94 },
  );

  // =========================================================================
  // 3. SPOON (Obědová lžička) — Bold silhouette vector spoon
  // =========================================================================
  const spoonOutline = new THREE.Shape();
  spoonOutline.moveTo(-0.14, 0.0);
  spoonOutline.lineTo(0.14, 0.0);
  spoonOutline.lineTo(0.13, 0.82);
  spoonOutline.quadraticCurveTo(0.36, 0.92, 0.36, 1.2);
  spoonOutline.quadraticCurveTo(0.36, 1.54, 0.0, 1.54);
  spoonOutline.quadraticCurveTo(-0.36, 1.54, -0.36, 1.2);
  spoonOutline.quadraticCurveTo(-0.36, 0.92, -0.13, 0.82);
  spoonOutline.closePath();

  const bpSpoon = buildBlueprint(
    spoonOutline,
    [
      { shape: roundedRect(0, 0.48, 0.16, 0.84, 0.06), color: C.silver, depthRank: 0 },
      { shape: ellipseShape(0, 1.18, 0.28, 0.3), color: C.silverLight, depthRank: 1, curveSegs: 16 },
      { shape: ellipseShape(0, 1.18, 0.19, 0.21), color: C.silverDark, depthRank: 2, curveSegs: 14 },
      { shape: ellipseShape(-0.07, 1.25, 0.07, 0.11), color: C.white, depthRank: 3, curveSegs: 10 },
      { shape: roundedRect(0, 0.22, 0.18, 0.1, 0.02), color: C.gold, depthRank: 1 },
    ],
    { scale: 0.94 },
  );

  // =========================================================================
  // 4. CLOTH (Hadr na stůl) — Folded gingham checkerboard vector cloth
  // =========================================================================
  const clothOutline = roundedRect(0, 0.56, 1.16, 1.06, 0.12);
  const clothLayers: { shape: THREE.Shape; color: number; depthRank: number; curveSegs?: number }[] = [
    { shape: roundedRect(0, 0.56, 1.02, 0.92, 0.07), color: C.cream, depthRank: 0 },
  ];
  // 4x4 crisp red/pink checkered gingham vector grid
  const gxStart = -0.36;
  const gyStart = 0.22;
  const gStep = 0.24;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const cx = gxStart + col * gStep;
      const cy = gyStart + row * gStep;
      if ((row + col) % 2 === 0) {
        clothLayers.push({
          shape: roundedRect(cx, cy, 0.22, 0.2, 0.015),
          color: C.clothRed,
          depthRank: 1,
        });
      } else if (col % 2 === 0) {
        clothLayers.push({
          shape: roundedRect(cx, cy, 0.22, 0.2, 0.015),
          color: C.clothPink,
          depthRank: 1,
        });
      }
    }
  }
  // Fold flap accent across top edge
  clothLayers.push({
    shape: roundedRect(0, 0.96, 1.04, 0.11, 0.03),
    color: C.redDark,
    depthRank: 2,
  });
  clothLayers.push({
    shape: roundedRect(0, 0.16, 1.04, 0.07, 0.02),
    color: C.gold,
    depthRank: 2,
  });

  const bpCloth = buildBlueprint(clothOutline, clothLayers, { scale: 0.96 });

  // =========================================================================
  // 5. PLATE (Talíř) — Bold concentric vector porcelain plate with gold crest
  // =========================================================================
  const plateOutline = circleShape(0, 0.62, 0.64);
  const bpPlate = buildBlueprint(
    plateOutline,
    [
      { shape: circleShape(0, 0.62, 0.56), color: C.cream, depthRank: 0, curveSegs: 20 },
      { shape: circleShape(0, 0.62, 0.5), color: C.gold, depthRank: 1, curveSegs: 20 },
      { shape: circleShape(0, 0.62, 0.45), color: C.white, depthRank: 2, curveSegs: 20 },
      { shape: circleShape(0, 0.62, 0.34), color: C.creamShade, depthRank: 3, curveSegs: 18 },
      { shape: circleShape(0, 0.62, 0.3), color: C.cream, depthRank: 4, curveSegs: 18 },
      // Center arcade diamond crest
      {
        shape: polyShape([
          [0, 0.76],
          [0.14, 0.62],
          [0, 0.48],
          [-0.14, 0.62],
        ]),
        color: C.red,
        depthRank: 5,
      },
      { shape: circleShape(0, 0.62, 0.055), color: C.gold, depthRank: 6, curveSegs: 10 },
    ],
    { outlineSegs: 22, scale: 0.98 },
  );

  // =========================================================================
  // 6. WATER GLASS (Sklenice s vodou) — Opaque cyan vector tumbler + lemon
  // =========================================================================
  const waterOutline = polyShape([
    [-0.36, 0.0],
    [0.36, 0.0],
    [0.46, 1.18],
    [0.58, 1.24],
    [0.52, 1.44],
    [0.24, 1.42],
    [0.16, 1.24],
    [-0.46, 1.24],
  ]);
  const waterGlassBody = polyShape([
    [-0.29, 0.08],
    [0.29, 0.08],
    [0.39, 1.16],
    [-0.39, 1.16],
  ]);
  const waterLiquid = polyShape([
    [-0.25, 0.16],
    [0.25, 0.16],
    [0.33, 0.92],
    [-0.33, 0.92],
  ]);
  const waterWave = roundedRect(0, 0.92, 0.66, 0.08, 0.03);
  const waterStreak = polyShape([
    [-0.24, 0.22],
    [-0.15, 0.22],
    [-0.21, 1.08],
    [-0.3, 1.08],
  ]);
  const bpWater = buildBlueprint(
    waterOutline,
    [
      { shape: waterGlassBody, color: C.waterGlass, depthRank: 0 },
      { shape: waterLiquid, color: C.waterFill, depthRank: 1 },
      { shape: waterWave, color: C.waterLight, depthRank: 2 },
      { shape: roundedRect(-0.08, 0.72, 0.18, 0.18, 0.03), color: C.white, depthRank: 3 },
      { shape: roundedRect(0.14, 0.64, 0.16, 0.16, 0.03), color: C.waterLight, depthRank: 3 },
      { shape: waterStreak, color: C.white, depthRank: 4 },
      { shape: circleShape(0.36, 1.22, 0.2), color: C.lemon, depthRank: 2, curveSegs: 14 },
      { shape: circleShape(0.36, 1.22, 0.13), color: C.lemonPulp, depthRank: 3, curveSegs: 12 },
    ],
    { scale: 0.95 },
  );

  // =========================================================================
  // 7. BEER MUG (Sklenice s pivem — Český půllitr) — Opaque golden vector mug
  // =========================================================================
  const beerOutline = polyShape([
    [-0.44, 0.0],
    [0.4, 0.0],
    [0.42, 0.26],
    [0.66, 0.28],
    [0.68, 0.96],
    [0.42, 0.98],
    [0.44, 1.28],
    [0.24, 1.44],
    [-0.04, 1.5],
    [-0.34, 1.42],
    [-0.46, 1.22],
  ]);
  const beerHandleOuter = roundedRect(0.46, 0.62, 0.3, 0.56, 0.1);
  const beerHandleInner = roundedRect(0.46, 0.62, 0.14, 0.34, 0.05);
  const bpBeer = buildBlueprint(
    beerOutline,
    [
      { shape: beerHandleOuter, color: C.gold, depthRank: 0 },
      { shape: beerHandleInner, color: C.outline, depthRank: 1 },
      { shape: roundedRect(-0.02, 0.56, 0.72, 0.98, 0.06), color: C.beer, depthRank: 1 },
      // Vertical golden arcade flutes
      { shape: roundedRect(-0.2, 0.52, 0.11, 0.68, 0.04), color: C.beerBright, depthRank: 2 },
      { shape: roundedRect(0.0, 0.52, 0.11, 0.68, 0.04), color: C.beerBright, depthRank: 2 },
      { shape: roundedRect(0.18, 0.52, 0.1, 0.68, 0.04), color: C.beerDark, depthRank: 2 },
      // Mug base band
      { shape: roundedRect(-0.02, 0.12, 0.74, 0.12, 0.03), color: C.gold, depthRank: 3 },
      // Puffy snowy beer foam crown
      { shape: roundedRect(-0.02, 1.12, 0.76, 0.24, 0.08), color: C.foamShade, depthRank: 3 },
      { shape: circleShape(-0.22, 1.24, 0.18), color: C.foam, depthRank: 4, curveSegs: 12 },
      { shape: circleShape(0.0, 1.31, 0.21), color: C.foam, depthRank: 4, curveSegs: 12 },
      { shape: circleShape(0.22, 1.23, 0.18), color: C.foam, depthRank: 4, curveSegs: 12 },
    ],
    { scale: 0.94 },
  );

  // =========================================================================
  // 8. SHOT GLASS (Panák) — Thick-base vector shot glass with amber spirit
  // =========================================================================
  const shotOutline = polyShape([
    [-0.36, 0.0],
    [0.36, 0.0],
    [0.48, 1.08],
    [-0.48, 1.08],
  ]);
  const shotGlassBody = polyShape([
    [-0.29, 0.07],
    [0.29, 0.07],
    [0.4, 1.0],
    [-0.4, 1.0],
  ]);
  const shotBase = polyShape([
    [-0.27, 0.09],
    [0.27, 0.09],
    [0.3, 0.34],
    [-0.3, 0.34],
  ]);
  const shotLiquid = polyShape([
    [-0.3, 0.36],
    [0.3, 0.36],
    [0.36, 0.84],
    [-0.36, 0.84],
  ]);
  const bpShot = buildBlueprint(
    shotOutline,
    [
      { shape: shotGlassBody, color: C.shotGlass, depthRank: 0 },
      { shape: shotBase, color: C.white, depthRank: 1 },
      { shape: shotLiquid, color: C.spirit, depthRank: 1 },
      { shape: roundedRect(0, 0.84, 0.72, 0.08, 0.02), color: C.spiritLight, depthRank: 2 },
      { shape: roundedRect(0, 1.0, 0.82, 0.07, 0.02), color: C.gold, depthRank: 3 },
      { shape: roundedRect(-0.18, 0.58, 0.08, 0.56, 0.03), color: C.white, depthRank: 3 },
    ],
    { scale: 1.0 },
  );

  // =========================================================================
  // 9. NAPKIN (Ubrousek) — 3-peak crown folded vector napkin + crimson/gold ring
  // =========================================================================
  const napkinOutline = polyShape([
    [-0.46, 0.0],
    [0.46, 0.0],
    [0.54, 1.12],
    [0.24, 0.92],
    [0.0, 1.4],
    [-0.24, 0.92],
    [-0.54, 1.12],
  ]);
  const napkinLeftWing = polyShape([
    [-0.38, 0.1],
    [-0.04, 0.1],
    [-0.14, 0.86],
    [-0.45, 1.02],
  ]);
  const napkinRightWing = polyShape([
    [0.04, 0.1],
    [0.38, 0.1],
    [0.45, 1.02],
    [0.14, 0.86],
  ]);
  const napkinCenterPeak = polyShape([
    [-0.28, 0.1],
    [0.28, 0.1],
    [0.0, 1.28],
  ]);
  const bpNapkin = buildBlueprint(
    napkinOutline,
    [
      { shape: napkinLeftWing, color: C.creamShade, depthRank: 0 },
      { shape: napkinRightWing, color: C.creamShade, depthRank: 0 },
      { shape: napkinCenterPeak, color: C.cream, depthRank: 1 },
      { shape: roundedRect(0, 0.44, 0.78, 0.16, 0.04), color: C.gold, depthRank: 2 },
      { shape: roundedRect(0, 0.44, 0.72, 0.07, 0.02), color: C.red, depthRank: 3 },
      { shape: roundedRect(0, 0.1, 0.76, 0.07, 0.02), color: C.goldDark, depthRank: 2 },
    ],
    { scale: 0.96 },
  );

  // =========================================================================
  // 10. WINE BOTTLE (Láhev vína) — Tall emerald vector bottle + vintage label
  // =========================================================================
  const wineOutline = polyShape([
    [-0.36, 0.0],
    [0.36, 0.0],
    [0.36, 0.94],
    [0.18, 1.18],
    [0.18, 1.64],
    [-0.18, 1.64],
    [-0.18, 1.18],
    [-0.36, 0.94],
  ]);
  const wineBody = polyShape([
    [-0.29, 0.07],
    [0.29, 0.07],
    [0.29, 0.92],
    [0.11, 1.16],
    [0.11, 1.54],
    [-0.11, 1.54],
    [-0.11, 1.16],
    [-0.29, 0.92],
  ]);
  const wineShade = polyShape([
    [0.08, 0.08],
    [0.29, 0.08],
    [0.29, 0.92],
    [0.11, 1.15],
    [0.08, 1.15],
  ]);
  const bpWine = buildBlueprint(
    wineOutline,
    [
      { shape: wineBody, color: C.wineGreen, depthRank: 0 },
      { shape: wineShade, color: C.wineDark, depthRank: 1 },
      { shape: roundedRect(-0.18, 0.56, 0.07, 0.66, 0.03), color: C.wineLight, depthRank: 2 },
      // Burgundy foil & cork
      { shape: roundedRect(0, 1.38, 0.24, 0.3, 0.03), color: C.wineFoil, depthRank: 2 },
      { shape: roundedRect(0, 1.57, 0.2, 0.1, 0.02), color: C.cork, depthRank: 3 },
      { shape: roundedRect(0, 1.24, 0.26, 0.06, 0.02), color: C.gold, depthRank: 3 },
      // Vintage cream label + crimson crest bar
      { shape: roundedRect(0, 0.52, 0.54, 0.42, 0.03), color: C.cream, depthRank: 3 },
      { shape: roundedRect(0, 0.58, 0.44, 0.1, 0.02), color: C.wineFoil, depthRank: 4 },
      { shape: roundedRect(0, 0.42, 0.36, 0.06, 0.02), color: C.goldDark, depthRank: 4 },
    ],
    { scale: 0.9 },
  );

  const BLUEPRINTS: Record<ItemType, VectorTokenBlueprint> = {
    knife: bpKnife,
    fork: bpFork,
    spoon: bpSpoon,
    cloth: bpCloth,
    plate: bpPlate,
    water: bpWater,
    beer: bpBeer,
    shot: bpShot,
    napkin: bpNapkin,
    wine: bpWine,
  };

  const outlineMat = flatMat(C.outline);

  function createItemMesh(type: ItemType): THREE.Group {
    const bp = BLUEPRINTS[type];
    const root = new THREE.Group();

    // Solid dark vector contour body (3D arcade slab with zero shading/shadows)
    const slab = new THREE.Mesh(bp.slabGeo, outlineMat);
    slab.position.y = bp.yOffset;
    root.add(slab);

    // Crisp flat vector color layers on both front (+Z) and back (-Z) faces
    for (let i = 0; i < bp.layers.length; i++) {
      const layer = bp.layers[i];

      const front = new THREE.Mesh(layer.geo, layer.mat);
      front.position.set(0, bp.yOffset, layer.zOffset);
      root.add(front);

      const back = new THREE.Mesh(layer.geo, layer.mat);
      back.position.set(0, bp.yOffset, -layer.zOffset);
      back.rotation.y = Math.PI;
      root.add(back);
    }

    root.scale.setScalar(bp.scale);
    return root;
  }

  return {
    createItemMesh,
    dispose: () => {
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
    },
  };
}
