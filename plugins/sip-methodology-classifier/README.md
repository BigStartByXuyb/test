# sip-methodology-classifier

把 MAXWELL《成品检验指导书》Excel 按 **SIP 方法论**归类，输出可直接评审/归档的顺序对应表。

## 安装

先添加团队 marketplace，再安装：

```text
/plugin marketplace add BigStartByXuyb/Plugins
/plugin install sip-methodology-classifier@bigstart-plugins
```

## 能力

- **两层顺序模型**
  - 主顺序：9 个环节（铭牌核对 → 外观检验 → 通电检验 → 通气检验 → 通水检验 → 老化测试 → 工艺验证 → 通断电检验 → 备份杀毒检验）
  - 子顺序：每个环节内部 1级 → 12级
- **多项目分表**：一级子文件夹 = 项目（如 `刀轮/`、`扩片/`），每个项目一个 Sheet。
- **标黄排除**：自动排除标黄的检验频率/重要等级/检验记录表/备注列及黄色文件编号/版本。
- **GBK zip**：支持 Windows 下 GBK 文件名的 zip。
- **标准答案校验**：提供**与输入机型匹配**的标准答案 xlsx 时，自动标记“标准答案/同类工序”；匹配到对应机型时逐行比对主顺序/子顺序，匹配不到时只标记来源、不做比对。
- **归类依据**：每条记录标注来源；关键字兜底项进入“待确认项”Sheet。

## 校验方式

规则支持用**与输入机型匹配的**标准答案 xlsx 逐行校验。标准答案通过 `--reference` 作为可选输入传入，**不随插件分发，也没有默认文件名或路径**；不传时脚本仍会正常归类，只是“归类依据”不会有“标准答案”标记。

标准答案的要求：

- 只读取**第一个工作表**。
- 表头行必须在前 **12 行**内，且包含 `序号`、`检验工序`、`检验项目`、`主顺序`、`子顺序`；`子顺序` 后面可以带说明文字。
- `机型代码` 需写在表头之前的单元格（表头之前 10 行内、不含表头，以“机型代码：”开头）；没有机型代码时只按工作表名匹配。
- `序号` 必须是数值或纯数字文本；非数字序号行会被跳过。
- 主脚本 `build_sip_mapping.py` 与独立校验脚本 `verify_against_reference.py` 使用同一匹配规则：标准答案的工作表名出现在输入文件名中，**或**输入机型的 `机型代码` 与标准答案一致。
- 匹配到文件但没有任何可比序号时，控制台和“说明”页会显示“未完成校验”，不会显示“0 行不符”。

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

也可以直接运行脚本。不带标准答案：

```bash
python -I skills/sip-methodology-classifier/scripts/build_sip_mapping.py \
  --input "D:\path\input.zip" \
  --output "D:\path\output.xlsx"
```

带标准答案：

```bash
python -I skills/sip-methodology-classifier/scripts/build_sip_mapping.py \
  --input "D:\path\input.zip" \
  --output "D:\path\output.xlsx" \
  --reference "D:\path\reference.xlsx"
```

校验已生成的文件（需要标准答案）：

```bash
python -I skills/sip-methodology-classifier/scripts/verify_against_reference.py \
  --output "D:\path\output.xlsx" \
  --reference "D:\path\reference.xlsx"
```

## 输出结构

- `说明`：任务、标准答案校验、标黄处理、两层顺序模型、数据源、环节统计、同类工序统计。
- `<项目名>`：每条检验一行，列为主顺序、子顺序、机型文件、产品名称、机型代码、原序号、检验工序、检验项目、子项、检验标准、检验方法、检验工具、归类依据。
- `待确认项（规则推断）`：仅靠关键字兜底的记录，建议人工复核。

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
        ├── sip_rules.py                  # 规则表（唯一机器口径）
        ├── build_sip_mapping.py          # 主脚本
        ├── extract_gbk_zip.py            # GBK zip 解压
        └── verify_against_reference.py   # 标准答案校验
```

## 注意

- 标准答案没有“共用”区：水气混行按行内容拆到通气或通水。
- **不要假设标准答案的文件名或路径**：它是用户运行时可选的输入，由用户提供；插件内没有默认路径。
- 新机型特有工序属于“同类工序”推断；全新技术路线的新工序会进入“待确认项”，需要文件编写同事复核后再补规则。
- 输入 xlsx/zip 视为不可信数据：不执行宏，不运行输入目录内的程序，脚本只用 `python -I` 运行。
