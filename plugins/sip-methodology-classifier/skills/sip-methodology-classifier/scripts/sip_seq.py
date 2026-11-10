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
