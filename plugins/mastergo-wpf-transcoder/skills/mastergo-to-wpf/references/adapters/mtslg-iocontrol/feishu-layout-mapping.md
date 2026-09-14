# MasterGo 页面壳层 → MTSLG Layout.xml 映射标准

本文负责维护 MasterGo 顶部栏、底部栏和键盘提示到 MTSLG Layout.xml 的映射规则。

## 适用范围

- 顶部栏：映射到产品配置 Layout.xml 的全局 Header/HeaderItem。
- 底部栏：映射到具体页面 Page/Menu/MenuItem。
- 键盘提示：映射到 MenuItem.TopLeftContent，例如 F1、F2、F3。

## 底部按钮组件集结构映射

底部菜单按团队组件库中独立组件集“底部栏”的**组件名**及其真实子节点匹配（匹配键登记在模板表 `layoutRules.bottomBar.match`，见下文“匹配规则”）。业务页面中的底栏实例用于读取本次实例的文本、图标、键盘提示和排列顺序，也用于提供变体识别所需的组件名；图层 ID、设计坐标和显示文案不作为匹配键。

### 组件集：底部栏

#### 匹配规则

底部栏变体按模板表 `layoutRules.bottomBar.match` 登记的**一个**键判定（一族一个键，与组件模板族同一套机制）：`componentName: true` 表示**变体值 = 被引用组件的名字**（实例的 `name`）。实测底部栏实例的 `componentInfo.properties` 里没有变体信息（只有 `实例`/`显示icon`/`显示文案`/`显示F`，或为空），它们引用的是独立组件本体（名字即变体值，如 `非首页-长方形`、`首页-长方形`），因此底部栏与右栏独立组件族 `rightSidebarComponentTemplates`（`componentSet: true`）走同一条「按组件名匹配」的路。取到的值必须精确等于本节列出的一个变体值；未命中时不得生成 MenuItem，并计入 `layoutEvidence.unresolvedBottomBarItems`（非 0 时 `gen-mtslg-layout.js` 拒绝生成 Layout）。

#### 固定模板

一个页面底部栏对应一个 Page 下的一个 Menu；只有底部栏横排的命中变体实例生成 MenuItem。底部栏容器、右下角常驻分组（`右侧底部-常驻button`）以及分组内的全部子实例都不生成 MenuItem。

常驻分组内的实例数量登记在 `layoutEvidence.residentGroupItems`，与 `matchedBottomBarItems` 的换算关系为 `matchedBottomBarItems = menuItems.length + residentGroupItems`；生成脚本会按此校验并在 `menuItems` 里出现常驻分组实例时直接失败。Index 按底部栏的视觉排列顺序取值（从 1 起）、保留常驻分组留下的空档，不重排后续编号。**未命中变体的实例**（既非装饰、又不在常驻分组、也没按 `layoutRules.bottomBar.match` 命中变体）计入 `layoutEvidence.unresolvedBottomBarItems`，非 0 时拒绝生成——不允许静默丢按钮。

```xml
<Page Target="{target}" LangName="{page_lang_name}">
  <Menu>
    <!-- 每个底部栏横排命中变体实例生成一个 MenuItem（右下角常驻分组除外） -->
  </Menu>
</Page>
```

新建页面时，Index 取当前页面底部栏中该实例的实际排列顺序，**从 1 起**（第 1 个按钮 = 1，按底部栏的视觉排列顺序，含没有生成 MenuItem 的按钮）；不生成 MenuItem 的按钮（如右下角常驻分组）在 Index 上保留空档，不重排后续编号。例如底部栏第 1~5 个按钮生成 MenuItem、第 6~7 个是常驻分组不生成、第 8~12 个再生成，则 Index 为 `1,2,3,4,5,8,9,10,11,12`。不写入 Left、Top、Width、Height。增量修改已有 Layout 时，已有页面和已有 MenuItem 的 Index 原样保留，不用设计稿顺序覆盖。固定模板已经声明的 `PageName`、`IOEnable`、`UserRightId` 等可选属性，目标项目未提供时保留属性并输出空字符串；当前变体没有声明的属性不新增。

