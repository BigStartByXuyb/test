# 控件条目模板

<!-- 本模板用于 02-controls/ 下每个控件条目；复制后填充，8 个区块缺失必须写「无」而非省略。 -->

```markdown
<!-- evidence=已确认(…)/部分确认(…)/待确认(…); pending=[TD-xxx,…];
     verified=YYYY-MM-DD; sources=[{source_root}/SDC/Style/XXX.xaml, {source_root}/ManualView.xaml] -->

# XXX（中文名）

## 1. 用途
一句话定位 + 典型场景（引用真实页面/模板证据）。

## 2. 声明
XML 名（如 `<s:IconButton …/>`，s = http://www.maxwell-gp.com/）、TargetType（MaxwellControl.Controls.*，私有程序集）、命名空间前缀。

## 3. 关键属性表
| 属性 | 类型/取值 | 说明 | 证据（file:line 或锚点） | 状态 |
|---|---|---|---|---|
| … | … | … | … | ✅/🟡/❓TD-xxx |

## 4. 样式族表
| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| … | … | … | … |

## 5. 框架写法示例
真实页面原样 XAML + 逐属性说明；无实例时用模板证据构造并标注「无使用实例」。

## 6. 禁止写法对照
- 禁止（常规 WPF 手写反例代码）
- 必须改为（框架写法代码）
- 禁止原因（≥3 条，对照 00-guide/03-writing-paradigm.md 五类依据）

## 7. 参考锚点
- 模板源码路径 + 锚点（x:Key / Trigger）
- 真实使用路径:行号
- files/*.json、capabilities/*.json 交叉索引

## 8. 待确认项
本控件涉及的 TD 编号清单（与 05-best-practices/pending-confirmations.md 联动）。
```

## 填写规则

1. **证据第一**：区块 3/4 的每一行必须有证据列；拿不到 P1/P2 证据的属性不进表（或标 ❓）。
2. **区块 5 优先摘 ManualView 原样**；引用时保持属性拼写与转义（如 `&amp;&amp;`）原样。
3. **区块 6 反例必须是"等效替代"**——写的是想达到同一视觉/行为而手写拼装的结构，不是随便一个 Button。
4. **头部元数据随回填更新**：`pending` 列表、`verified` 日期、`sources`。
5. 范本条目：`02-controls/navigation/icon-button.md`。
