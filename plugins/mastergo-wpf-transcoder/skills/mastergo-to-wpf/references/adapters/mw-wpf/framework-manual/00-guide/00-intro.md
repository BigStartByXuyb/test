# 00 手册导览

<!-- evidence=结构性文档; verified=2026-08-13; sources=[framework.config.json, {source_root}/ManualView.xaml, docs/ai-index/framework-guide.md] -->

## 手册定位

本手册回答一个问题：**在 MW 自研 WPF 框架的全源码项目里，写一个页面该用哪个控件、传哪些参数、绝不能怎么写。**

边界（已与使用者确认）：

1. **只管界面使用面**——控件属性、样式族、协议写法；不写控件内部实现（.cs 私有程序集也不可见），不写业务流程。
2. **不搬运源码**——框架源码已全部包含在项目中，本手册无任何"把组件源码加入项目"的工具。
3. **写法对照前置**——"框架写法 vs 常规 WPF 写法"的区分是手册一等公民内容：封装好的控件一行属性完成，禁止手写等效模板结构。

## 阅读路径

| 你要做的事 | 读哪章 |
|---|---|
| 写/改一个 WPF 页面 | 03-protocols（协议）→ 02-controls（控件条目） |
| 从需求出发、不知道用哪个控件 | 04-scenarios（场景对照）→ 02-controls |
| 引用颜色/画刷/图标/尺寸资源键 | 01-resources |
| 新增组件或自查写法 | 05-best-practices + 00-guide/03-writing-paradigm.md |

## 权威示例

- **P2 真实业务页**：`refence\ManualView.xaml`——14 个 IconButton 主功能区 + 退出按钮 + `s:View.Model` 注入，是三大协议与 IconButton 的权威使用面。
- **P3 可编译 Demo**：`MasterGo_WPF_V0.0.3`（net8.0-windows，`dotnet build` 0 错误）——资源加载顺序与键存在性的可验证对照（其 `SDC/` 为精简副本，`Icons.xaml`、`Style/MenuButtons.xaml` 是 Demo 本地文件）。
- **Demo 对照资产**：`docs\ai-index\semantic\main-menu-view.md`（MasterGo Demo 主菜单分析，属 Demo 资产，不并入本手册，保留原址）。

## 手册与 ai-index 的分工

- `docs\ai-index\`（framework-guide.md + framework-index.json + files/*.json + capabilities/）：**导航层**，机器生成，负责"快速定位能力在哪个文件"。
- 本手册：**事实层**，人工维护，负责"这个控件怎么用、怎么写、为什么不能手写"。
- 规则：ai-index 的 JSON 是摘要不是事实（framework-guide.md 明示）；手册所有结论必须能回溯到原始 XAML（P1/P2/P3）。
