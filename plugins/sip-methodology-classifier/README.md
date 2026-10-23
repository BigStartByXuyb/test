# sip-methodology-classifier

把 MAXWELL《成品检验指导书》Excel 按 **SIP 方法论**归类，输出与参考样张同格式的顺序对应表。

## 安装

先添加团队 marketplace，再安装：

```text
/plugin marketplace add http://14.29.174.209:20001/data_ai/plugins.git
/plugin install sip-methodology-classifier@mw-plugins
```

## 能力

- **两层顺序模型**
  - 主顺序：9 个环节（铭牌核对 → 外观检验 → 通电检验 → 通气检验 → 通水检验 → 老化测试 → 工艺验证 → 通断电检验 → 备份杀毒检验）
  - 子顺序：每个环节内部 1级 → 12级
- **主干 + 设备族分支**：通用规则放主干；SDC（刀轮/晶圆切割）和 EXP（扩片）目前继承主干、分支文件预留扩展，SLG（激光切割，草稿）有独立分支规则。按文件名前缀、机型代码、产品名称、工序特征自动识别；识别不了记为 unknown，按主干规则归类并标注“未知类型，需复核”。新增设备品类需要三步：新增分支文件、在调度器注册、在识别函数加条件。
- **同格式输出**：每个机型一个 Sheet，表头第 1 行，保留源表前 12 列（A–L，原列顺序）与合并单元格，追加 M 主顺序 / N 子顺序；列宽、字体、填充、边框、冻结窗格按参考样张统一。
- **标黄排除**：自动排除标黄的检验频率/重要等级/检验记录表/备注列及黄色文件编号/版本。
- **GBK zip**：支持 Windows 下 GBK 文件名的 zip。
- **标准答案校验**：提供**与输入机型匹配**的标准答案 xlsx 时，逐行比对主顺序/子顺序；匹配不到时不做逐行比对。来源标记只出现在分析视图的“归类依据”列，同格式输出没有该列。
- **分析视图（可选）**：按 SIP 环节分组、带“归类依据/待确认项”的汇总表。

## 输出格式（默认同格式）

默认生成与参考样张同格式的工作簿：

- 每个机型一个 Sheet，表头在第 1 行。
- 保留源表前 12 列（A–L）并保持原列顺序（典型为 序号/检验工序/检验项目/检验标准/检验方法/检验工具，中间可能包含子项或空列），追加 M 主顺序、N 子顺序。
- 保留原合并单元格、列宽、字体、填充、边框、冻结窗格；行顺序保持原表顺序。
- 标点规范化为全角括号/冒号，折叠连续空格，`l/min` → `L/min`。

已用 SDC1D 参考样张逐项比对：**A–N 值差异 0，697 个合并单元格完全一致**；列宽、表头字体/填充、数据字体、边框均匹配。参考样张中个别单元格的手工换行设置（28 处）和主题色表示方式（8 处）不做硬编码复刻，输出保留源表自身的换行/主题色，视觉一致。

## 校验方式

规则支持用**与输入机型匹配的**标准答案 xlsx 逐行校验。标准答案通过 `--reference` 作为可选输入传入，**不随插件分发，也没有默认文件名或路径**；不传时脚本仍会正常归类。

标准答案的要求：

- 只读取**第一个工作表**。
- 表头行必须在前 **12 行**内，且包含 `序号`、`检验工序`、`检验项目`、`主顺序`、`子顺序`；`子顺序` 后面可以带说明文字。
- `机型代码` 需写在表头之前的单元格（表头之前 10 行内、不含表头，以“机型代码：”开头）；没有机型代码时只按工作表名匹配。
- `序号` 必须是数值或纯数字文本；非数字序号行会被跳过。
- 分析视图按“标准答案的工作表名出现在输入文件名中，**或**输入机型的 `机型代码` 与标准答案一致”匹配；同格式输出没有机型代码列，按 Sheet 名（= 机型文件名）匹配。
- 有标准答案但 M/N 为空的行计为“未完成校验”，不计为不符；所有校验路径（同格式生成脚本、分析视图、独立校验命令）共用 `sip_verify.py` 的同一口径。

## 使用

在 Claude Code 中直接说：

> 按 SIP 方法论归类这个 zip：`D:\path\input.zip`，输出到 `D:\path\output.xlsx`

如果有标准答案，再补一句（文件名由你指定）：

> 标准答案在 `D:\path\reference.xlsx`

或不带标准答案直接使用命令：

```text
/sip-classify --input "D:\path\input.zip" --output "D:\path\output.xlsx"
```

