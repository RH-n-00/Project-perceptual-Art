import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const BACKGROUND = 0x23272b;
const RADIUS = 1.0;
const SHAPE_SEED = 4909;
const CLOCK = new THREE.Clock();
const NOISE = new ImprovedNoise();

const app = {
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  envRT: null,
  root: new THREE.Group(),
  hailstoneGroup: new THREE.Group(),
  autoRig: new THREE.Group(),
  currentTier: null,
  interactionActive: false,
  resumeAt: 0,
  autoInfluence: 1,
  shellMesh: null,
  coreMesh: null,
  hintEl: document.getElementById('hint'),
  loadingEl: document.getElementById('loading')
};

init();

function init() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.setClearColor(BACKGROUND, 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);
  app.renderer = renderer;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);
  app.scene = scene;

  const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 50);
  camera.position.set(0, 0.05, 4.18);
  app.camera = camera;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.rotateSpeed = 0.62;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI - 0.08;
  controls.target.set(0, 0, 0);
  controls.update();
  controls.addEventListener('start', onControlStart);
  controls.addEventListener('end', onControlEnd);
  app.controls = controls;

  setupLighting(scene, renderer);

  app.root.add(app.autoRig);
  app.autoRig.add(app.hailstoneGroup);
  scene.add(app.root);

  app.currentTier = getTier();
  buildHailstone(app.currentTier);

  window.addEventListener('resize', onResize);
  window.addEventListener('pointerdown', hideHint, { once: true });
  window.addEventListener('touchstart', hideHint, { once: true, passive: true });
  window.addEventListener('keydown', hideHint, { once: true });

  requestAnimationFrame(() => {
    app.loadingEl.classList.add('is-hidden');
  });

  renderer.setAnimationLoop(render);
}

function setupLighting(scene, renderer) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileCubemapShader();
  const room = new RoomEnvironment();
  app.envRT = pmremGenerator.fromScene(room, 0.02);
  scene.environment = app.envRT.texture;
  room.dispose();
  pmremGenerator.dispose();

  const hemi = new THREE.HemisphereLight(0xdfe8f4, 0x14161a, 0.92);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xf7fbff, 1.9);
  key.position.set(3.8, 2.6, 4.4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xd9e5f5, 0.52);
  fill.position.set(-3.3, 1.4, -2.6);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xe8f0fb, 0.38);
  rim.position.set(0.5, -2.5, 4.8);
  scene.add(rim);
}

// tier selection block
function getTier() {
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  return (coarsePointer || shortSide < 900) ? 'REDUCED' : 'FULL';
}

function getTierConfig(tier) {
  if (tier === 'REDUCED') {
    return {
      shellDetail: 5,
      coreDetail: 3,
      shellIor: 1.31,
      shellTransmission: 0.97,
      shellThickness: 0.64 * RADIUS,
      shellAttenuationDistance: 1.38 * RADIUS,
      shellRoughness: 0.29,
      shellClearcoat: 0.05,
      shellClearcoatRoughness: 0.18,
      shellEnvMapIntensity: 0.92,
      coreRadius: 0.45 * RADIUS,
      coreOffsetMagnitude: 0.032 * RADIUS,
      coreEnvMapIntensity: 0.12,
      pixelRatioCap: 1.5
    };
  }

  return {
    shellDetail: 6,
    coreDetail: 4,
    shellIor: 1.31,
    shellTransmission: 0.985,
    shellThickness: 0.70 * RADIUS,
    shellAttenuationDistance: 1.50 * RADIUS,
    shellRoughness: 0.26,
    shellClearcoat: 0.22,
    shellClearcoatRoughness: 0.12,
    shellEnvMapIntensity: 1.02,
    coreRadius: 0.46 * RADIUS,
    coreOffsetMagnitude: 0.038 * RADIUS,
    coreEnvMapIntensity: 0.16,
    pixelRatioCap: 2
  };
}

