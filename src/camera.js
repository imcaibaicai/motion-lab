import * as THREE from 'three';

// 实测修订：爆炸体约 90 单位高，A2/A3 必须拉远；0.70 到贴脸构图，
// 0.78 拉回远景且 target 回 (7,0,0)，同时满足 A5 归位与验收回零。
export const CAMERA_KEYS = Object.freeze([
  { p: 0.00, pos: [7, 46, 92], target: [7, 2, 0], fov: 40 },
  { p: 0.20, pos: [7, 20, 94], target: [7, 0, 0], fov: 40 },
  { p: 0.44, pos: [38, 24, 145], target: [7, 0, 0], fov: 40 },
  { p: 0.62, pos: [48, 26, 190], target: [7, 0, 0], fov: 30 },
  { p: 0.70, pos: [-4, 15, 50], target: [-20, 14, 8], fov: 40 },
  { p: 0.78, pos: [7, 18, 105], target: [7, 0, 0], fov: 40 },
  { p: 0.90, pos: [7, 14, 96], target: [7, 0, 0], fov: 40 },
  { p: 1.00, pos: [7, 20, 104], target: [7, 2, 0], fov: 40 },
]);

// 竖幅专用表：390×844 的水平视场只有约 19°，桌面距离装不下 65 单位宽的爆炸体。
// 做法是按关键帧拉远（k）、把注视点下移（dy）让机箱落在上半屏，避免正文压住零件。
export const MOBILE_KEYS = Object.freeze([
  // 下面七组由 probe-mobile.mjs 按 390×844 网格搜索得到（8px 安全边距、可见零件全在画面内）。
  { p: 0.00, pos: [7, 44.2, 89.7], target: [7, -6, 0], fov: 46 },
  { p: 0.20, pos: [5, 23.1, 103.9], target: [5, -10, 0], fov: 46 },
  { p: 0.44, pos: [54.2, 18.3, 194.7], target: [12.5, -14, 0], fov: 46 },
  { p: 0.62, pos: [50.8, 13.9, 188.9], target: [10, -12, 0], fov: 44 },
  { p: 0.70, pos: [-4, 15, 50], target: [-20, 14, 8], fov: 42 },
  { p: 0.78, pos: [10, 16.9, 180.5], target: [10, -14, 0], fov: 46 },
  { p: 0.90, pos: [6.5, 12.6, 89.8], target: [6.5, -8, 0], fov: 46 },
  { p: 1.00, pos: [7, 17.9, 95.5], target: [7, -6, 0], fov: 46 },
]);

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth01 = (x) => x * x * (3 - 2 * x);
const mix = (a, b, t) => a + (b - a) * t;

function tangent(keys, index, field, component) {
  const current = keys[index];
  if (index === 0) {
    const next = keys[1];
    return (next[field][component] - current[field][component]) / (next.p - current.p);
  }
  if (index === keys.length - 1) {
    const previous = keys[index - 1];
    return (current[field][component] - previous[field][component]) / (current.p - previous.p);
  }
  const previous = keys[index - 1];
  const next = keys[index + 1];
  const incoming = (current[field][component] - previous[field][component]) / (current.p - previous.p);
  const outgoing = (next[field][component] - current[field][component]) / (next.p - current.p);
  // 局部反转点不能带着平均切线高速穿过，否则会在贴脸段形成速度尖峰。
  if (incoming * outgoing <= 0) return 0;
  // 非均匀进度轴上的 Catmull–Rom 切线，保留普通关键帧的 C1 连续速度。
  return (next[field][component] - previous[field][component]) / (next.p - previous.p);
}

function hermite(keys, segment, local, field, component) {
  const a = keys[segment];
  const b = keys[segment + 1];
  const dt = b.p - a.p;
  const t2 = local * local;
  const t3 = t2 * local;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + local;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * a[field][component]
    + h10 * dt * tangent(keys, segment, field, component)
    + h01 * b[field][component]
    + h11 * dt * tangent(keys, segment + 1, field, component);
}

function findSegment(keys, p) {
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (p <= keys[i + 1].p) return i;
  }
  return keys.length - 2;
}

export function bakeCamera(keys = CAMERA_KEYS) {
  const frames = [];
  for (let index = 0; index <= 100; index += 1) {
    const p = index / 100;
    const segment = findSegment(keys, p);
    const a = keys[segment];
    const b = keys[segment + 1];
    const local = clamp01((p - a.p) / (b.p - a.p));
    const pos = [0, 1, 2].map((component) => hermite(keys, segment, local, 'pos', component));
    const target = [0, 1, 2].map((component) => hermite(keys, segment, local, 'target', component));
    // fov 独立 smoothstep，绝不跟随位置样条过冲。
    const fov = mix(a.fov, b.fov, smooth01(local));
    frames.push({ p, pos, target, fov });
  }
  return Object.freeze(frames);
}

export const CAMERA_FRAMES = bakeCamera(CAMERA_KEYS);
export const MOBILE_FRAMES = bakeCamera(MOBILE_KEYS);

export function framesFor(mobile) {
  return mobile ? MOBILE_FRAMES : CAMERA_FRAMES;
}

export function applyCamera(camera, p, mobile = false) {
  const frames = framesFor(mobile);
  const scaled = clamp01(p) * 100;
  const index = Math.min(99, Math.floor(scaled));
  const local = scaled - index;
  const a = frames[index];
  const b = frames[index + 1];
  camera.position.set(
    mix(a.pos[0], b.pos[0], local),
    mix(a.pos[1], b.pos[1], local),
    mix(a.pos[2], b.pos[2], local),
  );
  camera.userData.target = camera.userData.target || new THREE.Vector3();
  camera.userData.target.set(
    mix(a.target[0], b.target[0], local),
    mix(a.target[1], b.target[1], local),
    mix(a.target[2], b.target[2], local),
  );
  camera.lookAt(camera.userData.target);
  camera.fov = mix(a.fov, b.fov, local);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

export function inspectCamera(frames = CAMERA_FRAMES) {
  let maxSpeedStepRatio = 0;
  let worstIndex = -1;
  const speeds = [];
  for (let i = 0; i < frames.length; i += 1) {
    const previous = frames[Math.max(0, i - 1)];
    const next = frames[Math.min(frames.length - 1, i + 1)];
    const dx = next.pos[0] - previous.pos[0];
    const dy = next.pos[1] - previous.pos[1];
    const dz = next.pos[2] - previous.pos[2];
    const dp = Math.max(0.0001, next.p - previous.p);
    speeds.push(Math.hypot(dx, dy, dz) / dp);
  }
  for (let i = 1; i < speeds.length; i += 1) {
    const denominator = Math.max(0.001, (speeds[i] + speeds[i - 1]) * 0.5);
    const ratio = Math.abs(speeds[i] - speeds[i - 1]) / denominator;
    if (ratio > maxSpeedStepRatio) {
      maxSpeedStepRatio = ratio;
      worstIndex = i;
    }
  }
  const at078 = frames[78];
  return {
    frameCount: frames.length,
    maxSpeedStepRatio,
    worstIndex,
    target078: at078.target,
    target078Error: Math.hypot(at078.target[0] - 7, at078.target[1], at078.target[2]),
    fov062: frames[62].fov,
    finite: frames.every((frame) => [...frame.pos, ...frame.target, frame.fov].every(Number.isFinite)),
  };
}
