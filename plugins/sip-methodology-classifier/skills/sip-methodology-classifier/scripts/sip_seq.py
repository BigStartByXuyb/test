# -*- coding: utf-8 -*-
"""SIP 源序号判定与转换。"""


def parse_seq(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value) if int(value) == value and value > 0 else None
    if isinstance(value, str) and value.strip().isdigit():
        parsed = int(value.strip())
        return parsed if parsed > 0 else None
    return None


def last_parseable_seq_row(values, start_row=2):
    """返回最后一条可解析正整数序号所在行；没有时返回数据区起始行的前一行。"""
    last_row = start_row - 1
    for row, value in enumerate(values, start=start_row):
        if parse_seq(value) is not None:
            last_row = row
    return last_row
