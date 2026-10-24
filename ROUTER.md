# 意图路由表（渐进披露）

按用户说的话找落点。**先读本表，再决定读哪一份文档**，不要一上来把整个工作区读一遍。

| 用户说的话 | 走哪个模态 | 先读 |
|---|---|---|
| "做个动画/这个效果怎么实现/看看这个案例" | 探索 Explore | `recipes/scroll-teardown-design.md`（运动与取景）｜`motions/library.json`（已有条目） |
| "把这个页面做出来/改一下这个网页" | 网页实现 Web | `docs/验收标准.md` |
| "出一支片子/渲染成 mp4/卡点" | 视频出片 Shoot | `docs/渲染管线.md` |
| "把这个效果存下来/以后能复用" | 资产入库 Catalog | `motions/_template/SPEC.md` |
| "复刻这张图/把这个图重绘成 SVG" | 工艺 Recipe | `recipes/pixel-svg-rebuild.md`（**待建**，见文末） |
| "照着这段视频做/测量一下它" | 工艺 Recipe | `recipes/reference-reconstruction.md`（**待建**，见文末） |
| "渲染出来不对/画面缺了一块/色差" | 排障 | 对应 `recipes/*.md` 的**失败模式表** |
| "验收怎么算过/指标是多少" | 验收 | `docs/验收标准.md` |
| "缓动和时长用什么" | 规范 | `packages/motion` + `docs/动效规范.md` |

## 三类东西的判据

问自己一句：这是**方法**、**条目**，还是**作品**？

- **方法**（换个项目也成立、讲怎么做）→ `recipes/`
- **条目**（一个具体效果、有 slug、能引用）→ `motions/<slug>/`
- **作品**（这一支片子、这一个页面）→ `video/` 或 `apps/`

判断不出来时问用户，不要猜着落盘。

## 关键词别名

同一件事的不同说法，避免搜不到：

- 代码视频 / 逐帧渲染 / 无头渲染 / HTML 转视频 → `docs/渲染管线.md`
- 复刻 / 反向实现 / 参照 / 扒 → `recipes/reference-reconstruction.md`
- 像素级 / SVG 重绘 / 平涂 → `recipes/pixel-svg-rebuild.md`
- 镜头 / shot / composition → `motions/`
- 确定性 / determinism / 可复现 → `AGENTS.md` 第四节

## 待建（本表先占位，避免以后搜不到）

| 文件 | 内容 | 触发条件 |
|---|---|---|
| `recipes/pixel-svg-rebuild.md` | 把一张平面图重绘成矢量：量测方法、图层拆分、平涂与渐变的取舍 | 第一次真的要把位图变 SVG 时 |
| `recipes/reference-reconstruction.md` | 照着一段参考视频反向实现：取帧、量时刻、量几何、容差登记 | 第一次真的要复刻别人的片子时 |

**规矩**：占位条目不许写成"随便写点"，要么真做过的写清楚，要么就留空并写明未验证。
