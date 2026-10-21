# -*- coding: utf-8 -*-
"""用标准答案校验已生成的对应表。

用法：
  python -I verify_against_reference.py --output <对应表.xlsx> --reference <标准答案.xlsx>

与 build_reference_format.py 共用 sip_verify 的同一套判定：
  - 同格式输出：Sheet 名 = 机型文件，A 列序号 + M/N。
  - 分析视图：机型文件/原序号 + M/N，可按机型代码匹配。
  - 有标准答案但 M/N 为空的行计为“未完成”，不计为不符。

退出码：全部一致 0；有不符或空缺 1；无法比对 / 未完成 2。
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from sip_rules import load_reference
from sip_verify import verify_file, format_results, exit_code

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def main():
    ap = argparse.ArgumentParser(description='用标准答案校验已生成的对应表')
    ap.add_argument('--output', required=True, help='生成的对应表 xlsx')
    ap.add_argument('--reference', required=True,
                    help='标准答案 xlsx（第一个工作表，表头含 序号/检验工序/检验项目/主顺序/子顺序）')
    args = ap.parse_args()

    ref = load_reference(args.reference)
    results = verify_file(args.output, ref)
    print('\n'.join(format_results(results)))
    return exit_code(results)


if __name__ == '__main__':
    sys.exit(main())
