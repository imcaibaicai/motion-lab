# packages/motion

缓动的唯一真源。`easing.json` 是数据，网页与视频各自读同一份，避免两边手感漂移。

## 网页侧

```js
import easing from './packages/motion/easing.json' with { type: 'json' };
const e = easing.families.smooth;
el.style.transition = `transform ${e.webDurationMs}ms cubic-bezier(${e.bezier.join(',')})`;
```

也可以用构建脚本把 `easing.json` 生成一份 CSS 变量表，避免运行时读 JSON。

## 视频侧（Multiplane）

`render(t)` 里不能用 CSS 过渡，必须自己按 t 求值：

```js
function easeBezier(p, [x1, y1, x2, y2]) {
  // 三次贝塞尔求 y(x)，控制点在 (0,0) 与 (1,1)
  // 实现略：二分或牛顿迭代解 x(u)=p，再取 y(u)
}
const k = easeBezier(Shot.ease.prog(t, 0, duration * entryRatio), easing.families.smooth.bezier);
```

`Shot.ease` 自带几个常用曲线，**够用就用它**；需要与网页严格一致时才走上面的贝塞尔求值。

## 纪律

- 文档与说明书里**只写族名**（`snappy` / `smooth` / …），不写具体数值。
- 改曲线只改这里一处，网页与视频同时生效。
- 新增族名要先问：它解决的是新需求，还是现有族的变体？
