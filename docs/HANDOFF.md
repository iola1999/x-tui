# x-tui Handoff

最后更新: 2026-04-24

本文档用于交接这一轮围绕 `twitter-cli` 延迟、推文详情加载、鼠标复制、终端原生图片渲染的设计与调试工作。目标不是重复 README，而是把这轮问题的来龙去脉、当前仓库状态、已知风险和下一步怎么接着做写清楚。

## 1. 这轮工作的核心结论

### 1.1 `twitter-cli` 的耗时问题

- 主要瓶颈不是 X/Twitter 网页本身慢，而是原先每次查询都要冷启动外部 CLI。
- 因此做了两层优化:
  - `x-tui` 侧默认优先走常驻 `twitter daemon` 进程。
  - 推文详情改为分阶段加载，先拿正文，再拿第一页评论。
- 缓存和常驻进程不是替代关系:
  - 缓存解决“同一数据重复访问”的返回速度。
  - 常驻进程解决“新的 CLI 请求”每次冷启动的固定开销。
  - 所以两者都值得保留。

### 1.2 `twitter-cli` 的维护策略

- 最终决定不是单独发一个新包。
- 当前策略是把兼容版本维护在仓库内的 `vendor/twitter-cli`。
- 约束是:
  - Python 代码只留在 `vendor/twitter-cli`。
  - Bun/TS 应用只通过 CLI 或 daemon JSONL 协议边界与它通信。
  - 保持目录干净，未来如果要单独拆出去，再做 `subtree split` 或直接抽目录。

### 1.3 推文详情的产品决策

- 详情页正文和评论区已经改成一个连续滚动区域。
- 评论只加载第一页。
- 先显示正文，再异步补第一页评论。
- 评论页数以后可以做成设置项，但当前默认固定为 1 页，优先保证响应速度。

### 1.4 终端图片渲染的结论

- 半块字符方案在可读性上不够，尤其是缩略图和大图预览。
- 现在支持优先走 Kitty / iTerm2 原生图片协议。
- 但原生协议不受 Ink diff buffer 管控，必须自己处理:
  - 清除旧 placement
  - 滚动时重算位置
  - 进入/退出页面时清理残留图像
  - 避免布局尚未稳定就过早绘制

## 2. 已完成的功能和修复

### 2.1 `twitter-cli` 常驻进程和兼容层

关键文件:

- `src/services/twitterCli.ts`
- `src/services/twitterDaemon.ts`
- `src/services/__tests__/twitterCli.test.ts`
- `src/services/__tests__/twitterDaemon.test.ts`
- `docs/vendor-twitter-cli.md`

已完成项:

- `x-tui` 默认优先使用 resident `twitter daemon`。
- 如果 daemon 不可用，会自动降级为一次一启的 `spawn` 调用。
- 支持 `X_TUI_TWITTER_TRANSPORT=spawn` 强制关闭常驻模式，方便回归比较。
- 启动时优先发现 `vendor/twitter-cli/.venv/bin/twitter`，其次才走 `PATH` 或 `X_TUI_TWITTER_CMD`。
- 对旧版 CLI 的两个关键不兼容场景补了可读错误:
  - 不支持 `--pages`
  - 不支持 `daemon`

这部分的直接收益:

- feed/search/detail 这类冷请求的“启动前等待”明显下降。
- 用户主观感受已经从“每次都像卡一下”变成“几乎没有加载等待”。

### 2.2 推文详情只取第一页评论

关键文件:

- `src/screens/TweetDetailScreen.tsx`
- `src/services/twitterCli.ts`
- `src/screens/tweetDetailTimeline.ts`
- `src/screens/__tests__/tweetDetailTimeline.test.ts`

已完成项:

- 详情页分两阶段:
  - `tweetHead(id)` 先拿正文
  - `tweetDetail(id, { pages: 1 })` 再拿第一页评论
- 详情页评论只请求第一页。
- 详情页正文和评论已改为同一个 `ScrollBox` 内连续滚动。
- 评论异步补进来时，页面会尽量保持原来的滚动位置，不再强制跳到底部或中间。

关于“`max=1` 不就只查第一页吗”的结论:

- 不够。
- `max` 控制的是条目数量上限，不等于只取第一页。
- 如果底层 CLI 仍继续翻页，仍然会产生多页请求。
- 因此当前限制评论深度依赖的是 `--pages 1`，不是单靠 `--max 1`。

### 2.3 详情页退出错误码 2 的问题

关键文件:

- `src/services/twitterCli.ts`

已完成项:

- 对 `exit code 2` 做了更具体的识别。
- 如果是 CLI 版本过旧导致不支持 `--pages` 或 `daemon`，现在会给出明确提示，而不是只显示一个模糊的退出码。

### 2.4 鼠标拖动选区自动复制

关键文件:

- `src/components/SelectionCopyManager.tsx`
- `src/components/__tests__/selectionCopy.test.ts`

已完成项:

