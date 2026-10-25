import * as THREE from 'three';

// 坐标与 STORYBOARD §0.2 一致；root 内部坐标，root.position.x 固定为 +7。
export const PART_TABLE = Object.freeze([
  { id: 'front-glass', name: '前玻璃', spec: '钢化玻璃 · 展柜前板', base: [0, 0, 21], explode: [0, 0, 26], start: 0.20, end: 0.30, glass: true },
  { id: 'side-glass', name: '右侧玻璃', spec: '钢化玻璃 · 展柜侧板', base: [10, 0, 0], explode: [30, 0, 0], start: 0.21, end: 0.31, glass: true },
  { id: 'intake', name: '底部进风', spec: '3 × 140 mm', base: [0, -22.4, 0], explode: [0, -22, 0], start: 0.26, end: 0.38 },
  { id: 'chamber', name: '仓隔板', spec: '双仓结构', base: [0, -11.4, 0], explode: [-12, 0, 0], start: 0.26, end: 0.36 },
  { id: 'cooler', name: '散热器', spec: '塔式风冷 · 六热管', base: [-3.6, 8, -2], explode: [-20, 13, 0], start: 0.28, end: 0.40 },
  { id: 'cpu', name: '处理器', spec: 'LGA 封装', base: [-8.75, 3.2, -2], explode: [-15, 8, 3], start: 0.30, end: 0.42 },
  { id: 'ram-a', name: '内存 A', spec: 'DDR5 · A2', base: [-8.4, 5, 5.4], explode: [-17, 11, 4], start: 0.31, end: 0.43, focus: true },
  { id: 'ram-b', name: '内存 B', spec: 'DDR5 · B2', base: [-8.4, 5, 8], explode: [-17, 13, 8], start: 0.32, end: 0.44, focus: true },
  { id: 'gpu', name: '显卡', spec: '双槽 · 三风扇', base: [0.5, -4, -5], explode: [0, -3, 28], start: 0.33, end: 0.44 },
  { id: 'psu', name: '电源', spec: '750 W · ATX 3.1', base: [0, -17.6, 2], explode: [-7, -20, 5], start: 0.34, end: 0.44 },
  { id: 'ssd', name: '固态 M.2', spec: '1 TB · PCIe 4.0', base: [-7.6, 16, 10], explode: [-16, -9, -8], start: 0.35, end: 0.44, focus: true },
  { id: 'top-cover', name: '顶盖', spec: '网孔顶板', base: [0, 23, 0], explode: [0, 22, 0], start: 0.36, end: 0.44 },
]);

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

function makeTemplates(mobile) {
  const glass = mobile
    ? new THREE.MeshStandardMaterial({ color: 0x172238, metalness: 0.45, roughness: 0.22, transparent: true, opacity: 0.9 })
    : new THREE.MeshPhysicalMaterial({
        color: 0x60789a, metalness: 0.08, roughness: 0.07,
        transmission: 0, thickness: 0.45, ior: 1.48,
        transparent: true, opacity: 0.96, envMapIntensity: 1,
      });
  return {
    glass,
    board: new THREE.MeshStandardMaterial({ color: 0x152b2b, metalness: 0.18, roughness: 0.72 }),
    pcb: new THREE.MeshStandardMaterial({ color: 0x14251f, metalness: 0.12, roughness: 0.78 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2b374a, metalness: 0.58, roughness: 0.38 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8794a8, metalness: 0.82, roughness: 0.27 }),
    chip: new THREE.MeshStandardMaterial({ color: 0x323b49, metalness: 0.5, roughness: 0.42 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xb86a3d, metalness: 0.82, roughness: 0.3 }),
    fan: new THREE.MeshStandardMaterial({ color: 0x263348, metalness: 0.38, roughness: 0.46 }),
    edge: new THREE.LineBasicMaterial({ color: 0x7295e8, transparent: true, opacity: 0.42 }),
    softEdge: new THREE.LineBasicMaterial({ color: 0x536887, transparent: true, opacity: 0.28 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x263b60, emissive: 0x142445, emissiveIntensity: 0.55, metalness: 0.72, roughness: 0.3, transparent: true, opacity: 1 }),
  };
}

function edgedBox(size, material, edgeMaterial, edgeOpacity = 1) {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  const edge = edgeMaterial.clone();
  edge.opacity *= edgeOpacity;
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 28), edge));
  return group;
}

