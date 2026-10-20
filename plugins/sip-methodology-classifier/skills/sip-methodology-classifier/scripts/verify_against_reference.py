# -*- coding: utf-8 -*-
"""用标准答案校验已生成的对应表。

用法：
  python -I verify_against_reference.py --output <对应表.xlsx> --reference <标准答案.xlsx>

输出：按机型文件逐行比对 主顺序/子顺序，打印一致/不一致数量与前若干条差异。
退出码：全部一致 0；有不一致 1；无法比对 2。
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from openpyxl import load_workbook
from sip_rules import load_reference, norm, header_key

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def read_output(path):
    """返回 {机型文件: {原序号: (主顺序, 子顺序)}}。"""
    wb = load_workbook(path, data_only=True)
    out = {}
    for ws in wb.worksheets:
        if ws.title == '说明' or ws.title.startswith('待确认'):
            continue
        # 表头行：含 主顺序/子顺序/机型文件/原序号
        hr = None
        for r in range(1, min(ws.max_row, 15) + 1):
            vals = [norm(ws.cell(r, c).value) for c in range(1, ws.max_column + 1)]
            if '主顺序' in vals and '子顺序' in vals and '机型文件' in vals and '原序号' in vals:
                hr = r
                break
        if hr is None:
            continue
        col = {}
        for c in range(1, ws.max_column + 1):
            v = header_key(ws.cell(hr, c).value)
            if v and v not in col:
                col[v] = c
        c_file = col['机型文件']
        c_seq = col['原序号']
        c_main = col['主顺序']
        c_sub = col['子顺序']
        for r in range(hr + 1, ws.max_row + 1):
            f = ws.cell(r, c_file).value
            seq = ws.cell(r, c_seq).value
            main = ws.cell(r, c_main).value
            sub = ws.cell(r, c_sub).value
            if not f or not isinstance(seq, (int, float)) or not main or not sub:
                continue
            out.setdefault(str(f), {})[int(seq)] = (str(main).strip(), str(sub).strip())
    return out


def main():
    ap = argparse.ArgumentParser(description='用标准答案校验已生成的对应表')
    ap.add_argument('--output', required=True, help='生成的对应表 xlsx')
    ap.add_argument('--reference', required=True, help='标准答案 xlsx')
    args = ap.parse_args()

    ref = load_reference(args.reference)
    out = read_output(args.output)
    targets = []
    for f in out:
        if ref.get('sheet_title') and ref['sheet_title'].lower() in f.lower():
            targets.append(f)
    if not targets:
        print(f'无法比对：输出中没有与标准答案 sheet“{ref.get("sheet_title")}”匹配的机型文件')
        return 2

    total_ok = total_bad = 0
    for f in sorted(targets):
        ok = bad = 0
        diffs = []
        for seq, got in sorted(out[f].items()):
            exp = ref['seq'].get(seq)
            if exp is None:
                continue
            if got == exp:
                ok += 1
            else:
                bad += 1
                if len(diffs) < 10:
                    diffs.append((seq, got, exp))
        total_ok += ok
        total_bad += bad
        print(f'{f}: {ok}/{ok + bad} 一致, {bad} 不符')
        for d in diffs:
            print('  ', d)
    print(f'合计: {total_ok}/{total_ok + total_bad} 一致, {total_bad} 不符')
    return 0 if total_bad == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
