import * as THREE from 'three';

// 审美参数唯一入口：精修视觉时优先改这里，不改几何与驱动结构。
export const LOOK = Object.freeze({
  background: 0x05070d,
  fogColor: 0x05070d,
  fogDensity: 0.0026,
  blueprintFogDensity: 0.0016,
  hueStart: 0.615,
  hueEnd: 0.655,
  hueSaturation: 0.82,
  hueLightness: 0.66,
  exposure: 1.16,
  glass: {
    closedOpacity: 0.96,
    openOpacity: 0.28,
    residueOpacity: 0.10,
    finalOpacity: 0.32,
    transmission: 0.68,
    closedEnv: 1.0,
    openEnv: 0.15,
    finalEnv: 0.5,
  },
  lights: {
    key: 3.4,
    rim: 3.8,
    fill: 1.25,
    hemisphere: 0.95,
    warm: 6,
  },
  frame: {
    assembledOpacity: 0.62,
    explodedOpacity: 0.34,
    focusOpacity: 0.20,
  },
  focus: {
    dimOpacity: 0.25,
    warmColor: 0xff7a45,
    surfaceMix: 0.22,
    lineMix: 0.72,
    emissiveMix: 0.28,
  },
});

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const q = clamp01((x - a) / (b - a));
  return q * q * (3 - 2 * q);
};
const mix = (a, b, q) => a + (b - a) * q;
const FOCUS_BODY = new THREE.Color(0x7c8aa3);

function makeEnvironment(renderer) {
  // 六张本地程序化柔光面，给金属与玻璃提供 IBL；无远程 HDR、无图片请求。
  const faces = [];
  for (let i = 0; i < 6; i += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 64, 64);
    gradient.addColorStop(0, i % 2 ? '#101725' : '#263652');
    gradient.addColorStop(0.48, '#080b12');
    gradient.addColorStop(1, i === 2 ? '#6c7f9e' : '#141b29');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = i < 2 ? 'rgba(230,238,255,.82)' : 'rgba(150,180,235,.32)';
    ctx.fillRect(8 + i * 3, 5, 10, 54);
    ctx.fillStyle = 'rgba(255,142,91,.18)';
    ctx.fillRect(48, 12, 5, 40);
    faces.push(canvas);
  }
  const cube = new THREE.CubeTexture(faces);
  cube.colorSpace = THREE.SRGBColorSpace;
  cube.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromCubemap(cube);
  cube.dispose();
  pmrem.dispose();
  return target;
}

export function createLook(scene, renderer, { mobile = false } = {}) {
  scene.background = null; // 透明画布，让 DOM 暗底网格与暗角保持可见。
  scene.fog = mobile ? null : new THREE.FogExp2(LOOK.fogColor, LOOK.fogDensity);
  const environmentTarget = makeEnvironment(renderer);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 0.72;

  const key = new THREE.DirectionalLight(0xdbe8ff, 0.15);
  key.position.set(38, 48, 48);
  const rim = new THREE.DirectionalLight(0x7597ff, 0.2);
  rim.position.set(-42, 20, -38);
  const fill = new THREE.DirectionalLight(0xb7c9ec, 0.1);
  fill.position.set(12, -28, 32);
  const hemisphere = new THREE.HemisphereLight(0x52698e, 0x080a10, 0.12);
  const warm = new THREE.PointLight(0xff7a45, 0, 145, 2);
  warm.position.set(-16, 12, 18);
  scene.add(key, rim, fill, hemisphere, warm);

  return { scene, renderer, key, rim, fill, hemisphere, warm, environmentTarget, mobile };
}

function resetMaterial(material) {
  const base = material.userData.look;
  if (!base) return;
  if (material.color && base.color) material.color.copy(base.color);
  if (material.emissive && base.emissive) {
    material.emissive.copy(base.emissive);
    material.emissiveIntensity = base.emissiveIntensity;
  }
  material.opacity = base.opacity;
  material.envMapIntensity = base.envMapIntensity;
}

