const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const q = clamp01((x - a) / (b - a));
  return q * q * (3 - 2 * q);
};

// A5 按 A2 的反序归位：顶盖先回，两片玻璃最后回；全部在 0.90 前归零。
let returnSchedule = new Map();

export function createDriver(parts) {
  const ordered = [...parts].sort((a, b) => (b.end - a.end) || (b.start - a.start));
  returnSchedule = new Map(ordered.map((part, index) => {
    const start = 0.78 + (index / Math.max(1, ordered.length - 1)) * 0.07;
    return [part.id, { start, end: start + 0.05, order: index }];
  }));
  return { parts, returnSchedule };
}

export function explosionFactor(part, p) {
  if (p <= 0.44) {
    const preview = part.glass ? smooth(0.16, 0.20, p) * 0.06 : 0;
    return Math.max(preview, smooth(part.start, part.end, p));
  }
  if (p < 0.78) return 1;
  const returning = returnSchedule.get(part.id);
  if (!returning) return 0;
  return 1 - smooth(returning.start, returning.end, p);
}

export function updateDriver(driver, model, p) {
  let maxDisplacementResidual = 0;
  const focusPush = smooth(0.62, 0.68, p) * (1 - smooth(0.74, 0.78, p));
  for (const part of driver.parts) {
    const factor = explosionFactor(part, p);
    const push = part.focus ? 1 : 1 + focusPush * 0.08;
    part.obj.position.copy(part.base).addScaledVector(part.explode, factor * push);
    part.obj.userData.explosionFactor = factor;
    if (p >= 0.90) maxDisplacementResidual = Math.max(maxDisplacementResidual, factor);
  }

  // 待机微动也必须是 p 的纯函数；不使用墙钟、CSS 动画或上一帧状态。
  const openingTurn = smooth(0, 0.20, p);
  const closingTurn = smooth(0.90, 1, p);
  model.root.rotation.y = -0.16 + openingTurn * 0.10 - closingTurn * 0.08
    + Math.sin(p * Math.PI * 2) * 0.018;
  model.root.updateMatrixWorld(true);
  return { maxDisplacementResidual };
}

export function inspectReturnSchedule(parts) {
  const ordered = [...parts].sort((a, b) => (b.end - a.end) || (b.start - a.start));
  return ordered.map((part) => ({ id: part.id, ...returnSchedule.get(part.id) }));
}
