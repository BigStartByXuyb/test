# -*- coding: utf-8 -*-
"""解压文件名可能为 GBK 编码的 zip（Windows 下常见）。

用法：
  python -I extract_gbk_zip.py <zip路径> <输出目录>

安全：
  - 拒绝绝对路径、盘符路径和 .. 路径穿越；
  - 只写普通文件，不创建符号链接；
  - 输出目录必须为空或不存在。
"""
import os
import sys
import zipfile


def fix_name(name):
    """zipfile 对未标记 UTF-8 的名称按 cp437 解码；还原成 GBK。"""
    try:
        return name.encode('cp437').decode('gbk')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return name


def safe_target(root, name):
    name = fix_name(name).replace('\\', '/')
    if name.startswith('/') or (len(name) > 1 and name[1] == ':'):
        raise ValueError(f'拒绝绝对路径: {name}')
    parts = [p for p in name.split('/') if p not in ('', '.')]
    if any(p == '..' for p in parts):
        raise ValueError(f'拒绝路径穿越: {name}')
    target = os.path.join(root, *parts)
    root_abs = os.path.abspath(root)
    target_abs = os.path.abspath(target)
    if not (target_abs == root_abs or target_abs.startswith(root_abs + os.sep)):
        raise ValueError(f'拒绝越界路径: {name}')
    return target_abs


def extract(zip_path, dest_dir):
    os.makedirs(dest_dir, exist_ok=True)
    if os.listdir(dest_dir):
        raise ValueError(f'输出目录非空: {dest_dir}')
    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            target = safe_target(dest_dir, info.filename)
            if info.is_dir() or info.filename.endswith('/'):
                os.makedirs(target, exist_ok=True)
                continue
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with z.open(info) as src, open(target, 'wb') as out:
                out.write(src.read())
    return dest_dir


def main():
    if len(sys.argv) != 3:
        print('用法: python -I extract_gbk_zip.py <zip路径> <输出目录>', file=sys.stderr)
        return 2
    dest = extract(sys.argv[1], sys.argv[2])
    print(f'已解压到: {dest}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
