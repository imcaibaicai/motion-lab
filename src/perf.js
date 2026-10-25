import * as THREE from 'three';

export function readProfile() {
  const params = new URLSearchParams(location.search);
  const raw = params.get('t');
  const parsed = raw === null ? null : Number(raw);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = innerWidth < 760 || matchMedia('(pointer: coarse)').matches;
  return {
    forced: parsed === null || !Number.isFinite(parsed) ? null : Math.min(1, Math.max(0, parsed)),
    reduced,
    mobile,
    staticReason: params.get('static') === '1' ? '手动静态预览' : reduced ? '系统已开启减少动态效果' : '',
    debug: params.get('debug') === '1',
  };
}

export function showStatic(reason) {
  document.documentElement.classList.add('static-mode');
  const experience = document.getElementById('experience');
  if (experience) experience.setAttribute('aria-hidden', 'true');
  const notice = document.getElementById('fallback-notice');
  if (notice) {
    notice.hidden = false;
    notice.textContent = `已显示静态完整版：${reason}。七幕内容均可直接阅读。`;
  }
}

export function createRenderer(canvas, { mobile }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.setClearColor(0x05070d, 0);
  return renderer;
}

export function observeVitals() {
  const vitals = { lcp: null, cls: 0, inp: null, supported: true };
  if (!('PerformanceObserver' in window)) {
    vitals.supported = false;
    return { vitals, disconnect() {} };
  }
  const observers = [];
  try {
    const lcp = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length) vitals.lcp = entries[entries.length - 1].startTime;
    });
    lcp.observe({ type: 'largest-contentful-paint', buffered: true });
    observers.push(lcp);
    const cls = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) vitals.cls += entry.value;
    });
    cls.observe({ type: 'layout-shift', buffered: true });
    observers.push(cls);
    const event = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) vitals.inp = Math.max(vitals.inp || 0, entry.duration);
    });
    event.observe({ type: 'event', buffered: true, durationThreshold: 16 });
    observers.push(event);
  } catch {
    vitals.supported = false;
  }
  return { vitals, disconnect() { for (const observer of observers) observer.disconnect(); } };
}

export function createPerformanceMonitor(renderer, startedAt) {
  const frameTimes = [];
  let previous = 0;
  let firstFrameMs = null;
  let contextLost = 0;
  let frames = 0;
  return {
    tick(now) {
      if (previous) {
        frameTimes.push(now - previous);
        if (frameTimes.length > 180) frameTimes.shift();
      }
      previous = now;
      frames += 1;
    },
    markFirstFrame(now) {
      if (firstFrameMs === null) firstFrameMs = now - startedAt;
    },
    markContextLost() { contextLost += 1; },
    snapshot() {
      const sorted = [...frameTimes].sort((a, b) => a - b);
      const mean = frameTimes.length
        ? frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length
        : 0;
      const p99 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] : 0;
      return {
        frames,
        sampleCount: frameTimes.length,
        fps: mean ? 1000 / mean : 0,
        onePercentLowFps: p99 ? 1000 / p99 : 0,
        firstFrameMs,
        contextLost,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      };
    },
  };
}

export function installContextLossHandling(canvas, { onLost, onRestored }) {
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    onLost();
  });
  canvas.addEventListener('webglcontextrestored', () => onRestored());
}
