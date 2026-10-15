# 页面跳转协议：PageName

<!-- evidence=部分确认(调用形式确认,分段语义待确认); pending=[TD-003]; verified=2026-08-13;
     sources=[{source_root}/ManualView.xaml] -->

## 1. 协议形式 ✅（调用面）

ManualView.xaml 中观察到的全部形式：

| 形式 | 证据位置 | 分段观察 |
|---|---|---|
| `Jump:ManualAlignView:ini:Manual:True` | ManualView.xaml | `Jump` + 视图名 + `ini` + `Manual` + `True` |
| `Jump:ManualCutAuto:ini` | :44 | `Jump` + 视图名 + `ini` |
| `Jump:ManualCutSemiAuto:ini` | :49 | 同上 |
| `Jump:ManualCleanCoating` | :58 | `Jump` + 视图名 |
| `Jump:AutoAlignView:ini:Manual` | :74 | `Jump` + 视图名 + `ini` + 参数 |
| `Jump:BaseLineCalibrate` | :93 | `Jump` + 视图名 |
| `Jump:Home` | :109 | `Jump` + 视图名 |

## 2. 已确认与待确认 ✅/❓

- ✅ `Jump:` 前缀是唯一观察到的跳转前缀；目标是**视图名**（ManualAlignView/ManualCutAuto/Home…）。
- ✅ 与 `Click="{s:Action GoBackCommand}"` 可共存（ManualView.xaml 退出按钮）。
- ❓ TD-003：各冒号段的正式语义（`ini`/`Manual`/`True` 含义）、页面注册机制、与 Click 共存时的执行优先级。

## 3. 写法对照

### ❌ 禁止：代码后置手动切页
```xml
<Button Click="JumpToManual"/>
```
```csharp
private void JumpToManual(object sender, RoutedEventArgs e)
{
    new ManualCutAutoView().Show();   // 或 MainWindow 手动切换 Content
}
```

### ✅ 推荐：PageName 协议
```xml
<s:IconButton PageName="Jump:ManualCutAuto:ini" …/>
```
禁止原因：① 页面跳转是框架协议（与页面注册机制联动），代码后置 new Window() 绕过注册与参数传递；② 跳转目标集中在 XAML 中可审计、可索引；③ 与 s:Action/IOEnable 同通道，设备联锁（IOEnable）失效时跳转按钮的禁用策略才能统一（对照总则 3）。

## 4. 待确认项

- TD-003：分段协议语义、页面注册机制、与 Click 共存优先级。
