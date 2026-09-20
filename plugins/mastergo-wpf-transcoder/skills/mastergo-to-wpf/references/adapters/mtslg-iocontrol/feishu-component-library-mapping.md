<title>MasterGo 组件库 → MTSLG IOContorl 映射标准</title>

匹配键优先使用“独立组件集名称 + MasterGo 公开变体/属性名 + 真实属性值”；“完整父节点语义”**不作为匹配键**（父节点链用于定位实例、读取证据与回溯，也用于确认真实结构、裁剪边界与来源；映射表的模板族里也没有按父节点分流的字段）。组件集 ID、实例 ID 和设计师自定义名称只作为读取追踪信息，不参与唯一匹配；匹配键负责命中固定模板，ControlType、节点数量、父子关系和槽位顺序由模板固定，花括号字段由对应 MasterGo 节点或业务配置填充。

坐标、父子层级和裁剪边界属于通用转码规则，详见下方“坐标与容器边界规则”。本段不重复展开实例公式。

# 组件层级身份规则

优先识别独立组件集，再读取该组件的公开变体/属性和真实属性值；父节点语义不参与匹配（父节点链用于定位实例、读取证据与回溯，以及确认真实结构、裁剪边界与来源）。

组件匹配优先识别独立组件集，再读取实例变体和公开属性；输入框、选择框等独立组件不再默认归入“左标题+右信息”。

匹配键示例：组件集=输入框 + 变体=输入框-整数-40；高度只映射到 Height，不改变 ControlType。

# MasterGo 组件集：输入框 → MTSLG 映射关系

“输入框”现在是独立的 MasterGo 组件集，不再作为“左标题+右信息”的嵌套变体处理。匹配时直接识别输入框组件集、公开变体和真实高度值。

### 匹配规则

- 输入框本体单独生成，不把标题或单位合并进输入框的 ControlType。
- 变体名称中的 `-40`、`-36`、`-32`、`-28` 只表示设计尺寸高度，不产生新的代码控件类型。
- 当前项目默认高度为 40；只有 MasterGo 明确使用 36、32 或 28 时，才将对应高度写入 `Height`。

### 固定模板：组件集=输入框，变体=整数

MasterGo 变体：输入框-整数-40、输入框-整数-36、输入框-整数-32、输入框-整数-28。四者代码映射固定为 `IntNumberBox`，仅尺寸不同。

```
<IOContorl ID="{id_input}" IOName="{io_name}" ControlType="IntNumberBox" IOState="{state}" IOEnable="{enable}" Value="{value}" DefaultValue="{default_value}" MinValue="{min_value}" MaxValue="{max_value}" IOCommand="{io_command}" Left="{left}" Top="{top}" Width="{width}" Height="{height}" FontSize="{font_size}" />
```

例如高度 40 的整数输入框仍使用 `ControlType="IntNumberBox"`；高度 36、32 或 28 时只修改 `Height`。

### 固定模板：组件集=输入框，变体=小数

MasterGo 变体：输入框-小数-40、输入框-小数-36、输入框-小数-32、输入框-小数-28。四者代码映射固定为 `NumberBox`，精度由输入属性或项目规则提供。

```
<IOContorl ID="{id_input}" IOName="{io_name}" ControlType="NumberBox" IOState="{state}" IOEnable="{enable}" Value="{value}" DefaultValue="{default_value}" MinValue="{min_value}" MaxValue="{max_value}" IOCommand="{io_command}" Left="{left}" Top="{top}" Width="{width}" Height="{height}" FontSize="{font_size}" />
```

### 固定模板：组件集=输入框，变体=文字

MasterGo 变体：输入框-文字-40、输入框-文字-36、输入框-文字-32、输入框-文字-28。四者代码映射固定为 `TextBox`；标题、占位提示和其他说明文字仍分别使用独立的 `TextBlock`。

```
<IOContorl ID="{id_input}" IOName="{io_name}" ControlType="TextBox" IOState="{state}" IOEnable="{enable}" LangName="{lang_name}" Value="{value}" IOCommand="{io_command}" Left="{left}" Top="{top}" Width="{width}" Height="{height}" FontSize="{font_size}" />
```

### 待确认变体：组件集=输入框，变体=密码输入框

MasterGo 组件库已存在真实变体 `密码输入框`，但当前 MT3.0 IOContorl 控件契约和目标项目 XML 中没有确认的 `PasswordBox` ControlType 或正式密码属性模板。该变体暂标记为待确认；未确认前解析器必须失败，不得降级为 `TextBox`。

# MasterGo 组件集：选择框 → MTSLG 映射关系

### 匹配规则

- MasterGo 真实变体为 `选择框-40`、`选择框-36`、`选择框-32`、`选择框-28`。
- 四个变体均生成一个 `ComboBox` IOContorl；变体后缀只决定自身 `Height`。
- 选择框内部的下拉箭头 PATH 属于 ComboBox 内部视觉结构，不拆成独立 IOContorl；若目标控件需要图标，应由 ComboBox 样式提供。
- **`Value` 不参与多语言（槽位登记 `langRefPolicy: "none"`）**：`Value` 的语义是「**默认选中的名称**」（MT3.0 界面设计器文档：`Value | string | Y | 默认选中的名称`；把选中值写入/读出的是 `IOName`）——运行时由数据决定，不是要翻译的固定文案，因此**不产语言键、不挂 `LangName`**。需要多语言的是**选项文字**：设计器文档里选项是 ComboBox 的子 `TextBlock`（各自带 `Value`，TextBlock 支持 `LangName`），或由 `ItemsSourceFile` + `DisplayMemberPath` / `SelectedValuePath` 从数据文件提供；设计稿只画关闭态、没有选项列表时，**选项数据属运行时待绑定**，不得编造。

### 固定模板：组件集=选择框，变体=选择框-40/选择框-36/选择框-32/选择框-28

固定节点：一个 ComboBox IOContorl；ControlType 固定为 `ComboBox`，节点数量和父子关系固定；`Height` 分别来自对应变体的 40、36、32、28。

```xml
<IOContorl ID="{id_combo}" IOName="{io_name}" ControlType="ComboBox" IOState="{state}" IOEnable="{enable}" Value="{selected_value}" IOCommand="{io_command}" Left="{left}" Top="{top}" Width="{width}" Height="{height}" FontSize="{font_size}">{combo_items}</IOContorl>
```

字段来源：选择框实例→`Value`、位置和尺寸→`Left/Top/Width/Height`、业务字段/动作→`IOName/IOCommand`；MasterGo 未提供的可选字段字段缺失时保留对应 XML 属性并输出空字符串值。

# 坐标与容器边界规则

> **全局固定常量：`contentOriginY = 192px`。** 本适配器所有业务页面根级 `Top/Y` 必须按 `pageAbsY - 192` 输出；不得把 192 改成页面级配置，也不得对嵌套控件重复扣除。

## 页面根级坐标归一

- 本项目页面顶部公共栏固定为 126px，根级设计稿标题固定为 66px，标题始终按 design-artifact-title 剥离。
- 因此根级保留业务节点的 Top/Y 统一按 MasterGo 原始坐标减 192px；192px 是当前项目固定约定，不设置“标题保留时扣 126px”的分支，也不需要在映射 JSON 中配置。
- 该偏移只作用于根级坐标，不改变 Width/Height；嵌套控件使用父子相对坐标，不重复扣除页面偏移。

## 组件父子相对坐标

根级或已展开为同级的 MasterGo 节点使用内容区坐标：`Left = pageAbsX - contentOriginX`、`Top = pageAbsY - 192`。保留父容器的嵌套子节点使用父节点相对坐标：`Left = pageAbsX - parentPageAbsX`、`Top = pageAbsY - parentPageAbsY`；页面偏移只在根级归一化时扣除一次。**例外（容器类控件）**：`ControlType="GroupBox"` 等两段式容器的子控件坐标相对**内容区原点**，不是父容器左上角——内容区原点 = 父容器左上角 + 内容区边框 + 标题条高度（`infoGroupTemplates.styleInsets`，按容器变体的 `contentInsetStyle` 查表），详见本文「信息分组」一节的固定模板说明。父子链必须同时用于确认真实结构、裁剪边界和来源，不能把子节点相对坐标误当作根级绝对坐标。

根组件实例的 Left/Top 先按页面公共偏移归一化；保留嵌套的子控件再按其直接父节点换算相对坐标，不重复扣除父节点坐标或页面偏移。不同组件实例必须分别读取和计算，固定模板只决定结构、ControlType 和槽位顺序，不决定实例坐标。

## overflow=hidden 与裁剪边界

当一次性 `getDsl` 完整响应中的根节点或对应容器节点 `overflow` 为 hidden 时，必须保留对应的外层布局容器及其 Width/Height 裁剪边界。内部子控件的最终位置仍按递归计算出的页面绝对 bbox 和内容区公式计算；相对坐标只能作为父子关系核对信息，不能替代最终 Left/Top。

只有在根组件没有裁剪需求时，才允许将语义槽位展开为同级节点。若展开为同级节点，必须显式保留等价的裁剪边界；否则超出外层组件的文字可能与相邻实例重叠。该裁剪规则优先于“平级节点”的模板书写形式。

# MasterGo 组件集：选择+信息 → MTSLG 映射关系

### 匹配规则

组件集=选择+信息；属性 1 决定选择控件类型和选中状态：单选-选中/未选择→RadioButton，多选-选中/未选中→CheckBox。

### 固定模板：组件集=选择+信息

固定节点：选择控件 + TextBlock，两个平级节点。

```
<!-- 属性1=单选-选中/未选择：默认圆点 RadioButton，使用隐式 RadioButtonBaseStyle -->
<IOContorl ID="{id_choice}" ControlType="RadioButton" Value="{checked}" IOName="{io_name}" IOCommand="{io_command}" IOEnable="{io_enable}" IOState="{io_state}" Left="{choice_left}" Top="{choice_top}" Width="{choice_width}" Height="{choice_height}" />
<IOContorl ID="{id_text}" ControlType="TextBlock" Value="{info_value}" IOState="{text_state}" IOEnable="{text_enable}" Left="{text_left}" Top="{text_top}" Width="NaN" Height="40" FontSize="{text_font_size}" />

<!-- 属性1=多选-选中/未选中：默认 CheckBox 样式 -->
<IOContorl ID="{id_choice}" ControlType="CheckBox" Value="{checked}" IOName="{io_name}" IOCommand="{io_command}" IOEnable="{io_enable}" IOState="{io_state}" Left="{choice_left}" Top="{choice_top}" Width="{choice_width}" Height="{choice_height}" />
<IOContorl ID="{id_text}" ControlType="TextBlock" Value="{info_value}" IOState="{text_state}" IOEnable="{text_enable}" Left="{text_left}" Top="{text_top}" Width="NaN" Height="40" FontSize="{text_font_size}" />
```

# MasterGo 组件集：单选+多选 → MTSLG 映射关系

### 匹配规则

