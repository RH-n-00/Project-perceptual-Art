const DEBUG_COUNTS = {
  hale: 850,
  hail: 850,
  ujBlue: 1200,
  ujRed: 500,
};

const PRODUCTION_COUNTS = {
  hale: 1400,
  hail: 1400,
  ujBlue: 1800,
  ujRed: 760,
};

const LAYER_DESCRIPTORS = {
  hale: {
    id: 'HALE',
    center: [0, 0, 0.085],
    normal: [0, 0, 1],
    uAxis: [1, 0, 0],
    vAxis: [0, 1, 0],
    width: 1.08,
    height: 0.32,
    thickness: 0.07,
  },
  hail: {
    id: 'HAIL',
    center: [-0.085, 0, 0],
    normal: [1, 0, 0],
    uAxis: [0, 0, -1],
    vAxis: [0, 1, 0],
    width: 1.08,
    height: 0.32,
    thickness: 0.07,
  },
  uj: {
    id: 'UNION_JACK',
    center: [0, 0.070, 0],
    normal: [0, 1, 0],
    uAxis: [1, 0, 0],
    vAxis: [0, 0, -1],
    width: 1.0,
    height: 0.60,
    thickness: 0.07,
    whiteVoidThickness: 0.12,
  },
};

const COLORS = {
  text: 0xE8EFF3,
  ujBlue: 0x1F3B73,
  ujRed: 0xC8102E,
};

function mulberry32(seed) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed, label) {
  let h = seed >>> 0;
  for (let i = 0; i < label.length; i += 1) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function descriptorToVectors(THREE, descriptor) {
  return {
    ...descriptor,
    center: new THREE.Vector3(...descriptor.center),
    normal: new THREE.Vector3(...descriptor.normal).normalize(),
    uAxis: new THREE.Vector3(...descriptor.uAxis).normalize(),
    vAxis: new THREE.Vector3(...descriptor.vAxis).normalize(),
  };
}

function drawRect(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
}

function drawPolygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.fill();
}

function createTextMask(word, width = 1024, height = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';

  const marginX = width * 0.08;
  const marginY = height * 0.14;
  const availableWidth = width - marginX * 2;
  const availableHeight = height - marginY * 2;
  const letterWidth = availableWidth / 4.55;
  const gap = letterWidth * 0.18;
  const stroke = letterWidth * 0.18;
  const cap = stroke * 1.04;
  let x = marginX;
  const y = marginY;
  const h = availableHeight;

  function drawH(px) {
    drawRect(ctx, px, y, stroke, h);
    drawRect(ctx, px + letterWidth - stroke, y, stroke, h);
    drawRect(ctx, px, y + h * 0.43, letterWidth, cap * 0.92);
  }

  function drawA(px) {
    drawPolygon(ctx, [
      [px + letterWidth * 0.06, y + h],
      [px + letterWidth * 0.32, y],
      [px + letterWidth * 0.68, y],
      [px + letterWidth * 0.94, y + h],
      [px + letterWidth * 0.76, y + h],
      [px + letterWidth * 0.64, y + h * 0.62],
      [px + letterWidth * 0.36, y + h * 0.62],
      [px + letterWidth * 0.24, y + h],
    ]);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    drawPolygon(ctx, [
      [px + letterWidth * 0.39, y + h * 0.31],
      [px + letterWidth * 0.61, y + h * 0.31],
      [px + letterWidth * 0.55, y + h * 0.52],
      [px + letterWidth * 0.45, y + h * 0.52],
    ]);
    ctx.restore();
    drawRect(ctx, px + letterWidth * 0.28, y + h * 0.53, letterWidth * 0.44, cap * 0.78);
  }

  function drawL(px) {
    drawRect(ctx, px, y, stroke, h);
    drawRect(ctx, px, y + h - cap, letterWidth, cap);
  }

  function drawE(px) {
    drawRect(ctx, px, y, stroke, h);
    drawRect(ctx, px, y, letterWidth, cap);
    drawRect(ctx, px, y + h * 0.44, letterWidth * 0.82, cap * 0.9);
    drawRect(ctx, px, y + h - cap, letterWidth, cap);
  }

  function drawI(px) {
    drawRect(ctx, px + letterWidth * 0.36, y, stroke * 1.02, h);
    drawRect(ctx, px, y, letterWidth, cap);
    drawRect(ctx, px, y + h - cap, letterWidth, cap);
  }

  const drawLetter = { H: drawH, A: drawA, L: drawL, E: drawE, I: drawI };
  for (const char of word) {
    drawLetter[char]?.(x);
    x += letterWidth + gap;
  }

  return ctx.getImageData(0, 0, width, height);
}

