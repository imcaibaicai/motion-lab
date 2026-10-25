import * as THREE from 'three';

export const LABEL_DEFINITIONS = Object.freeze([
  { id: 'side-glass', name: '玻璃', spec: '三面海景房 · 展柜式打开', side: 1, primary: true, revealAt: 0.33 },
  { id: 'cooler', name: '散热器', spec: '塔式风冷 · 六热管', side: -1, primary: true, revealAt: 0.42 },
  { id: 'gpu', name: '显卡', spec: '双槽 · 三风扇', side: 1, primary: true, revealAt: 0.46 },
  { id: 'psu', name: '电源', spec: '750 W · ATX 3.1 / 12V-2x6', side: -1, primary: true, revealAt: 0.46 },
  { id: 'motherboard', name: '主板', spec: 'ATX · B760', side: 1, primary: true, revealAt: 0.30 },
  { id: 'cpu', name: '处理器', spec: 'LGA 封装 · 供电与散热', side: -1, revealAt: 0.48 },
  { id: 'ram-b', name: '内存 B', spec: 'DDR5 · 双通道', side: -1, revealAt: 0.50, focusLabel: true },
  { id: 'ssd', name: '固态 M.2', spec: '1 TB · PCIe 4.0', side: 1, revealAt: 0.52, focusLabel: true },
  { id: 'top-cover', name: '顶盖', spec: '网孔顶板 · 独立拆装', side: 1, revealAt: 0.54 },
]);

const SVG_NS = 'http://www.w3.org/2000/svg';
const LABEL_WIDTH = 156;
const LABEL_HEIGHT = 52;
const MIN_GAP = 56;
const clamp = (min, max, value) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(0, 1, value);
const smooth = (a, b, x) => {
  const q = clamp01((x - a) / (b - a));
  return q * q * (3 - 2 * q);
};

function visibilityFor(definition, p) {
  const focusIn = smooth(0.62, 0.68, p);
  const leaving = 1 - smooth(0.76, 0.86, p);
  if (p >= 0.62) {
    return definition.focusLabel ? focusIn * leaving : (1 - focusIn) * leaving;
  }
  const blueprint = smooth(0.44, 0.50, p);
  const ordinary = smooth(definition.revealAt, definition.revealAt + 0.025, p);
  return definition.primary ? ordinary * leaving : ordinary * blueprint * leaving;
}

function makeLabel(definition, index) {
  const element = document.createElement('div');
  element.className = `part-label${definition.primary ? ' primary' : ' secondary'}`;
  element.dataset.part = definition.id;
  const number = document.createElement('span');
  number.className = 'label-number';
  number.textContent = String(index + 1).padStart(2, '0');
  const text = document.createElement('span');
  text.className = 'label-text';
  const title = document.createElement('strong');
  title.textContent = definition.name;
  const spec = document.createElement('small');
  spec.textContent = definition.spec;
  text.append(title, spec);
  element.append(number, text);
  return element;
}