组件集=单选+多选；属性 1 决定 ControlType 和状态：`单选-选中`、`单选-未选择`→RadioButton，`多选-选中`、`多选-未选择`→CheckBox。这四个是设计稿中的真实属性值；`单选-选中/未选择`、`多选-选中/未选中` 这种带斜杠的写法属于《选择+信息》组件集，不得登记到本组件集，否则两个模板族会互相抢占。

### 固定模板：组件集=单选+多选

固定节点：一个选择控件 IOContorl，无 TextBlock 子节点。

```
<!-- 属性1=单选-选中/未选择：使用默认 RadioButtonBaseStyle，除非 MasterGo 明确提供已登记 Style -->
<IOContorl ID="{id}" ControlType="RadioButton" IOState="{io_state}" Value="{value}" IOParam="{io_param}" IOName="{io_name}" IOCommand="{io_command}" IOEnable="{io_enable}" Left="{left}" Top="{top}" Width="{width}" Height="{height}" />

<!-- 属性1=多选-选中/未选择：使用默认 CheckBox 样式，除非 MasterGo 明确提供已登记 Style -->
<IOContorl ID="{id}" ControlType="CheckBox" IOState="{io_state}" Value="{value}" IOParam="{io_param}" IOName="{io_name}" IOCommand="{io_command}" IOEnable="{io_enable}" Left="{left}" Top="{top}" Width="{width}" Height="{height}" />
```

属性1=选中/未选中→状态字段；由控件默认状态样式决定圆点/勾选颜色和显示状态。固定模板默认不写 Style：独立 RadioButton 使用隐式 RadioButtonBaseStyle，CheckBox 使用默认 CheckBox 样式；只有 MasterGo 明确提供并且代码库已登记对应样式时，才增加 Style 属性。

节点文案/业务值→Value；业务字段/动作→IOName/IOCommand。

- 在现有 XML 中，RadioButton 的 Value 常是业务选项值，IOParam 是提交值；它们不等同于设计稿的选中状态。
- 同组互斥关系由页面配置/业务字段确定。

# MasterGo 组件集：信息分组-模块化 → MTSLG 映射关系

### 匹配规则

组件集=信息分组-模块化（`infoGroupTemplates.match.componentSet = true`）。组件集名取自实例**自身**的组件名；图层重命名不改变组件名。容器族不使用"内部实例子节点名"作为候选，避免页面根的第一个实例子节点与外层容器同名时把整页误判成容器。

### 固定模板：组件集=信息分组-模块化

固定节点：一个固定 GroupBox 外壳；该组件对外只有两个业务参数：标题名称→Header；多语言资源→LangName（由 Header 查资源库）。内部子节点不是 GroupBox 的可变类型参数，按子组件模板展开。

```
<IOContorl ID="{id_group}" ControlType="GroupBox" Style="" Header="{header}" LangName="{lang_name}" IOName="" IOVisible="" IOEnable="" MinValue="" MaxValue="" Width="{width}" Height="{height}" Left="{left}" Top="{top}">{child_io_controls}</IOContorl>
```

- MasterGo 根组件名称/实例名称→组件身份，不写入 Header。
- 根组件内标题 TEXT（例如“周期名称”）→Header；再由 Header 查询对应 LangName。
- GroupBox 的位置、宽高来自根组件；**`Style` 是必写字段但值为空串**（本族 `style` 登记为空字符串，由框架落默认样式）；`IOName` / `IOVisible` / `IOEnable` / `MinValue` / `MaxValue` 属于固定模板字段，没有可靠来源时输出空字符串值。
- **内容区原点（强制）**：GroupBox 的模板是"标题条 + 内容区"两段式，子控件的 `Left/Top` 从**内容区原点**量，不是从容器左上角量。原点登记在 `mtslg-iocontrol-map.json` 的 `infoGroupTemplates.styleInsets`：`IOGroupBoxBaseStyle` = `{left:2, top:40}`、`IOGroupBoxSecondary` = `{left:1, top:35}`、`IOGroupBoxThirdly` = `{left:1, top:25}`、`IOGroupBoxFour` = `{left:1, top:35}`。换算：`Left = 子控件绝对X − 容器绝对X − inset.left`，`Top = 子控件绝对Y − 容器绝对Y − inset.top`。**`style`（发射值）与 `contentInsetStyle`（查上表的内部键）是两个字段**：本族 `style=""`、`contentInsetStyle="IOGroupBoxSecondary"`。也就是说 Style 恒空，但内容区原点仍按 `IOGroupBoxSecondary` 的 `{left:1, top:35}` 机械换算；`contentInsetStyle` 未登记对应原点时生成脚本直接失败（不猜原点）。**口径状态**：两者都是**项目框架侧的确定口径**——GroupBox 的 `Style` 恒发空串；空 `Style` 时内容区原点就是 `{left:1, top:35}`。按既定事实直接换算，不设待确认项。
- 设计稿把子控件画在组件里但层级上是平级兄弟时，由 `apply-container-containment.js` 按**坐标完全包含**关系重挂为 GroupBox 的子节点（取面积最小的容器；越界 1px 不算包含；无法唯一判定时保持原状并写入冲突报告，不猜）；重挂时同时按上面的内容区原点重算 `expectedLeft/expectedTop`。
- 未命中该组件集的容器类实例仍按未映射组件处理（不产控件、内部文本不发射）；只有命中的容器才展开子控件。

信息分组内部的 TabControl/TabItem 只有在 MasterGo DSL 明确给出组件集、真实属性值、父子链和槽位来源后才展开；当前没有独立的正式变体模板，未确认时不生成占位 Tab 节点。

# MasterGo 组件集：信息模块-手动控制弹层 → MTSLG 映射关系

### 匹配规则

组件集=信息模块-手动控制弹层（`infoGroupTemplates.match.componentSet = true`）。与信息分组同族：组件集名取自实例自身的组件名，图层重命名不影响。

### 固定模板：组件集=信息模块-手动控制弹层

固定节点：一个固定 GroupBox 外壳；对外只有两个业务参数：标题名称→Header；多语言资源→LangName（由 Header 查资源库）。内部子节点按子组件模板展开。

```
<IOContorl ID="{id_group}" ControlType="GroupBox" Style="" Header="{header}" LangName="{lang_name}" IOName="" IOVisible="" IOEnable="" MinValue="" MaxValue="" Width="{width}" Height="{height}" Left="{left}" Top="{top}">{child_io_controls}</IOContorl>
```

- 根组件内标题 TEXT（例如“单轴控制”）→Header；再由 Header 查询对应 LangName。
- 位置、宽高来自根组件；`Style` 按本族登记发射（空串，必写字段）；其余固定模板字段没有可靠来源时输出空字符串值。
- 组内子控件同样按各自模板生成，嵌套规则、内容区原点换算与信息分组完全一致（`childPolicy = nested-page-templates`，`styleInsets` 共用同一张表）。

# MasterGo 组件集：集成图像 / 晶圆图 → MTSLG 映射关系（相机视口）

### 匹配规则

相机视口组件集按**组件集名**（= 实例自身名）命中（`cameraTemplates.match.componentSet = true`，与右栏独立组件族同一套「按组件名匹配」机制），登记的组件集为团队组件库「集成图像 UI汇总」画廊里的：`集成图像`、`集成图像-XIS 模式`、`集成图像-晶圆图 - 线条模式`、`晶圆图 - 工件模式`、`集成图像-低倍率`、`集成图像-JOG mode`、`集成图像-结果检查（预对准）`、`集成图像=结果检查（预对准）展开`、`组件 1065`。图层重命名不改变组件集名；命中即以组件集名精确匹配，未命中的实例仍按未映射组件处理。`组件 1065` 是组件库里未命名的相机视口（设计侧建议改名，行为上按相机视口登记）。

### 固定模板：组件集=集成图像 / 晶圆图

固定节点：一个 `ControlType="Camera"` 的视口控件；**不发射 `Style`**（`cameraTemplates.stylePolicy = none`，直接用运行时默认控件外观）。**相机视口是一个整体**：组件内部的一切绘制内容（网格、通道文字、JOG mode、拟合结果等）都不处理、不发射——内部 TEXT 由映射生成器显式 consume，并按 `cameraTemplates.innerTextPolicy` 以 `camera-viewport-internal` 角色 omit（该角色已登记进 provenance 校验器的 omit 角色集合，校验可通过且不会漏成根级 `TextBlock`）。

```
<IOContorl ID="{id_camera}" ControlType="Camera" DesignPanelID="" IOName="" Value="" Width="{width}" Height="{height}" Left="{left}" Top="{top}" />
```

- `DesignPanelID`（相机编号）与 `Value`（相机名称）在设计稿里**没有可靠来源**——相机实例既不带公开属性，也没有承载相机名的文本节点（实测各页面相机实例的 `componentInfo.properties` 为空）——按固定模板写**空串占位**，由工程师或运行时绑定填写；不得用组件集名、图层名或内部绘制文字充当相机编号/名称。
- `IOName`（从内存读取相机名称）同属恒写字段，无来源时写空串。
- `Width` / `Height` 取**实例自身 bbox**（实测 600×600 或 600×510），不得用组件内部绘制节点尺寸；`Left` / `Top` 按页面统一坐标规则计算。
- 运行时字段（`IOSetExposure`、`IsImagePix`、`IsExpendPanel`、`IsCrossing*`、`ScalingType` 等）当前模块不发射，保持默认形态。
- 未命中该组件集的相机类组件不得降级成 `Border`、`Image` 或自绘结构；保持未映射并记入待确认。

# MasterGo 控件类型：IconButton → MTSLG 映射规则

## 聚合集合=右侧栏：IconButton 按钮族映射关系

### 匹配规则

- 匹配键为“聚合集合名（右侧栏） + 公开属性名（按钮类型） + 真实属性值”，不使用图层名称，也没有“父节点语义”这一层；变体内部引用的独立组件是组件库中的真实组件，名称必须写全（`右侧栏-左右结构-icon+文案` / `右侧栏-上下结构-icon+文案`，与下一节对照表和映射表 `componentSet` 逐字一致），`右侧栏-左右结构` / `右侧栏-上下结构` 只是口头简写、不是匹配键、也不构成父节点语义。
- 真实属性值即团队组件库中该集合的变体值：F+文案、文案 大button、上下结构-icon+文案、左右结构-icon+文案、stop、start、恢复切割、删除料盒-1、删除料盒-2、文案-小button、enter、exit、startstop。
- 每个变体内部实例指向的独立组件名登记在映射表的 `componentSet` 上；解析时先用属性值命中变体，再用内部组件名交叉核对，两者不一致**直接失败并要求重新核对**（不静默选边，`resolve-mtslg-template-mapping.js` 按此实现），避免用错模板的槽位结构生成页面。
- Style 由变体值决定（见下方对照表）；`null` 表示该变体刻意不写 Style，使用框架默认样式。

### 固定模板：聚合集合=右侧栏（全部按钮类型变体）