**MenuItem 常驻属性（恒写）**：`LangName`、`PageName`、`IOCommand`、`IOVisible`、`IOEnable` 与页面 XML 按钮族的 `PageName` / `IOVisible` / `IOCommand` / `IOEnable` 同一策略——无论变体是否声明、来源是否取到，都写出该属性；没有可靠来源时写空字符串占位，不允许因为"没取到"而丢字段。`Value` 不写（菜单文本只放在 `Name`）。常驻集合的真值源是 `mtslg-iocontrol-map.json` 的 `layoutRules.bottomBar.menuItemAlwaysWrittenAttrs`；需要额外追加时用 manifest 的 `menuItemAlwaysAttrs`（例如 `["UserRightId"]`）扩展。

**MenuItem 图标尺寸**：与页面 XML 按钮族同一规则——有 `Icon` 就必须有 `iconSize`（图标图形节点 bbox），发射时四舍五入写 `IconWidth` / `IconHeight`；没有图标槽位时不写 `Icon` / `IconWidth` / `IconHeight`；带 `Icon` 却没有 `iconSize` 直接失败，禁止猜尺寸。

**MenuItem 设计稿标记（命中才写，不是常驻字段）**：

1. **红字文案 → `IsNeedRedMark="true"`**：菜单项文案 TEXT 的颜色属于红色系（实测设计稿取值 `#F8274B`；判定 R≥180 且 G≤100 且 B≤100，颜色取 TEXT 的 `_color`，取不到时回退 `fill` → styles 的值）。
2. **左上角状态方框 → `IsShowStatus="true"`**：菜单项组件内存在左上角小方框——节点类型必须在 `GROUP` / `LAYER` 内（实测状态方框是 `GROUP` 组 2492 + 两个 `LAYER` 矩形；图标是 `INSTANCE` + `PATH`、F 键提示是 `TEXT`，因此按类型即可区分，左上角的小图标不会被误判），宽高 8–32px、相对菜单项左上角 x≤20 且 y≤20，并额外排除图标映射命中的几何子树；实测「首页-长方形」的 `组 2492` 18×18@8,8，对应公开属性 `显示开关`。

两者都是**命中才发射**：未命中时**不写**该属性（`false`、空串、纯空白串都不发射）。判定参数的真值源是 `mtslg-iocontrol-map.json` 的 `layoutRules.bottomBar.menuItemFlags`——属性名（`attr`）、节点类型（`nodeTypes`）、数值阈值（`minRed` / `maxGreenBlue` / `minSize` / `maxSize` / `maxOffsetX` / `maxOffsetY`）与 `excludeIconSubtree` 都由脚本直接读取，改表即改产物。推导由 `gen-mtslg-layout-manifest.js` 完成（写进 `menuItems.isNeedRedMark` / `menuItems.isShowStatus`），发射由 `gen-mtslg-layout.js` 完成；该布尔过滤只作用于这两个标记字段，**不得影响 `IO*` 等恒写字段**（恒写字段即使取到布尔 `false` 也必须发射）。

## Layout 清单（menuItems）的机械推导

底部栏菜单不再人工登记，由 `gen-mtslg-layout-manifest.js` 从 DSL 快照 + 当前页面 Icon 映射 + 模板表机械推导，规则全部登记在 `mtslg-iocontrol-map.json` 的 `layoutRules.bottomBar`：