- 接入了“拖动选区后自动复制”的行为。
- 使用 Ink 的 selection API，在拖动结束且有选区时自动复制，不会清空已有选区。
- 已加 toast 提示 `Selection copied`。

设计意图:

- 对齐 Claude Code 这类终端 UI 的体验。
- 解决 alt-screen 场景下用户无法方便用鼠标复制的问题。

### 2.5 图片查看器和状态栏索引同步

关键文件:

- `src/screens/ImageViewerScreen.tsx`
- `src/components/StatusBar.tsx`
- `src/state/store.ts`

已完成项:

- 大图查看器现在用 store 里的 `index` 作为单一事实来源，不再本地维护一份独立 `current` 状态。
- `h` / `l` 切图时会直接更新 store。
- 状态栏改为订阅 `currentScreen`，不再只盯 `activeTab` 和 stack length。

这两点是为了解决:

- 多图切换时，左上角和左下角序号不同步。
- 状态栏序号不更新的问题。

### 2.6 缩略图和大图原生渲染支持

关键文件:

- `src/components/MediaThumbs.tsx`
- `src/components/NativeImageBox.tsx`
- `src/screens/imageViewerNative.ts`
- `src/screens/ImageViewerScreen.tsx`
- `src/utils/imageEncoders/kitty.ts`
- `src/utils/imageEncoders/iterm2.ts`
- `src/utils/imageEncoders/__tests__/iterm2-kitty.test.ts`
- `src/screens/__tests__/imageViewerNative.test.ts`

已完成项:

- 详情页内图片支持鼠标点击进入大图查看。
- 缩略图在支持的终端内也可走原生图片协议，而不是只用半块字符。
- 大图查看器和缩略图共用一套原生图片测量/清理逻辑。
- 缩略图不再一律强制拉伸成方图，现改为“固定槽位 + 按原图宽高比缩放”。

当前实现方式:

- 卡片布局槽位仍固定在约 `16 x 8` cells，避免卡片高度在不同终端间剧烈跳动。
- 槽位内部实际绘制尺寸会按原图比例 fit 进去。

### 2.7 Native image 残影、叠图、详情页切换后旧图不消失

关键文件:

- `src/components/NativeImageBox.tsx`
- `src/screens/imageViewerNative.ts`
- `src/utils/imageEncoders/kitty.ts`

已完成项:

- 之前只靠输出空格覆盖，无法真正清掉 Kitty placement。
- 现在针对 Kitty 改成发送 placement delete 命令，而不是仅靠空格擦除。
- 这修复了两个问题:
  - 时间线滚动后旧位置的图片残留
  - 进入推文详情后，上一屏时间线缩略图仍然留在终端里

### 2.8 Scroll / visibility / repaint 的基础防线

已完成项:

- 绘制前会先测量元素当前 cell 位置。
- 如果超出可见区域，则不绘制，并尝试清理已绘制状态。
- 增加了 `paintKey` 和已绘制状态复用判断，避免同一图片在同一位置反复重绘。
- 为 native image 调试加入日志:
  - 环境变量: `X_TUI_DEBUG_NATIVE_IMAGES=1`
  - 日志文件: `/tmp/x-tui-native-images.log`

## 3. 本轮最重要的排查结论

### 3.1 关于评论为什么会出现“每一页的请求”

结论:

- 那些额外请求不是正文自身拆页，而是评论分页。
- 详情请求本质上拿到的是正文和回复线程。
- 所以如果不限制 reply page，CLI 会继续翻页获取更多回复。
- 当前已经改成只拿第一页评论。

### 3.2 关于缓存是否让常驻进程变得没必要

结论:

- 不会。
- 缓存命中时，返回当然更快，但它只覆盖“已经访问过”的数据。
- 对新的 search、新的 detail、新的 feed 拉取，请求仍然需要走到底层 CLI。
- 常驻进程解决的是这些新请求每次都要 fork/启动/准备参数的问题。

### 3.3 关于图片错位问题的根因

这是当前最关键、也最容易被误判的一点。

较早阶段已经确认的根因:

- 旧图残留不是“空白重绘没覆盖干净”，而是 Kitty placement 本来就不受文本空格覆盖影响。
- 所以必须显式 delete placement。

最新阶段确认的根因:

- 目前剩下的“滚动后图片位置歪掉、重叠，窗口重新激活后又恢复正常”更像是布局尚未稳定时就执行了 native draw。
- 证据来自调试日志: 能看到 `measure` 的行号和最终 `draw` 的行号不一致，说明绘制发生时布局已经又挪了一次。
- 重新激活窗口会触发一次新的重测量，因此图片又能回到正确位置。

## 4. 当前仍在进行中的问题

### 4.1 Native thumbnail 滚动后偶发错位/重叠

当前状态:

- 已经在 `src/components/NativeImageBox.tsx` 中加入“布局稳定后再画”的延迟重测逻辑:
  - `MAX_LAYOUT_SETTLE_PASSES = 3`
  - `LAYOUT_SETTLE_DELAY_MS = 8`
  - 事件日志: `defer-layout-shift`
