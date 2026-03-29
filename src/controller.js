import * as THREE from 'three';

export function createObjectRotationController({
  domElement,
  userRig,
  hintElement,
  onInteractionStart,
  onInteractionSettled,
}) {
  const state = {
    pointerId: null,
    dragging: false,
    lastX: 0,
    lastY: 0,
    velX: 0,
    velY: 0,
    sinceRelease: 0,
    returning: false,
  };

  const qx = new THREE.Quaternion();
  const qy = new THREE.Quaternion();
  const identity = new THREE.Quaternion();
  const viewportRef = () => Math.max(480, Math.min(window.innerWidth, window.innerHeight));

  function hideHint() {
    if (!hintElement) return;
    hintElement.style.animation = 'none';
    hintElement.style.opacity = '0';
  }

  function applyDelta(deltaX, deltaY) {
    const viewportMin = viewportRef();
    const rotY = -deltaX * 1.8 / viewportMin;
    const rotX = -deltaY * 1.6 / viewportMin;
    qy.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotY);
    qx.setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotX);
    userRig.quaternion.premultiply(qy);
    userRig.quaternion.premultiply(qx);
  }

  function onPointerDown(event) {
    if (state.pointerId !== null) return;
    state.pointerId = event.pointerId;
    state.dragging = true;
    state.returning = false;
    state.sinceRelease = 0;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.velX = 0;
    state.velY = 0;
    domElement.setPointerCapture?.(event.pointerId);
    document.body.classList.add('dragging');
    hideHint();
    onInteractionStart?.();
  }

  function onPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.velX = dx;
    state.velY = dy;
    applyDelta(dx, dy);
  }

  function endPointer(event) {
    if (event.pointerId !== state.pointerId) return;
    state.dragging = false;
    state.pointerId = null;
    state.sinceRelease = 0;
    state.returning = false;
    domElement.releasePointerCapture?.(event.pointerId);
    document.body.classList.remove('dragging');
  }

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', endPointer);
  domElement.addEventListener('pointercancel', endPointer);
  domElement.addEventListener('pointerleave', (event) => {
    if (state.dragging && event.pointerId === state.pointerId) {
      endPointer(event);
    }
  });

  return {
    update(deltaSeconds) {
      if (state.dragging) {
        return;
      }

      const velocityMagnitude = Math.abs(state.velX) + Math.abs(state.velY);
      if (velocityMagnitude > 0.02) {
        applyDelta(state.velX, state.velY);
        const damping = Math.exp(-deltaSeconds * 9.5);
        state.velX *= damping;
        state.velY *= damping;
        state.sinceRelease += deltaSeconds;
        if (Math.abs(state.velX) + Math.abs(state.velY) < 0.06) {
          state.velX = 0;
          state.velY = 0;
          state.returning = true;
          state.sinceRelease = 0;
        }
        return;
      }

      state.returning = true;
      state.sinceRelease += deltaSeconds;
      userRig.quaternion.slerp(identity, 1 - Math.exp(-deltaSeconds * 1.9));
      if (userRig.quaternion.angleTo(identity) < 0.018) {
        userRig.quaternion.copy(identity);
        if (state.returning) {
          state.returning = false;
          onInteractionSettled?.();
        }
      }
    },
    get isDragging() {
      return state.dragging;
    },
    get isSettled() {
      return !state.dragging && state.velX === 0 && state.velY === 0 && userRig.quaternion.angleTo(identity) < 0.018;
    },
    dispose() {
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerup', endPointer);
      domElement.removeEventListener('pointercancel', endPointer);
    },
  };
}
