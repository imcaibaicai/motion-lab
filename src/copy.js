export const SCENES = Object.freeze([
  {
    id: 'a0', start: 0, end: 0.08, index: '00', eyebrow: 'DEMO CLUB / 招新',
    title: '示例社团',
    lead: '从一台机器开始，认识一群愿意把问题拆开的人。',
    meta: '某校 · 创始年份待确认',
  },
  {
    id: 'a1', start: 0.08, end: 0.20, index: '01', eyebrow: 'SEC.01 / 拆解',
    title: '把它拆开看看',
    lead: '这台机器里的每一个零件，都在决定它值不值这个价。',
  },
  {
    id: 'a2', start: 0.20, end: 0.44, index: '02', eyebrow: 'SEC.02 / 装机',
    title: '我们真的动手',
    lead: '不是只看参数表。装一遍，才知道每一步为什么这样做。',
    bullets: ['整机装配：从零到点亮（示例条目）', '常见故障与排错：把经验讲清楚（示例条目）', '工具、防静电、走线：从基础开始（示例条目）'],
  },
  {
    id: 'a3', start: 0.44, end: 0.62, index: '03', eyebrow: 'SEC.03 / 参数',
    title: '参数不是玄学',
    lead: '看懂规格，也看懂预算。参数应该服务选择，而不是制造焦虑。',
    bullets: ['同一颗 CPU，为什么两台机器差价两千', 'B760 和 Z790，你该为哪个多付钱', '电源瓦数怎么算；认准 ATX 3.1 与 12V-2x6'],
  },
  {
    id: 'a4', start: 0.62, end: 0.78, index: '04', eyebrow: 'SEC.04 / 现实',
    title: '今年，存储是真的贵',
    lead: '内存和固态这一轮涨得很凶，很多人的第一台机器被预算卡住。',
    bullets: ['算清楚哪些钱必须花，哪些可以等', '看看手上旧机器的零件，哪些还能救'],
  },
  {
    id: 'a5', start: 0.78, end: 0.90, index: '05', eyebrow: 'SEC.05 / 我们',
    title: '一个人装机，一群人排错',
    lead: '不懂就问。把问题带来，把机器带来，空手来也可以。',
    bullets: ['成员方向与活动频次待社团确认', '互助排错与经验分享（示例条目）'],
  },
  {
    id: 'a6', start: 0.90, end: 1, index: '06', eyebrow: 'JOIN US / 九月见',
    title: '九月，机箱旁边见',
    lead: '团队寄语待确认。正式二维码与联系方式提供后替换此演示卡片。',
  },
]);

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const q = clamp01((x - a) / (b - a));
  return q * q * (3 - 2 * q);
};

