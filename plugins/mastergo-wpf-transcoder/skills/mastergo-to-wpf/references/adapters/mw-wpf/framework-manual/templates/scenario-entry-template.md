# 场景对照条目模板

<!-- 本模板用于 04-scenarios/ 下每个场景文件；结构仿 shadcn「关键规则→错误/正确对照」组织法。 -->

```markdown
<!-- evidence=…; verified=YYYY-MM-DD; sources=[{source_root}/ManualView.xaml, {source_root}/SDC/Style/XXX.xaml] -->

# 场景：XXX（如：图标功能按钮）

## 场景描述
需求一句话（如：页面上放一排带快捷键标记、图标、文字、设备联锁的功能按钮）。

## 推荐控件
| 需求要点 | 框架控件/协议 | 对应条目 |
|---|---|---|
| 图标+文字+角标 | IconButton | 02-controls/navigation/icon-button.md |
| 设备联锁 | IOEnable | 03-protocols/device-condition-protocol.md |
| 点击动作 | Click="{s:Action …}" | 03-protocols/action-protocol.md |

## 对照

### ❌ 禁止：常规 WPF 写法
```xml
（手写拼装代码）
```

### ✅ 推荐：框架写法
```xml
（框架控件一行/数行代码，摘自 ManualView 或按其形式）
```

## 禁止原因（≥3 条）
1. …（对照 00-guide/03-writing-paradigm.md 五类依据，标注证据）
2. …

## 证据来源
- 真实页面：{source_root}/ManualView.xaml:行号
- 模板证据：{source_root}/SDC/Style/XXX.xaml（锚点）
```

## 填写规则

1. 一个场景 = 一个需求场景，跨控件时用「推荐控件」表路由到条目，不重复展开属性细节。
2. 反例与推荐必须**等效**（达成同一视觉/行为），否则对照无效。
3. 禁止原因逐条对应五类依据（状态/协议挂点/样式族/本地化/视觉规范），能标证据就标。
4. 与 00-guide/03-writing-paradigm.md 总则冲突的内容不允许出现。