function createFan(radius, material, bladeMaterial) {
  const fan = new THREE.Group();
  fan.add(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.24, 8, 40), material));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.48, 18), bladeMaterial);
  hub.rotation.x = Math.PI / 2;
  fan.add(hub);
  const bladeGeometry = new THREE.BoxGeometry(radius * 0.7, 0.54, 0.16);
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.set(Math.cos(angle) * radius * 0.43, Math.sin(angle) * radius * 0.43, 0);
    blade.rotation.z = angle + 0.42;
    fan.add(blade);
  }
  return fan;
}

function prepareMaterials(record) {
  const clones = new Map();
  const materials = [];
  record.obj.traverse((node) => {
    if (!node.material) return;
    const list = Array.isArray(node.material) ? node.material : [node.material];
    const mapped = list.map((source) => {
      if (!clones.has(source)) {
        const material = source.clone();
        material.transparent = true;
        material.userData.look = {
          opacity: material.opacity,
          color: material.color ? material.color.clone() : null,
          emissive: material.emissive ? material.emissive.clone() : null,
          emissiveIntensity: material.emissiveIntensity || 0,
          envMapIntensity: material.envMapIntensity ?? 1,
          line: material.isLineBasicMaterial === true,
        };
        clones.set(source, material);
        materials.push(material);
      }
      return clones.get(source);
    });
    node.material = Array.isArray(node.material) ? mapped : mapped[0];
  });
  record.materials = materials;
}

function buildCooler(M) {
  const group = new THREE.Group();
  const fins = new THREE.Group();
  const finGeometry = new THREE.BoxGeometry(10.5, 0.48, 10.5);
  for (let i = 0; i < 14; i += 1) {
    const fin = new THREE.Mesh(finGeometry, M.metal);
    fin.position.y = i * 1.02 - 6.7;
    fins.add(fin);
  }
  group.add(fins);
  const pipeGeometry = new THREE.CylinderGeometry(0.23, 0.23, 15.2, 8);
  for (const x of [-3.2, -1.1, 1.1, 3.2]) {
    const pipe = new THREE.Mesh(pipeGeometry, M.copper);
    pipe.position.set(x, 0, -3.6);
    group.add(pipe);
  }
  const fan = createFan(4.35, M.fan, M.dark);
  fan.position.z = 5.55;
  group.add(fan);
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(11.2, 15.2, 11.2)),
    M.edge.clone(),
  );
  group.add(outline);
  return group;
}

function buildMotherboard(M) {
  const group = edgedBox([0.6, 34, 30], M.board, M.edge, 0.8);
  const chipGeometry = new THREE.BoxGeometry(0.8, 3.4, 4.2);
  for (const [y, z] of [[9, -8], [8, 8], [-7, 7], [-9, -7]]) {
    const chip = new THREE.Mesh(chipGeometry, M.chip);
    chip.position.set(0.65, y, z);
    group.add(chip);
  }
  const traceMaterial = M.softEdge.clone();
  const points = [];
  for (let i = 0; i < 7; i += 1) {
    const y = -12 + i * 4;
    points.push(new THREE.Vector3(0.36, y, -13), new THREE.Vector3(0.36, y, 12));
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), traceMaterial));
  return group;
}

function buildRam(M) {
  const group = edgedBox([0.95, 13, 1.65], M.dark, M.edge);
  const chipGeometry = new THREE.BoxGeometry(0.68, 1.65, 0.16);
  for (let i = 0; i < 5; i += 1) {
    const chip = new THREE.Mesh(chipGeometry, M.chip);
    chip.position.set(0, -4.4 + i * 2.2, 0.89);
    group.add(chip);
  }
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.02, 11.8, 0.12), M.copper);
  stripe.position.z = -0.88;
  group.add(stripe);
  return group;
}

function buildGpu(M) {
  const group = edgedBox([18, 4.6, 11], M.dark, M.edge);
  for (const x of [-6.3, 0, 6.3]) {
    const fan = createFan(2.05, M.fan, M.chip);
    fan.position.set(x, 0, 5.62);
    group.add(fan);
  }
  const backplate = new THREE.Mesh(new THREE.BoxGeometry(17.2, 0.24, 10.2), M.metal);
  backplate.position.y = 2.42;
  group.add(backplate);
  return group;
}

