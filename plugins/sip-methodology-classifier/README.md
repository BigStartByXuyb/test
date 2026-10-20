# sip-methodology-classifier

把 MAXWELL《成品检验指导书》Excel 按 **SIP 方法论**归类，输出可直接评审/归档的顺序对应表。

## 安装

```text
/plugin install sip-methodology-classifier --marketplace BigStartByXuyb/Plugins
```

## 能力

- **两层顺序模型**
  - 主顺序：9 个环节（铭牌核对 → 外观检验 → 通电检验 → 通气检验 → 通水检验 → 老化测试 → 工艺验证 → 通断电检验 → 备份杀毒检验）
  - 子顺序：每个环节内部 1级 → 12级
- **多项目分表**：一级子文件夹 = 项目（如 `刀轮/`、`扩片/`），每个项目一个 Sheet。
- **标黄排除**：自动排除标黄的检验频率/重要等级/检验记录表/备注列及黄色文件编号/版本。
- **GBK zip**：支持 Windows 下 GBK 文件名的 zip。
- **标准答案校验**：提供同事确认的标准答案 xlsx 时，自动标记“标准答案/同类工序”，并逐行比对主顺序/子顺序。
- **归类依据**：每条记录标注来源；关键字兜底项进入“待确认项”Sheet。

## 已验证

用团队标准答案 `SIP方法论-SDC1D.xlsx` 校验：**SDC1D 408/408 行**的主顺序与子顺序完全一致。

## 使用

在 Claude Code 中直接说：

> 按 SIP 方法论归类这个 zip：`D:\path\刀轮.zip`，输出到 `D:\path\SIP对应表.xlsx`
> 标准答案在 `D:\path\SIP方法论-SDC1D.xlsx`

或使用命令：

```
/sip-classify --input "D:\path\刀轮.zip" --output "D:\path\SIP对应表.xlsx" --reference "D:\path\SIP方法论-SDC1D.xlsx"
```

也可以直接运行脚本：

```bash
python -I skills/sip-methodology-classifier/scripts/build_sip_mapping.py \
  --input "D:\path\刀轮.zip" \
  --output "D:\path\SIP对应表.xlsx" \
  --reference "D:\path\SIP方法论-SDC1D.xlsx"
```

校验已生成的文件：

```bash
python -I skills/sip-methodology-classifier/scripts/verify_against_reference.py \
  --output "D:\path\SIP对应表.xlsx" \
  --reference "D:\path\SIP方法论-SDC1D.xlsx"
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
- 新机型特有工序属于“同类工序”推断；全新技术路线的新工序会进入“待确认项”，需要文件编写同事复核后再补规则。
- 输入 xlsx/zip 视为不可信数据：不执行宏，不运行输入目录内的程序，脚本只用 `python -I` 运行。