export function createLabels(container, model) {
  const byId = new Map([...model.all, ...model.parts].map((part) => [part.id, part]));
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'label-lines');
  svg.setAttribute('aria-hidden', 'true');
  container.append(svg);
  const entries = LABEL_DEFINITIONS.map((definition, index) => {
    const element = makeLabel(definition, index);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', 'label-leader');
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('class', 'label-dot');
    dot.setAttribute('r', '2');
    svg.append(path, dot);
    container.append(element);
    return { definition, part: byId.get(definition.id), element, path, dot };
  }).filter((entry) => entry.part);
  const world = new THREE.Vector3();
  const projected = new THREE.Vector3();
  let lastLayout = [];

  function update(camera, p, { mobile = false } = {}) {
    if (mobile) {
      for (const entry of entries) {
        entry.element.style.opacity = '0';
        entry.element.style.visibility = 'hidden';
        entry.path.style.opacity = '0';
        entry.dot.style.opacity = '0';
      }
      lastLayout = [];
      return;
    }

    const width = innerWidth;
    const height = innerHeight;
    const items = [];
    for (const entry of entries) {
      const opacity = visibilityFor(entry.definition, p);
      if (opacity < 0.01) {
        entry.element.style.opacity = '0';
        entry.element.style.visibility = 'hidden';
        entry.path.style.opacity = '0';
        entry.dot.style.opacity = '0';
        continue;
      }
      entry.part.obj.getWorldPosition(world);
      projected.copy(world).project(camera);
      const anchorX = (projected.x * 0.5 + 0.5) * width;
      const anchorY = (0.5 - projected.y * 0.5) * height;
      const side = entry.definition.side;
      const desiredX = anchorX + side * (entry.definition.primary ? 122 : 102);
      // 桌面左侧约 38vw 是正文安全区，引线可以跨区，文字不能压正文。
      const minCenter = Math.max(300, width * 0.40 + 78);
      const x = clamp(minCenter, width - 104, desiredX);
      const focusOffset = p >= 0.62 && entry.definition.focusLabel
        ? (entry.definition.id === 'ram-b' ? -112 : 64)
        : -18;
      const y = clamp(92, height - 104, anchorY + focusOffset);
      items.push({ entry, opacity, side, anchorX, anchorY, x, y });
    }

    // 钳制到正文安全区后，不同引线方向也可能落在同一列；统一去冲突才可靠。
    const column = [...items].sort((a, b) => a.y - b.y);
    let previous = 92 - MIN_GAP;
    for (const item of column) {
      item.y = Math.max(item.y, previous + MIN_GAP);
      previous = item.y;
    }
    const overflow = previous - (height - 104);
    if (overflow > 0) for (const item of column) item.y -= overflow;
    for (let i = column.length - 2; i >= 0; i -= 1) {
      column[i].y = Math.min(column[i].y, column[i + 1].y - MIN_GAP);
    }
    if (column.length && column[0].y < 92) {
      const correction = 92 - column[0].y;
      for (const item of column) item.y += correction;
    }

    lastLayout = items.map((item) => {
      const { entry, opacity, side, anchorX, anchorY, x, y } = item;
      const endX = x - side * LABEL_WIDTH * 0.5;
      const elbowX = anchorX + side * 32;
      entry.element.style.left = `${x.toFixed(2)}px`;
      entry.element.style.top = `${y.toFixed(2)}px`;
      entry.element.style.opacity = opacity.toFixed(4);
      entry.element.style.visibility = 'visible';
      entry.path.setAttribute('d', `M ${anchorX.toFixed(2)} ${anchorY.toFixed(2)} L ${elbowX.toFixed(2)} ${anchorY.toFixed(2)} L ${endX.toFixed(2)} ${y.toFixed(2)}`);
      entry.path.style.opacity = (opacity * 0.62).toFixed(4);
      entry.dot.setAttribute('cx', anchorX.toFixed(2));
      entry.dot.setAttribute('cy', anchorY.toFixed(2));
      entry.dot.style.opacity = opacity.toFixed(4);
      return {
        id: entry.definition.id,
        side,
        x, y,
        opacity,
        left: x - LABEL_WIDTH / 2,
        right: x + LABEL_WIDTH / 2,
        top: y - LABEL_HEIGHT / 2,
        bottom: y + LABEL_HEIGHT / 2,
      };
    });
  }

  function getDiagnostics() {
    const collisions = [];
    for (let i = 0; i < lastLayout.length; i += 1) {
      for (let j = i + 1; j < lastLayout.length; j += 1) {
        const a = lastLayout[i];
        const b = lastLayout[j];
        const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0
          && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0;
        if (overlap) collisions.push([a.id, b.id]);
      }
    }
    return {
      labels: lastLayout,
      collisions,
      outOfViewport: lastLayout.filter((item) => item.left < 0 || item.right > innerWidth || item.top < 0 || item.bottom > innerHeight).map((item) => item.id),
    };
  }

  return { update, getDiagnostics, entries };
}