固定节点：一个 IconButton IOContorl；ControlType 固定为 IconButton；节点数量、父子关系和槽位顺序固定；变体值只决定 Style。

```xml
<IOContorl ID="{id}" ControlType="IconButton" Style="{style}" Icon="{icon}" IconWidth="{icon_width}" IconHeight="{icon_height}" PageName="{page_name}" IOName="{io_name}" IOCommand="{io_command}" IOEnable="{io_enable}" IOState="{io_state}" IOVisible="{io_visible}" LangName="{lang_name}" Value="{value}" Left="{left}" Top="{top}" Width="{width}" Height="{height}" />
```

Style 与内部组件对照（只对下表列出的真实值成立）：

| 按钮类型变体值 | Style | 内部独立组件名（componentSet） |
|-|-|-|
| 左右结构-icon+文案 | RightButtonStyle | 右侧栏-左右结构-icon+文案 |
| start | RightButtonStyle | start |
| enter | EnterButtonStyle（组件级固定，见下） | enter |
| exit | ExitButtonStyle（组件级固定，见下） | exit |
| stop | RightButtonStyle | 待组件库登记 |
| 恢复切割 | RightButtonStyle | 待组件库登记 |
| 上下结构-icon+文案 | UpDownRightButtonStyle | 右侧栏-上下结构-icon+文案 |
| startstop | UpDownRightButtonStyle | 待组件库登记 |
| F+文案 | null（不写 Style） | 待组件库登记 |
| 文案 大button | null（不写 Style） | 待组件库登记 |
| 删除料盒-1 | null（不写 Style） | 待组件库登记 |
| 删除料盒-2 | null（不写 Style） | 待组件库登记 |
| 文案-小button | null（不写 Style） | 待组件库登记 |

文案→Value；业务字段/动作→IOName/IOCommand；PageName/IOVisible/IOCommand 按“按钮族固定参数”一节恒写；图标→Icon，图标尺寸→IconWidth/IconHeight（取台账命中条目节点 bbox；`enter`/`exit` 两个组件级固定变体的例外口径见下两节）；独立组件没有 F 键槽位，不生成 TopLeftContent。Icon 键可使用目标项目已确认键或当前页面唯一的临时 Geometry 键。本节的「变体值只决定 Style」只对其余变体成立：`enter`/`exit` 的 Style 与固定属性由各自独立固定模板登记。

### 固定模板：按钮类型=enter

固定节点：一个 IconButton IOContorl；ControlType 固定为 IconButton；节点数量、父子关系和槽位顺序与右栏聚合模板一致；Style 固定为 `EnterButtonStyle`；`IsSave` 固定为 `"true"`；`Icon` 固定为 `EnterGeometry`（**运行时提供**，本页不生成该 Geometry）；语言键固定为 `{page}Enter`。

```xml
<IOContorl ID="{id}" ControlType="IconButton" Style="EnterButtonStyle" Icon="EnterGeometry" TopLeftContent="" Value="{value}" LangName="{page}Enter" PageName="" IOCommand="" IsSave="true" Width="{width}" Height="{height}" IconWidth="{icon_width}" IconHeight="{icon_height}" Left="{left}" Top="{top}" />
```

字段来源：`Left`/`Top`/`Width`/`Height` 取设计稿 bbox（`Top = pageAbsY − 192`）；文案取设计文本 → `Value`；`IconWidth`/`IconHeight` 取该实例子树里**唯一 PATH** 的 bbox 四舍五入（多个 PATH 直接失败，要求设计侧消歧；登记台账对该变体无效，禁止猜尺寸）——本变体的台账条目**不存在也不需要**，Bundle 会把命中该 owner 的台账条目剔除并记入 `runtimeIcons` 审计；`Style`/`Icon`/`IsSave`/`LangName` 全部由映射表登记，设计稿不参与取自。本变体登记 `omitRequiredAttrs`（见公共口径），因此**不发射** `IOVisible`/`IOEnable`/`IsShowStatus`/`IsNeedRedMark`；`IOCommand` 仍按必写字段发空串占位。

### 固定模板：按钮类型=exit

固定节点：一个 IconButton IOContorl；ControlType 固定为 IconButton；节点数量、父子关系和槽位顺序与右栏聚合模板一致；Style 固定为 `ExitButtonStyle`；`PageName` 固定为 `"GoBack"`；`Icon` 固定为 `ExitGeometry`（**运行时提供**，本页不生成该 Geometry）；语言键固定为 `{page}Exit`。

```xml
<IOContorl ID="{id}" ControlType="IconButton" Style="ExitButtonStyle" Icon="ExitGeometry" TopLeftContent="" Value="{value}" LangName="{page}Exit" PageName="GoBack" IOCommand="" Width="{width}" Height="{height}" IconWidth="{icon_width}" IconHeight="{icon_height}" Left="{left}" Top="{top}" />
```

字段来源：与 `enter` 同口径（几何取设计稿、文案取设计文本 → `Value`、图标尺寸取实例子树唯一 PATH 的 bbox）；`Style`/`Icon`/`PageName`/`LangName` 由映射表登记；与 `enter` 同样登记 `omitRequiredAttrs`，**不发射** `IOVisible`/`IOEnable`/`IsShowStatus`/`IsNeedRedMark`。

### 组件级固定变体的公共口径（enter / exit 共用）

两个变体都是**组件级固定**：Style、固定属性、运行时图标键和语言键全部由映射表登记（组件级通用，不分页面）；设计稿提供几何（`Left`/`Top`/`Width`/`Height` 与图标区域 bbox）与文案（→ `Value`）。

- **`iconPolicy: "runtime"` + `runtimeIcon`**：`Icon` 是目标项目已存在的资源键，**本页 Icon 文件不生成该 Geometry**，本页台账也没有该条目（有也会被 Bundle 剔除）。`IconWidth`/`IconHeight` 取该实例子树里唯一 PATH 的 bbox（设计稿图标区域尺寸；多个 PATH 直接失败）。引用运行时图标的节点不判为“引用了未生成的 Geometry”，被剔除的台账条目记在 bundle 审计 `runtimeIcons`。
- **`fixedAttrs`**：逐变体固定属性，生成时逐字发射；设计稿不覆盖这些属性，也不参与它们的取值。
- **`omitRequiredAttrs`**：逐变体收窄必写字段——登记在这里的属性**不发射**（`controlTypeRequiredAttrs` 与 `buttonFamily.alwaysWrittenAttrs` 仍是唯一真值源，本字段只做本变体的减法）。解析器把它盖成节点标记 `omitAttrs`，`gen-iocontrol-xml.js` 与 `validate-iocontrol-provenance.js` 共用 `scripts/lib/script-helpers.js` 的 `omittedAttrs()` 判据：生成器跳过发射，校验器同步跳过「必须存在」的检查。未登记的变体不受影响。
- **`langPolicy: "fixed"` + `langKeyTemplate` + `langText`**：语言键由映射表登记，`{page}` 由语言派生器按当前页面名替换，**不从设计文本派生、也不依赖设计文本存在**（设计文本缺失时仍按 `langText` 产键）；词典 CN/EN 取 `langText`。多页共用同一条登记，key 各自带页面名前缀。
- **作用范围**：只有登记了上述字段的变体才走固定路径；未登记的右栏变体，其 `Style`、图标生成和语言键派生行为与登记前完全一致。

### 固定模板：独立组件=右侧栏-左右结构-icon+文案 / 右侧栏-上下结构-icon+文案 / start

固定节点：一个 IconButton IOContorl；ControlType 固定为 IconButton；节点数量、父子关系和槽位顺序固定；组件名只决定 Style（`右侧栏-左右结构-icon+文案` 与 `start` → RightButtonStyle，`右侧栏-上下结构-icon+文案` → UpDownRightButtonStyle）。独立组件被直接放置到页面（没有聚合集合的“按钮类型”属性）时，按**组件名**命中本模板。

```xml
<!-- 右侧栏-左右结构-icon+文案 / start -->
<IOContorl ID="{id}" ControlType="IconButton" Style="RightButtonStyle" Icon="{icon}" IconWidth="{icon_width}" IconHeight="{icon_height}" PageName="{page_name}" IOName="{io_name}" IOCommand="{io_command}" IOEnable="{io_enable}" IOState="{io_state}" IOVisible="{io_visible}" LangName="{lang_name}" Value="{value}" Left="{left}" Top="{top}" Width="{width}" Height="{height}" />

<!-- 右侧栏-上下结构-icon+文案 -->
<IOContorl ID="{id}" ControlType="IconButton" Style="UpDownRightButtonStyle" Icon="{icon}" IconWidth="{icon_width}" IconHeight="{icon_height}" PageName="{page_name}" IOName="{io_name}" IOCommand="{io_command}" IOEnable="{io_enable}" IOState="{io_state}" IOVisible="{io_visible}" LangName="{lang_name}" Value="{value}" Left="{left}" Top="{top}" Width="{width}" Height="{height}" />
```

`右侧栏-左右结构-icon+文案` 与 `右侧栏-上下结构-icon+文案` 的公开属性均为 实例（图标槽位）、显示 icon、显示文案（两者是同一个视觉组件的两种形态：前者左右排布、后者上下排布）；`start` 没有公开属性。三者都取当前实例真实 bbox 作为坐标尺寸，图标尺寸取台账命中条目节点 bbox；文案→Value。

## 界面内操作组：IconButton 映射关系

### 匹配规则

- 匹配键使用组件实例公开属性“属性 1”及其真实属性值，不使用节点名称或外观语义推断。
- 属性 1=加减快捷键-无标题、加减快捷键操作-2有标题、加减快捷操作-有标题时，按钮固定使用 ControlType=IconButton、Style=SmallButton。
- 上述三个属性值对应的按钮均无图标槽位：Icon、IconWidth、IconHeight 仍按 ControlType 固定字段恒写、值写空字符串（见 `mtslg-iocontrol-map.json` 的 `controlTypeRequiredAttrs`）；PageName、IOVisible、IOCommand 仍按“按钮族固定参数”一节恒写。
- 其余真实属性值按各自固定模板命中：轴操作、轴操作-快慢、方向、图像移动-单侧、图像移动-双侧、缺口位置、拟合数据-双侧上下、拟合数据-前后、拟合数据-单侧上下、扫描；不得使用未定义的“其他”兜底模板。除三个加减快捷属性值外，其余按钮均使用默认 IconButton 并省略 Style；图标属性仅由对应 MasterGo 节点的真实图标槽位决定。

### 固定模板：属性 1=加减快捷键-无标题

固定节点：四个 IconButton IOContorl 和两个 TextBlock IOContorl；按钮 ControlType 固定为 IconButton，Style 固定为 SmallButton；文本 ControlType 固定为 TextBlock；四个按钮与数值、方向文本的槽位顺序和父子关系固定；所有按钮无图标属性。