带标准答案：

```text
/sip-classify --input "D:\path\input.zip" --output "D:\path\output.xlsx" --reference "D:\path\reference.xlsx"
```

也可以直接运行同格式脚本。不带标准答案：

```bash
python -I skills/sip-methodology-classifier/scripts/build_reference_format.py \
  --input "D:\path\input.zip" \
  --output "D:\path\output.xlsx"
```

带标准答案：

```bash
python -I skills/sip-methodology-classifier/scripts/build_reference_format.py \
  --input "D:\path\input.zip" \
  --output "D:\path\output.xlsx" \
  --reference "D:\path\reference.xlsx"
```

需要按 SIP 环节分组的分析视图时：

```bash
python -I skills/sip-methodology-classifier/scripts/build_sip_mapping.py \
  --input "D:\path\input.zip" \
  --output "D:\path\analysis.xlsx" \
  --reference "D:\path\reference.xlsx"
```

校验已生成的文件（需要标准答案，适用于分析视图或同格式输出的机型 Sheet）：

```bash
python -I skills/sip-methodology-classifier/scripts/verify_against_reference.py \
  --output "D:\path\output.xlsx" \
  --reference "D:\path\reference.xlsx"
```

## 输出结构（默认同格式）

- `<机型>`：每个机型一个 Sheet，表头第 1 行，A–L 原列 + M 主顺序 / N 子顺序，保留原合并单元格与行顺序。

可选分析视图（`build_sip_mapping.py`）：

- `说明`：任务、标准答案校验、标黄处理、两层顺序模型、数据源、环节统计、同类工序统计。
- `<项目名>`：每条检验一行，列为主顺序、子顺序、机型文件、产品名称、机型代码、原序号、检验工序、检验项目、子项、检验标准、检验方法、检验工具、归类依据、设备族。
- `待确认项（规则推断）`：关键字推断的记录（只会落在主顺序 2–9、子顺序 1–5 级；完全无法推断时用 `(3. 通电检验, 5级)`），建议人工复核。

## 目录

```
sip-methodology-classifier/
├── .claude-plugin/plugin.json
├── README.md
├── commands/sip-classify.md
└── skills/sip-methodology-classifier/
    ├── SKILL.md
    ├── reference/order-model.md
    └── scripts/
        ├── sip_rules.py                  # 规则调度：合并主干+分支、决定优先级和归类依据
        ├── sip_rules_trunk.py            # 主干规则（9 主顺序、1–12 级、通用行级规则）
        ├── sip_family_sdc.py             # 分支：刀轮/晶圆切割机
        ├── sip_family_exp.py             # 分支：扩片机
        ├── sip_family_slg.py             # 分支：激光切割设备（草稿，待同事确认）
        ├── sip_family_detect.py          # 设备族识别（文件名/机型/产品/工序特征）
        ├── sip_source.py                 # 源表解析/项目发现（默认与分析脚本共用）
        ├── sip_verify.py                 # 标准答案校验（所有校验路径共用）
        ├── build_reference_format.py     # 默认：同格式输出（每机型一个 Sheet）
        ├── build_sip_mapping.py          # 可选：按环节分组的分析视图
        ├── extract_gbk_zip.py            # GBK zip 解压
        └── verify_against_reference.py   # 标准答案校验命令
```

## 注意

- 标准答案没有“共用”区：水气混行按行内容拆到通气或通水。
- 未解析/跳过行（序号非数字或标黄）：M/N 留空；脚本会打印行数，交付时必须报告。
- 规则推断行（未知工序）：由关键字规则推断，只会落在主顺序 2–9、子顺序 1–5 级；只有完全无法推断时才用 `(3. 通电检验, 5级)`。脚本会打印行数，建议复核，分析视图的“待确认项”会列出。
- 标准答案校验把 M/N 为空的空白行计为“未完成”，不计为不符。
- **不要假设标准答案的文件名或路径**：它是用户运行时可选的输入，由用户提供；插件内没有默认路径。
- 命中显式规则的新机型工序归为“同类工序/分支规则/主干规则”；未命中的进入分析视图的“待确认项”，需要文件编写同事复核后再补规则。
- SLG 分支目前是草稿（依据 MX-SLG1E 检验表和方法论课件整理），正式使用前需文件编写同事确认；确认前交付物应标注“草稿”。
- 同格式输出保持原表行顺序；需要按 SIP 环节分组查看时使用分析视图。
- 输入 xlsx/zip 视为不可信数据：不执行宏，不运行输入目录内的程序，脚本只用 `python -I` 运行。
