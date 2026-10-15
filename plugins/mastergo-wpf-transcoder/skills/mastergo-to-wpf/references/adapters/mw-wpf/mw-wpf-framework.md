---
name: mw-wpf-framework-reference
description: MW 自研 WPF 框架参考资料：87 个框架控件、三大协议（s:Action/PageName/IOEnable）、资源键体系与禁止写法对照。由 mastergo-to-wpf 按需读取，不作为独立 Skill 触发。
---

# MW 自研 WPF 框架 API 使用规范

> 打包手册根：本 adapter 下的 `framework-manual/`；它提供控件目录、场景路由和证据规则。实际项目的 `framework.config.json` 解析出的源码根仍是资源键、模板行为和真实页面用法的最终事实源。
> 本文件是 `mastergo-to-wpf` 的 bundled adapter；发布时随总 skill 整体复制，不再依赖外部独立 skill 路径。

## 1. 定位与触发

管「MW 框架页面怎么写」。框架 = MaxwellControl 私有程序集（87 控件，.cs 不可见）+ SDC 资源层（唯一视觉事实源）；权威示例 `{source_root}/ManualView.xaml`。**必须使用**：在 MW 框架项目写任何页面；或提及 IconButton / IOEnable / PageName / s:Action / MainButtonStyle / MaxwellControl / SD / SDC / 自研框架 / 工控 HMI /「别手写 Button」/「用框架写法」。

## 2. 硬性规则

| # | 规则 | 违规后果 |
|---|---|---|
| **R1** | 框架存在对应封装控件或样式族，手写等效结构即违规（一行 `<s:IconButton>` 替代 Button+Grid 拼装） | 丢状态触发器/协议挂点/样式族切换，评审不过 |
| **R2** | 三大协议（s:Action/PageName/IOEnable）禁止自行扩展或发明等价语法（禁 IsEnabled+转换器替 IOEnable、禁 new Window 替 PageName、禁 Click 代码后置替 s:Action） | 绕过框架协议，联锁/跳转/动作审计失效 |
| **R3** | 框架确认没有所需控件：先与用户确认 → 在 SDC 上修改/新增 → 页面只引用新键；禁止页面用原生 WPF 替代 | 绕过框架本身，视为未完成交付 |
| **R4** | 禁止捏造：业务命名空间/页面类名/文本键/图标键一律不得编造——查手册与宿主语言字典，查不到就问用户（基线：曾捏造 MaxWell.SLGPages、WaferLoadThickness） | 编译失败/运行崩溃，交付作废 |
| **R5** | 键存在性验证：凡引用 StaticResource/DynamicResource 键，交付前 grep `{source_root}/SDC` 验证存在；不存在则替换或报告（基线：Icon_Laser 虚构键） | StaticResource 键缺失 = 加载期 XamlParseException |
| **R6** | 待确认语义只按已确认形式使用：TD 语义（IOEnable 表达式全集、图表数据协议等）未回填前只写已确认形式并标「待确认」，禁止扩展 | 推断写成事实，违反证据政策 |

依据：手册 `framework-manual/00-guide/03-writing-paradigm.md`、`framework-manual/00-guide/02-evidence-policy.md`。

## 3. 导航流程

1. 选型表（第 4 节）→ 控件/样式/协议；跨控件场景 → 手册 `framework-manual/04-scenarios/`
2. 手册 `framework-manual/02-controls/README.md` → 87 控件→条目双向索引（含样式键代表）
3. 读条目：属性表（区块 3）/样式族表（区块 4）/禁止对照（区块 6）；协议速查见第 5 节
4. **grep 验证键**：`grep 'x:Key=' {source_root}/SDC/**` 或 ai-index `resource_references`

## 4. 组件选型表（需求 → 控件/样式 → 手册条目）

