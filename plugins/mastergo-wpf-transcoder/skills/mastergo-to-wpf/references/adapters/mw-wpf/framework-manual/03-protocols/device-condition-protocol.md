# 设备条件协议：IOEnable

<!-- evidence=部分确认(调用形式确认,表达式语义待确认); pending=[TD-001]; verified=2026-08-13;
     sources=[{source_root}/ManualView.xaml] -->

## 1. 协议形式 ✅（调用面）

```xml
IOEnable="CTC.RUN==0 &amp;&amp; CTC.Transfer==0"
```

注意 XML 转义：`&&` 必须写作 `&amp;&amp;`（ManualView.xaml 等 14 处 ✅）。

观察到的取值形式：

| 形式 | 证据 |
|---|---|
| 设备条件表达式（`CTC.RUN==0 && CTC.Transfer==0`） | ManualView.xaml（14 个主按钮） |
| 布尔字面量 `true` | ManualView.xaml（退出按钮） |

## 2. 已确认与待确认 ✅/❓

- ✅ 接收设备条件表达式或布尔字面量；放在控件（IconButton）上作为启用条件。
- ✅ 是**页面唯一观察到的**设备联锁写法——页面没有出现 `IsEnabled="{Binding …}"` 手工联锁。
- ❓ TD-001：`CTC` 数据来源、表达式运算符全集、条件失败时的行为（禁用/拦截点击/隐藏）、结果与 `IsEnabled` 的关系。

## 3. 写法对照

### ❌ 禁止：手工联锁
```xml
<Button IsEnabled="{Binding RunStopped}"/>
```
```csharp
public bool RunStopped => Cts.Run == 0 && Cts.Transfer == 0;  // 手写转换
```

### ✅ 推荐：IOEnable 协议
```xml
<s:IconButton IOEnable="CTC.RUN==0 &amp;&amp; CTC.Transfer==0" …/>
```
禁止原因：① 设备联锁是框架协议，手工 IsEnabled+转换器是等价机制的重复发明（总则 3）；② IO 系列控件（IOCheckBox/IODataGrid/…）全部走 IOEnable 通道，按钮手工联锁与 IO 控件不一致；③ 表达式集中在 XAML 中可审计，设备联调时可全局检索。

## 4. 待确认项

- TD-001：表达式语法全集、CTC 数据来源、失败行为。