function buildHailstone(tier) {
  clearGroup(app.hailstoneGroup);

  const cfg = getTierConfig(tier);
  app.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.pixelRatioCap));

  const shellGeometry = createShellGeometry(cfg.shellDetail, SHAPE_SEED);
  const core = createCoreMesh(cfg, SHAPE_SEED + 71);

  // shell material block
  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xf6fbff),
    metalness: 0,
    roughness: cfg.shellRoughness,
    ior: cfg.shellIor,
    transmission: cfg.shellTransmission,
    thickness: cfg.shellThickness,
    attenuationDistance: cfg.shellAttenuationDistance,
    attenuationColor: new THREE.Color(0xf2f6ff),
    clearcoat: cfg.shellClearcoat,
    clearcoatRoughness: cfg.shellClearcoatRoughness,
    envMapIntensity: cfg.shellEnvMapIntensity
  });

  const shellMesh = new THREE.Mesh(shellGeometry, shellMaterial);
  shellMesh.renderOrder = 2;
  shellMesh.frustumCulled = false;

  app.shellMesh = shellMesh;
  app.coreMesh = core;

  app.hailstoneGroup.add(core);
  app.hailstoneGroup.add(shellMesh);
}

function createShellGeometry(detail, seed) {
  const geometry = new THREE.IcosahedronGeometry(RADIUS, detail);
  const position = geometry.attributes.position;
  const temp = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const axisA = seededDirection(seed * 0.91 + 1.37);
  const axisB = seededDirection(seed * 0.37 + 5.19);
  const axisC = seededDirection(seed * 0.53 + 9.41);

  for (let i = 0; i < position.count; i += 1) {
    temp.fromBufferAttribute(position, i);
    normal.copy(temp).normalize();

    const low = NOISE.noise(normal.x * 2.2 + 13.4, normal.y * 2.0 - 7.1, normal.z * 2.4 + 11.6);
    const mid = NOISE.noise(normal.x * 5.4 - 3.7, normal.y * 5.8 + 8.3, normal.z * 5.2 - 9.9);
    const high = NOISE.noise(normal.x * 10.8 + 14.9, normal.y * 11.2 - 4.4, normal.z * 10.5 + 6.8);

    const ridge = 1 - Math.abs(mid);
    const lobe =
      0.48 * Math.pow(Math.max(0, normal.dot(axisA)), 2.5) +
      0.34 * Math.pow(Math.max(0, normal.dot(axisB)), 2.0) +
      0.22 * Math.pow(Math.max(0, normal.dot(axisC)), 2.1);

    const radialFactor = THREE.MathUtils.clamp(
      1 + low * 0.070 + (ridge * 2 - 1) * 0.028 + high * 0.017 + lobe * 0.030,
      0.89,
      1.135
    );

    const faceting = 1 + Math.round(high * 3) * 0.0035;
    temp.copy(normal).multiplyScalar(RADIUS * radialFactor * faceting);
    position.setXYZ(i, temp.x, temp.y, temp.z);
  }

  geometry.computeVertexNormals();
  return geometry;
}

// core generation block
function createCoreMesh(cfg, seed) {
  const geometry = new THREE.IcosahedronGeometry(cfg.coreRadius, cfg.coreDetail);
  const position = geometry.attributes.position;
  const colors = [];
  const temp = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const offset = seededDirection(seed * 0.33 + 1.7).multiplyScalar(cfg.coreOffsetMagnitude);

  for (let i = 0; i < position.count; i += 1) {
    temp.fromBufferAttribute(position, i);
    normal.copy(temp).normalize();

    const primary = NOISE.noise(normal.x * 1.55 + 2.3, normal.y * 1.45 - 5.7, normal.z * 1.65 + 4.9);
    const secondary = NOISE.noise(normal.x * 3.8 - 7.4, normal.y * 3.5 + 9.3, normal.z * 3.7 - 11.2);
    const ridge = 1 - Math.abs(secondary);

    const coreScale = THREE.MathUtils.clamp(
      1 + primary * 0.085 + (ridge * 2 - 1) * 0.052,
      0.86,
      1.13
    );

    temp.copy(normal).multiplyScalar(cfg.coreRadius * coreScale);
    temp.add(offset);
    position.setXYZ(i, temp.x, temp.y, temp.z);

    const luminance = THREE.MathUtils.clamp(0.79 + primary * 0.055 + ridge * 0.13, 0.72, 0.96);
    const coolBias = THREE.MathUtils.clamp(0.015 + secondary * 0.01, 0, 0.03);
    colors.push(luminance, luminance + coolBias, luminance + coolBias * 1.7);
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xeef2f7),
    metalness: 0,
    roughness: 0.94,
    vertexColors: true,
    envMapIntensity: cfg.coreEnvMapIntensity
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  return mesh;
}

