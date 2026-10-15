<!-- evidence=已确认(消费处为模板源码直接证据；宿主 .cs 不可见); pending=[TD-053]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/Slider.xaml, {source_root}/ManualView.xaml] -->

# RangeTrack（双滑块轨道附加属性）

> 补充条目：枚举 FrameworkGeneric.xaml 时发现的清单外工具类（非业务性），依约定补写。

## 1. 用途

框架双滑块轨道组件 `controls:RangeTrack`（MaxwellControl.Controls，.cs 不可见）——承载**起/止双滑块 + 三段点击区**的轨道协议：通过五个附加属性注入轨道零件（两端滑块 ThumbStart/ThumbEnd + 递减/居中/递增三段 RepeatButton），各零件经命令 `controls:RangeSlider.DecreaseLarge/CenterLarge/IncreaseLarge` 驱动。**仅 RangeSlider 模板内部使用**（Slider.xaml 水平/垂直两模板 + 组合变体）。

## 2. 声明

```xml
<!-- 模板内原样（Slider.xaml RangeSliderHorizontal 模板） -->
<controls:RangeTrack …>
    <controls:RangeTrack.DecreaseRepeatButton>
        <RepeatButton Command="controls:RangeSlider.DecreaseLarge" …/>
    </controls:RangeTrack.DecreaseRepeatButton>
    <controls:RangeTrack.CenterRepeatButton>
        <RepeatButton Command="controls:RangeSlider.CenterLarge" …/>
    </controls:RangeTrack.CenterRepeatButton>
    <controls:RangeTrack.IncreaseRepeatButton>
        <RepeatButton Command="controls:RangeSlider.IncreaseLarge" …/>
    </controls:RangeTrack.IncreaseRepeatButton>
    <controls:RangeTrack.ThumbStart>…</controls:RangeTrack.ThumbStart>
    <controls:RangeTrack.ThumbEnd>…</controls:RangeTrack.ThumbEnd>
</controls:RangeTrack>
```

- `controls` = `clr-namespace:MaxwellControl.Controls`；页面零书写（模板设施）。

## 3. 关键属性表

| 属性 | 类型 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| ThumbStart | UIElement（RangeSliderHorizontalThumb 等） | 起始值滑块 | Slider.xaml:214-219（水平模板）/ :249-263（垂直模板） | 🟡 [TD-053] |
| ThumbEnd | UIElement | 结束值滑块 | Slider.xaml:216-219 | 🟡 [TD-053] |
| DecreaseRepeatButton | UIElement（RepeatButton） | 递减段点击区；命令 RangeSlider.DecreaseLarge | Slider.xaml:205-208 | 🟡 [TD-053] |
| CenterRepeatButton | UIElement（RepeatButton） | 居中段点击区；命令 RangeSlider.CenterLarge | Slider.xaml:209-211 | 🟡 [TD-053] |
| IncreaseRepeatButton | UIElement（RepeatButton） | 递增段点击区；命令 RangeSlider.IncreaseLarge | Slider.xaml:212-213 | 🟡 [TD-053] |
| 其余成员 | — | grep 命中仅上述五附加属性 | grep 统计 | ❓ TD-053 |

模板细节（模板源码证据）：

- RangeSliderHorizontal 模板 :194-234（RangeTrack 使用 :204-220：三段 RepeatButton :205-213 + 双 Thumb :214-219）；RangeSliderVertical :236-278（:249-263 同构）；
- 滑块样式：RangeSliderHorizontalThumb/VerticalThumb（:174-192）；
- 组合：Slider.xaml:305 家族（RangeSlider + NumberBox 组合）同轨消费；
- 命令协议：`controls:RangeSlider.DecreaseLarge/CenterLarge/IncreaseLarge`（:206/209/212、垂直版 :250/:253/:256、另 :357/:359/:362）——**RangeSlider 类静态命令**，与 ControlCommands 族并列（见 control-commands 条目 §3 关联）。

## 4. 样式族表

无（本条目为轨道工具组件，非样式族；消费家族见 [range-slider](../native/slider.md) 条目）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零引用。以下为 P1 模板证据构造。

```xml
<s:RangeSlider …/>
<!-- 轨道协议由 RangeSlider 模板内建，页面零书写 -->
```

- 双滑块拖动（ThumbStart/ThumbEnd）+ 轨道三段点击（RepeatButton 命令）随控件模板自动生效。

## 6. 禁止写法对照

### ❌ 禁止：手写原生 Slider + Track 拼装双滑块（等效替代）

```xml
<Slider …>
    <Slider.Template>
        <ControlTemplate TargetType="Slider">
            <Track x:Name="PART_Track">
                <Track.DecreaseRepeatButton>
                    <RepeatButton Command="Slider.DecreaseLarge"/>
                </Track.DecreaseRepeatButton>
                <Track.Thumb>
                    <Thumb x:Name="PART_Thumb"/>
                </Track.Thumb>
            </Track>
        </ControlTemplate>
    </Slider.Template>
</Slider>
<!-- 双滑块、中心段、值域视觉均需自绘 -->
```

### ✅ 推荐：RangeSlider 控件

```xml
<s:RangeSlider …/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：RangeTrack 双滑块协议（ThumbStart/ThumbEnd + 三段 RepeatButton 结构）与 RangeSlider 静态命令（IncreaseLarge/CenterLarge/DecreaseLarge）全失——原生 Track 单 Thumb 无法表达起止双值；
2. **① 丢失状态**：Hover/Pressed/拖动状态画刷（RangeThumb 家族模板触发器）与轨道分段视觉全部需自绘且行为分叉；
3. **③ 无法样式族切换**：水平/垂直模板切换、组合变体（NumberBox 联动）失效；
4. **⑤ 脱离视觉规范**：轨道高度、滑块尺寸、分段画刷 Token 散写页面，与框架滑块视觉基线脱节；
5. **④ 重复造轮子**：框架已内建完整 RangeSlider 协议（framework.config.json 规则 4 违反）。

## 7. 参考锚点

- 消费模板：`{source_root}/SDC/Style/Slider.xaml`（锚点 `x:Key="RangeSliderHorizontalStyle"` 模板 :194-234、RangeTrack 使用 :204-220、`x:Key="RangeSliderVerticalStyle"` :236-278、RangeSliderHorizontalThumb/VerticalThumb :174-192、组合 :305）
- 命令锚点：`controls:RangeSlider.DecreaseLarge/CenterLarge/IncreaseLarge`（:206/209/212、:250/253/256、:357/359/362）
- 真实使用：无（ManualView.xaml 零引用；模板内部设施）
- 索引交叉：`{index_root}/files/refence_SDC_Style_Slider.xaml.json`

## 8. 待确认项

- **TD-053**（新）：RangeTrack 附加属性族——五属性类型与注入协议（零件元素如何被轨道布局）、RepeatButton 点击区与命令映射语义（大段递增/递减步长）；.cs 不可见。
