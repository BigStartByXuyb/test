<!-- evidence=已确认(消费处为模板源码直接证据；宿主 .cs 不可见); pending=[TD-038]; verified=2026-08-14;
     sources=[{source_root}/SDC/FrameworkGeneric.xaml, {source_root}/SDC/Style/PasswordBox.xaml, {source_root}/ManualView.xaml] -->

# PasswordBoxAttach（密码框行为附加属性）

## 1. 用途

框架密码框行为协议：宿主类 `controls:PasswordBoxAttach` 提供 **IsMonitoring（监控开关）+ PasswordLength（密码长度）** 附加属性，挂在 PasswordBox 上——`PasswordLength==0` 时模板内占位符显示（密码为空提示），监控开启后长度由 .cs 持续跟踪。服务于登录密码框（LoginPasswordBox 样式）。

**双定义事实**：LoginPasswordBox 样式在 `FrameworkGeneric.xaml`（:501-565）与 `PasswordBox.xaml`（:17-80）各定义一份，内容同构（TD-038）。

## 2. 声明

```xml
<PasswordBox Style="{StaticResource LoginPasswordBox}" …/>
<!-- 族级默认已含 IsMonitoring=True 与 PasswordLength 触发器 -->
```

- `controls` = `clr-namespace:MaxwellControl.Controls`；
- 消费：IsMonitoring Setter（FrameworkGeneric.xaml:510）+ PasswordLength=0 触发器（:553-555 → placeholder Visible）；PasswordBox.xaml 对应 :23/:72-74。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| IsMonitoring | bool | 监控开关；登录样式两定义均设 True | FrameworkGeneric.xaml:510（LoginPasswordBoxStyle Setter）；PasswordBox.xaml:23 | 🟡 [TD-038] |
| PasswordLength | int | 当前密码长度；==0 → placeholder 显示 | FrameworkGeneric.xaml:553-555（Trigger Value="0" → placeholder Visible）；PasswordBox.xaml:72-74 | 🟡 [TD-038] |
| 其余成员 | — | 全库 grep 仅上述两属性命中 | grep 统计 | ❓ TD-038 |

模板细节（模板源码证据）：placeholder（水印 TextBlock）初始隐藏，`PasswordLength==0` 时显示（空密码提示）；IsMonitoring=True 时长度经 .cs 回写（写值机制不可见）。FrameworkGeneric 版（:501-565）与 PasswordBox 版（:17-80）触发器/占位结构同构但文件独立——两版是否需保持一致由 TD-038 跟踪。

## 4. 样式族表

无（本条目为附加属性；消费样式见 [password-box](../keypad-input/password-box.md) 条目）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零附加属性引用。以下为 P1 模板证据构造。

```xml
<PasswordBox Style="{StaticResource LoginPasswordBox}"
             Width="…" Height="30"/>
```

- 页面只写 Style 与尺寸，监控与占位联动随样式默认生效；
- 关闭占位提示：显式 `controls:PasswordBoxAttach.IsMonitoring="False"`（页面覆盖族默认）。

## 6. 禁止写法对照

### ❌ 禁止：手写 TextBlock 叠层 + TextChanged 事件控制占位符（等效替代）

```xml
<Grid>
    <PasswordBox x:Name="pwd" Width="…" Height="30"/>
    <TextBlock Text="请输入密码" IsHitTestVisible="False" Visibility="Collapsed">
        <TextBlock.Style>
            <Style TargetType="TextBlock">
                <Style.Triggers>
                    <Trigger Property="IsVisible" Value="False">
                        <Setter Property="Visibility" Value="Visible"/>
                    </Trigger>
                </Style.Triggers>
            </Style>
        </TextBlock.Style>
    </TextBlock>
</Grid>
<!-- 事件侧：pwd.PasswordChanged += … 手动切换占位符显隐 -->
```

### ✅ 推荐：PasswordBoxAttach 行为化

```xml
<PasswordBox Style="{StaticResource LoginPasswordBox}" …/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版占位显隐靠事件代码维护，聚焦/密码变化时序状态易错（空密码闪烁、粘贴绕过 PasswordChanged 等）；框架版为模板触发器 + .cs 跟踪，状态一致；
2. **② 丢失协议挂点**：IsMonitoring/PasswordLength 协议全无——其他复用登录框的模板（如框架登录页组合）注入的密码框行为无法生效；
3. **④ 绕过统一配置**：双定义 LoginPasswordBox（FrameworkGeneric.xaml:501-565 / PasswordBox.xaml:17-80）的族级默认被绕过，行为差异无法统一治理（TD-038）；
4. **⑤ 脱离视觉规范**：占位符字号/间距/对齐散写页面，与登录框视觉基线脱节；
5. **③ 无法样式族切换**：占位提示开/关不能靠 IsMonitoring 一个属性切换，需改代码。

## 7. 参考锚点

- 消费模板：`{source_root}/SDC/FrameworkGeneric.xaml`（锚点 `x:Key="LoginPasswordBoxStyle"` :501-565，IsMonitoring Setter :510、PasswordLength=0 Trigger :553-555）
- 双定义对照：`{source_root}/SDC/Style/PasswordBox.xaml`（IsMonitoring :23、PasswordLength Trigger :72-74）
- 真实使用：无（ManualView.xaml 不含附加属性引用）
- 索引交叉：`{index_root}/files/refence_SDC_FrameworkGeneric.xaml.json`、`{index_root}/files/refence_SDC_Style_PasswordBox.xaml.json`

## 8. 待确认项

- **TD-038**（复用）：LoginPasswordBox 双定义（FrameworkGeneric.xaml / PasswordBox.xaml）——两版同构差异、取舍机制与维护责任待确认；PasswordBoxAttach 监控回写机制（.cs 不可见）。