```xml
<IOContorl ID="{button_plus_5_id}" IOName="{button_plus_5_io_name}" IOCommand="{button_plus_5_io_command}" ControlType="IconButton" Style="SmallButton" IOEnable="{button_plus_5_enable}" IOState="{button_plus_5_state}" LangName="{button_plus_5_lang}" Value="{button_plus_5_value}" Left="{button_plus_5_left}" Top="{button_plus_5_top}" Width="{button_plus_5_width}" Height="{button_plus_5_height}" />
<IOContorl ID="{button_minus_5_id}" IOName="{button_minus_5_io_name}" IOCommand="{button_minus_5_io_command}" ControlType="IconButton" Style="SmallButton" IOEnable="{button_minus_5_enable}" IOState="{button_minus_5_state}" LangName="{button_minus_5_lang}" Value="{button_minus_5_value}" Left="{button_minus_5_left}" Top="{button_minus_5_top}" Width="{button_minus_5_width}" Height="{button_minus_5_height}" />
<IOContorl ID="{button_plus_1_id}" IOName="{button_plus_1_io_name}" IOCommand="{button_plus_1_io_command}" ControlType="IconButton" Style="SmallButton" IOEnable="{button_plus_1_enable}" IOState="{button_plus_1_state}" LangName="{button_plus_1_lang}" Value="{button_plus_1_value}" Left="{button_plus_1_left}" Top="{button_plus_1_top}" Width="{button_plus_1_width}" Height="{button_plus_1_height}" />
<IOContorl ID="{button_minus_1_id}" IOName="{button_minus_1_io_name}" IOCommand="{button_minus_1_io_command}" ControlType="IconButton" Style="SmallButton" IOEnable="{button_minus_1_enable}" IOState="{button_minus_1_state}" LangName="{button_minus_1_lang}" Value="{button_minus_1_value}" Left="{button_minus_1_left}" Top="{button_minus_1_top}" Width="{button_minus_1_width}" Height="{button_minus_1_height}" />
<IOContorl ID="{value_id}" ControlType="TextBlock" LangName="{value_lang}" Value="{display_value}" Left="{value_left}" Top="{value_top}" Width="NaN" Height="40" />
<IOContorl ID="{direction_id}" ControlType="TextBlock" LangName="{direction_lang}" Value="{direction}" Left="{direction_left}" Top="{direction_top}" Width="NaN" Height="40" />
```

按钮文案（例如 +5、-5、+1、-1）分别从对应 TEXT 节点读取并填入 Value；数值和方向文本分别从真实 TEXT 节点读取并填入对应 TextBlock.Value。业务字段/动作、状态、位置和尺寸从对应 MasterGo 节点读取；文本位置和尺寸也从各自节点 bbox 读取。无图标槽位时 Icon、IconWidth、IconHeight 仍恒写并输出空字符串值；PageName、IOVisible、IOCommand、IOEnable 按“按钮族固定参数”一节恒写；MasterGo 未提供的其他必写字段缺失时保留对应 XML 属性并输出空字符串值。

### 固定模板：属性 1=加减快捷键操作-2有标题

固定节点：四个 IconButton IOContorl 和两个 TextBlock IOContorl；按钮 ControlType 固定为 IconButton，Style 固定为 SmallButton；文本 ControlType 固定为 TextBlock；四个按钮与标题、数值文本的槽位顺序和父子关系固定；所有按钮无图标属性。

```xml
<IOContorl ID="{button_plus_5_id}" IOName="{button_plus_5_io_name}" IOCommand="{button_plus_5_io_command}" ControlType="IconButton" Style="SmallButton" IOEnable="{button_plus_5_enable}" IOState="{button_plus_5_state}" LangName="{button_plus_5_lang}" Value="{button_plus_5_value}" Left="{button_plus_5_left}" Top="{button_plus_5_top}" Width="{button_plus_5_width}" Height="{button_plus_5_height}" />
<IOContorl ID="{button_minus_5_id}" IOName="{button_minus_5_io_name}" IOCommand="{button_minus_5_io_command}" ControlType="IconButton" Style="SmallButton" IOEnable="{button_minus_5_enable}" IOState="{button_minus_5_state}" LangName="{button_minus_5_lang}" Value="{button_minus_5_value}" Left="{button_minus_5_left}" Top="{button_minus_5_top}" Width="{button_minus_5_width}" Height="{button_minus_5_height}" />
<IOContorl ID="{button_plus_1_id}" IOName="{button_plus_1_io_name}" IOCommand="{button_plus_1_io_command}" ControlType="IconButton" Style="SmallButton" IOEnable="{button_plus_1_enable}" IOState="{button_plus_1_state}" LangName="{button_plus_1_lang}" Value="{button_plus_1_value}" Left="{button_plus_1_left}" Top="{button_plus_1_top}" Width="{button_plus_1_width}" Height="{button_plus_1_height}" />
<IOContorl ID="{button_minus_1_id}" IOName="{button_minus_1_io_name}" IOCommand="{button_minus_1_io_command}" ControlType="IconButton" Style="SmallButton" IOEnable="{button_minus_1_enable}" IOState="{button_minus_1_state}" LangName="{button_minus_1_lang}" Value="{button_minus_1_value}" Left="{button_minus_1_left}" Top="{button_minus_1_top}" Width="{button_minus_1_width}" Height="{button_minus_1_height}" />
<IOContorl ID="{title_id}" ControlType="TextBlock" LangName="{title_lang}" Value="{title}" Left="{title_left}" Top="{title_top}" Width="NaN" Height="40" />
<IOContorl ID="{value_id}" ControlType="TextBlock" LangName="{value_lang}" Value="{display_value}" Left="{value_left}" Top="{value_top}" Width="NaN" Height="40" />
```

四个按钮文案（例如 +5、-5、+1、-1）分别从对应 TEXT 节点读取并填入 Value；标题和数值文本分别从真实 TEXT 节点读取并填入对应 TextBlock.Value。按钮业务字段/动作、状态、位置和尺寸从对应 MasterGo 节点读取；文本位置和尺寸也从各自节点 bbox 读取。无图标槽位时 Icon、IconWidth、IconHeight 仍恒写并输出空字符串值；PageName、IOVisible、IOCommand、IOEnable 按“按钮族固定参数”一节恒写；MasterGo 未提供的必写字段缺失时保留对应 XML 属性并输出空字符串值。

### 固定模板：属性 1=加减快捷操作-有标题

固定节点：四个 IconButton IOContorl 和三个 TextBlock IOContorl；按钮 ControlType 固定为 IconButton，Style 固定为 SmallButton；文本 ControlType 固定为 TextBlock；四个按钮、标题文本、数值文本和方向文本的父子关系、槽位顺序固定；所有按钮无图标属性。

```xml
<IOContorl ID="{button_plus_5_id}" IOName="{button_plus_5_io_name}" IOCommand="{button_plus_5_io_command}" ControlType="IconButton" Style="SmallButton" IOEnable="{button_plus_5_enable}" IOState="{button_plus_5_state}" LangName="{button_plus_5_lang}" Value="{button_plus_5_value}" Left="{button_plus_5_left}" Top="{button_plus_5_top}" Width="{button_plus_5_width}" Height="{button_plus_5_height}" />
<IOContorl ID="{button_minus_5_id}" IOName="{button_minus_5_io_name}" IOCommand="{button_minus_5_io_command}" ControlType="IconButton" Style="SmallButton" IOEnable="{button_minus_5_enable}" IOState="{button_minus_5_state}" LangName="{button_minus_5_lang}" Value="{button_minus_5_value}" Left="{button_minus_5_left}" Top="{button_minus_5_top}" Width="{button_minus_5_width}" Height="{button_minus_5_height}" />
<IOContorl ID="{button_plus_1_id}" IOName="{button_plus_1_io_name}" IOCommand="{button_plus_1_io_command}" ControlType="IconButton" Style="SmallButton" IOEnable="{button_plus_1_enable}" IOState="{button_plus_1_state}" LangName="{button_plus_1_lang}" Value="{button_plus_1_value}" Left="{button_plus_1_left}" Top="{button_plus_1_top}" Width="{button_plus_1_width}" Height="{button_plus_1_height}" />
<IOContorl ID="{button_minus_1_id}" IOName="{button_minus_1_io_name}" IOCommand="{button_minus_1_io_command}" ControlType="IconButton" Style="SmallButton" IOEnable="{button_minus_1_enable}" IOState="{button_minus_1_state}" LangName="{button_minus_1_lang}" Value="{button_minus_1_value}" Left="{button_minus_1_left}" Top="{button_minus_1_top}" Width="{button_minus_1_width}" Height="{button_minus_1_height}" />
<IOContorl ID="{title_id}" ControlType="TextBlock" LangName="{title_lang}" Value="{title}" Left="{title_left}" Top="{title_top}" Width="NaN" Height="40" />
<IOContorl ID="{value_id}" ControlType="TextBlock" LangName="{value_lang}" Value="{display_value}" Left="{value_left}" Top="{value_top}" Width="NaN" Height="40" />
<IOContorl ID="{direction_id}" ControlType="TextBlock" LangName="{direction_lang}" Value="{direction}" Left="{direction_left}" Top="{direction_top}" Width="NaN" Height="40" />
```

四个按钮文案（例如 +5、-5、+1、-1）分别从对应 TEXT 节点读取并填入 Value；标题、数值和方向文本分别从真实 TEXT 节点读取并填入对应 TextBlock 的 Value。按钮业务字段/动作、状态、位置和尺寸从对应 MasterGo 节点读取；文本位置和尺寸也从各自节点 bbox 读取。无图标槽位时 Icon、IconWidth、IconHeight 仍恒写并输出空字符串值；PageName、IOVisible、IOCommand、IOEnable 按“按钮族固定参数”一节恒写；MasterGo 未提供的其他必写字段缺失时保留对应 XML 属性并输出空字符串值。

该规则的真实子节点关系为：四个按钮子节点名称均为 `按钮`，按父节点链和组件内顺序区分；按钮内部 TEXT 节点写入对应 IconButton.Value。与按钮平级的主标题 TEXT 节点生成独立 TextBlock；组 2525 内的 TEXT 节点也分别生成独立 TextBlock。主标题可见性由实例属性控制，不影响按钮 Value 文本或组内独立文本。

该组件的 `显示主标题` 和 `显示左侧副标题` 都是文本可见性开关：属性为 true 时，沿当前实例父子链读取对应的主标题/左侧副标题 TEXT 节点并各自生成独立 TextBlock；属性为 false 时省略对应文本节点。主标题和左侧副标题都不是按钮 Value，不得从按钮文案或坐标推断文本。

### 固定模板：属性 1=轴操作

固定节点：四个 IconButton IOContorl 和一个可选 TextBlock IOContorl；按钮 ControlType 固定为 IconButton，Style 属性省略；文本 ControlType 固定为 TextBlock；四个方向按钮（up、left、right、down）与 SCAN 文本的槽位顺序和父子关系固定。

