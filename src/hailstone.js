import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

const FROST_BASE = new THREE.Color('#dce6ee');

function mulberry32(seed) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createFrostTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.createImageData(size, size);
  const data = image.data;
  const noise = new ImprovedNoise();

  let index = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size - 0.5;
      const ny = y / size - 0.5;

      const broad = noise.noise(nx * 3.6, ny * 3.6, 0.12);
      const medium = noise.noise(nx * 9.4 + 8.3, ny * 9.4 - 5.1, 2.7);
      const fine = noise.noise(nx * 26.0 + 11.4, ny * 26.0 + 3.8, 9.2);
      const streaks = 1.0 - Math.abs(noise.noise(nx * 42.0 + 3.0, ny * 5.8 + 9.6, 5.7));

      let value = 0.57 + broad * 0.2 + medium * 0.13 + fine * 0.07 + streaks * 0.08;
      value = THREE.MathUtils.clamp(value, 0.0, 1.0);
      const gray = Math.round(value * 255);

      data[index + 0] = gray;
      data[index + 1] = gray;
      data[index + 2] = gray;
      data[index + 3] = 255;
      index += 4;
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.8, 2.8);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createHailstoneGeometry(radius = 1, detail = 5) {
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const positions = geometry.getAttribute('position');
  const noise = new ImprovedNoise();
  const original = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const displaced = new THREE.Vector3();
  const stretch = new THREE.Vector3(0.98, 1.05, 0.94);

  for (let i = 0; i < positions.count; i += 1) {
    original.fromBufferAttribute(positions, i);
    direction.copy(original).normalize();

    const low = noise.noise(
      direction.x * 1.45 + 10.7,
      direction.y * 1.45 - 2.8,
      direction.z * 1.45 + 5.9,
    );

    const mid = noise.noise(
      direction.x * 3.2 - 14.1,
      direction.y * 3.2 + 7.4,
      direction.z * 3.2 - 11.8,
    );

    const fine = noise.noise(
      direction.x * 7.8 + 3.6,
      direction.y * 7.8 + 13.1,
      direction.z * 7.8 - 1.7,
    );

    const ridge = 1.0 - Math.abs(fine);
    const faceting = Math.max(Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z));

    const radialMultiplier = 1.0
      + low * 0.08
      + mid * 0.035
      + (ridge - 0.5) * 0.02
      + (faceting - 0.70) * 0.056;

    displaced.copy(direction).multiply(stretch).multiplyScalar(radius * radialMultiplier);
    positions.setXYZ(i, displaced.x, displaced.y, displaced.z);
  }

  geometry.computeVertexNormals();
  return geometry;
}

function computeMinRadius(geometry) {
  const positions = geometry.getAttribute('position');
  const cursor = new THREE.Vector3();
  let minRadius = Infinity;
  for (let i = 0; i < positions.count; i += 1) {
    cursor.fromBufferAttribute(positions, i);
    minRadius = Math.min(minRadius, cursor.length());
  }
  return minRadius;
}

