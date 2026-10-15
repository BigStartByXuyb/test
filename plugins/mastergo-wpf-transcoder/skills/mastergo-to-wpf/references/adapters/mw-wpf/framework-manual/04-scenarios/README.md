<!-- evidence=结构性文档; verified=2026-08-14;
     sources=[{source_root}/ManualView.xaml, {source_root}/SDC/Style/IconButton.xaml, {source_root}/SDC/Style/NumberBox.xaml, {source_root}/SDC/Style/ComboBox.xaml, {source_root}/SDC/Style/DataGrid.xaml] -->

# 04 场景对照（从需求出发）

## 定位

本专章是「场景对照」——**组装层**：不写新证据、不新造 TD，把 `02-controls/` 控件条目与 `03-protocols/` 协议条目按「从需求出发」重组为对照文档。写页面时不知道用哪个控件，从这里进（`00-guide/03-writing-paradigm.md` §2 双层对照体系的第二层）。

- 每个场景 = 一个业务需求，三要素齐全：**① 常规写法代码（禁止）② 框架写法代码（推荐）③ 禁止原因 ≥3 条**。
- 判定总则 6 条见 [00-guide/03-writing-paradigm.md](../00-guide/03-writing-paradigm.md)；证据等级 P1–P4 见 [00-guide/02-evidence-policy.md](../00-guide/02-evidence-policy.md)。
- 框架写法代码**原样摘自已写条目或 ManualView.xaml**（属性拼写、XML 转义与原文一致）；条目引用一律相对链接。
- 反例有效性：每个「禁止写法」片段的 grep 检查结论见对应文件头注释。

## 三要素说明

| 要素 | 要求 | 检查方法 |
|---|---|---|
| **① 常规写法代码（❌）** | 用常规 WPF 原生元素（Button/Grid/TextBlock/TextBox/DataGrid/ListBox/Popup…）手写拼装**等效**视觉/行为；**不得含 `s:` 前缀、`s:Action`、`IOEnable`、`PageName`** 及任何框架附加属性 | grep 反例特征结构，确认不出现在 `{source_root}/ManualView.xaml` 与 `{source_root}/SDC/Style/` 真实页面中（防误标） |
| **② 框架写法代码（✅）** | 原样摘自已写条目（02-controls/、03-protocols/）或 ManualView.xaml；属性拼写、XML 转义（如 `&amp;&amp;`）与原文一字不差 | 与条目原文逐字比对 |
| **③ 禁止原因（≥3 条）** | 逐条对照 03-writing-paradigm.md 五类依据：① 丢失状态 ② 丢失协议挂点 ③ 无法样式族切换 ④ 绕过本地化 ⑤ 脱离视觉规范 | 能标证据（锚点/行号）就标 |

## 场景总表（12 个）

### A 组（本批交付：6 场景 / 3 文件）

| # | 场景 | 需求一句话 | 文件 | 关键控件/协议 |
|---|---|---|---|---|
| ① | 图标功能按钮 | 页面放一排带快捷键标记、图标、文字、设备联锁的功能按钮 | [buttons.md](buttons.md) | `s:IconButton` + 页面级 MainButtonStyle（BasedOn）+ IOEnable + `Click="{s:Action …}"` |
| ② | 返回退出按钮 | 页面角落放退出/返回按钮，点击回主页 | [buttons.md](buttons.md) | `s:IconButton` + RightButtonStyle + `PageName="Jump:Home"` |
| ③ | 点击事件 | 按钮点击触发业务动作，不写代码后置 | [buttons.md](buttons.md) | `Click="{s:Action …}"`（[action-protocol](../03-protocols/action-protocol.md)） |
| ④ | 数字输入键盘 | 数值/整数参数输入：步进、钳制、可选弹出数字键盘 | [inputs.md](inputs.md) | `s:NumberBox` / `s:IntNumberBox` + `controls:NumericKeypadAttach.IsEnabled` + `s:NumericKeypad` |
| ⑤ | 多选下拉 | 从大量选项多选，需搜索 + 全选 | [inputs.md](inputs.md) | `s:MultiComboBox`（单值搜索用 `s:SingleComboBox`） |
| ⑥ | 表格分页 | 大数据量表格分页浏览 + 页码跳转 | [data-grid.md](data-grid.md) | `s:PagableDataGrid`（内建翻页）/ `s:Pagination` + `ControlCommands.Prev/Next` |

### B 组（并行批次交付：6 场景 / 4 文件，场景编号以文件内标题为准）

| # | 场景 | 需求一句话 | 对应文件 |
|---|---|---|---|
| ⑦ | 页面跳转 | 按钮/菜单点击跳转另一个页面 | [navigation-layout.md](navigation-layout.md)（场景⑦，PageName vs new Window；证据 [page-navigation-protocol](../03-protocols/page-navigation-protocol.md)） |
| ⑧ | 设备联锁 | 设备状态不满足时按钮不可操作 | [navigation-layout.md](navigation-layout.md)（场景⑧，IOEnable vs IsEnabled+转换器；证据 [device-condition-protocol](../03-protocols/device-condition-protocol.md)） |
| ⑨ | 步骤导航 | 多步骤工艺向导：步骤条 + 内容区 + 上一步/下一步 | [navigation-layout.md](navigation-layout.md)（场景⑨，向导步骤条/侧边导航；证据 [step-frame](../02-controls/navigation/step-frame.md)） |
| ⑩ | 弹窗与本地化 | 确认/提示/错误对话框 + 文案走本地化键 | [dialogs-windows.md](dialogs-windows.md)（场景⑩；证据 [message-box](../02-controls/navigation/message-box.md) + [localization-text](../03-protocols/localization-text.md)） |
| ⑪ | 状态灯 | 设备状态点位显示（运行/停止/报警） | [data-display.md](data-display.md)（场景⑪；证据 [io-status-light](../02-controls/io/io-status-light.md)） |
| ⑫ | 图标引用 | 按钮图标 / 纯显示图标引用框架图标几何 | [icons-resources.md](icons-resources.md)（场景⑫；证据 [icon-element](../02-controls/attached-props/icon-element.md) + [geometries-icons](../01-resources/geometries-icons.md)） |

## 使用流程

1. 在场景总表找到需求 → 打开对应场景文件；
2. 看「推荐控件」表路由到 02-controls/03-protocols 条目（属性细节不在此重复展开）；
3. 看「❌ 禁止 / ✅ 推荐」对照，确认自己的写法归属；
4. 需要新增场景时，按 [templates/scenario-entry-template.md](../templates/scenario-entry-template.md) 模板补充并登记回本表。

## 反例有效性检查（验收项）

- 每个场景的「❌ 禁止」反例必须满足：常规 WPF 原生元素拼装、无 `s:`/`s:Action`/`IOEnable`/`PageName`；
- grep 校验（`{source_root}/ManualView.xaml` 与 `{source_root}/SDC/Style/`）确认反例结构不出现在真实页面，检查结论写入各文件头注释；
- 校验命令示例：

```text
grep -c '<Button' {source_root}/ManualView.xaml                 # 0 → 页面无原生按钮拼装
grep -o 'Click="[^"]*"' {source_root}/ManualView.xaml           # 全部 {s:Action …}
grep -rc 'Click="[A-Za-z_]' {source_root}/SDC/Style/*.xaml      # 0 → 模板无代码后置事件
```