function createUnionJackMasks(width = 1000, height = 600) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const BLUE = '#012169';
  const WHITE = '#FFFFFF';
  const RED = '#C8102E';

  ctx.fillStyle = BLUE;
  ctx.fillRect(0, 0, width, height);

  const diagWhiteWidth = height * 0.20;
  const diagRedWidth = height * 0.10;
  const diagOffset = height * 0.064;
  const crossWhite = height * (10 / 30);
  const crossRed = height * (6 / 30);

  function strokeClipped(x1, y1, x2, y2, lineWidth, color) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  const diag1 = { x1: 0, y1: 0, x2: width, y2: height };
  const diag2 = { x1: 0, y1: height, x2: width, y2: 0 };

  strokeClipped(diag1.x1, diag1.y1, diag1.x2, diag1.y2, diagWhiteWidth, WHITE);
  strokeClipped(diag2.x1, diag2.y1, diag2.x2, diag2.y2, diagWhiteWidth, WHITE);

  function offsetLine(line, offset) {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    return {
      x1: line.x1 + nx * offset,
      y1: line.y1 + ny * offset,
      x2: line.x2 + nx * offset,
      y2: line.y2 + ny * offset,
    };
  }

  const diag1Red = offsetLine(diag1, diagOffset);
  const diag2Red = offsetLine(diag2, -diagOffset);
  strokeClipped(diag1Red.x1, diag1Red.y1, diag1Red.x2, diag1Red.y2, diagRedWidth, RED);
  strokeClipped(diag2Red.x1, diag2Red.y1, diag2Red.x2, diag2Red.y2, diagRedWidth, RED);

  ctx.fillStyle = WHITE;
  ctx.fillRect(width * 0.5 - crossWhite * 0.5, 0, crossWhite, height);
  ctx.fillRect(0, height * 0.5 - crossWhite * 0.5, width, crossWhite);

  ctx.fillStyle = RED;
  ctx.fillRect(width * 0.5 - crossRed * 0.5, 0, crossRed, height);
  ctx.fillRect(0, height * 0.5 - crossRed * 0.5, width, crossRed);

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const red = new Uint8Array(width * height);
  const blue = new Uint8Array(width * height);
  const white = new Uint8Array(width * height);

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const r = data[i + 0];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 210 && g > 210 && b > 210) {
      white[p] = 1;
    } else if (r > 140 && g < 90 && b < 110) {
      red[p] = 1;
    } else {
      blue[p] = 1;
    }
  }

  return {
    red: { width, height, data: red },
    blue: { width, height, data: blue },
    white: { width, height, data: white },
  };
}

function sampleBinaryMask(mask, nx, ny) {
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) {
    return 0;
  }
  const x = Math.min(mask.width - 1, Math.max(0, Math.round(nx * (mask.width - 1))));
  const y = Math.min(mask.height - 1, Math.max(0, Math.round(ny * (mask.height - 1))));
  const index = y * mask.width + x;
  return mask.data[index];
}

function sampleTextMask(imageData, nx, ny) {
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) {
    return 0;
  }
  const x = Math.min(imageData.width - 1, Math.max(0, Math.round(nx * (imageData.width - 1))));
  const y = Math.min(imageData.height - 1, Math.max(0, Math.round(ny * (imageData.height - 1))));
  const alphaIndex = (y * imageData.width + x) * 4 + 3;
  return imageData.data[alphaIndex] > 128 ? 1 : 0;
}

