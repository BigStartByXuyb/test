# 动作协议：{s:Action}

<!-- evidence=部分确认(调用形式确认,解析机制待确认); pending=[TD-002]; verified=2026-08-13;
     sources=[{source_root}/ManualView.xaml] -->

## 1. 协议形式 ✅（调用面）

```xml
Click="{s:Action LoadWaferToCutStage}"
```

参数为**动作名称字面量**（不带 `()`、不带字符串引号语义——按已确认形式书写）。ManualView.xaml 中观察到的全部实例：

| 动作名 | 证据位置 |
|---|---|
| `LoadWaferToCutStage` | ManualView.xaml |
| `TargetMatchClick` | :33 |
| `UnloadWaferToCleanStage` | :56 |
| `UnloadWaferToCS` | :66 |
| `UnloadAllWaferToCS` | :70 |
| `ManualCoat` | :80 |
| `ManualClean` | :86 |
| `MoveToManualLoad` | :91 |
| `GoBackCommand` | :114 |

## 2. 与原生 Click 的对照 ✅

- 框架页面**不用** `Click="OnLoad"`（代码后置方法名）+ 手写事件处理器——`s:Action` 承担全部按钮动作。
- `s:Action` 与 `PageName` 可**共存于同一按钮**吗？→ ManualView 中两者互斥出现（有 Click 的按钮无 PageName，反之亦然），但 `GoBackCommand`与 `PageName="Jump:Home"`**同时存在** ✅——共存形式确认，优先级语义 ❓ 见 TD-003。

## 3. 写法对照

### ❌ 禁止：代码后置事件
```xml
<Button Click="OnLoadButtonClicked"/>
```
```csharp
private void OnLoadButtonClicked(object sender, RoutedEventArgs e) { … }
```

### ✅ 推荐：动作协议
```xml
<s:IconButton Click="{s:Action LoadWaferToCutStage}" …/>
```
禁止原因：① 框架动作走 `s:Action` 通道（框架代理/命令），代码后置绕过该通道，动作审计、设备联锁联动失效；② 全页面动作集中可检索（ai-index 可索引）；③ 与 IOEnable/PageName 同属框架协议，混用原生事件破坏一致性（对照 00-guide/03-writing-paradigm.md 总则 3）。

## 4. 待确认项

- TD-002：`{s:Action}` 返回的是委托/命令/框架代理？动作解析位置、异步机制、异常处理。
