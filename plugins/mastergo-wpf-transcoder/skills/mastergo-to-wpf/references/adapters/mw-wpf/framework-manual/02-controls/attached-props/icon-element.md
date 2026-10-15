<!-- evidence=已确认(消费处为模板源码直接证据；宿主 .cs 不可见); pending=[TD-006]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/Button.xaml, {source_root}/SDC/Style/IconButton.xaml, {source_root}/ManualView.xaml] -->

# IconElement（图标附加属性）

## 1. 用途

框架图标协议：宿主类 `controls:IconElement` 提供图标几何/图片附加属性（Width/Height/Geometry/Source），挂在按钮等元素上，由样式模板内的 `Path`（几何）或 `Image`（位图）消费。对应 Button.xaml 两套专供样式——**ButtonIcon**（25×25 纯图标钮，Path 消费 Geometry）与 **ButtonImage**（30×30 图片钮，Image 消费 Source）。

**关键分布事实**：SDC 全库 **零 Setter 使用** IconElement——该属性族完全由页面/组合侧设置，框架仅提供消费模板。与 IconButton.Icon 属性（同文件家族的另一套协议，见 [icon-button](../navigation/icon-button.md) 条目）并存，IconElement 面向「模板内任意元素图标化」，IconButton.Icon 面向 IconButton 控件自身。

## 2. 声明

```xml
<Button Style="{StaticResource ButtonIconStyle}"
        controls:IconElement.Geometry="{StaticResource …Geometry}"
        controls:IconElement.Width="25" controls:IconElement.Height="25"/>
```

- `controls` = `clr-namespace:MaxwellControl.Controls`；
- 宿主元素在模板内绑定：`Path Width="{TemplateBinding controls:IconElement.Width}" … Data="{TemplateBinding controls:IconElement.Geometry}"`。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Width / Height | double | 图标渲染尺寸；Path 或 Image 的宽高 | Button.xaml:477（ButtonIcon 模板 Path Width/Height）、:511（ButtonImage 模板 Image Width/Height） | 🟡 [TD-006] |
| Geometry | Geometry | 图标几何（Path.Data）；与 Source 互斥路由到不同模板 | Button.xaml:477（`Path Data="{TemplateBinding controls:IconElement.Geometry}"`） | 🟡 [TD-006] |
| Source | ImageSource | 位图源（Image.Source） | Button.xaml:511（`Image Source="{TemplateBinding controls:IconElement.Source}"`） | 🟡 [TD-006] |

模板消费细节（Button.xaml 模板源码直接证据）：

- ButtonIcon（:466-496）：模板根为 Path，`Fill="{TemplateBinding Foreground}"`（:478）、Width/Height/Data 三绑定 IconElement；与 ButtonAttach.IconGeometory 相比，此处为**属性名 Geometry 正写**且带尺寸协议；
- ButtonImage（:500-526）：模板根为 Image，Source/Width/Height 三绑定 IconElement；
- 两个样式均无基于 IconElement 的显隐触发器（几何为空时以 Data=Null 触发由 Path/Image 各自隐藏，见按钮条目）。

## 4. 样式族表

无（本条目为附加属性；消费样式 ButtonIconStyle / ButtonImageStyle 属 Button 家族，具体样式证据以 `Button.xaml` 为准；相关按钮条目见 [io-button](../io/io-button.md)）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零附加属性引用。以下为 P1 模板证据构造。

```xml
<Button Style="{StaticResource ButtonIconStyle}"
        controls:IconElement.Geometry="{StaticResource PrevGeometry}"
        controls:IconElement.Width="25" controls:IconElement.Height="25"/>
```

- 几何图标走 `ButtonIconStyle` + Geometry；位图图标走 `ButtonImageStyle` + Source——模板按样式切换，属性协议一致；
- 几何键从几何资源库取（见 01-resources/geometries-icons.md），文本用 DynamicResource 本地化键。

## 6. 禁止写法对照

### ❌ 禁止：手写 `<Button><Path …/></Button>` 或 ContentControl 包图标（等效替代）

```xml
<Button Width="25" Height="25" Background="Transparent" BorderThickness="0">
    <Path Data="{StaticResource …Geometry}" Fill="Blue" Stretch="Uniform"/>
</Button>
```

### ✅ 推荐：IconElement 属性化

```xml
<Button Style="{StaticResource ButtonIconStyle}"
        controls:IconElement.Geometry="{StaticResource …Geometry}"
        controls:IconElement.Width="25" controls:IconElement.Height="25"/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：手写 Path 不参与 IconElement 绑定协议，模板调整（图标尺寸 Token、前景色继承）无法作用于页面实例；
2. **③ 无法样式族切换**：几何图标↔图片图标不能靠换 Style（ButtonIconStyle→ButtonImageStyle）完成——手写版改形态必须重写整个按钮；
3. **① 丢失状态**：手写按钮缺失禁用 Opacity 0.4、前景继承（Fill=Foreground 随 Hover/Pressed 变画刷）等模板触发器；
4. **⑤ 脱离视觉规范**：图标尺寸（25/30）、透明底、前景着色由模板统管，手写版尺寸/颜色散写页面失控。

## 7. 参考锚点

- 消费模板：`{source_root}/SDC/Style/Button.xaml`（锚点 `x:Key="ButtonIconStyle"` :466-496、`x:Key="ButtonImageStyle"` :500-526，绑定 `TemplateBinding controls:IconElement.*` :477/:511）
- 同族对比：`{source_root}/SDC/Style/Button.xaml`（ButtonAttach.IconGeometory 消费 :35/:102）——两套图标协议并存，场景区分见按钮条目
- 真实使用：无（ManualView.xaml 不含附加属性引用）
- 索引交叉：`{index_root}/files/refence_SDC_Style_Button.xaml.json`

## 8. 待确认项

- **TD-006**（复用）：IconElement 宿主类成员清单（是否有 Icon 别名/默认尺寸回退）与 Geometry/Source 冲突时的路由行为——.cs 不可见，当前仅确认模板消费侧语法。