function createBubblePoints({ count = 340, seed = 7, isExcluded = null } = {}) {
  const random = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  const candidate = new THREE.Vector3();
  let placed = 0;
  let attempts = 0;
  const maxAttempts = count * 80;

  while (placed < count && attempts < maxAttempts) {
    attempts += 1;
    let x = 0;
    let y = 0;
    let z = 0;
    let lengthSquared = 2;

    while (lengthSquared > 1 || lengthSquared < 0.06) {
      x = random() * 2 - 1;
      y = random() * 2 - 1;
      z = random() * 2 - 1;
      lengthSquared = x * x + y * y + z * z;
    }

    const radiusScale = 0.23 + random() * 0.47;
    candidate.set(x * radiusScale * 0.92, y * radiusScale * 1.02, z * radiusScale * 0.88);
    if (isExcluded?.(candidate)) {
      continue;
    }

    const cursor = placed * 3;
    positions[cursor + 0] = candidate.x;
    positions[cursor + 1] = candidate.y;
    positions[cursor + 2] = candidate.z;
    placed += 1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, placed * 3), 3));

  const material = new THREE.PointsMaterial({
    color: '#f4f7fa',
    size: 0.017,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'BubblePoints';
  points.renderOrder = 5;
  return points;
}

export function createHailstonePrototype(renderer) {
  const sculpture = new THREE.Group();
  sculpture.name = 'HailstonePrototype';

  const shellRoot = new THREE.Group();
  shellRoot.name = 'HailstoneShellRoot';
  sculpture.add(shellRoot);

  const frostTexture = createFrostTexture();
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  frostTexture.anisotropy = Math.min(4, maxAnisotropy);

  const outerGeometry = createHailstoneGeometry(1, 5);
  const secondaryGeometry = outerGeometry.clone();
  const minRadius = computeMinRadius(outerGeometry);
  const safeRadius = minRadius - 0.10;

  const coreMaterial = new THREE.MeshStandardMaterial({
    color: '#eef3f7',
    roughness: 0.96,
    metalness: 0.0,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.BackSide,
    bumpMap: frostTexture,
    bumpScale: 0.01,
  });

  const mistMaterial = new THREE.MeshStandardMaterial({
    color: '#d7e0e8',
    roughness: 1.0,
    metalness: 0.0,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
    bumpMap: frostTexture,
    bumpScale: 0.008,
  });

  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: FROST_BASE,
    metalness: 0.0,
    roughness: 0.26,
    clearcoat: 0.22,
    clearcoatRoughness: 0.12,
    transmission: 0.97,
    thickness: 0.70,
    ior: 1.31,
    attenuationColor: new THREE.Color('#e3edf4'),
    attenuationDistance: 1.50,
    specularIntensity: 0.72,
    envMapIntensity: 1.12,
    bumpMap: frostTexture,
    bumpScale: 0.02,
    roughnessMap: frostTexture,
  });

  const isReduced = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
  if (isReduced) {
    shellMaterial.clearcoat = 0.0;
    shellMaterial.bumpScale *= 0.5;
    shellMaterial.envMapIntensity *= 0.6;
  }

  const coreMesh = new THREE.Mesh(secondaryGeometry, coreMaterial);
  coreMesh.name = 'CoreMesh';
  coreMesh.scale.setScalar(0.84);
  coreMesh.renderOrder = 0;

  const perceptualContentRoot = new THREE.Group();
  perceptualContentRoot.name = 'PerceptualContentRoot';

  let bubblePoints = createBubblePoints();

  const mistMesh = new THREE.Mesh(secondaryGeometry.clone(), mistMaterial);
  mistMesh.name = 'MistMesh';
  mistMesh.scale.setScalar(0.93);
  mistMesh.renderOrder = 20;

  const outerShell = new THREE.Mesh(outerGeometry, shellMaterial);
  outerShell.name = 'OuterShell';
  outerShell.renderOrder = 30;

  shellRoot.add(coreMesh);
  shellRoot.add(bubblePoints);
  shellRoot.add(perceptualContentRoot);
  shellRoot.add(mistMesh);
  shellRoot.add(outerShell);

  function rebuildBubblePoints({ isExcluded = null } = {}) {
    if (bubblePoints) {
      shellRoot.remove(bubblePoints);
      bubblePoints.geometry.dispose();
      bubblePoints.material.dispose();
    }
    bubblePoints = createBubblePoints({ count: 340, seed: 7, isExcluded });
    shellRoot.add(bubblePoints);
    sculpture.userData.refs.bubblePoints = bubblePoints;
    return bubblePoints;
  }

  sculpture.userData.refs = {
    shellRoot,
    coreMesh,
    bubblePoints,
    perceptualContentRoot,
    mistMesh,
    outerShell,
  };

  sculpture.userData.metrics = {
    minRadius,
    safeRadius,
  };

  sculpture.userData.methods = {
    rebuildBubblePoints,
  };

  sculpture.userData.dispose = () => {
    if (bubblePoints) {
      bubblePoints.geometry.dispose();
      bubblePoints.material.dispose();
    }
    outerGeometry.dispose();
    secondaryGeometry.dispose();
    mistMesh.geometry.dispose();
    shellMaterial.dispose();
    coreMaterial.dispose();
    mistMaterial.dispose();
    frostTexture.dispose();
    while (perceptualContentRoot.children.length > 0) {
      const child = perceptualContentRoot.children.pop();
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material?.dispose?.());
      } else {
        child.material?.dispose?.();
      }
    }
  };

  return sculpture;
}