```xml
<IOContorl ID="{up_id}" IOName="{up_io_name}" IOCommand="{up_io_command}" ControlType="IconButton" Icon="{up_icon}" IconHeight="{up_icon_height}" IconWidth="{up_icon_width}" IOEnable="{up_enable}" IOState="{up_state}" Value="{up_value}" Left="{up_left}" Top="{up_top}" Width="{up_width}" Height="{up_height}" />
<IOContorl ID="{left_id}" IOName="{left_io_name}" IOCommand="{left_io_command}" ControlType="IconButton" Icon="{left_icon}" IconHeight="{left_icon_height}" IconWidth="{left_icon_width}" IOEnable="{left_enable}" IOState="{left_state}" Value="{left_value}" Left="{left_left}" Top="{left_top}" Width="{left_width}" Height="{left_height}" />
<IOContorl ID="{right_id}" IOName="{right_io_name}" IOCommand="{right_io_command}" ControlType="IconButton" Icon="{right_icon}" IconHeight="{right_icon_height}" IconWidth="{right_icon_width}" IOEnable="{right_enable}" IOState="{right_state}" Value="{right_value}" Left="{right_left}" Top="{right_top}" Width="{right_width}" Height="{right_height}" />
<IOContorl ID="{down_id}" IOName="{down_io_name}" IOCommand="{down_io_command}" ControlType="IconButton" Icon="{down_icon}" IconHeight="{down_icon_height}" IconWidth="{down_icon_width}" IOEnable="{down_enable}" IOState="{down_state}" Value="{down_value}" Left="{down_left}" Top="{down_top}" Width="{down_width}" Height="{down_height}" />
<IOContorl ID="{scan_id}" ControlType="TextBlock" Value="{scan_text}" Left="{scan_left}" Top="{scan_top}" Width="NaN" Height="40" />
```

四个按钮的图标、文案、业务字段/动作、状态、位置和尺寸从对应 MasterGo 节点读取；SCAN 文本节点填入 TextBlock.Value。SCAN 是可选取槽位：当前实例不存在该 TEXT 节点时不生成该 TextBlock，也不得用坐标或相邻实例补齐。存在图标槽位时生成 Icon、IconHeight、IconWidth；未提供的可选字段缺失时保留对应 XML 属性并输出空字符串值。

本组件集的固定真实子节点顺序为：

- `组 1504`：上方向按钮；Icon 来源为组 1521；
- `组 1524`：左方向按钮；Icon 来源为组 1525；
- `组 1526`：右方向按钮；Icon 来源为组 1526；
- `组 2526`：下方向按钮；Icon 来源为组 1522；
- `scan`：独立 TEXT 节点，单独生成 TextBlock，不并入任一方向按钮的 Value。

按钮的 `Left/Top/Width/Height` 必须读取四个按钮外层节点 bbox；内部图标组只提供 Icon 来源和图标尺寸，不得用内部图标 bbox 代替按钮尺寸。实例文本、图标和坐标均从当前实例的真实父子链读取。

### 固定模板：属性 1=轴操作-快慢

固定节点：八个 IconButton IOContorl 和一个可选 TextBlock IOContorl；按钮 ControlType 固定为 IconButton，Style 属性省略；文本 ControlType 固定为 TextBlock；八个按钮按“方向 × 内外圈”固定槽位顺序 up_inner、up_outer、down_inner、down_outer、left_inner、left_outer、right_inner、right_outer，SCAN 文本排在最后且仅在设计稿存在该 TEXT 节点时生成。

```xml
<IOContorl ID="{up_inner_id}" IOName="{up_inner_io_name}" IOCommand="{up_inner_io_command}" ControlType="IconButton" Icon="{up_inner_icon}" IconHeight="{up_inner_icon_height}" IconWidth="{up_inner_icon_width}" IOEnable="{up_inner_enable}" IOState="{up_inner_state}" Value="{up_inner_value}" Left="{up_inner_left}" Top="{up_inner_top}" Width="{up_inner_width}" Height="{up_inner_height}" />
<IOContorl ID="{up_outer_id}" IOName="{up_outer_io_name}" IOCommand="{up_outer_io_command}" ControlType="IconButton" Icon="{up_outer_icon}" IconHeight="{up_outer_icon_height}" IconWidth="{up_outer_icon_width}" IOEnable="{up_outer_enable}" IOState="{up_outer_state}" Value="{up_outer_value}" Left="{up_outer_left}" Top="{up_outer_top}" Width="{up_outer_width}" Height="{up_outer_height}" />
<IOContorl ID="{down_inner_id}" IOName="{down_inner_io_name}" IOCommand="{down_inner_io_command}" ControlType="IconButton" Icon="{down_inner_icon}" IconHeight="{down_inner_icon_height}" IconWidth="{down_inner_icon_width}" IOEnable="{down_inner_enable}" IOState="{down_inner_state}" Value="{down_inner_value}" Left="{down_inner_left}" Top="{down_inner_top}" Width="{down_inner_width}" Height="{down_inner_height}" />
<IOContorl ID="{down_outer_id}" IOName="{down_outer_io_name}" IOCommand="{down_outer_io_command}" ControlType="IconButton" Icon="{down_outer_icon}" IconHeight="{down_outer_icon_height}" IconWidth="{down_outer_icon_width}" IOEnable="{down_outer_enable}" IOState="{down_outer_state}" Value="{down_outer_value}" Left="{down_outer_left}" Top="{down_outer_top}" Width="{down_outer_width}" Height="{down_outer_height}" />
<IOContorl ID="{left_inner_id}" IOName="{left_inner_io_name}" IOCommand="{left_inner_io_command}" ControlType="IconButton" Icon="{left_inner_icon}" IconHeight="{left_inner_icon_height}" IconWidth="{left_inner_icon_width}" IOEnable="{left_inner_enable}" IOState="{left_inner_state}" Value="{left_inner_value}" Left="{left_inner_left}" Top="{left_inner_top}" Width="{left_inner_width}" Height="{left_inner_height}" />
<IOContorl ID="{left_outer_id}" IOName="{left_outer_io_name}" IOCommand="{left_outer_io_command}" ControlType="IconButton" Icon="{left_outer_icon}" IconHeight="{left_outer_icon_height}" IconWidth="{left_outer_icon_width}" IOEnable="{left_outer_enable}" IOState="{left_outer_state}" Value="{left_outer_value}" Left="{left_outer_left}" Top="{left_outer_top}" Width="{left_outer_width}" Height="{left_outer_height}" />
<IOContorl ID="{right_inner_id}" IOName="{right_inner_io_name}" IOCommand="{right_inner_io_command}" ControlType="IconButton" Icon="{right_inner_icon}" IconHeight="{right_inner_icon_height}" IconWidth="{right_inner_icon_width}" IOEnable="{right_inner_enable}" IOState="{right_inner_state}" Value="{right_inner_value}" Left="{right_inner_left}" Top="{right_inner_top}" Width="{right_inner_width}" Height="{right_inner_height}" />
<IOContorl ID="{right_outer_id}" IOName="{right_outer_io_name}" IOCommand="{right_outer_io_command}" ControlType="IconButton" Icon="{right_outer_icon}" IconHeight="{right_outer_icon_height}" IconWidth="{right_outer_icon_width}" IOEnable="{right_outer_enable}" IOState="{right_outer_state}" Value="{right_outer_value}" Left="{right_outer_left}" Top="{right_outer_top}" Width="{right_outer_width}" Height="{right_outer_height}" />
<IOContorl ID="{scan_id}" ControlType="TextBlock" Value="{scan_text}" Left="{scan_left}" Top="{scan_top}" Width="NaN" Height="40" />
```

槽位绑定规则：以八个候选按钮组整体包围盒的中心为基准，按钮中心落在主轴方向决定 up/down/left/right，到中心的距离决定 inner（近）/outer（远）；同一方向距离更近的一组记为 inner。八个按钮的图标、文案、业务字段/动作、状态、位置和尺寸从各自 MasterGo 节点读取。

按钮的 `Left/Top/Width/Height` 必须读取各自按钮外层节点 bbox；内部图标组只提供 Icon 来源和图标尺寸（IconWidth/IconHeight 取台账命中条目节点 bbox），不得用图标 bbox 代替按钮尺寸。即使同一方向内外两个按钮在设计稿中使用同一个图形（几何完全相同），也必须分别绑定各自实例的图标来源；设计侧缺少独立图形时保留按钮节点与 provenance，标记待设计补图，不得自行镜像或猜测朝向。SCAN 为可选取槽位，当前实例没有该 TEXT 节点时不生成，也不得补齐。实例文本、图标和坐标均从当前实例的真实父子链读取。

### 固定模板：属性 1=方向

固定节点：四个 IconButton IOContorl；ControlType 固定为 IconButton，Style 属性省略；每个按钮包含两个图标槽位，按钮顺序和父子关系固定。

```xml
<IOContorl ID="{up_pair_id}" IOName="{up_pair_io_name}" IOCommand="{up_pair_io_command}" ControlType="IconButton" Icon="{up_pair_icon}" IconHeight="{up_pair_icon_height}" IconWidth="{up_pair_icon_width}" IOEnable="{up_pair_enable}" IOState="{up_pair_state}" Value="{up_pair_value}" Left="{up_pair_left}" Top="{up_pair_top}" Width="{up_pair_width}" Height="{up_pair_height}" />
<IOContorl ID="{down_pair_id}" IOName="{down_pair_io_name}" IOCommand="{down_pair_io_command}" ControlType="IconButton" Icon="{down_pair_icon}" IconHeight="{down_pair_icon_height}" IconWidth="{down_pair_icon_width}" IOEnable="{down_pair_enable}" IOState="{down_pair_state}" Value="{down_pair_value}" Left="{down_pair_left}" Top="{down_pair_top}" Width="{down_pair_width}" Height="{down_pair_height}" />
<IOContorl ID="{vertical_pair_id}" IOName="{vertical_pair_io_name}" IOCommand="{vertical_pair_io_command}" ControlType="IconButton" Icon="{vertical_pair_icon}" IconHeight="{vertical_pair_icon_height}" IconWidth="{vertical_pair_icon_width}" IOEnable="{vertical_pair_enable}" IOState="{vertical_pair_state}" Value="{vertical_pair_value}" Left="{vertical_pair_left}" Top="{vertical_pair_top}" Width="{vertical_pair_width}" Height="{vertical_pair_height}" />
<IOContorl ID="{horizontal_pair_id}" IOName="{horizontal_pair_io_name}" IOCommand="{horizontal_pair_io_command}" ControlType="IconButton" Icon="{horizontal_pair_icon}" IconHeight="{horizontal_pair_icon_height}" IconWidth="{horizontal_pair_icon_width}" IOEnable="{horizontal_pair_enable}" IOState="{horizontal_pair_state}" Value="{horizontal_pair_value}" Left="{horizontal_pair_left}" Top="{horizontal_pair_top}" Width="{horizontal_pair_width}" Height="{horizontal_pair_height}" />
```

