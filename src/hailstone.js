import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { buildPerceptualContent } from './content.js';

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

function createHailstoneGeometry(radius = 1, detail = 5, offsetSeed = 0) {
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
      direction.x * 1.45 + 10.7 + offsetSeed,
      direction.y * 1.45 - 2.8 + offsetSeed * 0.5,
      direction.z * 1.45 + 5.9 - offsetSeed * 0.33,
    );

    const mid = noise.noise(
      direction.x * 3.2 - 14.1 + offsetSeed * 0.7,
      direction.y * 3.2 + 7.4 - offsetSeed * 0.4,
      direction.z * 3.2 - 11.8 + offsetSeed * 0.8,
    );

    const fine = noise.noise(
      direction.x * 7.8 + 3.6 - offsetSeed,
      direction.y * 7.8 + 13.1 + offsetSeed * 0.35,
      direction.z * 7.8 - 1.7 + offsetSeed * 0.25,
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
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

function computeSafeRadius(geometry) {
  const positions = geometry.getAttribute('position');
  const cursor = new THREE.Vector3();
  let minRadius = Infinity;
  for (let i = 0; i < positions.count; i += 1) {
    cursor.fromBufferAttribute(positions, i);
    minRadius = Math.min(minRadius, cursor.length());
  }
  return Math.max(0.62, minRadius - 0.14);
}

function createFrostCorePoints({ count, seed, safeRadius, isInWhiteVoid }) {
  const random = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const geometry = new THREE.BufferGeometry();
  const candidate = new THREE.Vector3();
  let placed = 0;
  let attempts = 0;

  while (placed < count && attempts < count * 50) {
    attempts += 1;
    const x = random() * 2 - 1;
    const y = random() * 2 - 1;
    const z = random() * 2 - 1;
    const len2 = x * x + y * y + z * z;
    if (len2 > 1 || len2 < 0.015) continue;

    const radialBias = Math.pow(random(), 1.7);
    candidate.set(x, y, z).normalize().multiplyScalar(THREE.MathUtils.lerp(0.1, safeRadius * 0.92, radialBias));
    candidate.x *= 0.92;
    candidate.y *= 1.02;
    candidate.z *= 0.88;

    if (candidate.length() > safeRadius || isInWhiteVoid(candidate)) {
      continue;
    }

    const idx = placed * 3;
    positions[idx + 0] = candidate.x;
    positions[idx + 1] = candidate.y;
    positions[idx + 2] = candidate.z;
    sizes[placed] = THREE.MathUtils.lerp(0.9, 1.8, random());
    placed += 1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, placed * 3), 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes.subarray(0, placed), 1));

  const material = new THREE.PointsMaterial({
    color: '#f3f7fa',
    size: 0.014,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.09,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.renderOrder = 5;
  return points;
}

export function createHailstonePrototype(renderer, { reduced = false, debug = false } = {}) {
  const hailstoneGroup = new THREE.Group();
  hailstoneGroup.name = 'HailstoneGroup';

  const shellRoot = new THREE.Group();
  shellRoot.name = 'HailstoneShellRoot';
  hailstoneGroup.add(shellRoot);

  const frostTexture = createFrostTexture();
  frostTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  const shellDetail = reduced ? 3 : 5;
  const outerGeometry = createHailstoneGeometry(1, shellDetail, 0.0);
  const innerGeometry = createHailstoneGeometry(0.93, Math.max(2, shellDetail - 1), 6.8);
  const coreGeometry = createHailstoneGeometry(0.84, Math.max(2, shellDetail - 1), 11.4);
  const safeRadius = computeSafeRadius(outerGeometry);

  const content = buildPerceptualContent({ safeRadius, reduced, debug });

  const coreMaterial = new THREE.MeshStandardMaterial({
    color: '#eef3f7',
    roughness: 0.96,
    metalness: 0.0,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.BackSide,
    bumpMap: frostTexture,
    bumpScale: 0.008,
  });

  const mistMaterial = new THREE.MeshStandardMaterial({
    color: '#d7e0e8',
    roughness: 1.0,
    metalness: 0.0,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
    side: THREE.DoubleSide,
    bumpMap: frostTexture,
    bumpScale: 0.006,
  });

  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: FROST_BASE,
    metalness: 0.0,
    roughness: reduced ? 0.29 : 0.26,
    clearcoat: reduced ? 0.0 : 0.18,
    clearcoatRoughness: 0.12,
    transmission: reduced ? 0.90 : 0.94,
    thickness: 0.62,
    ior: 1.22,
    attenuationColor: new THREE.Color('#e3edf4'),
    attenuationDistance: 1.7,
    specularIntensity: 0.84,
    envMapIntensity: reduced ? 0.72 : 1.0,
    bumpMap: frostTexture,
    bumpScale: reduced ? 0.010 : 0.018,
    roughnessMap: frostTexture,
  });

  const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
  coreMesh.renderOrder = 0;

  const mistMesh = new THREE.Mesh(innerGeometry, mistMaterial);
  mistMesh.renderOrder = 20;

  const outerShell = new THREE.Mesh(outerGeometry, shellMaterial);
  outerShell.renderOrder = 30;

  const frostCore = createFrostCorePoints({
    count: reduced ? 250 : 420,
    seed: 1337,
    safeRadius,
    isInWhiteVoid: content.isInWhiteVoid,
  });

  shellRoot.add(coreMesh, frostCore, mistMesh, outerShell);
  hailstoneGroup.add(content.group);

  if (debug) {
    const safeSphere = new THREE.Mesh(
      new THREE.SphereGeometry(safeRadius, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0x87c8ff, wireframe: true, transparent: true, opacity: 0.08 }),
    );
    safeSphere.name = 'DebugSafeRadius';
    hailstoneGroup.add(safeSphere);
  }

  hailstoneGroup.userData.safeRadius = safeRadius;
  hailstoneGroup.userData.dispose = () => {
    outerGeometry.dispose();
    innerGeometry.dispose();
    coreGeometry.dispose();
    shellMaterial.dispose();
    coreMaterial.dispose();
    mistMaterial.dispose();
    frostCore.geometry.dispose();
    frostCore.material.dispose();
    content.group.userData.dispose?.();
    frostTexture.dispose();
  };

  return hailstoneGroup;
}