function setPartAppearance(part, reveal, focus, warmColor, blueprint) {
  const isFocus = part.focus === true;
  const visibility = reveal * (isFocus ? 1 : mix(1, LOOK.focus.dimOpacity, focus));
  const warmth = isFocus ? focus : 0;

  for (const material of part.materials) {
    const base = material.userData.look;
    resetMaterial(material);
    const blueprintWeight = base.line ? 1 : 1 - blueprint * 0.48;
    material.opacity = base.opacity * visibility * blueprintWeight;
    material.depthWrite = visibility > 0.72 && base.opacity > 0.7 && blueprint < 0.4;
    if (warmth > 0) {
      const copper = base.color?.getHex() === 0xb86a3d;
      const surfaceMix = copper ? 0.38 : LOOK.focus.surfaceMix * 0.32;
      const amount = base.line ? LOOK.focus.lineMix : surfaceMix;
      if (material.color && !base.line && !copper) material.color.lerp(FOCUS_BODY, warmth * 0.28);
      if (material.color) material.color.lerp(warmColor, warmth * amount);
      if (material.emissive) {
        const emissiveMix = base.line ? 0.34 : copper ? 0.20 : 0.025;
        material.emissive.lerp(warmColor, warmth * emissiveMix);
        material.emissiveIntensity = Math.max(base.emissiveIntensity, warmth * (copper ? 0.32 : 0.10));
      }
    }
  }
}

function setGlassAppearance(part, p, mobile) {
  const open = smooth(0.08, 0.20, p);
  const depart = smooth(0.20, 0.34, p);
  const returning = smooth(0.82, 0.90, p);
  let opacity;
  let env;
  if (p < 0.20) {
    opacity = mix(LOOK.glass.closedOpacity, LOOK.glass.openOpacity, open);
    env = mix(LOOK.glass.closedEnv, LOOK.glass.openEnv, open);
  } else if (p < 0.62) {
    opacity = mix(LOOK.glass.openOpacity, LOOK.glass.residueOpacity, depart);
    env = LOOK.glass.openEnv;
  } else if (p < 0.82) {
    opacity = 0;
    env = 0;
  } else {
    opacity = mix(0, LOOK.glass.finalOpacity, returning);
    env = mix(0, LOOK.glass.finalEnv, returning);
  }

  for (const material of part.materials) {
    const base = material.userData.look;
    resetMaterial(material);
    if (base.line) {
      material.opacity = base.opacity * opacity;
    } else {
      material.opacity = base.opacity * opacity;
      if ('transmission' in material) {
        material.transmission = mobile ? 0 : LOOK.glass.transmission * open;
        material.roughness = mix(0.16, 0.07, open);
      }
      material.envMapIntensity = env;
      material.depthWrite = opacity > 0.7;
    }
  }
}

export function updateLook(rig, model, p) {
  const open = smooth(0.06, 0.20, p);
  const blueprint = smooth(0.44, 0.52, p) * (1 - smooth(0.60, 0.66, p));
  const focus = smooth(0.62, 0.68, p) * (1 - smooth(0.755, 0.78, p));
  const reassemble = smooth(0.78, 0.90, p);
  const reveal = 0.025 + open * 0.975;
  const warmColor = new THREE.Color(LOOK.focus.warmColor);
  const hue = mix(LOOK.hueStart, LOOK.hueEnd, smooth(0, 1, p));

  rig.key.intensity = mix(0.12, LOOK.lights.key, open);
  rig.rim.intensity = mix(0.18, LOOK.lights.rim, open);
  rig.fill.intensity = mix(0.06, LOOK.lights.fill, open);
  rig.hemisphere.intensity = mix(0.08, LOOK.lights.hemisphere, open);
  rig.warm.intensity = LOOK.lights.warm * focus;
  rig.renderer.toneMappingExposure = LOOK.exposure + focus * 0.08;
  if (rig.scene.fog) {
    rig.scene.fog.density = mix(LOOK.fogDensity, LOOK.blueprintFogDensity, blueprint);
  }

  for (const part of model.all) {
    if (part.glass) setGlassAppearance(part, p, rig.mobile);
    else setPartAppearance(part, reveal, focus, warmColor, blueprint);
  }

  const frameOpacity = mix(
    mix(LOOK.frame.assembledOpacity, LOOK.frame.explodedOpacity, smooth(0.20, 0.44, p)),
    LOOK.frame.assembledOpacity,
    reassemble,
  );
  for (const material of model.frame.materials) {
    const base = material.userData.look;
    resetMaterial(material);
    material.opacity = base.opacity * mix(frameOpacity, LOOK.frame.focusOpacity, focus);
    if (material.color) material.color.setHSL(hue, LOOK.hueSaturation * 0.42, 0.30);
    if (material.emissive) material.emissive.setHSL(hue, 0.72, 0.12);
  }

  // 只让蓝色边线随进度微偏色；金属固有色不被整体染色。
  for (const part of model.all) {
    if (part.glass || part.focus) continue;
    for (const material of part.materials) {
      const base = material.userData.look;
      if (base?.line && material.color) {
        material.color.setHSL(hue, LOOK.hueSaturation, LOOK.hueLightness);
      }
    }
  }

  return { open, blueprint, focus, reassemble };
}

export function disposeLook(rig) {
  rig.environmentTarget?.dispose();
}