- 但这部分刚加完后，用户提供的“最新日志”实际上仍是旧 `dist` 运行出来的结果，不是当前源码的行为。

这件事很重要:

- 仓库入口 `package.json` 的 `bin` 指向 `dist/cli.js`。
- 如果用户是跑全局安装或旧的 `dist`，日志里不会出现新加的 `defer-layout-shift` 事件。
- 已确认发生过一次这种“看似新日志，实际还是旧产物”的情况。

因此这部分的准确状态是:

- 修复补丁已经写入源码并重新构建过 `dist`
- 但还没有基于这份新构建拿到一次有效的新日志来确认它是否彻底解决错位

### 4.2 窗口重新激活时图片闪烁

当前判断:

- 这更像是终端对原生图片 placement 的重新绘制或重新同步。
- 在没有稳定地消除滚动错位前，不建议单独对“闪烁”做优化，否则容易把真正的重绘时序问题掩盖掉。

## 5. 当前源码和提交状态

### 5.1 本次交接时仍未提交的文件

当前工作区脏文件主要集中在 native image 的最后一轮修复:

- `src/components/MediaThumbs.tsx`
- `src/components/NativeImageBox.tsx`
- `src/components/StatusBar.tsx`
- `src/screens/ImageViewerScreen.tsx`
- `src/screens/__tests__/imageViewerNative.test.ts`
- `src/screens/imageViewerNative.ts`

### 5.2 已完成的校验

本轮最后一次已确认通过:

- `bun run typecheck`
- `bun run build`
- `bun test src/screens/__tests__/imageViewerNative.test.ts src/utils/imageEncoders/__tests__/iterm2-kitty.test.ts src/services/__tests__/tweetActions.test.ts src/state/__tests__/store.test.ts src/components/__tests__/StatusBar.test.ts`

## 6. 复现和排查指南

### 6.1 跑当前源码，不要误用旧产物

推荐:

```bash
bun run dev
```

或先构建再运行当前仓库的产物:

```bash
bun run build
./dist/cli.js
```

不建议直接用全局安装的 `x-tui` 来做这轮 native image 排查，因为很容易混入旧版本。

### 6.2 开启 native image 调试日志

```bash
export X_TUI_DEBUG_NATIVE_IMAGES=1
rm -f /tmp/x-tui-native-images.log
bun run dev
```

排查时重点看这些事件:

- `measure`
- `draw`
- `clear`
- `reuse`
- `reuse-after-render`
- `skip`
- `skip-after-render`
- `defer-layout-shift`

### 6.3 这轮复现的重点现象

重点复现这两个问题:

- 时间线滚动后，图片在旧位置仍有残留或新位置错位
- 进入详情页后，时间线里的图没有被清干净

第二个问题已经被 Kitty placement delete 修过，后续如果再出现，优先怀疑清理路径回退了。

第一个问题当前仍应重点关注 `defer-layout-shift` 是否出现。

### 6.4 如果错位问题仍然存在，下一步优先级

下一轮不要先猜终端协议差异，优先继续拿日志证据。

如果基于最新 `dist` 仍然能复现错位，优先继续尝试:

1. 要求“连续两次测量位置一致”才允许 draw，而不是目前的一次偏移后延迟重试。
2. 稍微增大 `LAYOUT_SETTLE_DELAY_MS`。
3. 适当提高 `MAX_LAYOUT_SETTLE_PASSES`。
4. 如果只在某个滚动容器内出现，继续检查 Ink `ScrollBox` 的 scrollTop 更新时序。

## 7. 重要文件索引

服务层:

- `src/services/twitterCli.ts`
- `src/services/twitterDaemon.ts`

详情页:

- `src/screens/TweetDetailScreen.tsx`
- `src/screens/tweetDetailTimeline.ts`

复制体验:

- `src/components/SelectionCopyManager.tsx`

图片渲染:

- `src/components/MediaThumbs.tsx`
- `src/components/NativeImageBox.tsx`
- `src/screens/ImageViewerScreen.tsx`
- `src/screens/imageViewerNative.ts`
- `src/utils/imageEncoders/kitty.ts`
- `src/utils/imageEncoders/iterm2.ts`

文档:

- `README.md`
- `docs/ROADMAP.md`
- `docs/vendor-twitter-cli.md`

## 8. 建议的下一步

如果下一位接手同学要继续做，建议顺序如下:

1. 先基于当前仓库重新启动，确认不是旧 `dist`。
2. 开 `X_TUI_DEBUG_NATIVE_IMAGES=1`，重新抓一份新日志。
3. 先验证 `defer-layout-shift` 补丁是否真的生效。
4. 如果生效后仍错位，再继续加强“布局稳定判定”。
5. 等 native image 滚动定位彻底稳定后，再回头考虑“窗口重新激活时的闪烁优化”。

