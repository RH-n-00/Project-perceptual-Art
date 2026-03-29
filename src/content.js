import * as THREE from 'three';

const UJ_BLUE = new THREE.Color('#1F3B73');
const UJ_RED = new THREE.Color('#C8102E');
const FROST_TEXT = new THREE.Color('#E8EFF3');

const LAYERS = {
  hale: {
    id: 'HALE',
    center: new THREE.Vector3(0, 0, 0.10),
    normal: new THREE.Vector3(0, 0, 1),
    uAxis: new THREE.Vector3(1, 0, 0),
    vAxis: new THREE.Vector3(0, 1, 0),
    width: 1.22,
    height: 0.36,
    thickness: 0.09,
  },
  hail: {
    id: 'HAIL',
    center: new THREE.Vector3(-0.10, 0, 0),
    normal: new THREE.Vector3(1, 0, 0),
    uAxis: new THREE.Vector3(0, 0, -1),
    vAxis: new THREE.Vector3(0, 1, 0),
    width: 1.22,
    height: 0.36,
    thickness: 0.09,
  },
  unionJack: {
    id: 'UNION_JACK',
    center: new THREE.Vector3(0, 0.08, 0),
    normal: new THREE.Vector3(0, 1, 0),
    uAxis: new THREE.Vector3(1, 0, 0),
    vAxis: new THREE.Vector3(0, 0, -1),
    width: 1.18,
    height: 0.708,
    thickness: 0.08,
    whiteVoidThickness: 0.14,
  },
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

function createTextMask(text, width = 1200, height = 360) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';

  const marginX = width * 0.08;
  const marginY = height * 0.12;
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

  const drawLetter = {
    H: drawH,
    A: drawA,
    L: drawL,
    E: drawE,
    I: drawI,
  };

  for (const char of text) {
    drawLetter[char]?.(x);
    x += letterWidth + gap;
  }

  const image = ctx.getImageData(0, 0, width, height);
  return { canvas, image };
}

function createUnionJackMasks(width = 1000, height = 600) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const BLUE = '#00247D';
  const WHITE = '#FFFFFF';
  const RED = '#CF142B';

  ctx.fillStyle = BLUE;
  ctx.fillRect(0, 0, width, height);

  const clipRect = new Path2D();
  clipRect.rect(0, 0, width, height);

  const diagWhiteWidth = height * 0.20;
  const diagRedWidth = height * 0.10;
  const diagOffset = height * 0.064;
  const crossWhite = height * (10 / 30);
  const crossRed = height * (6 / 30);

  function strokeClipped(x1, y1, x2, y2, lineWidth, color) {
    ctx.save();
    ctx.clip(clipRect);
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
    } else if (r > 160 && g < 80 && b < 100) {
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

function sampleMaskChannel(mask, nx, ny) {
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) {
    return 0;
  }
  const x = Math.min(mask.width - 1, Math.max(0, Math.round(nx * (mask.width - 1))));
  const y = Math.min(mask.height - 1, Math.max(0, Math.round(ny * (mask.height - 1))));
  return mask.data[y * mask.width + x];
}

function sampleTextMask(image, nx, ny) {
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) {
    return 0;
  }
  const x = Math.min(image.width - 1, Math.max(0, Math.round(nx * (image.width - 1))));
  const y = Math.min(image.height - 1, Math.max(0, Math.round(ny * (image.height - 1))));
  const idx = (y * image.width + x) * 4 + 3;
  return image.data[idx] > 128 ? 1 : 0;
}

function createShardGeometry() {
  const geometry = new THREE.TetrahedronGeometry(1, 0).toNonIndexed();
  geometry.computeVertexNormals();
  return geometry;
}

function makeTransparentMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0.0,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
    vertexColors: true,
  });
}

function createLayerMesh({
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
  const tempColor = new THREE.Color();

  const cellEstimate = Math.ceil(Math.sqrt(count * (descriptor.width / descriptor.height)) * 1.4);
  const gridX = Math.max(10, cellEstimate);
  const gridY = Math.max(4, Math.round(gridX * descriptor.height / descriptor.width));
  const cellW = descriptor.width / gridX;
  const cellH = descriptor.height / gridY;
  let placed = 0;

  function tryPlace(nx, ny) {
    if (!sampler(nx, ny)) {
      return;
    }

    const u = (nx - 0.5) * descriptor.width;
    const v = (0.5 - ny) * descriptor.height;
    const w = ((random() + random() + random()) / 3 - 0.5) * descriptor.thickness;

    position.copy(descriptor.center)
      .addScaledVector(descriptor.uAxis, u)
      .addScaledVector(descriptor.vAxis, v)
      .addScaledVector(descriptor.normal, w)
      .addScaledVector(descriptor.uAxis, (random() - 0.5) * cellW * 0.42)
      .addScaledVector(descriptor.vAxis, (random() - 0.5) * cellH * 0.42)
      .addScaledVector(descriptor.normal, (random() - 0.5) * descriptor.thickness * 0.18);

    if (position.length() > safeRadius) {
      return;
    }

    tempEuler.set(
      random() * Math.PI * 2,
      random() * Math.PI * 2,
      random() * Math.PI * 2,
    );
    tempQuat.setFromEuler(tempEuler);

    const scaleX = THREE.MathUtils.lerp(0.010, 0.018, random());
    const scaleY = THREE.MathUtils.lerp(0.007, 0.015, random());
    const scaleZ = THREE.MathUtils.lerp(0.008, 0.020, random());
    tempScale.set(scaleX, scaleY, scaleZ);
    tempMatrix.compose(position, tempQuat, tempScale);
    mesh.setMatrixAt(placed, tempMatrix);

    tempColor.copy(baseColor).offsetHSL(0, (random() - 0.5) * 0.03, (random() - 0.5) * 0.08);
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
  while (placed < count && attempts < count * 20) {
    attempts += 1;
    tryPlace(random(), random());
  }

  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  mesh.computeBoundingBox();
  return mesh;
}

function createLayerBounds(descriptor, color = 0x8fd3ff) {
  const box = new THREE.BoxGeometry(descriptor.width, descriptor.height, descriptor.thickness);
  const edges = new THREE.EdgesGeometry(box);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.28 }),
  );

  const basis = new THREE.Matrix4().makeBasis(
    descriptor.uAxis.clone().normalize(),
    descriptor.vAxis.clone().normalize(),
    descriptor.normal.clone().normalize(),
  );
  line.quaternion.setFromRotationMatrix(basis);
  line.position.copy(descriptor.center);
  return line;
}

