import * as THREE from 'three';
import { createParts, assertPartTable } from './parts.js';
import { LOOK, createLook, updateLook } from './look.js';
import { applyCamera, inspectCamera, framesFor } from './camera.js';
import { createDriver, updateDriver, inspectReturnSchedule } from './driver.js';
import { SCENES, createCopy, updateCopy, paintCopyGradients } from './copy.js';
import { createLabels } from './labels.js';
import {
  readProfile, showStatic, createRenderer, observeVitals,
  createPerformanceMonitor, installContextLossHandling,
} from './perf.js';

const profile = readProfile();
const diagnosticsNode = document.getElementById('diagnostics');
const cameraReport = inspectCamera(framesFor(profile.mobile));
assertPartTable();

if (profile.staticReason) {
  showStatic(profile.staticReason);
} else {
  initialise().catch((error) => {
    console.error(error);
    showStatic(`WebGL 初始化失败（${error.message}）`);
    diagnosticsNode.textContent = JSON.stringify({ ready: false, error: error.message });
  });
}

async function initialise() {
  const canvas = document.getElementById('gl');
  const renderer = createRenderer(canvas, profile);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.2, 1800);
  const model = createParts(profile);
  const rig = createLook(scene, renderer, profile);
  const driver = createDriver(model.parts);
  const panels = createCopy(document.getElementById('copy'));
  const labelLayer = createLabels(document.getElementById('labels'), model);
  const monitor = createPerformanceMonitor(renderer, 0); // performance.now() 已是导航相对时间。
  const vitals = observeVitals();
  const boot = document.getElementById('boot');
  const pct = document.getElementById('pct');
  const hudScene = document.getElementById('hud-scene');
  const joinCard = document.getElementById('join-card');
  const scrollCue = document.getElementById('scroll-cue');
  const chapterButtons = [...document.querySelectorAll('[data-jump]')];
  const partCard = document.getElementById('part-card');
  const partCardName = document.getElementById('part-card-name');
  const partCardSpec = document.getElementById('part-card-spec');
  const partCardIndex = document.getElementById('part-card-index');
  const partById = new Map(model.all.map((part) => [part.id, part]));
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let cardId = null;
  let cardP = -1;
  scene.add(model.root);

  let override = profile.forced;
  let targetProgress = 0;
  let maxScroll = 1;
  let currentProgress = 0;
  let firstFrame = true;
  let frameCounter = 0;
  let lastScene = -1;

  const smooth = (a, b, x) => {
    const q = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return q * q * (3 - 2 * q);
  };

  function measure() {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    targetProgress = Math.min(1, Math.max(0, scrollY / maxScroll));
  }

  function closeCard() {
    if (!partCard) return;
    cardId = null;
    cardP = -1;
    partCard.classList.remove('is-open');
    partCard.setAttribute('aria-hidden', 'true');
  }

  function openCard(id) {
    const part = partById.get(id);
    if (!part || !partCard) return null;
    const index = model.parts.findIndex((item) => item.id === id);
    cardId = id;
    cardP = currentProgress;
    partCardIndex.textContent = index >= 0 ? String(index + 1).padStart(2, '0') : '—';
    partCardName.textContent = part.name;
    partCardSpec.textContent = part.spec || '';
    partCard.classList.add('is-open');
    partCard.setAttribute('aria-hidden', 'false');
    return id;
  }

  // 触屏点选：射线命中最近的带 partId 节点；点空白处收起，不依赖计时器。
  function tapAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(model.root.children, true);
    for (const hit of hits) {
      let node = hit.object;
      while (node && node !== model.root && !node.userData.partId) node = node.parent;
      if (!node || !node.userData.partId) continue;
      const part = partById.get(node.userData.partId);
      // 退场玻璃仍在几何上挡在前面，但已接近全透明；不跳过就会点不到后面的零件。
      if (!part || !part.materials.some((material) => material.opacity > 0.12)) continue;
      return openCard(node.userData.partId);
    }
    closeCard();
    return null;
  }

  function diagnostics() {
    return {
      ready: !firstFrame,
      progress: currentProgress,
      partCount: model.parts.length,
      fixedParts: ['motherboard', 'frame'],
      camera: cameraReport,
      returnSchedule: inspectReturnSchedule(model.parts),
      performance: monitor.snapshot(),
      vitals: vitals.vitals,
      renderer: {
        pixelRatio: renderer.getPixelRatio(),
        mobileProfile: profile.mobile,
        cameraMode: profile.mobile ? 'mobile' : 'desktop',
        fogEnabled: scene.fog !== null,
        glassMode: profile.mobile ? 'opaque-dark' : 'physical',
        threeRevision: THREE.REVISION,
      },
      card: { id: cardId, open: partCard?.classList.contains('is-open') === true },
    };
  }

  function publishDiagnostics() {
    const report = diagnostics();
    diagnosticsNode.textContent = JSON.stringify(report);
    document.documentElement.dataset.recruitReady = String(report.ready);
    document.documentElement.dataset.partCount = String(report.partCount);
    document.documentElement.dataset.target078Error = String(report.camera.target078Error);
    return report;
  }

  function render(p) {
    currentProgress = Math.min(1, Math.max(0, p));
    updateDriver(driver, model, currentProgress);
    applyCamera(camera, currentProgress, profile.mobile);
    const lookState = updateLook(rig, model, currentProgress);
    labelLayer.update(camera, currentProgress, profile);
    document.documentElement.style.setProperty('--blueprint', lookState.blueprint.toFixed(4));
    document.documentElement.style.setProperty('--focus', lookState.focus.toFixed(4));
    const sceneIndex = updateCopy(panels, currentProgress);
    if (cardId && Math.abs(currentProgress - cardP) > 0.004) closeCard();
    renderer.render(scene, camera);

    document.documentElement.style.setProperty('--p', currentProgress.toFixed(5));
    pct.textContent = `${String(Math.round(currentProgress * 100)).padStart(3, '0')}%`;
    if (sceneIndex !== lastScene) {
      lastScene = sceneIndex;
      hudScene.textContent = `${SCENES[sceneIndex].index} / ${SCENES[sceneIndex].id.toUpperCase()}`;
      chapterButtons.forEach((button, index) => {
        if (index === sceneIndex) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
    }
    const joinOpacity = smooth(0.905, 0.95, currentProgress);
    joinCard.style.opacity = joinOpacity.toFixed(4);
    joinCard.style.visibility = joinOpacity > 0.01 ? 'visible' : 'hidden';
    joinCard.style.pointerEvents = joinOpacity > 0.8 ? 'auto' : 'none';
    joinCard.setAttribute('aria-hidden', joinOpacity > 0.5 ? 'false' : 'true');
    scrollCue.style.opacity = String(1 - smooth(0.015, 0.065, currentProgress));
    scrollCue.style.pointerEvents = currentProgress < 0.065 ? 'auto' : 'none';

    if (firstFrame) {
      firstFrame = false;
      boot.hidden = true;
      monitor.markFirstFrame(performance.now());
      performance.mark('recruit-first-frame');
      publishDiagnostics();
    }
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    // 标题字号用 vw 夹取，换尺寸后逐字渐变的位置必须重算。
    paintCopyGradients(panels);
    measure();
  }

  function jumpTo(progress) {
    if (override !== null) return;
    scrollTo(0, Math.round(progress * maxScroll));
    measure();
  }

  addEventListener('scroll', measure, { passive: true });
  addEventListener('resize', resize, { passive: true });
  chapterButtons.forEach((button, index) => button.addEventListener('click', () => {
    const scene = SCENES[index];
    jumpTo((scene.start + scene.end) * 0.5);
  }));
  document.querySelector('.wordmark').addEventListener('click', (event) => {
    event.preventDefault();
    jumpTo(0);
  });
  scrollCue.addEventListener('click', () => jumpTo(0.12));

  if (profile.mobile) {
    let downX = 0;
    let downY = 0;
    let downPointer = null;
    canvas.addEventListener('pointerdown', (event) => {
      downX = event.clientX;
      downY = event.clientY;
      downPointer = event.pointerId;
    });
    canvas.addEventListener('pointerup', (event) => {
      if (event.pointerId !== downPointer) return;
      downPointer = null;
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 12) return;
      tapAt(event.clientX, event.clientY);
    });
    canvas.addEventListener('pointercancel', () => { downPointer = null; });
    document.getElementById('part-card-close')?.addEventListener('click', closeCard);
  }
  document.querySelector('.skip-link').addEventListener('click', (event) => {
    event.preventDefault();
    showStatic('用户选择静态正文');
  });
  const qrDialog = document.getElementById('qr-dialog');
  document.getElementById('show-qr').addEventListener('click', () => {
    if (qrDialog && typeof qrDialog.showModal === 'function') qrDialog.showModal();
  });
  document.getElementById('qr-dialog-close')?.addEventListener('click', () => qrDialog?.close());
  qrDialog?.addEventListener('click', (event) => {
    // 点背景关闭：dialog 自身是点击目标时视为点到了遮罩。
    if (event.target === qrDialog) qrDialog.close();
  });
  document.getElementById('show-activities').addEventListener('click', () => {
    showStatic('活动安排以静态正文展示；真实活动清单待确认');
    document.getElementById('static-a2').scrollIntoView();
  });

  installContextLossHandling(canvas, {
    onLost() {
      monitor.markContextLost();
      showStatic('WebGL 上下文丢失');
      publishDiagnostics();
    },
    onRestored() { location.reload(); },
  });

  measure();
  render(override ?? targetProgress);

  function frame(now) {
    monitor.tick(now);
    render(override ?? targetProgress);
    frameCounter += 1;
    if (frameCounter % 45 === 0) publishDiagnostics();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 无头验收钩子：锁定进度、读取结构化报告；不改变正常滚动路径。
  window.__RECRUIT__ = {
    render,
    setProgress(value) {
      override = Math.min(1, Math.max(0, Number(value) || 0));
      render(override);
    },
    releaseProgress() { override = null; measure(); },
    getDiagnostics: publishDiagnostics,
    tapAt,
    closeCard,
    getCardState() {
      return { id: cardId, open: partCard?.classList.contains('is-open') === true };
    },
    getLabelDiagnostics() { return labelLayer.getDiagnostics(); },
    // 只读诊断：用候选相机投影当前装配态，供移动端取景按数值搜索，不改变真实相机。
    projectWith({ pos, target, fov }) {
      const probe = new THREE.PerspectiveCamera(fov, innerWidth / innerHeight, 0.2, 1800);
      probe.position.set(pos[0], pos[1], pos[2]);
      probe.lookAt(new THREE.Vector3(target[0], target[1], target[2]));
      probe.updateMatrixWorld(true);
      model.root.updateMatrixWorld(true);
      return model.all.map((part) => {
        const box = new THREE.Box3().setFromObject(part.obj);
        const xs = [];
        const ys = [];
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) {
              const point = new THREE.Vector3(x, y, z).project(probe);
              xs.push((point.x * 0.5 + 0.5) * innerWidth);
              ys.push((0.5 - point.y * 0.5) * innerHeight);
            }
          }
        }
        const bounds = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
        return {
          id: part.id,
          opacity: Math.max(...part.materials.map((material) => material.opacity)),
          ...bounds,
          inside: bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight,
        };
      });
    },
    getProjection() {
      model.root.updateMatrixWorld(true);
      camera.updateMatrixWorld();
      return model.parts.map((part) => {
        const box = new THREE.Box3().setFromObject(part.obj);
        const projected = [];
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) {
              const point = new THREE.Vector3(x, y, z).project(camera);
              projected.push([(point.x * 0.5 + 0.5) * innerWidth, (0.5 - point.y * 0.5) * innerHeight]);
            }
          }
        }
        const xs = projected.map((point) => point[0]);
        const ys = projected.map((point) => point[1]);
        const bounds = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
        return {
          id: part.id,
          focus: part.focus === true,
          ...bounds,
          inside: bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight,
          opacity: Math.max(...part.materials.map((material) => material.opacity)),
        };
      });
    },
    getState() {
      return {
        p: currentProgress,
        parts: model.parts.map((part) => ({
          id: part.id,
          factor: part.obj.userData.explosionFactor,
          position: part.obj.position.toArray(),
        })),
        camera: { position: camera.position.toArray(), target: camera.userData.target?.toArray(), fov: camera.fov },
        look: LOOK,
      };
    },
  };
}
