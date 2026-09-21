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

- `skills/mastergo-to-wpf/scripts/mastergo-dsl-pipeline.ps1` — 用 `-Action Capture` 把一次性 `getDsl` 响应固化为唯一的 `dsl.snapshot.json`，并校验根节点、递归节点、唯一 ref 和父子链；只有覆盖报告为 `complete` 才能继续生成。
- `skills/mastergo-to-wpf/scripts/resolve-mastergo-visibility.js` — 从 DSL 机械提取节点可见属性、祖先继承后的有效可见状态、TEXT/PATH 索引和可见性来源；只生成 visibility audit，不直接生成 mapping。
- `skills/mastergo-to-wpf/scripts/gen-mastergo-page-bundle.js` — 页面项目生成的唯一入口；内部由 `gen-mtslg-mapping-from-dsl.js` 从 DSL 快照、visibility audit、正式组件映射和图标台账**机械生成**页面 mapping 与 `textAudit`（不接受人工逐条改写的 mapping），再统一生成页面 XML、Icon、Layout、WPF 宿主和审计产物。

Layout 增量注册与 `--overwrite` 的语义：

- 新增一个尚不存在的 `Page Target`：允许增量写入已有 Layout，并在覆盖前创建备份；
- 替换已有的同名 `Page Target`：必须显式传入 `--overwrite`，并在清单里设置 `operation=replace-existing`；
- 页面 XML、Icon 和 WPF 宿主文件已存在时：必须显式传入 `--overwrite`（同样要求 `operation=replace-existing`）。

页面可以没有任何运行时 Icon。Bundle 不以 PATH 候选数量或 Geometry 数量判断页面是否需要图标；只有 IOContorl 节点或 Layout 菜单实际引用了 Icon 时，才要求对应 Geometry 已生成。

Agent 的完整工作流是：MasterGo MCP 一次性 `getDsl` → DSL pipeline `Capture` → coverage complete → 组件映射 → page bundle。完整页面或容器只允许用这一次 `getDsl` 响应作为设计数据源，不得拆成 section 分段采集，也不得用多个局部响应拼接页面；DSL pipeline 不负责猜测控件、资源键或运行时业务绑定。

MasterGo 转换只从 MasterGo MCP 取数：`getDsl` 不可调用或报错时**停止转换并报告原因**，不换用浏览器、截图或其他设计稿来源继续，也不读图做判断。

## 真实项目接入

项目运行时交付直接读取目标项目的 `framework.config.json`、`.csproj`、现有页面、Icon、Layout 和项目本地索引，确认框架 Profile、源码、资源键、页面宿主和运行目录。该事实读取适用于当前启用的 `mtslg-iocontrol`。没有目标项目时仍可生成正式静态结构和完整脚手架，但不能宣称编译、加载或运行时验证已完成。

可见性脚本的输出是 mapping 生成器的事实输入，不是最终页面文件。新建页面的 mapping 由 `gen-mtslg-mapping-from-dsl.js` 从原始 DSL、visibility audit 和正式组件映射机械生成（Bundle 自动调用），不由人工/AI 逐条改写；mapping 再由 Bundle 生成 XML、Icon、Layout 和宿主文件。人工/AI 的产出是**输入与边界决策**：`manifest.excludeInstances` 的组件隔离、`manifest.pageTitleText` / `langGlossary` / `languages.translations` 的文案语义，以及 `pending` / `unmappedComponents` 的处理结论。

当前启用的 `mtslg-iocontrol` 在没有目标项目时也生成完整项目脚手架：`.csproj`、`framework.config.json`、WPF 宿主壳、页面 XML、Icon 资源容器、Layout 壳层、mapping/provenance 和待配置清单都必须存在；只跳过编译、WPF 加载和真实运行时验证。脚手架与正式项目使用同一套页面生成结构。

## Claude Code 安装

从仓库根目录通过 Claude Code 的本地插件或 marketplace 流程安装。插件清单位于 `.claude-plugin/plugin.json`；Claude Code 会自动发现 `skills/` 下的两个独立 Skill。

## 本地验证

```powershell
node skills/mastergo-to-wpf/scripts/test-runtime.mjs
```

该入口运行全部 `scripts/tests/*.test.js` 与 `scripts/tests/*.tests.ps1`，任何子进程失败都使整次验证失败。需要 Node.js 22 与 PowerShell 7；可从插件根目录运行。`.github/workflows/mastergo-runtime.yml` 在 Linux 和 Windows 执行相同入口，使用只读权限、不读取密钥，与中央语义审计分离。

Skill 中包含项目专用的 MW/MTSLG 规则。分享给其他团队前，请先检查参考资料，并根据实际项目调整路径和运行时集成方式。
