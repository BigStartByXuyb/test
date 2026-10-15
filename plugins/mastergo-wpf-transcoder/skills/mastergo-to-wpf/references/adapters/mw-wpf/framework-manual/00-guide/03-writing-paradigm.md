# 03 写法对照总则

<!-- evidence=结构性文档; verified=2026-08-13; sources=[{source_root}/ManualView.xaml, {source_root}/SDC/Style/IconButton.xaml] -->

## 1. 判定总则

| # | 总则 | 例 |
|---|---|---|
| 1 | **框架存在对应封装控件，手写等效结构即违规** | 用 `<s:IconButton …/>` 一行；禁止 `Button` 内手写 `Grid+RowDefinitions+TextBlock+Run+ContentControl` 拼装等效视觉 |
| 2 | **框架存在样式族，禁止散写属性拼视觉** | 用 `Style="{StaticResource MainButtonStyle}"`；禁止在元素上散写 Width/Height/FontSize/画刷模拟同款 |
| 3 | **协议类只允许框架声明的已确认形式** | `Click="{s:Action Name}"`、`PageName="Jump:…"`、`IOEnable="…"`；禁止自行扩展语法或发明等价机制（如手写转换器模拟 IOEnable） |
| 4 | **文本一律走本地化键** | `Content="{DynamicResource ManualOperationLoad}"`；禁止硬编码中文文案 |
| 5 | **图标一律引用 Geometry 键** | `Icon="{StaticResource ManualOperationF1Geometry}"`（826 键图标库）；禁止手写 Path Data / 位图资源 |
| 6 | **框架确认没有所需控件时：先与用户确认，再在框架源码结构上修改/新增，禁止用普通 WPF 替代** | 确认后按 `01-resources/README.md`「新增组件步骤」在 SDC 增加（颜色→画刷→状态画刷→Token→Style），页面只引用新键 |

制度来源：framework.config.json development_rules 第 1 条「优先复用框架已有控件、样式和资源」、第 4 条「不重新发明已有框架能力」。

## 2. 双层对照体系

- **第一层（条目内嵌）**：`02-controls/` 每个控件条目第 6 区块「禁止写法对照」——查任意控件即见反例。
- **第二层（场景专章）**：`04-scenarios/` 按业务场景组织跨控件对照——从需求出发、不知道用哪个控件时从这里进。
- 两层都必须满足三要素：**① 常规写法代码（禁止）② 框架写法代码（推荐）③ 禁止原因 ≥3 条**，并标注证据来源。

## 3. 禁止原因五类（写对照时的依据清单）

| 类 | 说明 | 证据例 |
|---|---|---|
| ① 丢失状态 | 手写模板丢失 Hover/Pressed/Selected/Disabled 全套 Trigger 与透明度（0.56）等视觉态 | IconButton.xaml |
| ② 丢失协议挂点 | 手写控件没有 IOEnable/PageName/s:Action 挂点，设备联锁与跳转无从谈起 | ManualView.xaml |
| ③ 无法样式族切换 | 手写结构不能一键切 MainButtonStyle→RightButtonStyle | IconButton.xaml 样式族 |
| ④ 绕过本地化 | 硬编码文案绕过 DynamicResource 文本键体系 | ManualView.xaml |
| ⑤ 脱离视觉规范 | 尺寸/圆角/焦点策略（Focusable=False）失控，页面视觉无法统一 | 样式 Setter 证据 |

## 4. 例外边界

- 框架**没有**封装能力的场景（无对应控件/样式），处理流程：
  1. **先与用户确认**——扩展框架属于对框架本身的修改，不得擅自进行；
  2. 确认后在框架源码结构（SDC）上**修改或新增**组件/样式（按 `01-resources/README.md`「新增组件步骤」）；
  3. 页面只引用新键。
  **禁止用普通 WPF 写法在页面内替代**——那是绕过框架（总则 6）。
- 例外仅限**非本框架项目**：mastergo-to-wpf 的无框架产物等 Demo 不属于 MW 框架页面，不适用本总则；对照中须注明适用边界。
- 反例有效性：每个「禁止写法」片段必须确认不出现在 refence 真实页面中（防把框架实际用法误标为禁止）。