function createShardGeometry(THREE) {
  const positions = new Float32Array([
    0.0, 0.0, 1.15,
    -0.62, -0.34, -0.78,
    0.48, -0.56, -0.70,

    0.0, 0.0, 1.15,
    0.48, -0.56, -0.70,
    0.58, 0.38, -0.76,

    0.0, 0.0, 1.15,
    0.58, 0.38, -0.76,
    -0.44, 0.52, -0.72,

    0.0, 0.0, 1.15,
    -0.44, 0.52, -0.72,
    -0.62, -0.34, -0.78,
  ]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createMaterialSet(THREE) {
  return {
    debug: {
      hale: new THREE.MeshBasicMaterial({
        color: COLORS.text,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
      hail: new THREE.MeshBasicMaterial({
        color: COLORS.text,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
      ujBlue: new THREE.MeshBasicMaterial({
        color: COLORS.ujBlue,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
      ujRed: new THREE.MeshBasicMaterial({
        color: COLORS.ujRed,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    },
    production: {
      hale: new THREE.MeshStandardMaterial({
        color: COLORS.text,
        roughness: 0.78,
        metalness: 0.0,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
      }),
      hail: new THREE.MeshStandardMaterial({
        color: COLORS.text,
        roughness: 0.78,
        metalness: 0.0,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
      }),
      ujBlue: new THREE.MeshStandardMaterial({
        color: COLORS.ujBlue,
        roughness: 0.78,
        metalness: 0.0,
        transparent: true,
        opacity: 0.56,
        depthWrite: false,
      }),
      ujRed: new THREE.MeshStandardMaterial({
        color: COLORS.ujRed,
        roughness: 0.78,
        metalness: 0.0,
        transparent: true,
        opacity: 0.56,
        depthWrite: false,
      }),
    },
  };
}

function createLayerMesh({
  THREE,
  descriptor,
  count,
  random,
  geometry,
  material,
  sampler,
  safeRadius,
  baseColor,
}) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const position = new THREE.Vector3();
  const tempQuat = new THREE.Quaternion();
  const tempEuler = new THREE.Euler();
  const tempScale = new THREE.Vector3();
  const tempMatrix = new THREE.Matrix4();
  const tempColor = new THREE.Color(baseColor);
  let placed = 0;

  const gridX = Math.max(10, Math.ceil(Math.sqrt(count * (descriptor.width / descriptor.height))));
  const gridY = Math.max(4, Math.ceil(gridX * descriptor.height / descriptor.width));
  const cellW = descriptor.width / gridX;
  const cellH = descriptor.height / gridY;

  function tryPlace(nx, ny) {
    if (!sampler(nx, ny)) {
      return;
    }

    const u = (nx - 0.5) * descriptor.width;
    const v = (0.5 - ny) * descriptor.height;
    const bias = ((random() + random() + random()) / 3 - 0.5) * descriptor.thickness;

    position.copy(descriptor.center)
      .addScaledVector(descriptor.uAxis, u)
      .addScaledVector(descriptor.vAxis, v)
      .addScaledVector(descriptor.normal, bias)
      .addScaledVector(descriptor.uAxis, (random() - 0.5) * cellW * 0.35)
      .addScaledVector(descriptor.vAxis, (random() - 0.5) * cellH * 0.35)
      .addScaledVector(descriptor.normal, (random() - 0.5) * descriptor.thickness * 0.14);

    if (position.length() > safeRadius) {
      return;
    }

    tempEuler.set(
      random() * Math.PI * 2,
      random() * Math.PI * 2,
      random() * Math.PI * 2,
    );
    tempQuat.setFromEuler(tempEuler);
    tempScale.set(
      THREE.MathUtils.lerp(0.010, 0.018, random()),
      THREE.MathUtils.lerp(0.007, 0.015, random()),
      THREE.MathUtils.lerp(0.008, 0.020, random()),
    );
    tempMatrix.compose(position, tempQuat, tempScale);
    mesh.setMatrixAt(placed, tempMatrix);

    tempColor.set(baseColor).offsetHSL(0, (random() - 0.5) * 0.02, (random() - 0.5) * 0.06);
    mesh.setColorAt(placed, tempColor);
    placed += 1;
  }

  for (let gy = 0; gy < gridY && placed < count; gy += 1) {
    for (let gx = 0; gx < gridX && placed < count; gx += 1) {
      const nx = (gx + random()) / gridX;
      const ny = (gy + random()) / gridY;
      tryPlace(nx, ny);
    }
  }

  let attempts = 0;
  while (placed < count && attempts < count * 24) {
    attempts += 1;
    tryPlace(random(), random());
  }

  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
}

function createLayerBounds(THREE, descriptor, color) {
  const box = new THREE.BoxGeometry(descriptor.width, descriptor.height, descriptor.thickness);
  const edges = new THREE.EdgesGeometry(box);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.32,
      depthTest: false,
      toneMapped: false,
    }),
  );

  const basis = new THREE.Matrix4().makeBasis(
    descriptor.uAxis.clone(),
    descriptor.vAxis.clone(),
    descriptor.normal.clone(),
  );
  line.quaternion.setFromRotationMatrix(basis);
  line.position.copy(descriptor.center);
  line.renderOrder = 45;
  return line;
}

function createWhiteVoidTester(THREE, descriptor, whiteMask) {
  const local = new THREE.Vector3();
  return function whiteVoidTest(position) {
    local.copy(position).sub(descriptor.center);
    const u = local.dot(descriptor.uAxis);
    const v = local.dot(descriptor.vAxis);
    const w = local.dot(descriptor.normal);

    if (Math.abs(w) > descriptor.whiteVoidThickness * 0.5) {
      return false;
    }
    if (Math.abs(u) > descriptor.width * 0.5 || Math.abs(v) > descriptor.height * 0.5) {
      return false;
    }

    const nx = u / descriptor.width + 0.5;
    const ny = 0.5 - v / descriptor.height;
    return Boolean(sampleBinaryMask(whiteMask, nx, ny));
  };
}

export function buildPerceptualContent({
  THREE,
  safeRadius,
  mode = 'production',
  layerFilter = 'all',
  debug = false,
}) {
  const root = new THREE.Group();
  root.name = 'PerceptualContentRoot';

  const descriptors = {
    hale: descriptorToVectors(THREE, LAYER_DESCRIPTORS.hale),
    hail: descriptorToVectors(THREE, LAYER_DESCRIPTORS.hail),
    uj: descriptorToVectors(THREE, LAYER_DESCRIPTORS.uj),
  };

  const textHaleMask = createTextMask('HALE');
  const textHailMask = createTextMask('HAIL');
  const unionJackMasks = createUnionJackMasks();
  const whiteVoidTest = createWhiteVoidTester(THREE, descriptors.uj, unionJackMasks.white);
  const shardGeometry = createShardGeometry(THREE);
  const materials = createMaterialSet(THREE);
  const activeMode = mode === 'debug' ? 'debug' : 'production';
  const counts = activeMode === 'debug' ? DEBUG_COUNTS : PRODUCTION_COUNTS;
  const layerRefs = {
    hale: null,
    hail: null,
    ujBlue: null,
    ujRed: null,
  };
  const diagnostics = [];

  const randomHale = mulberry32(hashSeed(240328, 'hale'));
  const randomHail = mulberry32(hashSeed(240328, 'hail'));
  const randomUjBlue = mulberry32(hashSeed(240328, 'ujBlue'));
  const randomUjRed = mulberry32(hashSeed(240328, 'ujRed'));

  function includesLayer(id) {
    if (layerFilter === 'all' || !layerFilter) {
      return true;
    }
    if (layerFilter === 'uj') {
      return id === 'uj';
    }
    return layerFilter === id;
  }

  if (includesLayer('hale')) {
    const haleMesh = createLayerMesh({
      THREE,
      descriptor: descriptors.hale,
      count: counts.hale,
      random: randomHale,
      geometry: shardGeometry,
      material: materials[activeMode].hale,
      sampler: (nx, ny) => sampleTextMask(textHaleMask, nx, ny),
      safeRadius,
      baseColor: COLORS.text,
    });
    haleMesh.name = 'Layer_HALE';
    haleMesh.renderOrder = activeMode === 'debug' ? 40 : 10;
    root.add(haleMesh);
    layerRefs.hale = haleMesh;
  }

  if (includesLayer('hail')) {
    const hailMesh = createLayerMesh({
      THREE,
      descriptor: descriptors.hail,
      count: counts.hail,
      random: randomHail,
      geometry: shardGeometry,
      material: materials[activeMode].hail,
      sampler: (nx, ny) => sampleTextMask(textHailMask, nx, ny),
      safeRadius,
      baseColor: COLORS.text,
    });
    hailMesh.name = 'Layer_HAIL';
    hailMesh.renderOrder = activeMode === 'debug' ? 40 : 10;
    root.add(hailMesh);
    layerRefs.hail = hailMesh;
  }

  if (includesLayer('uj')) {
    const ujBlue = createLayerMesh({
      THREE,
      descriptor: descriptors.uj,
      count: counts.ujBlue,
      random: randomUjBlue,
      geometry: shardGeometry,
      material: materials[activeMode].ujBlue,
      sampler: (nx, ny) => sampleBinaryMask(unionJackMasks.blue, nx, ny),
      safeRadius,
      baseColor: COLORS.ujBlue,
    });
    ujBlue.name = 'Layer_UJ_Blue';
    ujBlue.renderOrder = activeMode === 'debug' ? 40 : 10;
    root.add(ujBlue);
    layerRefs.ujBlue = ujBlue;

    const ujRed = createLayerMesh({
      THREE,
      descriptor: descriptors.uj,
      count: counts.ujRed,
      random: randomUjRed,
      geometry: shardGeometry,
      material: materials[activeMode].ujRed,
      sampler: (nx, ny) => sampleBinaryMask(unionJackMasks.red, nx, ny),
      safeRadius,
      baseColor: COLORS.ujRed,
    });
    ujRed.name = 'Layer_UJ_Red';
    ujRed.renderOrder = activeMode === 'debug' ? 40 : 11;
    root.add(ujRed);
    layerRefs.ujRed = ujRed;
  }

  if (debug) {
    if (includesLayer('hale')) {
      diagnostics.push(createLayerBounds(THREE, descriptors.hale, 0xbedfff));
    }
    if (includesLayer('hail')) {
      diagnostics.push(createLayerBounds(THREE, descriptors.hail, 0xffd0be));
    }
    if (includesLayer('uj')) {
      diagnostics.push(createLayerBounds(THREE, descriptors.uj, 0xbefbc2));
    }
    diagnostics.forEach((line) => root.add(line));
  }

  function setMode(nextMode) {
    const resolvedMode = nextMode === 'debug' ? 'debug' : 'production';
    const debugOrder = resolvedMode === 'debug' ? 40 : 10;
    if (layerRefs.hale) {
      layerRefs.hale.material = materials[resolvedMode].hale;
      layerRefs.hale.renderOrder = debugOrder;
    }
    if (layerRefs.hail) {
      layerRefs.hail.material = materials[resolvedMode].hail;
      layerRefs.hail.renderOrder = debugOrder;
    }
    if (layerRefs.ujBlue) {
      layerRefs.ujBlue.material = materials[resolvedMode].ujBlue;
      layerRefs.ujBlue.renderOrder = debugOrder;
    }
    if (layerRefs.ujRed) {
      layerRefs.ujRed.material = materials[resolvedMode].ujRed;
      layerRefs.ujRed.renderOrder = resolvedMode === 'debug' ? 40 : 11;
    }
  }

  function dispose() {
    shardGeometry.dispose();
    Object.values(materials.debug).forEach((material) => material.dispose());
    Object.values(materials.production).forEach((material) => material.dispose());
    diagnostics.forEach((line) => {
      line.geometry?.dispose?.();
      line.material?.dispose?.();
    });
  }

  return {
    root,
    whiteVoidTest,
    layerRefs,
    setMode,
    dispose,
  };
}