四个按钮分别对应真实的方向图标槽位；图标、业务字段/动作、状态、文案、位置和尺寸逐节点读取。没有真实 Value 或可选字段时删除对应属性。

### 固定模板：属性 1=图像移动-单侧

固定节点：四个 IconButton IOContorl；ControlType 固定为 IconButton，Style 属性省略；按钮顺序和父子关系固定。

```xml
<IOContorl ID="{up_id}" IOName="{up_io_name}" IOCommand="{up_io_command}" ControlType="IconButton" Icon="{up_icon}" IconHeight="{up_icon_height}" IconWidth="{up_icon_width}" IOEnable="{up_enable}" IOState="{up_state}" Value="{up_value}" Left="{up_left}" Top="{up_top}" Width="{up_width}" Height="{up_height}" />
<IOContorl ID="{left_id}" IOName="{left_io_name}" IOCommand="{left_io_command}" ControlType="IconButton" Icon="{left_icon}" IconHeight="{left_icon_height}" IconWidth="{left_icon_width}" IOEnable="{left_enable}" IOState="{left_state}" Value="{left_value}" Left="{left_left}" Top="{left_top}" Width="{left_width}" Height="{left_height}" />
<IOContorl ID="{right_id}" IOName="{right_io_name}" IOCommand="{right_io_command}" ControlType="IconButton" Icon="{right_icon}" IconHeight="{right_icon_height}" IconWidth="{right_icon_width}" IOEnable="{right_enable}" IOState="{right_state}" Value="{right_value}" Left="{right_left}" Top="{right_top}" Width="{right_width}" Height="{right_height}" />
<IOContorl ID="{down_id}" IOName="{down_io_name}" IOCommand="{down_io_command}" ControlType="IconButton" Icon="{down_icon}" IconHeight="{down_icon_height}" IconWidth="{down_icon_width}" IOEnable="{down_enable}" IOState="{down_state}" Value="{down_value}" Left="{down_left}" Top="{down_top}" Width="{down_width}" Height="{down_height}" />
```

四个方向按钮的图标、业务字段/动作、状态、文案、位置和尺寸逐节点读取；MasterGo 未提供的可选属性字段缺失时保留对应 XML 属性并输出空字符串值。

该规则对应组件集=图像移动-单侧、属性 1=图像移动-单侧。固定真实子节点名称为：`按钮-指向上`（外层组 1504，Icon 来源组 1521）、`按钮-指向左`（外层组 1524，Icon 来源组 1525）、`按钮-指向右`（外层组 1526，Icon 来源组 1527）、`按钮-指向下`（外层组 2526，Icon 来源组 1523）。四个按钮的 Width/Height 必须读取当前项目页面实例的各自外层按钮 bbox；内部图标组只用于 Icon，不得用于按钮尺寸。该组件没有独立文本槽位。

### 固定模板：属性 1=图像移动-双侧

固定节点：四个 IconButton IOContorl；ControlType 固定为 IconButton，Style 属性省略；每个按钮的双图标槽位、顺序和父子关系固定。

```xml
<IOContorl ID="{first_id}" IOName="{first_io_name}" IOCommand="{first_io_command}" ControlType="IconButton" Icon="{first_icon}" IconHeight="{first_icon_height}" IconWidth="{first_icon_width}" IOEnable="{first_enable}" IOState="{first_state}" Value="{first_value}" Left="{first_left}" Top="{first_top}" Width="{first_width}" Height="{first_height}" />
<IOContorl ID="{second_id}" IOName="{second_io_name}" IOCommand="{second_io_command}" ControlType="IconButton" Icon="{second_icon}" IconHeight="{second_icon_height}" IconWidth="{second_icon_width}" IOEnable="{second_enable}" IOState="{second_state}" Value="{second_value}" Left="{second_left}" Top="{second_top}" Width="{second_width}" Height="{second_height}" />
<IOContorl ID="{third_id}" IOName="{third_io_name}" IOCommand="{third_io_command}" ControlType="IconButton" Icon="{third_icon}" IconHeight="{third_icon_height}" IconWidth="{third_icon_width}" IOEnable="{third_enable}" IOState="{third_state}" Value="{third_value}" Left="{third_left}" Top="{third_top}" Width="{third_width}" Height="{third_height}" />
<IOContorl ID="{fourth_id}" IOName="{fourth_io_name}" IOCommand="{fourth_io_command}" ControlType="IconButton" Icon="{fourth_icon}" IconHeight="{fourth_icon_height}" IconWidth="{fourth_icon_width}" IOEnable="{fourth_enable}" IOState="{fourth_state}" Value="{fourth_value}" Left="{fourth_left}" Top="{fourth_top}" Width="{fourth_width}" Height="{fourth_height}" />
```

四个按钮的双图标槽位、业务字段/动作、状态、文案、位置和尺寸逐节点读取；未提供的可选属性字段缺失时保留对应 XML 属性并输出空字符串值。

该规则对应属性 1=图像移动-双侧。固定真实子节点名称和顺序为：`横按钮-指向外`、`竖按钮-指向外`、`竖按钮-指向内`、`横按钮-指向内`。四个按钮的 Width/Height 必须读取当前项目页面实例的各自外层按钮 bbox；每个按钮的两个 Icon 槽位均来自其内部组 1525。内部图标组 bbox 不得替代按钮外层 bbox，组件没有独立文本槽位。

### 固定模板：属性 1=缺口位置

固定节点：两个 IconButton IOContorl；ControlType 固定为 IconButton，Style 属性省略；左右按钮槽位顺序和父子关系固定。

```xml
<IOContorl ID="{left_id}" IOName="{left_io_name}" IOCommand="{left_io_command}" ControlType="IconButton" Icon="{left_icon}" IconHeight="{left_icon_height}" IconWidth="{left_icon_width}" IOEnable="{left_enable}" IOState="{left_state}" Value="{left_value}" Left="{left_left}" Top="{left_top}" Width="{left_width}" Height="{left_height}" />
<IOContorl ID="{right_id}" IOName="{right_io_name}" IOCommand="{right_io_command}" ControlType="IconButton" Icon="{right_icon}" IconHeight="{right_icon_height}" IconWidth="{right_icon_width}" IOEnable="{right_enable}" IOState="{right_state}" Value="{right_value}" Left="{right_left}" Top="{right_top}" Width="{right_width}" Height="{right_height}" />
```

左右按钮图标、业务字段/动作、状态、文案、位置和尺寸逐节点读取；未提供的可选属性字段缺失时保留对应 XML 属性并输出空字符串值。

该规则对应组件集=缺口位置、属性 1=缺口位置。固定真实子节点名称为：`按钮-指向左`（外层组 1524，Icon 来源组 1525）和 `按钮-指向右`（外层组 1526，Icon 来源组 1527）。两个按钮的外层 Width/Height 必须读取当前项目页面实例的真实按钮 bbox；组 1525/1527 只提供 Icon 来源，不得替代按钮尺寸。该组件没有独立文本槽位。

### 固定模板：属性 1=拟合数据-双侧上下

固定节点：两个 IconButton IOContorl；ControlType 固定为 IconButton，Style 属性省略；每个按钮为双图标槽位，按钮顺序和父子关系固定。

```xml
<IOContorl ID="{first_id}" IOName="{first_io_name}" IOCommand="{first_io_command}" ControlType="IconButton" Icon="{first_icon}" IconHeight="{first_icon_height}" IconWidth="{first_icon_width}" IOEnable="{first_enable}" IOState="{first_state}" Value="{first_value}" Left="{first_left}" Top="{first_top}" Width="{first_width}" Height="{first_height}" />
<IOContorl ID="{second_id}" IOName="{second_io_name}" IOCommand="{second_io_command}" ControlType="IconButton" Icon="{second_icon}" IconHeight="{second_icon_height}" IconWidth="{second_icon_width}" IOEnable="{second_enable}" IOState="{second_state}" Value="{second_value}" Left="{second_left}" Top="{second_top}" Width="{second_width}" Height="{second_height}" />
```

两个按钮的双图标槽位、业务字段/动作、状态、文案、位置和尺寸逐节点读取；未提供的可选属性字段缺失时保留对应 XML 属性并输出空字符串值。

该规则对应属性 1=拟合数据-双侧上下。两个真实子节点名称均为 `按钮`，按父节点链和组件内顺序区分第一、第二按钮。两个按钮的 Width/Height 必须读取当前项目页面实例的各自外层按钮 bbox；左按钮的双图标均来自组 1525，右按钮的双图标均来自组 1525。不能拆成独立按钮，也不能使用内部图标 bbox 代替按钮尺寸。该组件没有独立文本槽位。

### 固定模板：属性 1=拟合数据-前后

固定节点：两个 IconButton IOContorl；ControlType 固定为 IconButton，Style 属性省略；前后按钮顺序和父子关系固定。

```xml
<IOContorl ID="{front_id}" IOName="{front_io_name}" IOCommand="{front_io_command}" ControlType="IconButton" Icon="{front_icon}" IconHeight="{front_icon_height}" IconWidth="{front_icon_width}" IOEnable="{front_enable}" IOState="{front_state}" Value="{front_value}" Left="{front_left}" Top="{front_top}" Width="{front_width}" Height="{front_height}" />
<IOContorl ID="{back_id}" IOName="{back_io_name}" IOCommand="{back_io_command}" ControlType="IconButton" Icon="{back_icon}" IconHeight="{back_icon_height}" IconWidth="{back_icon_width}" IOEnable="{back_enable}" IOState="{back_state}" Value="{back_value}" Left="{back_left}" Top="{back_top}" Width="{back_width}" Height="{back_height}" />
```

前后按钮图标、业务字段/动作、状态、文案、位置和尺寸逐节点读取；未提供的可选属性字段缺失时保留对应 XML 属性并输出空字符串值。

该规则对应属性 1=拟合数据-前后。固定子节点名称必须按组件真实名称匹配：`按钮-指向左` 的外层按钮节点使用其实际 bbox，Icon 来源为内部组 1525；`按钮-指向右` 的外层按钮节点使用其实际 bbox，Icon 来源为内部组 1527。这里的“指向左/指向右”是组件子节点的正式名称，不只是语义方向别名。

### 固定模板：属性 1=拟合数据-单侧上下

固定节点：两个 IconButton IOContorl；ControlType 固定为 IconButton，Style 属性省略；上下按钮顺序和父子关系固定。

```xml
<IOContorl ID="{up_id}" IOName="{up_io_name}" IOCommand="{up_io_command}" ControlType="IconButton" Icon="{up_icon}" IconHeight="{up_icon_height}" IconWidth="{up_icon_width}" IOEnable="{up_enable}" IOState="{up_state}" Value="{up_value}" Left="{up_left}" Top="{up_top}" Width="{up_width}" Height="{up_height}" />
<IOContorl ID="{down_id}" IOName="{down_io_name}" IOCommand="{down_io_command}" ControlType="IconButton" Icon="{down_icon}" IconHeight="{down_icon_height}" IconWidth="{down_icon_width}" IOEnable="{down_enable}" IOState="{down_state}" Value="{down_value}" Left="{down_left}" Top="{down_top}" Width="{down_width}" Height="{down_height}" />
```