- **底部栏容器**：任一"直接子节点里含右下角常驻分组"的容器（不记图层 ID、不记页面路径）。
- **变体匹配键**：`layoutRules.bottomBar.match` —— `componentName: true` 时用实例名（被引用组件的名字）当变体值；也可登记 `property: "属性名"` 改用公开属性值。一族一个键，与组件模板族同一套机制。
- **变体清单**：`layoutRules.bottomBar.variants` 共 16 个 —— 7 个基础变体（首页-长方形 / 非首页-长方形 / 方-icon+文案 / 方-icon / 非首页-F / 非首页-文案 / 非首页- F）加 9 个 `DI 显示-0/1000/2000/3000/4000/5000`、`DO 显示-0/1000/2000`。`DI/DO 显示-*` 是 84×84 的图标+文案按钮：不写 `TopLeftContent`（没有 F 键槽位），图标按图标映射发射，`Name` 照设计稿文本写入。
- **排列顺序**：视觉行序——先按 `y` 分行（同一行内 `y` 差不超过行高一半视为同行），行内按 `x` 升序；与运行目录参考 Layout 的 Index 形态一致。
- **Index**：从 1 起，包含不生成 MenuItem 的按钮；常驻分组内的按钮占位并留下空档。
- **Name / TopLeftContent**：取该实例的真实文本槽位与 F 键槽位，**照设计稿原样写入**（不做"占位符"判定、不登记默认值；设计里是 `文案展示` / `F1` 就写 `文案展示` / `F1`）。
- **Icon / IconWidth / IconHeight**：从页面 Icon 映射与图标图形节点 bbox 取；`extractSvg` 去重导致映射缺条目时按几何指纹回退匹配同一资源名。
- **常驻分组**：分组内实例数写入 `layoutEvidence.residentGroupItems`，换算 `matchedBottomBarItems = menuItems.length + residentGroupItems`。

推导结果是一次性输入，仍需经 `gen-mtslg-layout.js`（常驻属性恒写、图标尺寸门禁、Index 门禁）发射。

### 变体：首页-长方形

#### 匹配规则

组件名精确等于“首页-长方形”。沿该实例的真实子链读取文本槽位、可选图标槽位和开关状态槽位。

#### 固定模板

```xml
<MenuItem Name="{text}" Icon="{icon}" Index="{index}"/>
```

文本槽位写入 Name；固定模板声明的多语言键缺失时写入 `LangName=""`。图标槽位存在且已在当前页面的 Icon 文件中确认时才写入 Icon；图标槽位存在但资源名待配置时写入 `Icon=""` 并在 mapping 标记待配置。开关状态槽位（左上角方框 `组 2492`，对应公开属性 `显示开关`）：方框存在时按「MenuItem 设计稿标记」写入 `IsShowStatus="true"`，方框不存在时**不发射**该属性；本变体没有键盘提示槽位，不生成 TopLeftContent。

### 变体：非首页-长方形

#### 匹配规则

组件名精确等于“非首页-长方形”。沿真实子链读取文案、图标和 F 键提示三个槽位。

#### 固定模板

```xml
<MenuItem Name="{text}" Icon="{icon}" TopLeftContent="{key}" Index="{index}"/>
```

文案写入 Name，图标写入 Icon，F 键提示写入 TopLeftContent；固定模板声明但来源缺失的 `LangName` 和运行时属性输出空字符串并标记待配置。

### 变体：方-icon+文案

#### 匹配规则

组件名精确等于“方-icon+文案”。沿真实子链读取图标槽位和文案槽位。

#### 固定模板

```xml
<MenuItem Name="{text}" Icon="{icon}" Index="{index}"/>
```

文案写入 Name，图标写入 Icon；本变体没有键盘提示槽位，不生成 TopLeftContent。

### 变体：方-icon

#### 匹配规则

组件名精确等于“方-icon”。沿真实子链读取图标槽位。

#### 固定模板

```xml
<MenuItem Icon="{icon}" Index="{index}"/>
```

该变体生成一个独立 MenuItem。它没有固定文案和键盘提示槽位，不生成 Name 或 TopLeftContent；`LangName` / `PageName` / `IOCommand` / `IOVisible` 属于常驻属性，仍按恒写规则输出（无来源时为空字符串）。图标必须由真实图标节点和当前页面的 Icon 文件共同确认。

### 变体：非首页-F

