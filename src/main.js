import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createHailstonePrototype } from './hailstone.js';

const canvas = document.getElementById('app');
const hint = document.getElementById('hint');

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

const sculpture = createHailstonePrototype(renderer);
scene.add(sculpture);

const keyLight = new THREE.DirectionalLight('#f4f8ff', 1.1);
keyLight.position.set(4.5, 3.2, 5.6);
scene.add(keyLight);

const fillLight = new THREE.HemisphereLight('#cfd9e3', '#1d2125', 0.85);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight('#c9d8e6', 0.65);
rimLight.position.set(-5.8, 1.4, -4.8);
scene.add(rimLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.enableZoom = false;
controls.rotateSpeed = 0.72;
controls.minDistance = 4.2;
controls.maxDistance = 4.2;
controls.minPolarAngle = 0.02;
controls.maxPolarAngle = Math.PI - 0.02;
controls.target.set(0, 0, 0);
controls.update();

const front = new THREE.Quaternion();
const obliqueA = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.22, 0.52, 0.18, 'YXZ'));
const right = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, -Math.PI / 2, -0.08, 'YXZ'));
const obliqueB = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.33, -1.04, 0.16, 'YXZ'));
const top = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0.12, -0.16, 'YXZ'));
const obliqueC = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.72, 0.52, 0.28, 'YXZ'));

const autoPath = [
  { quaternion: front, hold: 1.2, travel: 3.8 },
  { quaternion: obliqueA, hold: 0.65, travel: 3.8 },
  { quaternion: right, hold: 1.2, travel: 4.0 },
  { quaternion: obliqueB, hold: 0.65, travel: 4.2 },
  { quaternion: top, hold: 1.25, travel: 4.2 },
  { quaternion: obliqueC, hold: 0.65, travel: 3.9 },
];

const autoState = {
  segmentIndex: 0,
  phase: 'hold',
  elapsed: 0,
  resumeAt: 0,
  isPausedByUser: false,
};

function smootherStep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function updateAutoRotation(deltaSeconds, timeSeconds) {
  if (autoState.isPausedByUser || timeSeconds < autoState.resumeAt) {
    return;
  }

  const currentPose = autoPath[autoState.segmentIndex];
  const nextPose = autoPath[(autoState.segmentIndex + 1) % autoPath.length];

  autoState.elapsed += deltaSeconds;

  if (autoState.phase === 'hold') {
    sculpture.quaternion.copy(currentPose.quaternion);
    if (autoState.elapsed >= currentPose.hold) {
      autoState.phase = 'travel';
      autoState.elapsed = 0;
    }
    return;
  }

  const travelProgress = THREE.MathUtils.clamp(autoState.elapsed / currentPose.travel, 0, 1);
  sculpture.quaternion.slerpQuaternions(
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

controls.addEventListener('start', () => {
  autoState.isPausedByUser = true;
  autoState.resumeAt = 0;
  document.body.classList.add('dragging');
  if (hint) {
    hint.style.animation = 'none';
    hint.style.opacity = '0';
  }
});

controls.addEventListener('end', () => {
  autoState.isPausedByUser = false;
  autoState.resumeAt = performance.now() / 1000 + 1.15;
  document.body.classList.remove('dragging');
});

renderer.domElement.addEventListener('pointerdown', () => {
  if (hint) {
    hint.style.animation = 'none';
    hint.style.opacity = '0';
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  updateAutoRotation(delta, elapsed);
  controls.update();
  renderer.render(scene, camera);
});

window.addEventListener('pagehide', () => {
  renderer.setAnimationLoop(null);
  sculpture.userData.dispose?.();
  envMap.dispose();
  controls.dispose();
  renderer.dispose();
});
