import * as THREE from 'three';
import type { ProceduralTexturePack } from './textures';
import type { ItemType } from './types';

export interface TablewareModelLibrary {
  createItemMesh: (type: ItemType) => THREE.Group;
  dispose: () => void;
}

/**
 * Builds composite 3–12 part PBR procedural 3D models for all 10 tableware items.
 * Every returned Group is pivoted cleanly at bottom-center (y = 0) so it rests
 * flush on its tile coaster or showcase pedestal.
 */
export function createTablewareModelLibrary(
  textures: ProceduralTexturePack,
  isSoftwareGl: boolean,
): TablewareModelLibrary {
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

  // --- Shared PBR Material Palette (varied roughness & metalness across adjacent parts) ---
  const matBrushedSteel = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe4e8ee,
      metalness: 0.94,
      roughness: 0.16,
      anisotropy: 0.75,
      clearcoat: 0.25,
    }),
  );

  const matPolishedSilver = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf1f4f8,
      metalness: 0.96,
      roughness: 0.1,
      clearcoat: 0.4,
    }),
  );

  const matBrushedBrass = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xd9a84e,
      metalness: 0.92,
      roughness: 0.2,
      anisotropy: 0.65,
    }),
  );

  const matWalnutHandle = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b2316,
      metalness: 0.04,
      roughness: 0.62,
    }),
  );

  const matPorcelain = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf8f3eb,
      metalness: 0.0,
      roughness: 0.14,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
    }),
  );

  const matPorcelainMatteFoot = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6ded2,
      metalness: 0.0,
      roughness: 0.75,
    }),
  );

  const matClearGlass = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf0faff,
      metalness: 0.0,
      roughness: 0.06,
      transmission: isSoftwareGl ? 0 : 0.88,
      transparent: true,
      opacity: isSoftwareGl ? 0.36 : 0.96,
      ior: 1.52,
      thickness: 0.4,
      clearcoat: 1.0,
      depthWrite: false,
    }),
  );

  const matHeavyCrystal = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.05,
      roughness: 0.08,
      transmission: isSoftwareGl ? 0 : 0.86,
      transparent: true,
      opacity: isSoftwareGl ? 0.42 : 0.98,
      ior: 1.62,
      thickness: 0.65,
      clearcoat: 1.0,
      depthWrite: false,
    }),
  );

  const matWaterLiquid = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x76d6ec,
      metalness: 0.0,
      roughness: 0.08,
      transparent: true,
      opacity: 0.72,
      clearcoat: 0.8,
    }),
  );

  const matIce = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xdff7ff,
      metalness: 0.0,
      roughness: 0.18,
      transparent: true,
      opacity: 0.78,
    }),
  );

  const matLemonRind = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf2ca38,
      roughness: 0.52,
      metalness: 0.0,
    }),
  );

  const matLemonPulp = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfbf09a,
      roughness: 0.3,
      metalness: 0.0,
    }),
  );

  const matBeerLiquid = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe69517,
      emissive: 0x542c00,
      emissiveIntensity: 0.25,
      metalness: 0.0,
      roughness: 0.12,
      transparent: true,
      opacity: 0.92,
      clearcoat: 0.6,
    }),
  );

  const matBeerFoam = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfffaf0,
      metalness: 0.0,
      roughness: 0.88,
    }),
  );

  const matSpiritLiquid = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe6842c,
      emissive: 0x4f2005,
      emissiveIntensity: 0.22,
      metalness: 0.0,
      roughness: 0.08,
      transparent: true,
      opacity: 0.86,
    }),
  );

  const matClothFabric = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: textures.clothGingham,
      metalness: 0.0,
      roughness: 0.88,
      sheen: 0.45,
      sheenRoughness: 0.8,
    }),
  );

  const matClothStitch = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x8f2419,
      metalness: 0.0,
      roughness: 0.82,
    }),
  );

  const matNapkinLinen = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: textures.napkinDamask,
      metalness: 0.0,
      roughness: 0.82,
      sheen: 0.55,
      sheenColor: new THREE.Color(0xfff5e4),
    }),
  );

  const matCrimsonRibbon = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9e2334,
      metalness: 0.05,
      roughness: 0.45,
    }),
  );

  const matWineBottleGlass = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x154229,
      metalness: 0.08,
      roughness: 0.09,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    }),
  );

  const matWineFoil = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x7d192b,
      metalness: 0.68,
      roughness: 0.28,
    }),
  );

  const matCork = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc29563,
      metalness: 0.0,
      roughness: 0.92,
    }),
  );

  const matWineLabel = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.wineLabel,
      metalness: 0.02,
      roughness: 0.68,
    }),
  );

  // --- Shared Prebuilt Geometries for All 10 Tableware Items ---

  // Cutlery Rest (used under knife, fork, spoon so they sit elevated & angled cleanly)
  const geoRestBar = trackGeo(new THREE.CylinderGeometry(0.055, 0.065, 0.48, 12));
  const geoRestFoot = trackGeo(new THREE.SphereGeometry(0.08, 12, 10));

  // 1. KNIFE geometries
  const knifeBladeShape = new THREE.Shape();
  knifeBladeShape.moveTo(0, 0);
  knifeBladeShape.lineTo(0.11, 0);
  knifeBladeShape.quadraticCurveTo(0.135, 0.42, 0.09, 0.72);
  knifeBladeShape.quadraticCurveTo(0.04, 0.8, 0.0, 0.76);
  knifeBladeShape.lineTo(0, 0);
  const geoKnifeBlade = trackGeo(
    new THREE.ExtrudeGeometry(knifeBladeShape, {
      depth: 0.024,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2,
    }),
  );
  geoKnifeBlade.center();

  const geoKnifeBolster = trackGeo(new THREE.CylinderGeometry(0.068, 0.078, 0.11, 14));
  const geoKnifeHandle = trackGeo(new THREE.CapsuleGeometry(0.068, 0.44, 6, 12));
  const geoKnifeRivet = trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.15, 10));
  const geoKnifePommel = trackGeo(new THREE.SphereGeometry(0.072, 12, 10));

  // 2. FORK geometries
  const geoForkHandle = trackGeo(new THREE.CapsuleGeometry(0.056, 0.56, 6, 12));
  const geoForkRidge = trackGeo(new THREE.BoxGeometry(0.04, 0.48, 0.09));
  const geoForkNeck = trackGeo(new THREE.CylinderGeometry(0.045, 0.06, 0.24, 12));
  const geoForkShoulder = trackGeo(new THREE.BoxGeometry(0.28, 0.1, 0.042));
  const geoForkTine = trackGeo(new THREE.CylinderGeometry(0.011, 0.021, 0.42, 8));

  // 3. SPOON geometries
  const geoSpoonBowl = trackGeo(
    new THREE.SphereGeometry(0.2, 20, 14, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48),
  );
  const geoSpoonRim = trackGeo(new THREE.TorusGeometry(0.195, 0.018, 10, 24));
  const spoonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.08, 0),
    new THREE.Vector3(0, 0.36, -0.05),
    new THREE.Vector3(0, 0.72, -0.02),
    new THREE.Vector3(0, 0.96, 0.03),
  ]);
  const geoSpoonStem = trackGeo(new THREE.TubeGeometry(spoonCurve, 20, 0.036, 10, false));
  const geoSpoonTip = trackGeo(new THREE.SphereGeometry(0.082, 14, 10));

  // 4. CLOTH (Hadr na stůl) geometries
  const clothFoldShape = new THREE.Shape();
  clothFoldShape.moveTo(-0.46, -0.36);
  clothFoldShape.lineTo(0.46, -0.36);
  clothFoldShape.lineTo(0.46, 0.36);
  clothFoldShape.lineTo(-0.46, 0.36);
  clothFoldShape.closePath();
  const geoClothLayer = trackGeo(
    new THREE.ExtrudeGeometry(clothFoldShape, {
      depth: 0.09,
      bevelEnabled: true,
      bevelThickness: 0.028,
      bevelSize: 0.032,
      bevelSegments: 3,
    }),
  );
  geoClothLayer.rotateX(-Math.PI / 2);
  const geoClothCrease = trackGeo(new THREE.CylinderGeometry(0.085, 0.085, 0.94, 14));
  const geoClothHem = trackGeo(new THREE.BoxGeometry(0.96, 0.024, 0.04));
  const geoClothLoop = trackGeo(new THREE.TorusGeometry(0.08, 0.018, 8, 16));

  // 5. PLATE (Talíř) geometries
  const platePoints = [
    new THREE.Vector2(0.0, 0.02),
    new THREE.Vector2(0.28, 0.02),
    new THREE.Vector2(0.32, 0.0), // foot ring resting at y=0
    new THREE.Vector2(0.37, 0.0),
    new THREE.Vector2(0.42, 0.045),
    new THREE.Vector2(0.64, 0.145),
    new THREE.Vector2(0.67, 0.175),
    new THREE.Vector2(0.63, 0.195),
    new THREE.Vector2(0.41, 0.095),
    new THREE.Vector2(0.32, 0.062),
    new THREE.Vector2(0.0, 0.055),
  ];
  const geoPlateBody = trackGeo(new THREE.LatheGeometry(platePoints, 36));
  const geoPlateGoldRim = trackGeo(new THREE.TorusGeometry(0.635, 0.014, 10, 40));
  const geoPlateInnerRing = trackGeo(new THREE.TorusGeometry(0.36, 0.008, 8, 32));
  const geoPlateCenterCrest = trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.008, 20));

  // 6. WATER GLASS (Sklenice s vodou) geometries
  const waterOuterPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.27, 0.0),
    new THREE.Vector2(0.33, 0.98),
    new THREE.Vector2(0.305, 0.99),
    new THREE.Vector2(0.25, 0.11),
    new THREE.Vector2(0.0, 0.11),
  ];
  const geoWaterGlass = trackGeo(new THREE.LatheGeometry(waterOuterPts, 28));
  const geoWaterLiquid = trackGeo(new THREE.CylinderGeometry(0.285, 0.24, 0.68, 24));
  const geoIceCube = trackGeo(new THREE.BoxGeometry(0.14, 0.13, 0.14));
  const geoLemonSlice = trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.036, 18, 1, false, 0, Math.PI * 1.15));
  const geoLemonPulp = trackGeo(new THREE.CylinderGeometry(0.135, 0.135, 0.04, 18, 1, false, 0, Math.PI * 1.15));

  // 7. BEER MUG (Sklenice s pivem — Český půllitr) geometries
  const beerOuterPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.34, 0.0),
    new THREE.Vector2(0.36, 0.16),
    new THREE.Vector2(0.35, 1.02),
    new THREE.Vector2(0.315, 1.03),
    new THREE.Vector2(0.31, 0.18),
    new THREE.Vector2(0.0, 0.18),
  ];
  const geoBeerMug = trackGeo(new THREE.LatheGeometry(beerOuterPts, 20));
  const beerHandleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.33, 0.86, 0),
    new THREE.Vector3(0.57, 0.82, 0),
    new THREE.Vector3(0.59, 0.52, 0),
    new THREE.Vector3(0.53, 0.26, 0),
    new THREE.Vector3(0.33, 0.24, 0),
  ]);
  const geoBeerHandle = trackGeo(new THREE.TubeGeometry(beerHandleCurve, 20, 0.055, 10, false));
  const geoBeerLiquid = trackGeo(new THREE.CylinderGeometry(0.305, 0.295, 0.68, 20));
  const geoBeerFoamCap = trackGeo(new THREE.CylinderGeometry(0.315, 0.305, 0.22, 20));
  const geoBeerFoamPuff = trackGeo(new THREE.SphereGeometry(0.14, 12, 10));
  const geoBeerBand = trackGeo(new THREE.TorusGeometry(0.355, 0.015, 8, 24));

  // 8. SHOT GLASS (Panák) geometries
  const shotPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.21, 0.0),
    new THREE.Vector2(0.27, 0.68),
    new THREE.Vector2(0.245, 0.69),
    new THREE.Vector2(0.195, 0.2), // thick heavy base
    new THREE.Vector2(0.0, 0.2),
  ];
  const geoShotGlass = trackGeo(new THREE.LatheGeometry(shotPts, 24));
  const geoShotBaseSlug = trackGeo(new THREE.CylinderGeometry(0.195, 0.205, 0.19, 24));
  const geoShotLiquid = trackGeo(new THREE.CylinderGeometry(0.228, 0.192, 0.34, 24));
  const geoShotGoldRim = trackGeo(new THREE.TorusGeometry(0.262, 0.011, 8, 28));

  // 9. NAPKIN (Ubrousek) geometries
  const geoNapkinCone = trackGeo(new THREE.ConeGeometry(0.34, 0.98, 4, 1));
  const geoNapkinWing = trackGeo(new THREE.ConeGeometry(0.24, 0.86, 4, 1));
  const geoNapkinRing = trackGeo(new THREE.TorusGeometry(0.22, 0.042, 14, 28));
  const geoNapkinRibbon = trackGeo(new THREE.TorusGeometry(0.245, 0.018, 10, 28));
  const geoNapkinBase = trackGeo(new THREE.CylinderGeometry(0.31, 0.34, 0.06, 16));

  // 10. WINE BOTTLE (Láhev vína) geometries
  const winePts = [
    new THREE.Vector2(0.0, 0.06), // punt indentation
    new THREE.Vector2(0.16, 0.06),
    new THREE.Vector2(0.26, 0.0),
    new THREE.Vector2(0.30, 0.02),
    new THREE.Vector2(0.30, 0.84),
    new THREE.Vector2(0.28, 0.96),
    new THREE.Vector2(0.18, 1.09),
    new THREE.Vector2(0.115, 1.18),
    new THREE.Vector2(0.108, 1.52),
    new THREE.Vector2(0.125, 1.55), // lip
    new THREE.Vector2(0.125, 1.59),
    new THREE.Vector2(0.092, 1.59),
    new THREE.Vector2(0.092, 1.50),
  ];
  const geoWineBottle = trackGeo(new THREE.LatheGeometry(winePts, 32));
  const geoWineFoil = trackGeo(new THREE.CylinderGeometry(0.114, 0.116, 0.28, 24, 1, true));
  const geoWineFoilCap = trackGeo(new THREE.CylinderGeometry(0.128, 0.128, 0.055, 24));
  const geoWineCork = trackGeo(new THREE.CylinderGeometry(0.088, 0.082, 0.13, 18));
  const geoWineLabel = trackGeo(
    new THREE.CylinderGeometry(0.306, 0.306, 0.44, 28, 1, true, -Math.PI * 0.45, Math.PI * 0.9),
  );
  const geoWineNeckCollar = trackGeo(new THREE.TorusGeometry(0.118, 0.012, 8, 24));

  function makeMesh(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    castShadow = true,
    renderOrder = 0,
  ): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = castShadow;
    m.receiveShadow = true;
    m.renderOrder = renderOrder;
    return m;
  }

  function addCutleryRest(parent: THREE.Group): void {
    const bar = makeMesh(geoRestBar, matBrushedBrass);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.08, 0);
    parent.add(bar);

    const leftFoot = makeMesh(geoRestFoot, matBrushedBrass);
    leftFoot.position.set(-0.24, 0.08, 0);
    parent.add(leftFoot);

    const rightFoot = makeMesh(geoRestFoot, matBrushedBrass);
    rightFoot.position.set(0.24, 0.08, 0);
    parent.add(rightFoot);
  }

  function createItemMesh(type: ItemType): THREE.Group {
    const root = new THREE.Group();

    switch (type) {
      case 'knife': {
        addCutleryRest(root);
        const body = new THREE.Group();
        body.position.set(0, 0.62, 0);
        body.rotation.set(0.18, 0.25, -0.32);

        const blade = makeMesh(geoKnifeBlade, matBrushedSteel);
        blade.position.set(0, 0.38, 0);
        body.add(blade);

        const bolster = makeMesh(geoKnifeBolster, matPolishedSilver);
        bolster.position.set(0, -0.02, 0);
        body.add(bolster);

        const handle = makeMesh(geoKnifeHandle, matWalnutHandle);
        handle.position.set(0, -0.31, 0);
        body.add(handle);

        for (let r = 0; r < 3; r++) {
          const rivet = makeMesh(geoKnifeRivet, matBrushedBrass, false);
          rivet.rotation.x = Math.PI / 2;
          rivet.position.set(0, -0.18 - r * 0.13, 0);
          body.add(rivet);
        }

        const pommel = makeMesh(geoKnifePommel, matBrushedBrass);
        pommel.position.set(0, -0.57, 0);
        body.add(pommel);

        root.add(body);
        break;
      }

      case 'fork': {
        addCutleryRest(root);
        const body = new THREE.Group();
        body.position.set(0, 0.62, 0);
        body.rotation.set(0.15, -0.2, 0.22);

        const handle = makeMesh(geoForkHandle, matPolishedSilver);
        handle.position.set(0, -0.28, 0);
        body.add(handle);

        const ridge = makeMesh(geoForkRidge, matBrushedBrass, false);
        ridge.position.set(0, -0.28, 0.01);
        body.add(ridge);

        const neck = makeMesh(geoForkNeck, matBrushedSteel);
        neck.position.set(0, 0.12, 0);
        body.add(neck);

        const shoulder = makeMesh(geoForkShoulder, matPolishedSilver);
        shoulder.position.set(0, 0.25, 0);
        body.add(shoulder);

        const tineOffsets = [-0.105, -0.035, 0.035, 0.105];
        for (const ox of tineOffsets) {
          const tine = makeMesh(geoForkTine, matPolishedSilver);
          tine.position.set(ox, 0.48, 0.02);
          tine.rotation.x = 0.12;
          body.add(tine);
        }

        root.add(body);
        break;
      }

      case 'spoon': {
        addCutleryRest(root);
        const body = new THREE.Group();
        body.position.set(0, 0.18, 0);
        body.rotation.set(0.18, 0.15, -0.18);

        const stem = makeMesh(geoSpoonStem, matPolishedSilver);
        body.add(stem);

        const tip = makeMesh(geoSpoonTip, matBrushedBrass);
        tip.scale.set(1, 0.55, 1.3);
        tip.position.set(0, 0.04, 0);
        body.add(tip);

        const bowl = makeMesh(geoSpoonBowl, matBrushedSteel);
        bowl.scale.set(0.95, 0.72, 1.38);
        bowl.rotation.x = -Math.PI * 0.42;
        bowl.position.set(0, 1.05, 0.08);
        body.add(bowl);

        const rim = makeMesh(geoSpoonRim, matPolishedSilver, false);
        rim.scale.set(0.95, 1.38, 1);
        rim.rotation.x = 0.25;
        rim.position.set(0, 1.07, 0.05);
        body.add(rim);

        root.add(body);
        break;
      }

      case 'cloth': {
        const lower = makeMesh(geoClothLayer, matClothFabric);
        lower.position.set(0, 0.03, 0);
        root.add(lower);

        const upper = makeMesh(geoClothLayer, matClothFabric);
        upper.scale.set(0.92, 0.9, 0.88);
        upper.position.set(0.03, 0.15, -0.02);
        upper.rotation.y = 0.12;
        upper.rotation.z = -0.03;
        root.add(upper);

        const crease = makeMesh(geoClothCrease, matClothFabric);
        crease.rotation.z = Math.PI / 2;
        crease.position.set(0, 0.13, -0.35);
        root.add(crease);

        const hemFront = makeMesh(geoClothHem, matClothStitch, false);
        hemFront.position.set(0, 0.09, 0.35);
        root.add(hemFront);

        const hemTop = makeMesh(geoClothHem, matClothStitch, false);
        hemTop.scale.set(0.9, 1, 1);
        hemTop.position.set(0.02, 0.22, 0.29);
        hemTop.rotation.y = 0.12;
        root.add(hemTop);

        const loop = makeMesh(geoClothLoop, matClothStitch, false);
        loop.position.set(0.42, 0.22, -0.26);
        loop.rotation.x = Math.PI / 2;
        root.add(loop);
        break;
      }

      case 'plate': {
        const body = makeMesh(geoPlateBody, matPorcelain);
        root.add(body);

        const foot = makeMesh(
          trackGeo(new THREE.TorusGeometry(0.34, 0.018, 8, 32)),
          matPorcelainMatteFoot,
          false,
        );
        foot.rotation.x = Math.PI / 2;
        foot.position.y = 0.018;
        root.add(foot);

        const goldRim = makeMesh(geoPlateGoldRim, matBrushedBrass, false);
        goldRim.rotation.x = Math.PI / 2;
        goldRim.position.y = 0.188;
        root.add(goldRim);

        const innerRing = makeMesh(geoPlateInnerRing, matBrushedBrass, false);
        innerRing.rotation.x = Math.PI / 2;
        innerRing.position.y = 0.088;
        root.add(innerRing);

        const crest = makeMesh(geoPlateCenterCrest, matBrushedBrass, false);
        crest.position.y = 0.06;
        root.add(crest);

        // Gently tilt the plate on a tiny brass display stand so its face shines toward the player
        root.children.forEach((c) => {
          c.position.y += 0.32;
          c.rotation.x += 0.42;
        });
        const stand = makeMesh(
          trackGeo(new THREE.CylinderGeometry(0.18, 0.26, 0.14, 16)),
          matBrushedBrass,
        );
        stand.position.y = 0.07;
        root.add(stand);
        break;
      }

      case 'water': {
        const liquid = makeMesh(geoWaterLiquid, matWaterLiquid, false, 1);
        liquid.position.y = 0.46;
        root.add(liquid);

        const ice1 = makeMesh(geoIceCube, matIce, false, 2);
        ice1.position.set(-0.07, 0.72, 0.04);
        ice1.rotation.set(0.4, 0.6, 0.2);
        root.add(ice1);

        const ice2 = makeMesh(geoIceCube, matIce, false, 2);
        ice2.position.set(0.08, 0.68, -0.05);
        ice2.rotation.set(-0.3, 0.2, 0.5);
        root.add(ice2);

        const glass = makeMesh(geoWaterGlass, matClearGlass, true, 3);
        root.add(glass);

        const lemonGroup = new THREE.Group();
        lemonGroup.position.set(0.28, 0.96, 0.04);
        lemonGroup.rotation.set(0.1, 0.2, -0.65);
        const rind = makeMesh(geoLemonSlice, matLemonRind, false, 4);
        const pulp = makeMesh(geoLemonPulp, matLemonPulp, false, 4);
        lemonGroup.add(rind, pulp);
        root.add(lemonGroup);
        break;
      }

      case 'beer': {
        const liquid = makeMesh(geoBeerLiquid, matBeerLiquid, false, 1);
        liquid.position.y = 0.52;
        root.add(liquid);

        const foamCap = makeMesh(geoBeerFoamCap, matBeerFoam, true, 2);
        foamCap.position.y = 0.95;
        root.add(foamCap);

        const puffPositions: [number, number, number, number][] = [
          [0, 1.1, 0, 1.15],
          [0.16, 1.07, 0.08, 0.85],
          [-0.15, 1.08, 0.09, 0.9],
          [0.05, 1.06, -0.16, 0.88],
          [-0.12, 1.05, -0.12, 0.8],
        ];
        for (const [px, py, pz, ps] of puffPositions) {
          const puff = makeMesh(geoBeerFoamPuff, matBeerFoam, false, 2);
          puff.position.set(px, py, pz);
          puff.scale.setScalar(ps);
          root.add(puff);
        }

        const mug = makeMesh(geoBeerMug, matHeavyCrystal, true, 3);
        root.add(mug);

        const handle = makeMesh(geoBeerHandle, matHeavyCrystal, true, 3);
        root.add(handle);

        const bandLow = makeMesh(geoBeerBand, matBrushedBrass, false, 4);
        bandLow.rotation.x = Math.PI / 2;
        bandLow.position.y = 0.18;
        root.add(bandLow);
        break;
      }

      case 'shot': {
        const baseSlug = makeMesh(geoShotBaseSlug, matHeavyCrystal, false, 1);
        baseSlug.position.y = 0.095;
        root.add(baseSlug);

        const liquid = makeMesh(geoShotLiquid, matSpiritLiquid, false, 2);
        liquid.position.y = 0.38;
        root.add(liquid);

        const glass = makeMesh(geoShotGlass, matHeavyCrystal, true, 3);
        root.add(glass);

        const goldRim = makeMesh(geoShotGoldRim, matBrushedBrass, false, 4);
        goldRim.rotation.x = Math.PI / 2;
        goldRim.position.y = 0.68;
        root.add(goldRim);

        // Slight scale boost so shot glass reads boldly down the track
        root.scale.setScalar(1.25);
        break;
      }

      case 'napkin': {
        const base = makeMesh(geoNapkinBase, matNapkinLinen);
        base.position.y = 0.03;
        root.add(base);

        const centerFold = makeMesh(geoNapkinCone, matNapkinLinen);
        centerFold.position.y = 0.52;
        centerFold.rotation.y = Math.PI / 4;
        root.add(centerFold);

        const leftWing = makeMesh(geoNapkinWing, matNapkinLinen);
        leftWing.position.set(-0.14, 0.48, 0.04);
        leftWing.rotation.set(0.08, 0.5, 0.24);
        root.add(leftWing);

        const rightWing = makeMesh(geoNapkinWing, matNapkinLinen);
        rightWing.position.set(0.14, 0.48, -0.04);
        rightWing.rotation.set(-0.08, -0.5, -0.24);
        root.add(rightWing);

        const ring = makeMesh(geoNapkinRing, matBrushedBrass);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.34;
        root.add(ring);

        const ribbon = makeMesh(geoNapkinRibbon, matCrimsonRibbon, false);
        ribbon.rotation.x = Math.PI / 2;
        ribbon.position.y = 0.34;
        root.add(ribbon);
        break;
      }

      case 'wine': {
        const bottle = makeMesh(geoWineBottle, matWineBottleGlass);
        root.add(bottle);

        const foil = makeMesh(geoWineFoil, matWineFoil);
        foil.position.y = 1.41;
        root.add(foil);

        const foilCap = makeMesh(geoWineFoilCap, matWineFoil);
        foilCap.position.y = 1.565;
        root.add(foilCap);

        const neckCollar = makeMesh(geoWineNeckCollar, matBrushedBrass, false);
        neckCollar.rotation.x = Math.PI / 2;
        neckCollar.position.y = 1.27;
        root.add(neckCollar);

        const cork = makeMesh(geoWineCork, matCork);
        cork.position.y = 1.62;
        root.add(cork);

        const label = makeMesh(geoWineLabel, matWineLabel, false);
        label.position.y = 0.48;
        label.rotation.y = 0; // faces +Z toward player camera
        root.add(label);

        root.scale.setScalar(0.86);
        break;
      }
    }

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
