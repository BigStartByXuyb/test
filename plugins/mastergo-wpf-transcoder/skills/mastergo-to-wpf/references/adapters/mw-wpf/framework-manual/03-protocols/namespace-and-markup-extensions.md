# 命名空间与标记扩展

<!-- evidence=部分确认(前缀与调用形式已确认,扩展实现机制待确认); verified=2026-08-13;
     sources=[{source_root}/ManualView.xaml] -->

## 1. 框架命名空间 ✅

```xml
xmlns:s="http://www.maxwell-gp.com/"
```
（ManualView.xaml ✅）

- 前缀惯例为 `s`，所有自研控件/标记扩展均经此前缀：`s:IconButton`、`s:MainButtonGrid`、`{s:Action …}`。
- 与 `controls:`（`clr-namespace:MaxwellControl.Controls`，样式内部使用，如 FrameworkGeneric.xaml）分工：**页面用 `s:`，SDC 样式内部用 `controls:`**。

## 2. 观察到的标记扩展与附加属性（ManualView 使用面）

| 语法 | 用途 | 证据 | 状态 |
|---|---|---|---|
| `{s:Action MethodName}` | 动作绑定（放 `Click`） | ManualView.xaml | 调用形式 ✅；解析机制 ❓ TD-002 |
| `{s:View.Model {Binding …}}` | 视图模型注入（放 `ContentControl`） | ManualView.xaml（`s:View.Model="{Binding SelectSlotViewModel}"`） | 调用形式 ✅；宿主机制 🟡 |
| `s:MainButtonGrid` | 主功能区容器控件 | ManualView.xaml | 调用形式 ✅；条目见 02-controls/navigation/ |
| `xmlns:s` 前缀本身 | — | ManualView.xaml | ✅ |

## 3. 写法对照

### ❌ 禁止：在页面给自研控件用 `controls:` 前缀/或混用命名空间
```xml
<controls:IconButton …/>   <!-- 页面不该直连程序集命名空间 -->
```

### ✅ 推荐：页面统一 `s:` 前缀
```xml
<s:IconButton TopLeftContent="F1" …/>
```
禁止原因：① `s:` 是框架页面协议的一部分（ManualView 全部页面统一），混用导致写法不可检索；② `controls:` 前缀是 SDC 样式内部契约，页面直连程序集命名空间破坏"资源层/使用层"边界；③ 协议统一后工具（ai-index、skill）才能按前缀定位框架调用。

## 4. 待确认项

- TD-002：`{s:Action …}` 的解析机制（详见 action-protocol.md）。
- `s:View.Model` 的宿主机制（页面注册/生命周期）🟡——未单独建 TD，并入 TD-003（跳转/宿主机制同源）跟踪。
