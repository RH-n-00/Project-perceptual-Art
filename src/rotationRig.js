export function createRotationRig({
  THREE,
  domElement,
  hintElement,
  artworkRoot,
  autoRig,
  userRig,
  initialView = 'front',
  autoEnabled = true,
}) {
  const IDENTITY = new THREE.Quaternion();
  const CANONICAL = {
    front: new THREE.Quaternion(),
    right: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2),
    top: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
  };

  const TOUR = [
    { name: 'front', hold: 1.2, travel: 7.0 },
    { name: 'right', hold: 1.2, travel: 7.0 },
    { name: 'top', hold: 1.2, travel: 7.0 },
  ];

  const state = {
    pointerId: null,
    dragging: false,
    lastX: 0,
    lastY: 0,
    lastMoveTime: 0,
    velX: 0,
    velY: 0,
    phase: 'IDLE_AUTO',
  };

  const autoState = {
    enabled: autoEnabled,
    segmentIndex: 0,
    segmentPhase: 'hold',
    elapsed: 0,
  };

  const tmpQX = new THREE.Quaternion();
  const tmpQY = new THREE.Quaternion();
  const WORLD_X = new THREE.Vector3(1, 0, 0);
  const WORLD_Y = new THREE.Vector3(0, 1, 0);

  function hideHint() {
    if (!hintElement) return;
    hintElement.style.animation = 'none';
    hintElement.style.opacity = '0';
  }

  function applyDragDelta(deltaX, deltaY) {
    const viewportMin = Math.max(480, Math.min(window.innerWidth, window.innerHeight));
    const rotY = -deltaX * 1.8 / viewportMin;
    const rotX = -deltaY * 1.6 / viewportMin;
    tmpQY.setFromAxisAngle(WORLD_Y, rotY);
    tmpQX.setFromAxisAngle(WORLD_X, rotX);
    userRig.quaternion.premultiply(tmpQY);
    userRig.quaternion.premultiply(tmpQX);
  }

  function smootherStep(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function setCanonicalView(name = 'front') {
    const viewName = CANONICAL[name] ? name : 'front';
    autoRig.quaternion.copy(CANONICAL[viewName]);
    userRig.quaternion.copy(IDENTITY);
    autoState.segmentIndex = TOUR.findIndex((segment) => segment.name === viewName);
    autoState.segmentPhase = 'hold';
    autoState.elapsed = 0;
  }

  function setAutoEnabled(flag) {
    autoState.enabled = Boolean(flag);
  }

  function updateAuto(deltaSeconds) {
    if (!autoState.enabled || state.phase !== 'IDLE_AUTO') {
      return;
    }

    const current = TOUR[autoState.segmentIndex];
    const next = TOUR[(autoState.segmentIndex + 1) % TOUR.length];
    autoState.elapsed += deltaSeconds;

    if (autoState.segmentPhase === 'hold') {
      autoRig.quaternion.copy(CANONICAL[current.name]);
      if (autoState.elapsed >= current.hold) {
        autoState.segmentPhase = 'travel';
        autoState.elapsed = 0;
      }
      return;
    }

    const t = THREE.MathUtils.clamp(autoState.elapsed / current.travel, 0, 1);
    autoRig.quaternion.slerpQuaternions(
      CANONICAL[current.name],
      CANONICAL[next.name],
      smootherStep(t),
    );

    if (t >= 1) {
      autoState.segmentIndex = (autoState.segmentIndex + 1) % TOUR.length;
      autoState.segmentPhase = 'hold';
      autoState.elapsed = 0;
    }
  }

  function onPointerDown(event) {
    if (state.pointerId !== null) return;
    state.pointerId = event.pointerId;
    state.dragging = true;
    state.phase = 'POINTER_ACTIVE';
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.lastMoveTime = performance.now();
    state.velX = 0;
    state.velY = 0;
    domElement.setPointerCapture?.(event.pointerId);
    document.body.classList.add('dragging');
    hideHint();
  }

  function onPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    const now = performance.now();
    const dt = Math.max(8, now - state.lastMoveTime);
    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.lastMoveTime = now;
    state.velX = dx / dt * 16.6667;
    state.velY = dy / dt * 16.6667;
    applyDragDelta(dx, dy);
  }

  function endPointer(event) {
    if (event.pointerId !== state.pointerId) return;
    state.dragging = false;
    state.pointerId = null;
    domElement.releasePointerCapture?.(event.pointerId);
    document.body.classList.remove('dragging');
    state.phase = 'INERTIA';
  }

  function updateInertia(deltaSeconds) {
    if (state.phase !== 'INERTIA') return;
    applyDragDelta(state.velX, state.velY);
    const damping = Math.exp(-deltaSeconds * 9.5);
    state.velX *= damping;
    state.velY *= damping;
    if (Math.abs(state.velX) + Math.abs(state.velY) < 0.06) {
      state.velX = 0;
      state.velY = 0;
      state.phase = 'RETURN_TO_AUTO';
    }
  }

  function updateReturn(deltaSeconds) {
    if (state.phase !== 'RETURN_TO_AUTO') return;
    userRig.quaternion.slerp(IDENTITY, 1 - Math.exp(-deltaSeconds * 1.9));
    if (userRig.quaternion.angleTo(IDENTITY) < 0.012) {
      userRig.quaternion.copy(IDENTITY);
      state.phase = 'IDLE_AUTO';
    }
  }

  function onPointerLeave(event) {
    if (state.dragging && event.pointerId === state.pointerId) {
      endPointer(event);
    }
  }

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', endPointer);
  domElement.addEventListener('pointercancel', endPointer);
  domElement.addEventListener('pointerleave', onPointerLeave);

  setCanonicalView(initialView);
  if (!autoState.enabled) {
    autoRig.quaternion.copy(CANONICAL[initialView] || CANONICAL.front);
  }

  return {
    update(deltaSeconds) {
      updateInertia(deltaSeconds);
      updateReturn(deltaSeconds);
      updateAuto(deltaSeconds);
    },
    setCanonicalView,
    setAutoEnabled,
    dispose() {
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerup', endPointer);
      domElement.removeEventListener('pointercancel', endPointer);
      domElement.removeEventListener('pointerleave', onPointerLeave);
    },
  };
}