上下按钮图标、业务字段/动作、状态、文案、位置和尺寸逐节点读取；未提供的可选属性字段缺失时保留对应 XML 属性并输出空字符串值。

### 固定模板：属性 1=扫描

固定节点：一个 TextBlock IOContorl 和两个 IconButton IOContorl；文本与按钮的槽位顺序和父子关系固定，按钮 ControlType 固定为 IconButton，Style 属性省略，文本 ControlType 固定为 TextBlock。

```xml
<IOContorl ID="{scan_title_id}" ControlType="TextBlock" Value="{scan_title}" Left="{scan_title_left}" Top="{scan_title_top}" Width="NaN" Height="40" />
<IOContorl ID="{left_id}" IOName="{left_io_name}" IOCommand="{left_io_command}" ControlType="IconButton" Icon="{left_icon}" IconHeight="{left_icon_height}" IconWidth="{left_icon_width}" IOEnable="{left_enable}" IOState="{left_state}" Value="{left_value}" Left="{left_left}" Top="{left_top}" Width="{left_width}" Height="{left_height}" />
<IOContorl ID="{right_id}" IOName="{right_io_name}" IOCommand="{right_io_command}" ControlType="IconButton" Icon="{right_icon}" IconHeight="{right_icon_height}" IconWidth="{right_icon_width}" IOEnable="{right_enable}" IOState="{right_state}" Value="{right_value}" Left="{right_left}" Top="{right_top}" Width="{right_width}" Height="{right_height}" />
```

扫描文本节点填入 TextBlock.Value；左右按钮图标、业务字段/动作、状态、文案、位置和尺寸逐节点读取。MasterGo 未提供的可选属性字段缺失时保留对应 XML 属性并输出空字符串值。

该规则对应属性 1=扫描。固定真实子节点名称为：TEXT `扫描` 单独生成 TextBlock；`按钮-指向左` 的外层按钮 Width/Height 读取当前实例 bbox，Icon 来源为组 1525；`按钮-指向右` 的外层按钮 Width/Height 读取当前实例 bbox，Icon 来源为组 1528。按钮 Icon 组不代替按钮尺寸，按钮没有独立文案 Value。

## 组件集=主菜单button：IconButton 映射关系

### 匹配规则

- 独立组件集名称=主菜单button；使用公开属性名“属性 1”及其真实属性值匹配，不使用组件集 ID、实例 ID 或图层名称作为匹配键。
- 属性 1=主菜单button 命中完整主菜单按钮模板；属性 1=主菜单button-文字 命中文本主菜单按钮模板。
- 组件实例的公开属性“显示F”控制 F 文本槽位，“显示icon”控制图标槽位；属性关闭时不生成对应槽位，也不把隐藏槽位单独输出为 TextBlock。

### 固定模板：属性 1=主菜单button

固定节点：一个 IconButton IOContorl；ControlType 固定为 IconButton，Style 固定为 MainButtonStyle。按钮文案固定写入 Value；显示F打开时，F 文本写入 TopLeftContent；显示icon打开时，图标写入 Icon。三个槽位都从当前实例的真实子节点读取，不能把组件内部槽位文本再独立生成一个 TextBlock。

```xml
<IOContorl ID="{id}" ControlType="IconButton" Style="MainButtonStyle" Icon="{icon}" IconWidth="{icon_width}" IconHeight="{icon_height}" PageName="{page_name}" TopLeftContent="{top_left_content}" Value="{value}" IOName="{io_name}" IOCommand="{io_command}" IOEnable="{io_enable}" IOState="{io_state}" IOVisible="{io_visible}" LangName="{lang_name}" Left="{left}" Top="{top}" Width="{width}" Height="{height}" />
```

按钮文案→Value；F 文本→TopLeftContent；图标 PATH/SVG→Icon；图标尺寸→IconWidth/IconHeight（取台账命中条目节点 bbox）；跳转目标→PageName（`Jump:{target}`）。位置、尺寸和字体事实从当前实例对应节点读取。显示F关闭时 TopLeftContent 输出空字符串；显示icon关闭时 Icon、IconWidth、IconHeight 输出空字符串（固定字段仍发射）。PageName、IOVisible、IOCommand、IOEnable 按“按钮族固定参数”一节恒写；其余必写字段没有可靠来源时输出空字符串值。

### 固定模板：属性 1=主菜单button-文字

固定节点：一个 IconButton IOContorl；ControlType 固定为 IconButton，Style 固定为 MainButtonStyle；只有文案槽位：文案写入 Value，Icon 与 TopLeftContent 仍按固定字段发射并输出空字符串值。

```xml
<IOContorl ID="{id}" ControlType="IconButton" Style="MainButtonStyle" PageName="{page_name}" Value="{value}" IOName="{io_name}" IOCommand="{io_command}" IOEnable="{io_enable}" IOState="{io_state}" IOVisible="{io_visible}" LangName="{lang_name}" Left="{left}" Top="{top}" Width="{width}" Height="{height}" />
```

文案→Value；跳转目标→PageName（`Jump:{target}`）；位置、尺寸和字体事实从当前实例的固定文本节点读取。该变体没有图标和 F 键槽位：Icon、IconWidth、IconHeight、TopLeftContent 仍按固定字段发射并输出空字符串值；PageName、IOVisible、IOCommand、IOEnable 按“按钮族固定参数”一节恒写，其余必写字段没有可靠来源时输出空字符串值。

# MasterGo 组件集：Table → MTSLG 映射关系

### 匹配规则

- 本族真值源：映射表 `tableTemplates`（`match.structural` 结构签名、`columnTemplate` 列定义模板、`columnControlTypePolicy` 列类型判定、`rowPolicy`/`innerTextPolicy` 行内容处置、`valuePolicy` 数据源策略）。
- 本族**只登记结构签名一条命中路径**：映射表里没有 `match.property`、没有 `componentSet`（团队组件库当前也没有 Table 组件集）。组件集 ID、实例 ID 与图层重命名只作来源追踪，不参与唯一匹配；将来若组件库正式发布 Table 组件集，再按「组件集名 + 公开属性」登记第二条路径，并在本节补写。
- **表格在团队组件库里通常没有组件集**（设计稿里只是一个 `GROUP`），因此本族按**结构签名**命中：节点类型 `GROUP` + 图层名以「表格」结尾 + 孩子里含名为「表头」的群组 + 至少一个名为 `item` 的行群组 + 表头至少有 `signature.minHeaderTexts` 条可见文本，**五项同时成立**才算命中。结构签名是主判据、图层名后缀是交叉核对项：**部分命中**（后缀或签名之一成立）时登记 `pending` 并写明是哪一半不成立（既不静默套模板，也不假装已识别），两项都不成立的普通 `GROUP` 不属于候选。这是本插件对「图层名称只用于核对、不参与匹配」登记的第二个例外（另一个是底部栏按组件名匹配）。
- 父节点、子节点关系和表格列顺序按 MasterGo 实际结构读取；若父节点明确是 TabControl，则外层按 TabControl/TabItem 规则处理，Table 子节点仍只映射为 DataGrid。
- 根节点 `Value` **恒写、不省略**，当前阶段**固定写空串 `Value=""`**：本阶段不要求去找数据文件名，数据源由工程师或运行时后续绑定；不得编造文件名，也不得因为空串把该控件判成未完成。空串必须同时带映射 `tableAudits[].valuePending=true` 与 Bundle 审计 `tables[].valuePending=true` 作为待绑定提示（提示性审计字段，不是交付门禁）；工程师绑定真实文件名后置 `valuePending=false`。
- **列 = 表头可见文本**（从左到右），行 = PageData 数据：行不发射控件，只按行登记进 `tableAudits[].rows`（行标题 / 单位 / 每格原文与类型都留档）。
- **列子节点是列结构，不是页面控件**：几何按下方 `columnTemplate` 固定发射（`Left=0` / `Top=0` / `Height=45`、不写 `Width`），属性只发射 `Value` + 恒写 `IOName` 空占位，**不套** `controlTypeRequiredAttrs`（那是页面控件的字段集）。列 `ControlType` 由该列各行单元格类型**严格多数**（> 50%）判定，没有严格多数时退化为 `TextBlock`；每列的类型分布记进 `tableAudits[].columns` 供复核。
- 表格内文本的处置：表头文本承载列 `Value`（`valueSource=dsl.text`，`decision=emit`）；行内文本（行标题 / 单位 / 单元格文本，含输入框实例内部的固定文本）一律 `decision=omit` + `role=table-data-cell`，避免泄漏成根级 TextBlock。
- 表格图层声明尺寸覆盖不了自身内容范围（GROUP 常见：加行后没跟着改尺寸）时，节点几何仍按设计稿 bbox 直传，同时把 `tableAudits[].geometry.declaredBoxCoversContent=false` 与两个 bbox 一起报出来，交设计侧修正。

### 固定模板：组件集=Table

固定节点：一个 DataGrid IOContorl 作为根节点，下面挂按表头展开的列定义子节点；根节点 ControlType 固定为 DataGrid，父子关系和列顺序固定（列顺序 = 表头文本从左到右）。

```xml
<IOContorl ID="{id_table}" ControlType="DataGrid" IOName="" IOVisible="" IOEnable="" Value="" Left="{table_left}" Top="{table_top}" Width="{table_width}" Height="{table_height}">
<IOContorl ID="{id_column_1}" ControlType="{column_1_control_type}" Value="{column_1_header}" IOName="" Left="0" Top="0" Height="45" />
<IOContorl ID="{id_column_2}" ControlType="{column_2_control_type}" Value="{column_2_header}" IOName="" Left="0" Top="0" Height="45" />
<!-- 按表头文本从左到右继续展开列定义子节点 -->
</IOContorl>
```

字段来源：根节点 Value→**当前阶段固定空串**（数据源由工程师或运行时后续绑定，禁止编造文件名）；业务字段/表标识→IOName；加载、刷新或选中动作→IOCommand；可用条件→IOEnable；自动刷新→IsAutoRefresh；根节点位置和尺寸→表格图层 bbox；列节点位置尺寸→映射表 `columnTemplate` 固定值。Style 只填 MasterGo 节点实际提供且代码库已登记的样式。

列节点按表头展开：**列数 = 表头可见文本数**，列标题→子节点 Value（必须回溯到该表头文本的 layerId/ref），列业务字段→子节点 IOName（设计无来源写空串），列控件类型按该列单元格类型严格多数判定（`TextBlock` / `NumberBox` / `IntNumberBox` / `TextBox` 等已登记类型；没有多数退化为 `TextBlock`）。列控件类型不是加载器必填契约，但必须由单元格机械判定并把分布写进 `tableAudits[].columns`，不得凭外观猜。**本族不为列发射 `IOVisible`**（表头文本没有「是否主键」这类信息，没有可靠来源）；确实需要隐藏列时，先在映射表 `columnTemplate` 登记来源判据与发射口径，再四处人读文档同步。

