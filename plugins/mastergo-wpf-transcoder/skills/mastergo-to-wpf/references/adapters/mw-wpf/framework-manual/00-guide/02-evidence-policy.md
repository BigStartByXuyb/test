# 02 证据政策

<!-- evidence=结构性文档; verified=2026-08-13; sources=[framework.config.json, docs/ai-index/framework-guide.md, docs/ai-index/semantic/*.md] -->

## 1. 证据层级（P1–P4）

| 层级 | 来源 | 强度 | 用途 |
|---|---|---|---|
| **P1** | 模板源码 `{source_root}/SDC/**`（Style/、Brushes/、顶层资源） | 最强 | 属性存在性、模板行为（Setter/TemplateBinding/Trigger/Converter）以此为准 |
| **P2** | 真实业务页 `{source_root}/ManualView.xaml` 及 refence 根目录页面 | 强 | 使用面（调参方式、组合方式、协议写法） |
| **P3** | 可编译 Demo `MasterGo_WPF_V0.0.3`（`dotnet build` 0 错误） | 中 | 键存在性、XamlParseException 验证、资源加载顺序 |
| **P4** | ai-index 索引（framework-index.json、files/*.json、capabilities/） | 仅导航 | **不得作为事实引用**（framework-guide.md 明示"JSON 是导航和摘要，不是最终实现"） |

## 2. 证据状态判定

| 状态 | 符号 | 判定标准 |
|---|---|---|
| 已确认 | ✅ | 至少一条 P1 直接证据（模板绑定/Setter/Trigger 直接作用该属性），且与 P2 实际使用无矛盾 |
| 部分确认 | 🟡 | 调用形式确认（能写出并编译通过），但语义/解析机制/默认值无法从本地证据确定。如：IOEnable 表达式语法、s:Action 解析机制、PageName 分段协议 |
| 待确认 | ❓ TD-xxx | 仅能推断、无本地证据。**禁止写成事实**；写代码时必须用已确认形式，或显式要求确认 |

## 3. TD 编号与回填机制

- 每处待确认标记格式：`[待确认 TD-xxx]`，全手册唯一编号。
- 统一登记在 `05-best-practices/pending-confirmations.md` 总表（列：TD 编号 | 位置 | 问题 | 当前证据 | 回填日期 | 回填依据 | 状态）。
- 回填触发：获得 MaxwellControl 源码/反编译、框架作者确认、或 Demo 行为验证。回填后更新：条目头部 `pending` 列表、属性表状态列、TD 总表（附回填依据 file+锚点与日期）。
- 手册每次发布时，未回填项必须显式列出，不隐藏。

## 4. 路径令牌与证据引用书写格式（不写死盘符）

手册内所有外部文件引用一律使用**路径令牌**，由 `{framework_root}/framework.config.json` 动态解析——源码位置变化时只改配置，手册内容不动：

| 令牌 | 含义 | 来源 |
|---|---|---|
| `{framework_root}` | 含 framework.config.json 的目录（动态入口） | 脚本自发现（向上找）或 `--framework-root` |
| `{source_root}` | 框架源码目录（refence） | framework.config.json 的 `source_root` |
| `{index_root}` | ai-index 目录 | framework.config.json 的 `index_root` |
| `{demo_root}` | 可编译 Demo（P3 证据） | 手册本地 `manual.config.json` |

- **锚点引用（证据主体）**：`x:Key="MainButtonStyle"`、样式键、资源键名——稳定，源码变动不影响有效性。
- **文件+行号引用（仅提示）**：`{source_root}/SDC/Sizes.xaml:41-42`——行号只是"快速跳转提示"，**可漂移、不参与硬校验**（脚本对越界行号只发警告）。证据有效性取决于锚点，不取决于行号。
- **键清单不穷举**：手册写"文件职责 + 代表键 + 命名模式"；需要完整键清单时，直接 grep 源文件（如 `x:Key=`）或查 `{index_root}/files/*.json` 的 `resource_references`——穷举表必然随源码过时，手册不维护（对应 shadcn skill 的"查，不靠记"原则）。
- **索引交叉**：`{index_root}/files/refence_ManualView.xaml.json` 的 `resource_references`（存在性核对用）。
- **手册内部互链**：用相对路径（保持 markdown 可点击）。
- **头部元数据**：每个条目文件头部注释 `evidence=…; pending=[TD-xxx]; verified=日期; sources=[…]`，供脚本校验。

**动态校验/更新指令**（`{manual_root}/tools/check-manual-paths.py`）：

```text
python tools/check-manual-paths.py                 # 校验手册内全部令牌引用是否存在
python tools/check-manual-paths.py --source-root <dir>   # 临时指向新源码位置校验（动态更新）
python tools/check-manual-paths.py --framework-root <dir> # 指定框架根
python tools/check-manual-paths.py --update        # 一次性把旧绝对路径改写为令牌
```

换机器/换位置 = 改 `manual.config.json` 指向或传参覆盖，手册内容不动。

## 5. 禁止事项

1. 不得把 ai-index JSON 内容当作事实引用（只用来定位）。
2. 不得把「结构推断」写成「事实」——归纳类结论一律标 🟡 并注明推断依据。
3. 不得自行扩展协议（IOEnable/PageName/s:Action 只允许 ManualView 中出现的已确认形式）。
4. 发现 ai-index 缺项时记入 TD 总表，不得擅自断言。