export function createUnionJackWhiteVoidTester(descriptor, whiteMask) {
  const local = new THREE.Vector3();
  return function isInWhiteVoid(worldPoint) {
    local.copy(worldPoint).sub(descriptor.center);
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
    return !!sampleMaskChannel(whiteMask, nx, ny);
  };
}

export function buildPerceptualContent({ safeRadius, reduced = false, debug = false, seed = 240328 }) {
  const group = new THREE.Group();
  group.name = 'PerceptualContentRoot';

  const textCount = reduced ? 1100 : 1600;
  const blueCount = reduced ? 1500 : 2200;
  const redCount = reduced ? 600 : 900;

  const shardGeometry = createShardGeometry();
  const textMaterial = makeTransparentMaterial(FROST_TEXT);
  const blueMaterial = makeTransparentMaterial(UJ_BLUE);
  const redMaterial = makeTransparentMaterial(UJ_RED);

  const haleMask = createTextMask('HALE');
  const hailMask = createTextMask('HAIL');
  const unionJackMasks = createUnionJackMasks();

  const haleRandom = mulberry32(hashSeed(seed, 'hale'));
  const hailRandom = mulberry32(hashSeed(seed, 'hail'));
  const blueRandom = mulberry32(hashSeed(seed, 'uj-blue'));
  const redRandom = mulberry32(hashSeed(seed, 'uj-red'));

  const haleMesh = createLayerMesh({
    descriptor: LAYERS.hale,
    count: textCount,
    random: haleRandom,
    geometry: shardGeometry,
    material: textMaterial,
    sampler: (nx, ny) => sampleTextMask(haleMask.image, nx, ny),
    safeRadius,
    baseColor: FROST_TEXT,
  });
  haleMesh.name = 'Layer_HALE';
  haleMesh.renderOrder = 10;

  const hailMesh = createLayerMesh({
    descriptor: LAYERS.hail,
    count: textCount,
    random: hailRandom,
    geometry: shardGeometry,
    material: textMaterial.clone(),
    sampler: (nx, ny) => sampleTextMask(hailMask.image, nx, ny),
    safeRadius,
    baseColor: FROST_TEXT,
  });
  hailMesh.name = 'Layer_HAIL';
  hailMesh.renderOrder = 10;

  const blueMesh = createLayerMesh({
    descriptor: LAYERS.unionJack,
    count: blueCount,
    random: blueRandom,
    geometry: shardGeometry,
    material: blueMaterial,
    sampler: (nx, ny) => sampleMaskChannel(unionJackMasks.blue, nx, ny),
    safeRadius,
    baseColor: UJ_BLUE,
  });
  blueMesh.name = 'Layer_UJ_Blue';
  blueMesh.renderOrder = 11;

  const redMesh = createLayerMesh({
    descriptor: LAYERS.unionJack,
    count: redCount,
    random: redRandom,
    geometry: shardGeometry,
    material: redMaterial,
    sampler: (nx, ny) => sampleMaskChannel(unionJackMasks.red, nx, ny),
    safeRadius,
    baseColor: UJ_RED,
  });
  redMesh.name = 'Layer_UJ_Red';
  redMesh.renderOrder = 12;

  group.add(haleMesh, hailMesh, blueMesh, redMesh);

  if (debug) {
    group.add(
      createLayerBounds(LAYERS.hale, 0xbedfff),
      createLayerBounds(LAYERS.hail, 0xffd0be),
      createLayerBounds(LAYERS.unionJack, 0xbefbc2),
    );
  }

  const whiteVoidTester = createUnionJackWhiteVoidTester(LAYERS.unionJack, unionJackMasks.white);

  group.userData.dispose = () => {
    haleMesh.geometry.dispose();
    haleMesh.material.dispose();
    hailMesh.material.dispose();
    blueMesh.material.dispose();
    redMesh.material.dispose();
  };

  return {
    group,
    descriptors: LAYERS,
    isInWhiteVoid: whiteVoidTester,
  };
}
