import * as THREE from 'three';

export interface ProceduralTexturePack {
  woodAlbedo: THREE.CanvasTexture;
  woodRoughness: THREE.CanvasTexture;
  clothGingham: THREE.CanvasTexture;
  napkinDamask: THREE.CanvasTexture;
  wineLabel: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

function finalizeDataTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTexturePack {
  // 1. Rich Walnut Dining Track Wood Albedo + Roughness
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 512;
  woodCanvas.height = 512;
  const wCtx = woodCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext('2d')!;

  wCtx.fillStyle = '#2a1c14';
  wCtx.fillRect(0, 0, 512, 512);
  rCtx.fillStyle = '#5c5c5c';
  rCtx.fillRect(0, 0, 512, 512);

  // Subtle vertical plank variation & grain streaks
  const plankCount = 4;
  const plankW = 512 / plankCount;
  for (let p = 0; p < plankCount; p++) {
    const shade = p % 2 === 0 ? '#2f2017' : '#261912';
    wCtx.fillStyle = shade;
    wCtx.fillRect(p * plankW, 0, plankW, 512);

    // Fine wood grain fibers
    for (let i = 0; i < 65; i++) {
      const gx = p * plankW + ((i * 29 + p * 17) % plankW);
      const alpha = 0.04 + ((i * 13) % 10) * 0.01;
      wCtx.strokeStyle = i % 3 === 0 ? `rgba(74, 48, 30, ${alpha})` : `rgba(14, 9, 6, ${alpha})`;
      wCtx.lineWidth = 1 + (i % 3);
      wCtx.beginPath();
      wCtx.moveTo(gx, 0);
      wCtx.bezierCurveTo(gx + 3, 170, gx - 3, 340, gx, 512);
      wCtx.stroke();

      rCtx.strokeStyle = i % 2 === 0 ? 'rgba(130,130,130,0.22)' : 'rgba(60,60,60,0.22)';
      rCtx.lineWidth = 1.5;
      rCtx.beginPath();
      rCtx.moveTo(gx, 0);
      rCtx.lineTo(gx, 512);
      rCtx.stroke();
    }

    // Subtle brass-tinted seam between planks
    wCtx.fillStyle = 'rgba(12, 8, 5, 0.7)';
    wCtx.fillRect(p * plankW, 0, 2, 512);
  }

  const woodAlbedo = finalizeColorTexture(woodCanvas, maxAnisotropy, 1, 6);
  const woodRoughness = finalizeDataTexture(roughCanvas, maxAnisotropy, 1, 6);

  // 2. Checkered Bistro Table Cloth (Hadr na stůl)
  const clothCanvas = document.createElement('canvas');
  clothCanvas.width = 256;
  clothCanvas.height = 256;
  const cCtx = clothCanvas.getContext('2d')!;
  cCtx.fillStyle = '#f3eadb';
  cCtx.fillRect(0, 0, 256, 256);

  const cell = 32;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if ((x + y) % 2 === 0) {
        cCtx.fillStyle = '#b93b2e';
        cCtx.fillRect(x * cell, y * cell, cell, cell);
      } else if (x % 2 === 0) {
        cCtx.fillStyle = 'rgba(185, 59, 46, 0.35)';
        cCtx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }
  // Woven cotton threads
  cCtx.strokeStyle = 'rgba(255, 250, 242, 0.16)';
  cCtx.lineWidth = 1;
  for (let i = 0; i < 256; i += 4) {
    cCtx.beginPath();
    cCtx.moveTo(i, 0);
    cCtx.lineTo(i, 256);
    cCtx.moveTo(0, i);
    cCtx.lineTo(256, i);
    cCtx.stroke();
  }
  const clothGingham = finalizeColorTexture(clothCanvas, maxAnisotropy, 2, 2);

  // 3. Ivory Damask Linen Napkin (Ubrousek)
  const napkinCanvas = document.createElement('canvas');
  napkinCanvas.width = 256;
  napkinCanvas.height = 256;
  const nCtx = napkinCanvas.getContext('2d')!;
  nCtx.fillStyle = '#f2e8d5';
  nCtx.fillRect(0, 0, 256, 256);
  nCtx.strokeStyle = 'rgba(186, 162, 122, 0.28)';
  nCtx.lineWidth = 1.5;
  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 256; x += 32) {
      nCtx.beginPath();
      nCtx.moveTo(x + 16, y + 4);
      nCtx.lineTo(x + 28, y + 16);
      nCtx.lineTo(x + 16, y + 28);
      nCtx.lineTo(x + 4, y + 16);
      nCtx.closePath();
      nCtx.stroke();
    }
  }
  // Hem border stripe
  nCtx.strokeStyle = 'rgba(176, 134, 66, 0.55)';
  nCtx.lineWidth = 4;
  nCtx.strokeRect(10, 10, 236, 236);
  const napkinDamask = finalizeColorTexture(napkinCanvas, maxAnisotropy);

  // 4. Vintage Wine Bottle Label (Láhev vína)
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512;
  labelCanvas.height = 256;
  const lCtx = labelCanvas.getContext('2d')!;
  lCtx.fillStyle = '#f3e9d2';
  lCtx.fillRect(0, 0, 512, 256);

  // Burgundy & gold ornamental frame
  lCtx.strokeStyle = '#6d1b2b';
  lCtx.lineWidth = 8;
  lCtx.strokeRect(16, 16, 480, 224);
  lCtx.strokeStyle = '#c4943e';
  lCtx.lineWidth = 2;
  lCtx.strokeRect(26, 26, 460, 204);

  // Gold crest circle
  lCtx.fillStyle = '#c4943e';
  lCtx.beginPath();
  lCtx.arc(256, 72, 22, 0, Math.PI * 2);
  lCtx.fill();
  lCtx.fillStyle = '#6d1b2b';
  lCtx.beginPath();
  lCtx.arc(256, 72, 14, 0, Math.PI * 2);
  lCtx.fill();

  lCtx.fillStyle = '#2b1815';
  lCtx.font = 'bold 34px Georgia, serif';
  lCtx.textAlign = 'center';
  lCtx.fillText('CHÂTEAU RYTMUS', 256, 140);

  lCtx.fillStyle = '#7a2233';
  lCtx.font = 'italic 22px Georgia, serif';
  lCtx.fillText('Grand Réserve · Morava', 256, 178);

  lCtx.fillStyle = '#9c7228';
  lCtx.font = 'bold 18px Georgia, serif';
  lCtx.fillText('1924', 256, 210);

  const wineLabel = finalizeColorTexture(labelCanvas, maxAnisotropy);

  // 5. Soft Radial Contact Shadow Texture
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(8, 5, 3, 0.72)');
  grad.addColorStop(0.55, 'rgba(8, 5, 3, 0.34)');
  grad.addColorStop(1, 'rgba(8, 5, 3, 0.0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadow = finalizeColorTexture(shadowCanvas, 1);

  return {
    woodAlbedo,
    woodRoughness,
    clothGingham,
    napkinDamask,
    wineLabel,
    contactShadow,
    dispose: () => {
      woodAlbedo.dispose();
      woodRoughness.dispose();
      clothGingham.dispose();
      napkinDamask.dispose();
      wineLabel.dispose();
      contactShadow.dispose();
    },
  };
}
