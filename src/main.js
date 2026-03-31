import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createHailstonePrototype } from './hailstone.js';
import { buildPerceptualContent } from './content.js';
import { createRotationRig } from './rotationRig.js';

const params = new URLSearchParams(window.location.search);
const canvas = document.getElementById('app');
const hint = document.getElementById('hint');

const initialView = ['front', 'right', 'top'].includes(params.get('view')) ? params.get('view') : 'front';
const autoEnabled = params.get('auto') !== '0';
const debug = params.get('debug') === '1';
const debugContent = params.get('debugContent') === '1';
const layerFilter = ['all', 'hale', 'hail', 'uj'].includes(params.get('layer')) ? (params.get('layer') || 'all') : 'all';
const hailCountParam = Number.parseInt(params.get('hailCount') || '', 10);
const hailCount = Number.isFinite(hailCountParam)
  ? THREE.MathUtils.clamp(hailCountParam, 0, 1200)
  : 320;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#23272b');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 30);
camera.position.set(0, 0, 4.2);
scene.add(camera);

const environment = new RoomEnvironment();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const envMap = pmremGenerator.fromScene(environment, 0.03, 0.1, 40).texture;
scene.environment = envMap;
environment.dispose();
pmremGenerator.dispose();

const keyLight = new THREE.DirectionalLight('#f4f8ff', 1.1);
keyLight.position.set(4.5, 3.2, 5.6);
scene.add(keyLight);

const fillLight = new THREE.HemisphereLight('#cfd9e3', '#1d2125', 0.85);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight('#c9d8e6', 0.65);
rimLight.position.set(-5.8, 1.4, -4.8);
scene.add(rimLight);

const artworkRoot = new THREE.Group();
artworkRoot.name = 'ArtworkRoot';
const autoRig = new THREE.Group();
autoRig.name = 'AutoRig';
const userRig = new THREE.Group();
userRig.name = 'UserRig';
const sculptureRoot = new THREE.Group();
sculptureRoot.name = 'SculptureRoot';

const sculpture = createHailstonePrototype(renderer);
sculptureRoot.add(sculpture);
userRig.add(sculptureRoot);
autoRig.add(userRig);
artworkRoot.add(autoRig);
scene.add(artworkRoot);

function createHailField({ source, count, seed = 17 }) {
  const group = new THREE.Group();
  group.name = 'HailField';
  const random = (() => {
    let t = seed >>> 0;
    return function randomValue() {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const flakes = [];
  const spread = 6.4;

  for (let i = 0; i < count; i += 1) {
    const flake = source.clone(true);
    flake.name = `Hailstone_${i + 1}`;

    const content = flake.getObjectByName('PerceptualContentRoot');
    if (content) {
      content.clear();
      content.visible = false;
    }

    const scale = THREE.MathUtils.lerp(0.035, 0.11, random());
    flake.scale.setScalar(scale);
    flake.position.set(
      (random() - 0.5) * spread * 1.8,
      (random() - 0.5) * spread * 1.4,
      (random() - 0.5) * spread * 1.6,
    );
    flake.rotation.set(
      random() * Math.PI * 2,
      random() * Math.PI * 2,
      random() * Math.PI * 2,
    );

    const drift = new THREE.Vector3(
      (random() - 0.5) * 0.05,
      -THREE.MathUtils.lerp(0.06, 0.22, random()),
      (random() - 0.5) * 0.05,
    );

    flakes.push({ flake, drift });
    group.add(flake);
  }

  return {
    group,
    update(deltaSeconds) {
      for (const { flake, drift } of flakes) {
        flake.position.addScaledVector(drift, deltaSeconds);
        flake.rotation.x += deltaSeconds * 0.35;
        flake.rotation.y += deltaSeconds * 0.25;
        if (flake.position.y < -spread) {
          flake.position.y = spread;
          flake.position.x = (random() - 0.5) * spread * 1.8;
          flake.position.z = (random() - 0.5) * spread * 1.6;
        }
      }
    },
  };
}

const hailField = createHailField({ source: sculpture, count: hailCount });
artworkRoot.add(hailField.group);

const contentHandle = buildPerceptualContent({
  THREE,
  safeRadius: sculpture.userData.metrics.safeRadius,
  mode: debugContent ? 'debug' : 'production',
  layerFilter,
  debug,
});

const { perceptualContentRoot, shellRoot } = sculpture.userData.refs;
perceptualContentRoot.clear();
perceptualContentRoot.add(contentHandle.root);
perceptualContentRoot.visible = true;

if (layerFilter === 'all' || layerFilter === 'uj') {
  sculpture.userData.methods.rebuildBubblePoints({ isExcluded: contentHandle.whiteVoidTest });
}

let debugSafeRadius = null;
if (debug) {
  const sphere = new THREE.SphereGeometry(sculpture.userData.metrics.safeRadius, 16, 10);
  const wire = new THREE.WireframeGeometry(sphere);
  debugSafeRadius = new THREE.LineSegments(
    wire,
    new THREE.LineBasicMaterial({
      color: 0x99e4ff,
      transparent: true,
      opacity: 0.16,
      depthTest: false,
      toneMapped: false,
    }),
  );
  debugSafeRadius.name = 'SafeRadiusDebug';
  debugSafeRadius.renderOrder = 44;
  shellRoot.add(debugSafeRadius);
  sphere.dispose();
}

const rotationRig = createRotationRig({
  THREE,
  domElement: renderer.domElement,
  hintElement: hint,
  artworkRoot,
  autoRig,
  userRig,
  initialView,
  autoEnabled,
});
rotationRig.setCanonicalView(initialView);
rotationRig.setAutoEnabled(autoEnabled);

window.__hailstoneApp = {
  scene,
  camera,
  artworkRoot,
  autoRig,
  userRig,
  sculpture,
  contentHandle,
  rotationRig,
};

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onResize);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();
  rotationRig.update(delta, elapsed);
  hailField.update(delta);
  renderer.render(scene, camera);
});

function cleanup() {
  renderer.setAnimationLoop(null);
  window.removeEventListener('resize', onResize);
  rotationRig.dispose();
  if (debugSafeRadius) {
    shellRoot.remove(debugSafeRadius);
    debugSafeRadius.geometry.dispose();
    debugSafeRadius.material.dispose();
  }
  contentHandle.dispose?.();
  sculpture.userData.dispose?.();
  envMap.dispose();
  renderer.dispose();
}

window.addEventListener('pagehide', cleanup, { once: true });