#### 匹配规则

组件名精确等于“非首页-F”。沿真实子链读取主文本槽位和 F 键提示槽位。

#### 固定模板

```xml
<MenuItem Name="{text}" TopLeftContent="{key}" Index="{index}"/>
```

主文本写入 Name，F 键提示写入 TopLeftContent；本变体没有图标槽位，不生成 Icon。

### 变体：非首页-文案

#### 匹配规则

组件名精确等于“非首页-文案”。沿真实子链读取文案槽位。

#### 固定模板

```xml
<MenuItem Name="{text}" Index="{index}"/>
```

文案写入 Name；本变体没有图标和键盘提示槽位，不生成 Icon 或 TopLeftContent。

### 变体：非首页- F

#### 匹配规则

组件名精确等于“非首页- F”（连字符后带空格，是设计稿里该变体名本身的一部分，比较时按原样匹配，不做去空格归一）。沿真实子链读取文案槽位和 F 键提示槽位。

#### 固定模板

```xml
<MenuItem Name="{text}" TopLeftContent="{key}" Index="{index}"/>
```

文案写入 Name，F 键提示写入 TopLeftContent；本变体没有图标槽位，不生成 Icon。所有变体的文本、图标和键盘提示都必须沿实例的真实父子链读取；图标值必须在当前页面的 Icon 文件中确认。

## 顶部栏映射

MasterGo 顶部栏组件用于识别宿主插槽和核对显示内容；运行时字段由 Layout.xml 的 HeaderItem 提供。

```xml
<Header Title="SamplesStudio">
  <HeaderItem Id="ShowCIM" Target="CimView"/>
  <HeaderItem Id="AlarmContentIO" Target="CTC.Alarm_Message"/>
  <HeaderItem Id="AlarmStatusIO" Target="CTC.Alarm_Level"/>
  <HeaderItem Id="RecipeNameIO" Target="CTC.Recipe_RecipeName"/>
</Header>
```

顶部栏不使用中间区域的 126px、66px 或 192px 坐标归一化规则；HeaderItem 本身也不填写 Left、Top、Width、Height。MasterGo 坐标只作为视觉核对和来源证据。

顶部栏的具体业务语义、Target 和数据源必须从目标项目现有 HeaderItem 或框架源码确认。没有确认时标记“待确认”，不得按文字或图标名称猜写。

## 底部栏映射

底部栏按所属页面写入该页面的 Menu/MenuItem。底部组件的设计尺寸仅用于核对组件变体，Layout.xml 不记录其设计坐标。

```xml
<Page Target="{target}" LangName="{page_lang_name}">
  <Menu>
    <MenuItem Name="{name}" LangName="{lang_name}" Icon="{icon}" TopLeftContent="{key}" Index="{index}" PageName="{page_name}" IOEnable="{enable}" UserRightId="{user_right_id}"/>
  </Menu>
</Page>
```

底部栏需要登记固定模板声明的 Name、LangName、Icon、TopLeftContent、Index、PageName、IOEnable 和 UserRightId，并按目标 Layout.xml 的现有结构写入。声明的字段没有可靠来源时输出空字符串并标记待配置；没有 Icon 槽位的变体不生成 Icon 属性。存在 Icon 槽位时，Icon 值只能从当前页面的 Icon 文件中查找。

## Layout.xml 参数说明

顶部栏和底部栏按目标 Layout.xml 的节点结构生成。目标 Layout.xml 存在时，沿用其真实节点结构；目标项目声明了 Layout 路径但文件不存在时，按本文正式模板新建文件。参数值必须来自项目现有配置、映射文件或已确认的 MasterGo 来源；固定模板已声明但无法确认的字段输出空字符串并标记为“待确认”，模板未声明的字段不新增。

```xml
<HeaderItem Id="{id}" Target="{target}"/>
<MenuItem Name="{name}" LangName="{lang_name}" Icon="{icon}" TopLeftContent="{key}" Index="{index}" PageName="{page_name}" IOEnable="{enable}" UserRightId="{right_id}"/>
```

