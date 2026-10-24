# <效果中文名>

- slug: `<slug>`
- status: `ready` | `spec-only` | `reference`
- determinism: `closed-form` | `precomputed-simulation`
- stack: `multiplane` / `remotion` / 「未实现」

---

## 1 契约 Contract

**输入**：文案 / 数据 / 画幅 / 时长 / 色彩语义。
**输出**：镜头页（`ref/`）或 composition；可渲成 mp4 或静帧。
**适用**：一句话说清什么场合该用它，什么场合不该用。

## 2 硬禁用 Banned

| 禁止 | 原因 | 改用 |
|---|---|---|
| CSS `transition` / `animation` | 浏览器按墙钟推进，`lint` 报 `css_animation`，渲染结果不可复现 | 在 `render(t)` 里直接设样式 |
| 全局累加计数器做错峰 | 多进程渲染与乱序调用下会错位，`verify` 的 `workers` 项会失败 | 用 `index * stagger` 的闭式表达式 |
| 远程字体 / CDN | `lint` 报 `remote_resource` | 本地 woff2 + `fonts` 声明 |

## 3 观测量 Observables（唯一硬约束）

位置一律用**相对舞台宽高的比例**，时刻一律用**占全片时长的比例**。

| 相对时刻 | 元素 | 相对位置 | 缩放 | 不透明度 | 缓动族 |
|---|---|---|---|---|---|
| 0% | 全部 | 基线下 8% | 1 | 0 | — |
| 8% | 第 1 个 | 基线 | 1 | 1 | smooth |
| 后续每 +3% | 逐个 | 同上 | 1 | 1 | smooth |

机器可读版见 `intent.json` 的 `observables`。

## 4 失败模式 Failures

| # | 症状 | 根因 | 修复 |
|---|---|---|---|
| F1 | 抽帧看到位置逐次漂移 | 用了上一帧的状态累加 | 改成 t 的闭式函数 |
| F2 | `verify` 只有 `workers` 项失败 | 存在跨调用共享状态 | 同上 |
| F3 | | | |

## 5 调参决策树 Tuning

**真正的旋钮只有 2 个**：错峰间隔、缓动族。其余（DOM 结构、库、字体渲染）都是工程细节，改了不影响观感。

```
抽帧 → 对比观测量表
├─ 位置/透明度对不上 → 改 render(t) 的插值，不动旋钮
├─ 节奏感觉碎 → 只调错峰间隔
└─ 节奏对但"手感"不对 → 只换缓动族
```

## 6 留白 Free

此处**不做任何规定**：元素结构与标签、是否使用动画库、字体、代码风格、命名。

---

## 验收 Verify

1. `multiplane lint <shot>`：无 error。
2. `multiplane verify <shot>`：通过（`gpu_raster_jitter` 警告可忽略）。
3. `multiplane stills <shot> --at <关键帧时刻>`：抽帧目视符合观测量表。
4. `multiplane inspect <shot> --json`：`duration` / `fps` / 舞台尺寸符合预期。