# 固定字段与可选字段规则

- **必写字段与按钮族固定参数（IconButton / Button / StatusButton）**：每个 ControlType 的固定必写字段集登记在 `mtslg-iocontrol-map.json` 的 `controlTypeRequiredAttrs`，生成器必须发射这些属性，取不到来源时写**空字符串占位**。按钮族在此基础上恒写 `PageName`、`IOVisible`、`IOCommand`、`IOEnable`（**变体登记 `omitRequiredAttrs` 时该变体做减法：登记的属性不发射，生成器与校验器共用 `omittedAttrs()` 判据（见飞书组件库映射规范「组件级固定变体的公共口径」）**）；`IconButton` 模板含 `Icon`/`IconWidth`/`IconHeight`：有图标槽位时机械取**台账命中条目节点的 bbox**（不是控件宽高，也不是图标容器尺寸）四舍五入取整，无图标槽位时这三项写空字符串；`Button`/`StatusButton` 模板不含图标字段，不发射 `Icon`/`IconWidth`/`IconHeight`。映射带 `Icon` 却缺少 `iconSize` 时生成器直接失败，禁止猜尺寸。`LangName` 是另一个例外：只在多语言绑定层给出真实 key 时发射——`noLangRefs` 豁免的不需要翻译文本（中英文写法完全相同的文本，以及运行时动态值）、以及槽位登记 `langRefPolicy=none` 的值（选择框 `Value`）都不写空占位。
- 固定：ControlType、节点数量、父子关系、槽位顺序。
- 几何/显示字段：Value、Left、Top、Width、Height、FontSize、FontWeight、字体/颜色/Style；其中 DSL 提供字体样式时 FontSize 必填，Height 与 FontSize 独立取值；`FontWeight` 是**命中才写**的条件属性（设计稿字重非 normal 时发射，值取设计稿 `styles[...].value.style` 的 `fontStyle`，如 `Bold`；**判定顺序固定为两步：先看样式名，命中映射表 `textBlockFontWeight.normalStyleNames` 即判为 normal、不写；只有样式名取不到时才回退用 `normalValues` 按 `weight` 判定**），不参与 `controlTypeRequiredAttrs` 恒写集合，规则以 `mtslg-mode.md` 的 TextBlock 字体规则与映射表 `textBlockFontWeight` 为准；MTSLG TextBlock 的 Height 固定为 40、**Width 固定为 `NaN`（自适应，不使用文本 bbox 宽度）**；输入框和选择框外框的 Height 按 MasterGo 的 40/36/32/28 变体处理；Height 与 FontSize 必须分别读取。一般显示型子节点缺少 Value 时控件仍会生成，但文字内容为空；**DataGrid 根节点例外：`Value` 恒写、当前阶段固定写空串 `Value=""`（数据源由工程师或运行时后续绑定，禁止编造文件名），并置 `valuePending=true` 作为待绑定提示（提示性审计字段，不是交付门禁；规则见 `mtslg-mode.md` 第 4.1 节「DataGrid 的命中口径与 Value 现阶段口径」与映射表 `valuePolicy`）**。列子节点是**列定义**不是页面控件：`Value` 一律等于该列表头文本（由表头机械展开，不是「可选字段」），列几何与字段集走 `tableTemplates.columnTemplate`，不套用本条页面控件字段集。Style 只有 MasterGo 明确提供且代码库存在对应资源键时才填写。只有当 MasterGo 层级明确存在父级容器并且该父级有样式选择器时，才由父级为子控件提供样式；不得根据外观或组件名称自行添加父级容器。
- 运行时：IOName、IOCommand、PageName、IOEnable、IOState、LangName。
- ID 按 MX_GUID/Pin 规则生成，不复制 MasterGo layer ID。

# 通用转码规则（适用于所有组件和页面）

## 文本属性固定映射

```
<IOContorl ID="{id_text}" IOName="{io_name_text}" ControlType="TextBlock" IOState="{state_text}" IOEnable="{enable_text}" LangName="{lang_name_text}" Value="{text_value}" Left="{left}" Top="{top}" Width="NaN" Height="40" FontSize="{font_size}" />
```

- 独立文本节点统一映射为 `TextBlock`，不因所在组件或变体改变 ControlType。
- 如果文本是输入框、选择框等控件内部内容，则保留为所属控件内容，不额外拆分为 TextBlock。
- 文本的 Value、FontSize、FontWeight 和坐标必须来自对应 MasterGo 节点；所有 MTSLG TextBlock 的 Height 固定为 40、Width 固定为 `NaN`，不能用外层组件高度、文字 bbox、组件语义或文本 bbox 宽度改写这两个值（文本 bbox 宽度只作为 `dslWidth` 来源记录在 mapping 中）。
- 独立的标题、单位、说明文字和其他文本节点，统一映射为 `ControlType="TextBlock"`；如果文字是输入框、选择框等控件内部内容，则保留为所属控件内容，不额外拆分。
- FontSize 只表示字体字号，Height 只表示控件布局边界；两者必须分别读取。所有 MTSLG TextBlock 使用固定 Height=40，禁止把外层组件高度、文字 bbox、字号或行高赋给 Height。
- 每个输出控件的 Left、Top 必须来自自身 MasterGo bbox，非 TextBlock 控件的 Width/Height 也来自自身 bbox；TextBlock 的 Width/Height 按固定规则发射（`Width="NaN"`、`Height="40"`）；输入框和选择框外框的 Height 按已命中的 40/36/32/28 变体处理；固定模板、相邻控件或父容器不能代替真实尺寸。
- 最终坐标统一按内容区绝对坐标计算：`Left = pageAbsX - contentOriginX`，`Top = pageAbsY - 192`。公共外壳偏移只扣除一次；父子关系只用于确认真实结构和裁剪边界。
- 组件映射文档只登记组件集、变体、ControlType 和固定结构；具体节点来源、尺寸、字体和坐标由 AI 转码规则逐节点核对。

## 文本换行固定口径

```
设计换行（U+2028 行分隔符 / U+2029 段分隔符 / CR(U+000D) / LF(U+000A) / CRLF）→ 统一归一成 LF（U+000A）
页面 XML 属性（Value / Header / MenuItem Name / TopLeftContent …）→ 写字符引用 &#x0a;
页面语言字典值（{页面名}_{LOCALE}.xaml）→ 同样写 &#x0a;
```

- 设计稿**单个文本 run 内部**的换行以 `U+2028`（行分隔符）编码，必须归一成 LF 后按框架写法发射；**XML 属性里不能出现字面换行**（解析器会把它归一成空格），因此一律写 `&#x0a;`——框架自己的 XAML 也是这个写法（例：`Content="Back&#x0a;Tab"`、`Content="Back&#x0a;Space"`）。
- **同一行内不同字体的多个 text run 是 `text` 数组的多项，按空串拼接，不是换行**；只有单个 run 内部的换行码点才算换行。
- 页面语言字典是运行时按 `LangName` 取文案的载体，字典值必须与设计稿换行一致（写 `&#x0a;`）；把换行压成空格会让两行文案在运行时退化成一行，属于缺陷。
- **空白处理分三条用途（同一文案因此有三种字符串形态，不要混用）**：① 页面 XML 属性文案只做换行归一、其余空白原样保留；② 字典值额外做「行内空白折叠成单个空格 → 换行两侧空白一并去掉 → 行首行尾 trim」（设计稿的左右留白是排版产物，字典值去掉它；`A␠␠\n␠␠B` → `A\nB`）——实现是 `scripts/lib/script-helpers.js` 的 `langValueText`；③ 键派生、译文查找、术语表匹配用「压平值」（所有空白折叠成单个空格并 trim）。
- 发射、校验、Bundle 与字典发射器共用同一实现（`scripts/lib/script-helpers.js` 的 `normalizeNewlines` / `langValueText` / `xmlAttr` / `xmlElementText` / `normalizeForCompare`）：页面 XML 的原始属性值与 mapping 文案比较时先解码字符引用、再归一换行，避免同一文案因写法不同被判成冲突。
- **实现真值源**是 `scripts/lib/script-helpers.js`（换行归一 `normalizeNewlines`、字典值变换 `langValueText`、属性/元素转义 `xmlAttr` / `xmlElementText`、比对归一 `normalizeForCompare` 的唯一实现），生成器、校验器、Bundle、字典发射器共用同一份，不允许各写一份；映射表 `textNewlinePolicy` 只**登记**同一口径（码点集合、归一目标、两种发射写法、字典值空白变换）供人读与回归断言比对，不是脚本的运行期输入。改口径时先改实现，再同步映射表登记块与**四份人读文档**：`skills/mastergo-to-wpf/SKILL.md`、`skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/mtslg-mode.md`、`skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/feishu-component-library-mapping.md`（本文档）、`skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/feishu-layout-mapping.md`。

# 页面生成总规则

1. 识别组件集及实例属性。
2. 按完整层级匹配唯一固定模板。
3. 按节点语义、顺序、坐标、尺寸、字体和间距填充字段。
4. 缺少业务字段保留空值并标记待配置；无模板则标记未映射，不静默替换。

# 转码专项规则：文本尺寸与顶部示例标题

**TextBlock 尺寸与字号：**FontSize 只表示字体字号，Height/Width 只表示控件布局边界，三者必须分别读取。所有 MTSLG TextBlock（标签、数值、单位和独立文本）固定使用 `Height="40"` 与 `Width="NaN"`（宽度自适应，不写文本 bbox 宽度；文本 bbox 宽度仅作为 `dslWidth` 记入 mapping 溯源）。输入框和选择框外框的 Height 仍按 40/36/32/28 变体处理，禁止把 FontSize、文字 bbox、外层组件高度或行高直接赋给 TextBlock Height。

**顶部示例标题：**位于页面根节点或展示外壳、仅用于组件展示/工件示教的最上方标题（例如“工件边缘示教（2.2.1.E）”）标记为 design-artifact-title，默认不生成到业务 XML。业务内容容器内部且运行时明确需要的标题才保留。

被剥离或保留的标题必须记录节点 ID 和原因，便于 XML 验证和追溯。

## 文本占位与省略门禁

- `_placeholder=true` 只表示该 TEXT 来自组件库占位来源，不能单独决定删除。
- `_placeholder=true` 且文本在当前页面中承担真实按钮文案、F 值、标签、数值、标题栏、组件内部标题或其他业务内容时，按真实可见属性生成；即使映射中保留 placeholder 标记，也必须生成。
- 页面文本只有在页面根级/工件级 `page-title`、DSL 明确标记为 hidden，或已被宿主结构边界剥离为 `host-shell` 时允许省略。省略必须在 `textAudit` 中记录 `decision=omit` 和原因。
- GroupBox Header、Tab/TabItem 标题、Table 列标题、组件内部标题不因名字包含“标题”而自动省略；它们按自身可见性和正式组件映射处理。