function buildIntake(M) {
  const group = new THREE.Group();
  for (const z of [-12, 0, 12]) {
    const fan = createFan(4.55, M.fan, M.dark);
    fan.rotation.x = -Math.PI / 2;
    fan.position.set(0, 0.25, z);
    group.add(fan);
  }
  return group;
}

function buildTopCover(M) {
  const group = edgedBox([19.4, 0.55, 40], M.dark, M.edge, 0.7);
  const grid = new THREE.GridHelper(40, 20, 0x627ca8, 0x354967);
  grid.scale.x = 0.48;
  grid.position.y = 0.31;
  grid.material.transparent = true;
  grid.material.opacity = 0.42;
  group.add(grid);
  return group;
}

function buildFrame(M) {
  const frame = new THREE.Group();
  const postGeometry = new THREE.BoxGeometry(0.28, 46, 0.28);
  for (const x of [-10, 10]) {
    for (const z of [-21, 21]) {
      const post = new THREE.Mesh(postGeometry, M.frame);
      post.position.set(x, 0, z);
      frame.add(post);
    }
  }
  const beamGeometry = new THREE.BoxGeometry(20, 0.28, 0.28);
  for (const y of [-23, 23]) {
    for (const z of [-21, 21]) {
      const beam = new THREE.Mesh(beamGeometry, M.frame);
      beam.position.set(0, y, z);
      frame.add(beam);
    }
  }
  const base = edgedBox([20, 0.5, 42], M.dark, M.softEdge, 0.5);
  base.position.y = -23;
  frame.add(base);
  return frame;
}

function buildPart(def, M) {
  switch (def.id) {
    case 'front-glass': return edgedBox([19.4, 44, 0.34], M.glass, M.edge);
    case 'side-glass': return edgedBox([0.34, 44, 40], M.glass, M.edge);
    case 'intake': return buildIntake(M);
    case 'chamber': return edgedBox([19.4, 0.5, 40], M.dark, M.softEdge);
    case 'cooler': return buildCooler(M);
    case 'cpu': return edgedBox([0.65, 4.6, 4.6], M.metal, M.edge);
    case 'ram-a':
    case 'ram-b': return buildRam(M);
    case 'gpu': return buildGpu(M);
    case 'psu': return edgedBox([15, 8.6, 16], M.dark, M.edge);
    case 'ssd': {
      const group = edgedBox([0.55, 2.2, 8], M.pcb, M.edge);
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.86, 5.8), M.metal);
      shield.position.x = 0.43;
      group.add(shield);
      const accent = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 4.6), M.copper);
      accent.position.x = 0.66;
      group.add(accent);
      return group;
    }
    case 'top-cover': return buildTopCover(M);
    default: throw new Error(`未知零件: ${def.id}`);
  }
}

export function createParts({ mobile = false } = {}) {
  const root = new THREE.Group();
  root.name = 'machine-root';
  root.position.x = 7;
  const M = makeTemplates(mobile);
  const parts = [];

  for (const def of PART_TABLE) {
    const obj = buildPart(def, M);
    obj.name = def.id;
    obj.userData.partId = def.id;
    obj.position.copy(v3(def.base));
    root.add(obj);
    const record = { ...def, obj, base: v3(def.base), explode: v3(def.explode) };
    prepareMaterials(record);
    parts.push(record);
  }

  const motherboard = {
    id: 'motherboard', name: '主板', spec: 'ATX · B760',
    obj: buildMotherboard(M), base: new THREE.Vector3(-9.4, 1, 0), fixed: true,
  };
  motherboard.obj.name = 'motherboard';
  motherboard.obj.userData.partId = 'motherboard';
  motherboard.obj.position.copy(motherboard.base);
  root.add(motherboard.obj);
  prepareMaterials(motherboard);

  const frame = { id: 'frame', obj: buildFrame(M) };
  frame.obj.name = 'frame';
  root.add(frame.obj);
  prepareMaterials(frame);

  return { root, parts, motherboard, frame, all: [...parts, motherboard] };
}

export function assertPartTable() {
  const ids = new Set(PART_TABLE.map((part) => part.id));
  if (PART_TABLE.length !== 12 || ids.size !== 12) {
    throw new Error(`零件表必须是 12 个独立条目，当前 ${PART_TABLE.length}/${ids.size}`);
  }
  return true;
}
