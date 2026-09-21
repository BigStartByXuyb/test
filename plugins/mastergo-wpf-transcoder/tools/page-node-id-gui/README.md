# MTSLG 控件 ID 查询（GUI）

**一件事**：贴 MasterGo 链接 → 返回这个控件在 MTSLG IOContorl 里应该用的 ID。不整页转码。

```
双击 start.cmd          # 起本地服务并打开浏览器（默认 http://127.0.0.1:8787/）
```

页面上：

- 贴**容器（页面帧）**链接 → 列出这个容器里**每个控件**该用的 ID，点一行看详情，`复制 ID` / `复制代码`；
- 贴**控件**链接 → 直接给这一个控件的 ID（前提是本工具已知它所在的页面帧，见下）。

## 为什么需要"页面帧"

ID 的公式是 `MX_` + `sha256(页面键 + "\n" + 节点 ref)` 前 32 位，**页面键 = 页面帧的 layer_id**
（也就是转码时用的那个根节点）。同一个控件，用"控件链接"单独抓取的 DSL 根是控件自己，
页面键就变了，算出来的 ID 与整页转码不一致。所以：

1. 贴**容器（页面帧）链接**：本工具记住这个页面的页面帧，ID 与转码完全一致；
2. 之后贴该页面里的**控件链接**：直接从已知的页面帧里定位，返回这一个控件的 ID；
3. 也可以填**工程目录**：从工程里已有的 `Generated/runs/<页面名>/dsl.snapshot.json`（旧的
   `Generated/dsl.snapshot.json` 仍兼容）与 `docs/page-registry.json` 自动找页面帧，离线且更快
   （不占用设计稿接口）。

## 启动参数

```
node server.js                                   # 默认 127.0.0.1:8787，并打开浏览器
node server.js --port 9000 --no-open
node server.js --project D:\SSD_YinQie_F2ContinuousRunData
node server.js --snapshot <dsl.snapshot.json>    # 完全离线：只用一份快照
node server.js --token mg_xxx                    # 缺省取 env MASTERGO_MCP_TOKEN，再取 ~/.codex/config.toml
```

## 口径（与插件一致）

- ID 由 `skills/mastergo-to-wpf/scripts/resolve-node-control.js` 产出，
  它内部转调 `scripts/lib/page-node-id.js`（与转码器**同一份**公式实现），本 GUI 不重算 ID。
- 命中正式映射表的控件，会同时给出可直接粘贴的完整控件代码；没命中的只给 ID（需人工手写或先补映射登记）。
- **不要改已有控件的 ID**（改了等于换了个控件）；人工新增的控件沿用 GUID 写法即可。

## 依赖

Node.js（插件转码本来就需要）与 `pwsh`。离线模式（`--snapshot` 或工程目录里有快照）不需要网络与 token。
