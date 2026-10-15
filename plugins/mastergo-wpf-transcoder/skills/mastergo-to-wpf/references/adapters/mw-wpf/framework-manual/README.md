# MW 自研 WPF 框架使用手册

<!-- evidence=结构性文档; verified=2026-08-14; sources=[framework.config.json, {source_root}/SDC/**, {source_root}/ManualView.xaml] -->

## 定位

本手册是 **MW 自研 WPF 框架**（`framework.config.json` 的 `framework_name`；资源层目录为 `SDC`，即用户所称 "SD"）的 **API 使用参考**：

- **只管界面使用面**：每个控件本身怎么用（属性、样式族、协议写法）。不涉及控件内部实现，不涉及业务流程。
- **全源码包含场景**：开发时框架源码已全部并入项目，无需"复制组件源码"工具——与 shadcn/ui 的 CLI 模式不同，本手册不含任何源码搬运工具。
- **写法对照是一等公民**：凡框架已有封装能力的场景，常规 WPF 手写写法一律标注「禁止」，并给出框架写法替代（判定总则见 `00-guide/03-writing-paradigm.md`）。

## 证据图例

| 符号 | 含义 | 使用规则 |
|---|---|---|
| ✅ 已确认 | P1 模板源码直接证据，且与 P2 真实使用无矛盾 | 可放心使用 |
| 🟡 部分确认 | 调用形式确认，语义/解析机制/默认值未确认 | 只能按已确认形式使用，不得扩展 |
| ❓ TD-xxx | 仅能推断、无本地证据 | 禁止写成事实；登记待回填，见 `05-best-practices/pending-confirmations.md` |

证据来源四级：**P1** 模板源码 `{source_root}/SDC/**`（最强）→ **P2** 真实业务页 `{source_root}/ManualView.xaml` → **P3** 可编译 Demo `MasterGo_WPF_V0.0.3` → **P4** ai-index 索引（仅导航，不得作为事实引用）。详见 `00-guide/02-evidence-policy.md`。

## 目录导航

| 章 | 内容 | 何时读 |
|---|---|---|
| [00-guide](00-guide/00-intro.md) | 手册定位、框架架构、证据政策、写法总则 | 第一次使用必读 |
| 01-resources | SDC 资源系统（颜色/字体/尺寸/画刷/图标/加载顺序） | 引用资源键、新增组件时 |
| 02-controls | 87 个框架控件条目（一控件一文件） | 使用具体控件时 |
| 03-protocols | 命名空间与三大协议（s:Action / PageName / IOEnable） | 写事件/跳转/设备联锁时 |
| 04-scenarios | 场景对照专章（常规写法 → 框架写法） | 从需求出发、不知道用哪个控件时 |
| 05-best-practices | 最佳实践、高频错误、待确认项总表 | 自查/评审时 |
| templates | 控件条目模板、场景对照模板 | 新增/修订条目时 |

## 与其它体系的关系

- **ai-index**（`{index_root}/`）：自动生成的 JSON 导航层。本手册是它的**上层事实层**——索引只负责定位，手册内容以原始 XAML 为事实依据。
- **mastergo-to-wpf skill**：管「设计稿 → WPF 转换」，本手册管「框架 API 写法」，共用导航链 `framework.config.json → ai-index → refence 源码`。
- **权威示例**：`refence\ManualView.xaml`（真实业务页，使用面证据）+ `MasterGo_WPF_V0.0.3`（可编译对照 Demo，net8.0-windows）。

## 覆盖进度

| 阶段 | 交付物 | 状态 |
|---|---|---|
| 0 | 骨架：目录 + 本 README + 00-guide 4 篇 + templates 2 个 + TD 总表 | ✅ |
| 1 | 01-resources 6 篇 + 03-protocols 5 篇 | ✅ |
| 2 | 02-controls/navigation（13 控件，IconButton 为范本） | ✅ |
| 3 | 02-controls/io（14 控件） | ✅ |
| 4 | 02-controls/keypad-input（12）+ grid-tree（8） | ✅ |
| 5 | 02-controls/charts（5）+ attached-props（17）+ native（16 补缺） | ✅ |
| 6 | 04-scenarios（README+7 场景文件）+ 05-best-practices 3 篇 | ✅ |
| 7 | 全手册验证回填 | ⬜ |
| 8 | mw-wpf-framework 参考规范提炼 | ⬜ |
