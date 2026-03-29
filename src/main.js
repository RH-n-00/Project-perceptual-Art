import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createHailstonePrototype } from './hailstone.js';
import { createObjectRotationController } from './controller.js';

const params = new URLSearchParams(window.location.search);
const canvas = document.getElementById('app');
const hint = document.getElementById('hint');
const reduced = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
const debug = params.get('debug') === '1';
const staticView = params.get('view');
const disableAuto = params.get('auto') === '0';

const scene = new THREE.Scene();
scene.background = new THREE.Color('#23272b');
scene.fog = new THREE.FogExp2('#23272b', 0.065);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.90;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, reduced ? 1.25 : 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 30);
camera.position.set(0, 0, 4.2);
camera.lookAt(0, 0, 0);
scene.add(camera);

const environment = new RoomEnvironment();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const envMap = pmremGenerator.fromScene(environment, 0.03, 0.1, 40).texture;
scene.environment = envMap;
environment.dispose();
pmremGenerator.dispose();

const fillLight = new THREE.HemisphereLight('#d4dde6', '#1c2024', 0.35);
scene.add(fillLight);

const keyLight = new THREE.DirectionalLight('#eff5fb', 1.25);
keyLight.position.set(3, 4, 6);
scene.add(keyLight);

const fillDirectional = new THREE.DirectionalLight('#c7d3df', 0.35);
fillDirectional.position.set(-4, -1, 2);
scene.add(fillDirectional);

const rimLight = new THREE.DirectionalLight('#dce7f1', 0.75);
rimLight.position.set(-5, 3, -4);
scene.add(rimLight);

const artworkRoot = new THREE.Group();
artworkRoot.name = 'ArtworkRoot';
const autoRig = new THREE.Group();
autoRig.name = 'AutoRig';
const userRig = new THREE.Group();
userRig.name = 'UserRig';
const hailstone = createHailstonePrototype(renderer, { reduced, debug });
userRig.add(hailstone);
autoRig.add(userRig);
artworkRoot.add(autoRig);
scene.add(artworkRoot);

const qFront = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.0, 0.0, 0.03, 'YXZ'));
const qObliqueA = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, -0.36, 0.12, 'YXZ'));
const qRight = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.0, -Math.PI / 2, -0.04, 'YXZ'));
const qObliqueB = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.48, -1.08, 0.12, 'YXZ'));
const qTop = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0.05, -0.12, 'YXZ'));
const qObliqueC = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.76, 0.48, 0.22, 'YXZ'));

const canonicalViews = {
  front: qFront,
  right: qRight,
  top: qTop,
  obliqueA: qObliqueA,
  obliqueB: qObliqueB,
  obliqueC: qObliqueC,
};

const autoPath = [
  { quaternion: qFront, hold: 1.2, travel: 3.8 },
  { quaternion: qObliqueA, hold: 0.65, travel: 3.8 },
  { quaternion: qRight, hold: 1.2, travel: 4.0 },
  { quaternion: qObliqueB, hold: 0.65, travel: 4.2 },
  { quaternion: qTop, hold: 1.25, travel: 4.2 },
  { quaternion: qObliqueC, hold: 0.65, travel: 3.9 },
];

const autoState = {
  segmentIndex: 0,
  phase: 'hold',
  elapsed: 0,
  resumeAt: 0,
  enabled: !disableAuto,
};

function smootherStep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function updateAutoRotation(deltaSeconds, timeSeconds, controller) {
  if (!autoState.enabled) {
    return;
  }
  if (controller.isDragging || !controller.isSettled || timeSeconds < autoState.resumeAt) {
    return;
  }

  const currentPose = autoPath[autoState.segmentIndex];
  const nextPose = autoPath[(autoState.segmentIndex + 1) % autoPath.length];
  autoState.elapsed += deltaSeconds;

  if (autoState.phase === 'hold') {
    autoRig.quaternion.copy(currentPose.quaternion);
    if (autoState.elapsed >= currentPose.hold) {
      autoState.phase = 'travel';
      autoState.elapsed = 0;
    }
    return;
  }

  const travelProgress = THREE.MathUtils.clamp(autoState.elapsed / currentPose.travel, 0, 1);
  autoRig.quaternion.slerpQuaternions(
    currentPose.quaternion,
    nextPose.quaternion,
    smootherStep(travelProgress),
  );

  if (travelProgress >= 1) {
    autoState.segmentIndex = (autoState.segmentIndex + 1) % autoPath.length;
    autoState.phase = 'hold';
    autoState.elapsed = 0;
  }
}

if (staticView && canonicalViews[staticView]) {
  autoRig.quaternion.copy(canonicalViews[staticView]);
  autoState.enabled = false;
}

const controller = createObjectRotationController({
  domElement: renderer.domElement,
  userRig,
  hintElement: hint,
  onInteractionStart() {
    autoState.resumeAt = Infinity;
  },
  onInteractionSettled() {
    autoState.resumeAt = performance.now() / 1000 + 0.9;
  },
});

window.__hailstoneApp = {
  scene,
  camera,
  artworkRoot,
  autoRig,
  userRig,
  hailstone,
  canonicalViews,
};

window.addEventListener('resize', () => {
  const reducedNow = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, reducedNow ? 1.25 : 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  controller.update(delta);
  updateAutoRotation(delta, elapsed, controller);
  renderer.render(scene, camera);
});

window.addEventListener('pagehide', () => {
  renderer.setAnimationLoop(null);
  controller.dispose();
  hailstone.userData.dispose?.();
  envMap.dispose();
  renderer.dispose();
});