### HeaderItem 参数

| 参数 | 含义 |
|-|-|
| Id | 顶部栏项目在 Layout.xml 中的标识。 |
| Target | 顶部栏项目绑定的运行时目标或数据项。 |

### MenuItem 参数

| 参数 | 含义 |
|-|-|
| Name | 底部菜单显示名称或菜单项名称。 |
| LangName | 菜单项对应的多语言资源键。 |
| Icon | 菜单项使用的图标键，只从当前页面的 Icon 文件读取；本文不定义图标目录。 |
| TopLeftContent | 菜单项左上角显示的键盘提示，例如 F1、F2。 |
| Index | 菜单项在页面底部菜单中的顺序编号。 |
| PageName | 菜单项关联的页面名称；项目未使用时不生成。 |
| IOEnable | 菜单项是否启用，必须按项目 Layout.xml 或框架约定填写。 |
| UserRightId | 菜单项所需的用户权限标识，项目未提供时不猜写。 |

## 键盘提示

MasterGo 底部组件中的 F1、F2、F3、F6、F7、F8、F10 等提示，映射到 MenuItem.TopLeftContent。新建页面的 Index 取当前页面底栏真实排列顺序；已有 Layout 中既有 MenuItem 的 Index 保留原值，不能仅凭 F 标签覆盖。

## 页面实例字段来源

Layout 映射只定义字段来源和生成条件，不登记任何具体页面的文案、多语言键、按键或顺序值。

### MenuItem 页面实例模板

#### 字段来源

```xml
<MenuItem Name="{text}" LangName="{lang_name}" Icon="{icon}" TopLeftContent="{key}" Index="{index}"/>
```

Name 取当前组件实例的真实文本槽位；LangName 仅从当前页面的语言文件读取；Icon 仅从当前页面的 Icon 文件读取；TopLeftContent 取当前实例的 F 键提示槽位；新建页面的 Index 取当前页面底部栏中该实例的实际排列顺序，已有 MenuItem 的 Index 保留 Layout.xml 原值。

当前实例没有对应来源时，如果该字段属于当前固定模板，则保留属性并输出空字符串；如果字段不属于当前固定模板，则不新增属性。`LangName` / `PageName` / `IOCommand` / `IOVisible` / `IOEnable` 按常驻属性恒写（取不到值为空字符串）；`UserRightId` 的值仍只从目标项目或用户明确提供的 Layout 配置读取。

## 未确认项处理

- MasterGo 中出现但目标 Layout.xml 找不到对应键的顶部/底部组件，状态设为“未映射/待开发确认”。
- 不得为未确认项填写未经验证的目标类型或菜单字段。
- 补齐运行时键后，再更新本规则文档和组件映射登记表。

## 新建 Layout.xml

目标项目声明了 `layout_file` 但文件不存在，且用户要求生成新页面时，按正式运行结构创建文件；页面实例只填入已确认的字段，未确认的运行时属性字段缺失时保留对应 XML 属性并输出空字符串值。新建文件仍保留 `Header`、`Body/Pages`、`LeftToolBox`、`ToolBox` 和 `Footer` 壳层；壳层运行时属性没有来源时保持空元素，不复制其他项目的字段：

```xml
<Layout>
  <Header>
    <!-- 仅写入已确认的 HeaderItem -->
  </Header>
  <Body>
    <Pages>
      <Page Target="{target}" LangName="{page_lang_name}">
        <Menu>
          <!-- 每个已命中的底部栏变体生成一个 MenuItem -->
        </Menu>
      </Page>
    </Pages>
    <LeftToolBox />
    <ToolBox />
  </Body>
  <Footer />
</Layout>
```

新建文件不继承其他项目的 Header、Page、Menu、MenuItem、Target 或运行时字段；当前正式模板声明的字段没有来源时输出空字符串并在交付清单中标记待确认，模板没有声明的字段不新增。