// CJK 与全角标点按字切；拉丁字母、数字与半角标点按词切，避免把 B760 拆成 B/7/6/0。
const CJK = /[\u2e80-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;
const SPACE = /\s/;

export function tokenize(text) {
  const tokens = [];
  let word = '';
  for (const ch of text) {
    if (CJK.test(ch) || SPACE.test(ch)) {
      if (word) { tokens.push(word); word = ''; }
      tokens.push(SPACE.test(ch) ? ' ' : ch);
    } else {
      word += ch;
    }
  }
  if (word) tokens.push(word);
  return tokens;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildReveal(target, text) {
  target.textContent = '';
  // 屏幕阅读器读完整原句，视觉层才逐字显示，避免被念成一串单字。
  target.append(element('span', 'sr-only', text));
  const visual = element('span', 'reveal');
  visual.setAttribute('aria-hidden', 'true');
  const tokens = [];
  for (const token of tokenize(text)) {
    if (token === ' ') {
      visual.append(document.createTextNode(' '));
      continue;
    }
    const span = element('span', 'reveal-token', token);
    span.style.opacity = '0';
    visual.append(span);
    tokens.push(span);
  }
  target.append(visual);
  target.dataset.revealTokens = String(tokens.length);
  return tokens;
}

// 标题渐变必须逐字落在字符自己身上：父级 background-clip:text 时，子 span 的 opacity
// 只影响文字填充，不影响父级背景的裁剪绘制，画面会"全字可见但透明度读数为 0"。
export function paintCopyGradients(panels) {
  for (const panel of panels) {
    const title = panel.querySelector('.scene-title');
    if (!title) continue;
    const rect = title.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    for (const token of title.querySelectorAll('.reveal-token')) {
      const box = token.getBoundingClientRect();
      token.style.backgroundImage = 'linear-gradient(175deg,#fff 8%,#c4d2f1 58%,#849bd3 100%)';
      token.style.backgroundSize = `${rect.width.toFixed(2)}px ${rect.height.toFixed(2)}px`;
      token.style.backgroundPosition = `${(rect.left - box.left).toFixed(2)}px ${(rect.top - box.top).toFixed(2)}px`;
      token.style.backgroundRepeat = 'no-repeat';
      token.style.webkitBackgroundClip = 'text';
      token.style.backgroundClip = 'text';
      token.style.webkitTextFillColor = 'transparent';
      token.style.color = 'transparent';
    }
  }
}

export function createCopy(container) {
  const panels = SCENES.map((scene) => {
    const serverRendered = container.querySelector(`[data-scene="${scene.id}"]`);
    const panel = serverRendered || (() => {
      const created = element('article', 'copy-panel');
      created.dataset.scene = scene.id;
      created.setAttribute('aria-hidden', 'true');
      const top = element('div', 'copy-topline');
      top.append(element('span', 'eyebrow', scene.eyebrow), element('span', 'scene-index', scene.index));
      created.append(top);
      created.append(element(scene.id === 'a0' ? 'h1' : 'h2', 'scene-title', scene.title));
      created.append(element('p', 'scene-lead', scene.lead));
      if (scene.meta) created.append(element('p', 'scene-meta', scene.meta));
      if (scene.bullets) {
        const list = element('ul', 'scene-bullets');
        for (const item of scene.bullets) list.append(element('li', '', item));
        created.append(list);
      }
      container.append(created);
      return created;
    })();
    const title = panel.querySelector('.scene-title');
    const lead = panel.querySelector('.scene-lead');
    panel.__titleTokens = title ? buildReveal(title, scene.title) : [];
    panel.__leadTokens = lead ? buildReveal(lead, scene.lead) : [];
    panel.__bulletItems = [...panel.querySelectorAll('.scene-bullets li')];
    panel.__bulletTokens = panel.__bulletItems.map((item) => buildReveal(item, item.textContent));
    return panel;
  });
  paintCopyGradients(panels);
  if (document.fonts?.ready) document.fonts.ready.then(() => paintCopyGradients(panels));
  return panels;
}

export function sceneIndexAt(p) {
  const index = SCENES.findIndex((scene) => p >= scene.start && p < scene.end);
  return index < 0 ? SCENES.length - 1 : index;
}

function revealTokens(tokens, p, base, span, fade) {
  const stagger = tokens.length > 1 ? Math.min(0.0055, span / (tokens.length - 1)) : 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const at = base + i * stagger;
    tokens[i].style.opacity = smooth(at, at + fade, p).toFixed(4);
  }
}

export function updateCopy(panels, p) {
  const activeIndex = sceneIndexAt(p);
  panels.forEach((panel, index) => {
    const scene = SCENES[index];
    // 硬切而非交叉淡化：两幕同时可见时中文标题会叠成乱码。
    // 换幕靠"新幕从下方 10px 落定"提供动感，切点处新幕文字已经显形，不会出现空白区。
    const opacity = index === activeIndex ? 1 : 0;
    const settle = index === 0 ? 1 : smooth(scene.start, scene.start + 0.012, p);
    panel.style.opacity = opacity.toFixed(4);
    panel.style.visibility = opacity ? 'visible' : 'hidden';
    panel.style.transform = `translateY(${(1 - settle) * 10}px)`;
    panel.setAttribute('aria-hidden', opacity ? 'false' : 'true');

    if (!opacity) return;
    // 首屏 A0 在 p=0 就必须全亮，否则 LCP 会被逐字动画拖晚；其余幕在切点前就开始显形。
    const sceneWidth = scene.end - scene.start;
    const titleBase = index === 0 ? -0.06 : scene.start - 0.012;
    const leadBase = index === 0 ? -0.06 : scene.start - 0.004;
    revealTokens(panel.__titleTokens, p, titleBase, Math.min(0.05, Math.max(0.018, sceneWidth * 0.30)), 0.008);
    revealTokens(panel.__leadTokens, p, leadBase, Math.min(0.07, Math.max(0.025, sceneWidth * 0.34)), 0.009);
    panel.__bulletTokens.forEach((tokens, bulletIndex) => {
      const base = leadBase + 0.016 + bulletIndex * 0.008;
      // 文字还没显形时先藏起整行，否则只剩孤零零的橙色破折号。
      if (panel.__bulletItems[bulletIndex]) {
        panel.__bulletItems[bulletIndex].style.visibility = p >= base ? 'visible' : 'hidden';
      }
      revealTokens(tokens, p, base, Math.min(0.06, Math.max(0.02, sceneWidth * 0.25)), 0.008);
    });
  });
  return activeIndex;
}
