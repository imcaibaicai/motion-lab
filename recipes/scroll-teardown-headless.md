# 滚动拆解页 + 无头截图：踩过的三个坑

适用场景：做「随滚动拆解/爆炸」类的单页（`apps/` 探索模态），并用无头 Edge 截帧自查。
三条都是**静默失败**——页面不报错、控制台干净、截出来是空白或错位，只能靠对照证据定位。

## 一、sticky 舞台放在滚动占位之后 → 永远截到空白

**现象**：页面有内容，`?t=0.9` 参数也生效，但截图整片只有背景纹理，看不到任何图形或文字。

**根因**：结构写成

```html
<div class="scroll" style="height:300vh"></div>  <!-- 占位在前面 -->
<div class="stage" style="position:sticky;top:0;height:100vh">…</div>
```

sticky 元素仍在**正常流**里，被前面 300vh 的占位顶到了三屏之下。滚到顶部时它根本不在视口内。

**修法**：占位必须是 sticky 的**父容器**，不是兄弟节点。

```html
<div class="scroll" style="height:300vh">
  <div class="stage" style="position:sticky;top:0;height:100vh">…</div>
</div>
```

**证据**：`apps/recruit-explore/s2-blueprint.html` 修前修后两版截图字节数 42181 → 87841，前者的两块 canvas/svg 全是空的。

## 二、WebGL 只渲染一次 → 无头截图拿到空白画布

**现象**：DOM 层（标签投影位置、进度百分比、进度条）全部正确，但 WebGL 画面和 2D canvas 星芒**都是空的**。加诊断行后看到 `calls=10 / lines=4404 / gl=1440x900 / ctx=ok`——渲染真的执行了，只是没被合成进截图。

**根因**：`?t=` 锁进度分支里只调用一次 `renderer.render()` 就返回。无头浏览器在 `--screenshot` 时刻取帧，此时 canvans 内容尚未作为一帧提交给合成器。

**修法**：即使用参数锁定进度，也要**持续 rAF 渲染**（进度不变，但每帧都重绘）。

```js
if (FORCED !== null){
  (function spin(){ draw(2.0); requestAnimationFrame(spin); })();
}
```

**证据**：`apps/recruit-explore/s1-dark-wire.html`，修前 254795 字节全黑（只有 DOM 文字），修后 372283 字节画出线框。

## 三、PowerShell 判路径包含时正反斜杠不一致 → 静态服务器 403

**现象**：`Invoke-WebRequest http://127.0.0.1:8781/x.html` 返回 403，截图抓到的是 403 文本页（6123 字节）。

**根因**：`new URL('.', import.meta.url).pathname` 得到的是 `/D:/…`（正斜杠），去掉前导斜杠后与 `path.join()` 产出的 `D:\…`（反斜杠）做 `startsWith` 比较必然为假。

**修法**：统一用 `fileURLToPath()` 拿原生路径。

```js
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url)); // 带尾部分隔符
```

## 截图配方（本机实测可用）

```powershell
# 服务器
node serve.mjs 8781

# 截帧（见 apps/recruit-explore/shot.ps1）
msedge.exe --headless=new --disable-gpu --enable-unsafe-swiftshader `
  --hide-scrollbars --no-first-run --user-data-dir=$env:TEMP\edge-shot-profile `
  --window-size=1440,900 --virtual-time-budget=3500 `
  --screenshot=<绝对路径>.png "http://127.0.0.1:8781/<page>.html?t=0.9"
```

- `--enable-unsafe-swiftshader` 必须带：本机无独立 GPU 时 WebGL 走软件渲染。
- 页面必须支持 `?t=<0..1>` 锁进度，否则只能截到滚动位置 0。
- **三帧起截**：`t=0`（合着）、`t=0.5`（半开）、`t=0.9`（全开），只截一帧无法判断动效。

## 四、录成视频：逐帧截图法（本机无 ffmpeg 时的完整路径）

**做法**：`?t=` 锁进度 → 循环 48 次无头截图得到 `f000.png…f047.png` → ffmpeg 编码。

单帧成本实测：WebGL 页 **2.2 s/帧**（S1，48 帧 107 s），纯 SVG 页 **1.1 s/帧**（S2，48 帧 51 s）。
往返（拆开再缩回）不必重录：纯进度驱动的页面，`filter_complex "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1"` 就能把「下滚→上滚」拼出来。

踩到的坑，按发生顺序：

| # | 现象 | 根因 | 修法 |
|---|---|---|---|
| 1 | `ffmpeg` 命令不存在 | 本机未装 | 见下条 |
| 2 | `pnpm add ffmpeg-static` 报 `Invalid package.json` | PowerShell 5.1 的 `Out-File -Encoding utf8` 写入 **UTF-8 BOM**，pnpm 拒收 | 用 `[System.IO.File]::WriteAllText($p,$s,(New-Object System.Text.UTF8Encoding($false)))` |
| 3 | 修完 BOM 后报 `ERR_PNPM_IGNORED_BUILDS: ffmpeg-static` | pnpm 默认拦截依赖的 postinstall 脚本，而 ffmpeg-static 正是靠 postinstall 去 GitHub 下载二进制 | 别硬绕。改用 **`@ffmpeg-installer/win32-x64`**：二进制直接打进 npm 包，无 postinstall、无 GitHub 依赖 |
| 4 | 直接改 `package.json` 加 `pnpm.onlyBuiltDependencies` 后 `pnpm install` 把包删了 | 手写的新 `package.json` 里没有 `dependencies` 字段，pnpm 按锁文件把它剪掉了 | 改配置时**保留 `dependencies`**，或直接换包 |

**结论**：国内网络 + pnpm 的组合下，优先选「二进制打包在包内」的 ffmpeg 分发（`@ffmpeg-installer/win32-x64`，61.5 MB，实测 `ffmpeg version N-92722`、带 libx264），跳过一切 postinstall 下载。

编码命令：

```powershell
# 单向下滚
ffmpeg -y -framerate 24 -i frames\s1\f%03d.png -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart out\s1-down.mp4
# 下滚 + 上滚（不重录，直接倒放拼接）
ffmpeg -y -framerate 24 -i frames\s1\f%03d.png -filter_complex "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]" -map "[v]" -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart out\s1-roundtrip.mp4
```

## 自查清单（截完必须先自己看）

- [ ] 画面里有东西（字节数 > 100KB 通常意味着有图形；< 10KB 基本是空白/错误页）
- [ ] 标签没有压在零件主体上、没有被 viewBox 边缘切掉
- [ ] 标注**跟着零件走**，不要拴在装配位置上（零件一动，引线就错位）
- [ ] `t=0` 是一个能单独成立的「合着」状态，不是空白
- [ ] 诊断信息（`calls`/`lines`）只在你主动加 `?dbg=1` 时出现，不污染正式画面