| 需求 | 控件/样式/协议 | 手册条目 |
|---|---|---|
| 主功能按钮（F 键+图标+文字） | `s:IconButton` + 页面级 MainButtonStyle（BasedOn） | 02-controls/navigation/icon-button.md |
| 退出/返回按钮 | `s:IconButton` + RightButtonStyle + `PageName="Jump:Home"` | icon-button.md |
| 状态按钮（ON/OFF） | `s:StatusButton`（StatusButtonBaseStyle） | navigation/status-button.md |
| 数字/整数参数输入 | `s:NumberBox` / `s:IntNumberBox` + `controls:NumericKeypadAttach.IsEnabled` | keypad-input/number-box.md |
| 弹出键盘 | `s:NumericKeypad` / `s:StringNumericKeypad` / `s:BigNumericKeypad` | keypad-input/numeric-keypad.md |
| 表格 | `s:DataGrid` / `s:IODataGrid` / `s:PagableDataGrid` | grid-tree/data-grid.md |
| 表格分页 | `s:Pagination` + `ControlCommands.Prev/Next` | grid-tree/pagination.md |
| 树形导航 | `s:TreeView` 家族（TreeViewListStyle） | grid-tree/tree-view.md |
| 多选/单值下拉 | `s:MultiComboBox` / `s:SingleComboBox` | grid-tree/multi-combo-box.md |
| 主窗口/圆角窗口 | `s:CommonWindow` / `s:CornerRadiusWindow` | navigation/common-window.md |
| 确认/提示弹窗 | `s:MessageBox`（复用 WindowClosedButton） | navigation/message-box.md |
| 状态灯点位 | `s:IOStatusLight`（IOStatusLightBaseStyle） | io/io-status-light.md |
| 图标引用 | `Icon="{StaticResource XXXGeometry}"` / `s:IconControl` / `controls:IconElement.Geometry` | 01-resources/geometries-icons.md |
| 加载动画 | `s:Loading` 家族（LoadingBaseStyle） | native/loading.md |
| 步骤向导 | `s:StepFrame`（StepFrameBaseStyle） | navigation/step-frame.md |
| 分组框 | `s:IOGroupBox` / `s:GroupBox` | io/io-group-box.md |
| 侧边菜单/主菜单 | `s:SideMenu` / `s:Menu` 家族 | navigation/side-menu.md |
| 设备联锁 | `IOEnable="CTC.RUN==0 &amp;&amp; …"`（禁 IsEnabled+转换器） | 03-protocols/device-condition-protocol.md |
| 页面跳转 | `PageName="Jump:…"`（禁 new Window） | 03-protocols/page-navigation-protocol.md |
| 点击动作 | `Click="{s:Action 动作名}"`（禁代码后置） | 03-protocols/action-protocol.md |
| 页面文本 | `Content="{DynamicResource 文本键}"`（禁硬编码中文） | 03-protocols/localization-text.md |

## 5. 核心协议速查

| 协议 | 已确认形式 | 待确认边界 |
|---|---|---|
| **s:Action** | `Click="{s:Action LoadWaferToCutStage}"`——动作名字面量不带 `()`；可与 PageName 共存（GoBackCommand+Jump:Home） | 解析机制 TD-002 |
| **PageName** | `Jump:ManualCutAuto:ini` / `Jump:ManualAlignView:ini:Manual:True` / `Jump:Home`——`Jump:`+视图名+可选 `:ini[:Manual[:True]]` | 分段语义/优先级 TD-003 |
| **IOEnable** | `IOEnable="CTC.RUN==0 &amp;&amp; CTC.Transfer==0"`——**`&&` 必须转义为 `&amp;&amp;`**（ManualView 14 处）；或 `IOEnable="true"` | 表达式全集 TD-001 |
| **文本键** | `Content="{DynamicResource ManualOperationLoad}"`——文本一律 DynamicResource | 键定义位置 TD-004 |
| **图标键** | `Icon="{StaticResource ManualOperationF1Geometry}"`——图标一律 StaticResource | 无 |

页面用 `xmlns:s="http://www.maxwell-gp.com/"`；`controls:`（MaxwellControl.Controls）附加属性主要被 SDC 样式消费（ManualView 页面零实例），页面如需使用按 `framework-manual/02-controls/attached-props/` 条目已确认属性形式写。

## 6. 输出前检查清单

- [ ] 无手写等效结构（无 Button+Grid 拼装、无手写 Path Data、无位图图标）
- [ ] 协议挂点齐全（需联锁/跳转/动作的控件已挂 IOEnable / PageName / s:Action）
- [ ] 键 grep 通过（所有资源键在 `{source_root}/SDC` 或宿主字典中存在，拼写陷阱键照抄）
- [ ] 文本走 DynamicResource（页面零硬编码中文）
- [ ] 无捏造（命名空间/页面类名/文本键/图标键有据或已确认）
- [ ] 无硬编码色值/尺寸/字号（走 Token、画刷键、样式族）
- [ ] TD 语义标待确认（不扩展、不写成事实）
- [ ] 样式族选择正确（具名键 vs 页面级 BasedOn，未散写属性拼视觉）

## 7. 详细参考路由（路径相对手册根，手册是唯一事实源）

| 手册文件 | 何时读 | 内容 |
|---|---|---|
| `framework-manual/00-guide/03-writing-paradigm.md` | 写任何页面前 | 写法总则 6 条（R1-R3 依据） |
| `framework-manual/00-guide/02-evidence-policy.md` | 语义不确定、写待确认时 | P1-P4 证据层级、证据状态、TD 编号制 |
| `framework-manual/02-controls/README.md` | 找控件条目 | 87 控件→条目双向索引（含样式键代表） |
| `framework-manual/02-controls/<类别>/<条目>.md` | 用具体控件时 | 8 区块完整条目：属性表/样式族表/框架写法/禁止对照/参考锚点/TD |
| `framework-manual/03-protocols/*.md` | 写事件/跳转/联锁时 | 三大协议 + 命名空间 + 本地化 |
| `framework-manual/04-scenarios/*.md` | 从需求出发不知道用哪个控件 | 12 场景对照（常规写法→框架写法+禁止原因） |
| `framework-manual/05-best-practices/*.md` | 自查/评审 | resource-usage / style-selection / common-mistakes（拼写陷阱表）/ pending-confirmations（TD 总表） |
| `framework-manual/templates/*.md` | 新增/修订条目时 | 控件条目模板 / 场景条目模板 |

本参考文件只保留规则与选型速查（第 2/4/5 节），一切细节按需读手册对应文件，不维护第二份副本。
