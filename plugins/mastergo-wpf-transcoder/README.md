# MasterGo WPF 转码插件

用于将 MasterGo 设计稿转换为 MW WPF/XAML 和 MTSLG IOContorl XML 的 Claude Code 插件。

## Included skills

- `skills/mastergo-to-wpf/` — 转码流程、组件映射参考、MTSLG 来源验证和坐标回归检查。
- `skills/mastergo-iocontrol-document-format/` — 编写和审查 MasterGo → MTSLG IOContorl 映射文档的统一格式规范。

架构与关键组成（目录分层、交付链路、规则事实源、产物布局、门禁与扩展点）见 [`ARCHITECTURE.md`](./ARCHITECTURE.md)。

插件内保留两条路线的资料，但**当前版本只启用 `mtslg-iocontrol`**；`mw-wpf`（作业 A）暂不进入分流或生成流程，仅在显式重新启用前完成全篇复核：

- `Adapter: mw-wpf`：生成真实 MW WPF 页面、XAML、C# 宿主和项目注册。
- `Adapter: mtslg-iocontrol`：生成完整 MTSLG IOContorl 项目结构，包括页面 XML、页面 Icon、Layout、mapping/provenance、项目配置以及目标项目要求的宿主壳；它不是 WPF 路线的降级结果，也不是附属中间产物。

当前启用的 `mtslg-iocontrol` 支持真实目标项目接入、正式输出目录和运行时验证；没有目标项目时生成完整项目脚手架，只跳过编译和运行时加载验证。`mw-wpf` 路线的同等能力需在其重新启用时单独复核。

完整页面转换包含三项强制工具：

- `skills/mastergo-to-wpf/scripts/mastergo-dsl-pipeline.ps1` — 用 `-Action Capture` 把一次性 `getDsl` 响应固化为唯一的 `dsl.snapshot.json`，并校验根节点、递归节点、唯一 ref 和父子链；只有覆盖报告为 `complete` 才能继续生成。固化时把原始 capture 的 `captureSha256`/`captureBytes`/`egress` 写进 `manifest.json` 与快照（快照据此回指原始 capture），并带**冻结守卫**：`-Out` 下已有 `manifest.json` 且其 `captureSha256` 与本次输入不一致（或旧产物没有该字段）时拒绝执行，须显式归档/删除旧 manifest 才能重新冻结。这道冻结基准由 `validate-iocontrol-provenance.js` 在交付前硬断言：mapping 清单 `source` 上的五项 provenance 缺一即校验失败（旧产物可显式加 `--allow-legacy-provenance` 豁免「缺失」，警告打到 stderr，写错的值不豁免）。
- `skills/mastergo-to-wpf/scripts/resolve-mastergo-visibility.js` — 从 DSL 机械提取节点可见属性、祖先继承后的有效可见状态、TEXT/PATH 索引和可见性来源；只生成 visibility audit，不直接生成 mapping。
- `skills/mastergo-to-wpf/scripts/gen-mastergo-page-bundle.js` — 接收已确认的页面 mapping，统一生成页面 XML、Icon、Layout、WPF 宿主和审计产物。

Layout 增量注册与 `--overwrite` 的语义：

- 新增一个尚不存在的 `Page Target`：允许增量写入已有 Layout，并在覆盖前创建备份；
- 替换已有的同名 `Page Target`：必须显式传入 `--overwrite`；
- 页面 XML、Icon 和 WPF 宿主文件已存在时：必须显式传入 `--overwrite`。

页面可以没有任何运行时 Icon。Bundle 不以 PATH 候选数量或 Geometry 数量判断页面是否需要图标；只有 IOContorl 节点或 Layout 菜单实际引用了 Icon 时，才要求对应 Geometry 已生成。

Agent 的完整工作流是：MasterGo MCP 一次性 `getDsl` → DSL pipeline `Capture` → coverage complete → 组件映射 → page bundle。完整页面或容器只允许用这一次 `getDsl` 响应作为设计数据源，不得拆成 section 分段采集，也不得用多个局部响应拼接页面；DSL pipeline 不负责猜测控件、资源键或运行时业务绑定。

MasterGo 转换默认优先检查并调用 MasterGo MCP；浏览器、截图和其他设计稿兜底只允许在 MCP 确认不可用后使用，并须记录兜底原因。

## 真实项目接入

项目运行时交付直接读取目标项目的 `framework.config.json`、`.csproj`、现有页面、Icon、Layout 和项目本地索引，确认框架 Profile、源码、资源键、页面宿主和运行目录。该事实读取适用于当前启用的 `mtslg-iocontrol`。没有目标项目时仍可生成正式静态结构和完整脚手架，但不能宣称编译、加载或运行时验证已完成。

可见性脚本的输出是 AI 映射的事实输入，不是最终页面文件。AI 仍需结合原始 DSL、visibility audit、正式组件映射和目标运行时资料生成 mapping；mapping 再由 Bundle 生成 XML、Icon、Layout 和宿主文件。

当前启用的 `mtslg-iocontrol` 在没有目标项目时也生成完整项目脚手架：`.csproj`、`framework.config.json`、WPF 宿主壳、页面 XML、Icon 资源容器、Layout 壳层、mapping/provenance 和待配置清单都必须存在；只跳过编译、WPF 加载和真实运行时验证。脚手架与正式项目使用同一套页面生成结构。

## Claude Code 安装

从仓库根目录通过 Claude Code 的本地插件或 marketplace 流程安装。插件清单位于 `.claude-plugin/plugin.json`；Claude Code 会自动发现 `skills/` 下的两个独立 Skill。

## 本地验证

```powershell
node --test "skills/mastergo-to-wpf/scripts/tests/*.test.js"
```

该命令运行全部 21 个回归测试（测试统一放在 `scripts/tests/`，与交付链路脚本 `scripts/` 分开）；需要单跑某一个时直接指定文件名，例如 `node skills/mastergo-to-wpf/scripts/tests/gen-mastergo-page-bundle.test.js`。其中 `capture-provenance-e2e.test.js` 会用本地 MCP 桩跑一次真实的 capture + `pwsh` Capture 固化 + mapping 生成，验证 capture → 快照 → mapping 三层同源、且 PowerShell 与 Node 两侧的 SHA256 同口径（本机没有 `pwsh` 时该用例打印 SKIP 并以 0 退出）。PowerShell 流水线回归测试同目录：`scripts/tests/mastergo-dsl-pipeline.tests.ps1`。

Skill 中包含项目专用的 MW/MTSLG 规则。分享给其他团队前，请先检查参考资料，并根据实际项目调整路径和运行时集成方式。