function clearGroup(group) {
  while (group.children.length > 0) {
    const child = group.children[group.children.length - 1];
    group.remove(child);
    disposeObject(child);
  }
}

function disposeObject(object) {
  object.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
      if (Array.isArray(node.material)) {
        node.material.forEach((m) => m.dispose());
      } else {
        node.material.dispose();
      }
    }
  });
}

function seededDirection(seed) {
  const rng = mulberry32(Math.floor(seed * 100000));
  const z = rng() * 2 - 1;
  const theta = rng() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), z).normalize();
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return function next() {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function onControlStart() {
  app.interactionActive = true;
  app.resumeAt = Number.POSITIVE_INFINITY;
}

function onControlEnd() {
  app.interactionActive = false;
  app.resumeAt = performance.now() + 1400;
}

function hideHint() {
  app.hintEl.classList.add('is-hidden');
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  app.camera.aspect = width / height;
  app.camera.updateProjectionMatrix();
  app.renderer.setSize(width, height);

  const nextTier = getTier();
  const cfg = getTierConfig(nextTier);
  app.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.pixelRatioCap));
  if (nextTier !== app.currentTier) {
    app.currentTier = nextTier;
    buildHailstone(nextTier);
  }
}

let elapsedTime = 0;

function render() {
  const delta = CLOCK.getDelta();
  elapsedTime += delta;
  const now = performance.now();

  if (app.interactionActive || now < app.resumeAt) {
    app.autoInfluence = THREE.MathUtils.damp(app.autoInfluence, 0, 4.6, delta);
  } else {
    app.autoInfluence = THREE.MathUtils.damp(app.autoInfluence, 1, 1.5, delta);
  }

  applyAutoRotation(elapsedTime, delta, app.autoInfluence);
  app.controls.update();
  app.renderer.render(app.scene, app.camera);
}

const AUTO_EULER_A = new THREE.Euler();
const AUTO_EULER_B = new THREE.Euler();
const AUTO_Q_A = new THREE.Quaternion();
const AUTO_Q_B = new THREE.Quaternion();
const AUTO_Q_TARGET = new THREE.Quaternion();

function applyAutoRotation(t, delta, influence) {
  AUTO_EULER_A.set(t * 0.145, t * 0.17, t * 0.095, 'YXZ');
  AUTO_EULER_B.set(
    0.19 * Math.sin(t * 0.22 + 0.5),
    0.24 * Math.sin(t * 0.14 + 2.1),
    0.14 * Math.sin(t * 0.19 - 0.9),
    'XYZ'
  );

  AUTO_Q_A.setFromEuler(AUTO_EULER_A);
  AUTO_Q_B.setFromEuler(AUTO_EULER_B);
  AUTO_Q_TARGET.copy(AUTO_Q_A).multiply(AUTO_Q_B);

  if (influence <= 0.001) return;
  const step = 1 - Math.exp(-delta * 2.8 * influence);
  app.autoRig.quaternion.slerp(AUTO_Q_TARGET, THREE.MathUtils.clamp(step, 0, 1));
}
