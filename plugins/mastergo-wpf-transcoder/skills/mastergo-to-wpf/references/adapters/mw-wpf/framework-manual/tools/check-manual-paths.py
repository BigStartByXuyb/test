#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MW 框架手册 路径令牌 校验/更新工具

令牌约定（见 00-guide/02-evidence-policy.md 第 4 节）:
  {framework_root}  含 framework.config.json 的目录（动态入口）
  {source_root}     framework.config.json 的 source_root（框架源码/refence 目录）
  {index_root}      framework.config.json 的 index_root（ai-index 目录）
  {demo_root}       manual.config.json 的 demo_root（P3 可编译 Demo）

用法:
  python check-manual-paths.py                    校验手册内所有令牌引用的 file:line 是否存在
  python check-manual-paths.py --update           迁移模式: 把旧绝对路径一次性改写为令牌
  python check-manual-paths.py --source-root <dir>   临时指向新源码位置校验（动态更新验证）
  python check-manual-paths.py --demo-root <dir>     临时指向新 Demo 位置
  python check-manual-paths.py --framework-root <dir> 指定框架根目录
"""
import argparse
import json
import os
import re
import sys

MANUAL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKENS = ("framework_root", "source_root", "index_root", "demo_root")

# 旧绝对路径 → 令牌（--update 模式用；顺序即优先级）
LEGACY = [
    (r"D:[/\\]Test-Work-MW[/\\]framework\.config\.json", "{framework_root}/framework.config.json"),
    (r"D:[/\\]Test-Work-MW[/\\]docs[/\\]ai-index", "{index_root}"),
    (r"D:[/\\]Test-Work-MW[/\\]MasterGo_WPF_V0\.0\.3", "{demo_root}"),
    (r"D:[/\\]MW-Framework-Reference[/\\]refence", "{source_root}"),
    (r"D:[/\\]Test-Work-MW[/\\]refence", "{source_root}"),
    (r"sources=\[refence/", "sources=[{source_root}/"),
    (r"sources=\[docs/ai-index/", "sources=[{index_root}/"),
    (r"refence/ManualView\.xaml", "{source_root}/ManualView.xaml"),
    (r"refence/Geometries\.xaml", "{source_root}/Geometries.xaml"),
    (r"refence/SDC/", "{source_root}/SDC/"),
    (r"MasterGo_WPF_V0\.0\.3[/\\]App\.xaml", "{demo_root}/App.xaml"),
]

# 引用解析：{token}/相对路径[:行或行-行]（路径只含 ASCII 文件名字符，冒号天然终结路径段）
CITE_RE = re.compile(r"\{([a-z_]+)\}([A-Za-z0-9_./\\*+-]+)(?::(\d+)(?:-(\d+))?)?")

def norm(p):
    return os.path.normpath(p).replace("\\", "/") if p else p

def find_framework_root(start):
    d = os.path.abspath(start)
    while True:
        if os.path.isfile(os.path.join(d, "framework.config.json")):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            return None
        d = parent

def load_tokens(cli):
    fw_root = cli.framework_root or find_framework_root(MANUAL_ROOT)
    if not fw_root:
        sys.exit("错误：未找到 framework.config.json（可用 --framework-root 指定）")
    with open(os.path.join(fw_root, "framework.config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    tokens = {
        "framework_root": norm(fw_root),
        "source_root": norm(cfg.get("source_root")),
        "index_root": norm(cfg.get("index_root")),
        "demo_root": None,
    }
    local = os.path.join(MANUAL_ROOT, "manual.config.json")
    if os.path.isfile(local):
        with open(local, encoding="utf-8") as f:
            lc = json.load(f)
        for k in ("source_root", "index_root", "demo_root"):
            if lc.get(k):
                tokens[k] = norm(lc[k])
    for k in ("source_root", "index_root", "demo_root", "framework_root"):
        v = getattr(cli, k, None)
        if v:
            tokens[k] = norm(v)
    return tokens

def md_files():
    out = []
    for root, dirs, files in os.walk(MANUAL_ROOT):
        dirs[:] = [d for d in dirs if d != "tools"]
        if ".git" in root:
            continue
        for fn in files:
            if fn.endswith(".md"):
                out.append(os.path.join(root, fn))
    return sorted(out)

def update_mode(tokens):
    total = 0
    for path in md_files():
        with open(path, encoding="utf-8") as f:
            text = f.read()
        orig, changed = text, 0
        for pat, repl in LEGACY:
            text, n = re.subn(pat, repl, text)
            changed += n
        if text != orig:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(text)
            total += changed
            rel = os.path.relpath(path, MANUAL_ROOT)
            print(f"[update] {rel}: {changed} 处改写")
    print(f"[update] 完成，共 {total} 处")
    print("[update] 令牌解析当前值:")
    for k in TOKENS:
        print(f"    {k} = {tokens.get(k) or '(未配置)'}")

def check_mode(tokens):
    line_cache = {}
    problems, warnings, ok = [], [], 0
    for path in md_files():
        rel = os.path.relpath(path, MANUAL_ROOT)
        if rel.startswith("templates" + os.sep):
            continue  # 模板文件内的 XXX.xaml 等是占位符，不校验
        with open(path, encoding="utf-8") as f:
            text = f.read()
        for m in CITE_RE.finditer(text):
            name, relp = m.group(1), m.group(2)
            ln, ln2 = m.group(3), m.group(4)
            if name not in TOKENS:
                continue
            base = tokens.get(name)
            if not base:
                problems.append(f"{rel}: {m.group(0)} -> 令牌 {{{name}}} 未配置")
                continue
            target = norm(os.path.join(base, relp.lstrip("/\\")))
            ok_file = True
            if target.endswith("/**"):
                ok_file = os.path.isdir(target[:-3])
            elif "*" in target:
                ok_file = os.path.isdir(os.path.dirname(target))
            else:
                ok_file = os.path.exists(target)  # 文件或目录均可
            if not ok_file:
                problems.append(f"{rel}: {m.group(0)} -> 不存在: {target}")
                continue
            if ln and os.path.isfile(target):
                if target not in line_cache:
                    try:
                        with open(target, encoding="utf-8", errors="replace") as f:
                            line_cache[target] = sum(1 for _ in f)
                    except OSError:
                        line_cache[target] = -1
                n = line_cache[target]
                if n >= 0 and (int(ln) > n or (ln2 and int(ln2) > n)):
                    # 行号只是快速跳转提示，漂移不算错误
                    warnings.append(f"{rel}: {m.group(0)} -> 行号越界(文件仅 {n} 行，仅提示不报错): {target}")
            ok += 1
    print(f"[check] 有效引用 {ok} 处")
    if warnings:
        print(f"[check] 行号提示 {len(warnings)} 处(锚点有效，不报错):")
        for w in warnings:
            print("    " + w)
    if problems:
        print(f"[check] 问题 {len(problems)} 处:")
        for p in problems:
            print("    " + p)
        sys.exit(1)
    print("[check] 全部通过")
    for k in TOKENS:
        print(f"    {k} = {tokens.get(k) or '(未配置)'}")

def strip_lines_mode():
    """清除手册中的行号提示（行号易漂移，证据以文件+锚点为准）。
    跳过：evidence-policy（格式示例）与 pending-confirmations（回填档案）。"""
    pat_file = re.compile(
        r"((?:\{[a-z_]+_root\}[A-Za-z0-9_./\\*+-]*|[A-Za-z0-9_./\\*+-]*\.(?:xaml|json|md))):\d+(?:[-,]\d+)*"
    )
    pat_bare = re.compile(r"[（(]\s*:\d+(?:[-,]\d+)*\s*[)）]")
    skip = {"00-guide" + os.sep + "02-evidence-policy.md",
            "05-best-practices" + os.sep + "pending-confirmations.md"}
    total = 0
    for path in md_files():
        rel = os.path.relpath(path, MANUAL_ROOT)
        if rel in skip:
            continue
        with open(path, encoding="utf-8") as f:
            text = f.read()
        text, n1 = pat_file.subn(r"\1", text)
        text, n2 = pat_bare.subn("", text)
        if n1 + n2:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(text)
            total += n1 + n2
            print(f"[strip] {rel}: 清除 {n1 + n2} 处行号")
    print(f"[strip] 完成，共清除 {total} 处行号提示")


def main():
    ap = argparse.ArgumentParser(description="MW 框架手册路径令牌校验/更新")
    ap.add_argument("--update", action="store_true", help="把旧绝对路径改写为令牌")
    ap.add_argument("--strip-lines", action="store_true", help="清除手册中的行号提示")
    ap.add_argument("--framework-root", help="framework.config.json 所在目录")
    ap.add_argument("--source-root", help="临时指向源码位置")
    ap.add_argument("--index-root", help="临时指向 ai-index 位置")
    ap.add_argument("--demo-root", help="临时指向 Demo 位置")
    cli = ap.parse_args()
    tokens = load_tokens(cli)
    if cli.update:
        update_mode(tokens)
    elif cli.strip_lines:
        strip_lines_mode()
    else:
        check_mode(tokens)

if __name__ == "__main__":
    main()
