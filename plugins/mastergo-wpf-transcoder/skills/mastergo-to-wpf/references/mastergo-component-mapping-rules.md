# MasterGo 组件映射总路由

本文件只定义两套适配器共用的语义边界，不重复维护具体 XML 模板或 WPF 控件细节。

## 公共匹配原则

- 先识别正式组件实例、独立组件集名称、公开变量属性和真实变量值；只有该组件族确实由“父 + 子”组合构成时才追加父节点语义，聚合组件族（如右侧栏）不得使用“父节点语义”这一层；不能凭截图、Group 名称或外观猜测。
- 组件集 ID、实例 ID 和图层 ID 用于追踪；唯一代码分支必须由已登记的组件语义和变体命中。
- 固定模板决定控件类型、节点数量、父子关系和槽位顺序；MasterGo 实际提供的文本、图标、状态、尺寸和业务字段填入可变字段。
- 命中失败时隔离该组件并标记“未登记/待确认”，保留其 DSL 来源、坐标和 provenance；其他已唯一命中的组件可以继续生成，但包含未映射组件的产物不得宣称完整可运行。是否新增映射、修改正式映射或仅静态保留，由用户后续确认。

## 目标适配器

### `mtslg-iocontrol`

完整的 MasterGo 组件集到 IOContorl 模板、`ControlType`、XML 属性、字段和 `Value` 规则见：[飞书组件库映射规范](./adapters/mtslg-iocontrol/feishu-component-library-mapping.md)。该文件是 IOContorl 适配器的详细规则，不应被当作直接 WPF 控件映射。

### `mw-wpf`

使用目标项目 `docs/` 中的组件 manifest，以及 `references/adapters/mw-wpf/` 中的 MW 控件、Style、资源和协议证据。生成 `s:IconButton`、`DataGrid` 等真实框架控件时，必须使用对应的 `targets.mw-wpf` 登记，不得套用 IOContorl XML 模板。

## 映射登记形态

公共组件 manifest 推荐一份语义登记、两个目标区块：

```json
{
  "componentId": "mw.button.icon",
  "variant": "main",
  "properties": {},
  "targets": {
    "mw-wpf": { "control": "IconButton", "style": "MainButtonStyle" },
    "mtslg-iocontrol": { "controlType": "IconButton", "propertyMap": {} }
  }
}
```

因此，飞书那种“完整组件集 → IOContorl 固定模板”的形式应该继续保留在本地 `feishu-component-library-mapping.md`，并作为 IO 适配器权威规范；WPF 只需在同一语义组件下补充独立的 `mw-wpf` 目标信息。后续维护以该本地副本为准。

## 尺寸与页面标题规则

### TextBlock 尺寸（高度与宽度）

`TextBlock` 的高度与宽度都是固定布局边界，不是字号：

```text
MTSLG TextBlock Height = 40
MTSLG TextBlock Width  = NaN（自适应，不用文本 bbox 宽度）
FontSize 独立取对应 MasterGo DSL 字体事实
文本 bbox、文本 bbox 宽度、外层组件高度和行高不得改写 TextBlock Height/Width
文本 bbox 宽度只作为 dslWidth 记入 mapping 溯源
输入框/选择框等非 TextBlock 控件按正式变体模板取自身宽高
```

`FontSize`、`LineHeight` 和文本内容不能反推出控件尺寸。MTSLG IOContorl `TextBlock` 的 Height 必须固定为 `40`、Width 必须固定为 `NaN`；WPF 的宽度/高度与布局行高仍由对应 WPF 容器和项目事实决定。

### 顶部示例标题

组件展示页或工件示教稿最上方的标题，若位于页面根节点/展示外壳而不属于业务内容，默认排除：

```text
root/page
├── design-artifact-title  ← 不生成
└── business-content       ← 继续映射
```

例如“工件边缘示教（2.2.1.E）”这类画布说明标题不进入最终 XML。若标题位于业务组件内部，或目标运行时明确要求页面标题，则保留并记录 `titleRetentionReason`。
