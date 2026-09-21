// MasterGoPageNodeId —— 按名字查 MasterGo 设计稿节点的页面 ID（MTSLG IOContorl 页面用）。
//
// 唯一用途：开发手写 XML 控件时，需要知道"设计稿上这个控件该用哪个 ID"。
//   ID = "MX_" + sha256(页面键 + "\n" + 节点 ref) 前 32 位小写十六进制
//        页面键 = 快照根节点自己的 id（= 设计帧 layerId）   节点 ref = 全路径 ref
// 该公式与插件脚本 scripts/lib/page-node-id.js 完全一致（口径见 mtslg-mode.md「页面节点 ID 口径」）。
//
// 用法：
//   MasterGoPageNodeId.exe 确认按钮                 # 按关键词查（多个关键词 = 全部命中）
//   MasterGoPageNodeId.exe 调光 F7                  # 名称/文本/自身 layer_id 里都找
//   MasterGoPageNodeId.exe --all                    # 列出全部节点
//   MasterGoPageNodeId.exe 调光 --snapshot X.json   # 指定快照（默认在本 exe 同目录找）
//
// 编译（Windows 自带 csc，无需装任何东西）：
//   C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:exe
//       /r:System.Web.Extensions.dll /out:MasterGoPageNodeId.exe PageNodeId.cs
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

internal static class PageNodeId
{
    private const string IdPrefix = "MX_";

    private sealed class NodeRow
    {
        public string Ref;
        public string Name = "";
        public string Text = "";
        public string LayerId = "";
        public double X;
        public double Y;
    }

    private static int Main(string[] args)
    {
        try { Console.OutputEncoding = new UTF8Encoding(false); } catch { /* 老控制台忽略 */ }

        string snapshotPath = null;
        bool all = false;
        List<string> keywords = new List<string>();
        for (int i = 0; i < args.Length; i++)
        {
            string a = args[i];
            if (a == "--snapshot" && i + 1 < args.Length) { snapshotPath = args[++i]; continue; }
            if (a == "--all") { all = true; continue; }
            if (a == "-h" || a == "--help" || a == "/?") { Usage(); return 0; }
            if (a.StartsWith("--")) { Console.Error.WriteLine("未知参数: " + a); Usage(); return 2; }
            keywords.Add(a);
        }
        if (!all && keywords.Count == 0) { Usage(); return 0; }

        if (snapshotPath == null) snapshotPath = FindSnapshot();
        if (snapshotPath == null)
        {
            Console.Error.WriteLine("没找到 DSL 快照（dsl.snapshot.json / getDsl.json）。");
            Console.Error.WriteLine("请用 --snapshot <文件> 指定，或把快照放到本 exe 同目录。");
            return 2;
        }

        Dictionary<string, object> root;
        try { root = LoadSnapshot(snapshotPath); }
        catch (Exception ex)
        {
            Console.Error.WriteLine("读取快照失败: " + ex.Message);
            return 2;
        }

        string pageKey = Str(root, "id");
        if (pageKey.Length == 0)
        {
            Console.Error.WriteLine("快照根节点缺少 id，无法派生页面节点 ID");
            return 2;
        }

        List<NodeRow> rows = new List<NodeRow>();
        Walk(root, 0.0, 0.0, rows);

        Console.WriteLine("快照: " + snapshotPath);
        Console.WriteLine("页面键: " + pageKey + "    节点数: " + rows.Count);
        Console.WriteLine();

        int matched = 0;
        foreach (NodeRow row in rows)
        {
            if (!all && !Matches(row, keywords)) continue;
            matched++;
            Console.WriteLine(IdOf(pageKey, row.Ref) + "  " + Describe(row));
        }

        Console.WriteLine();
        if (all) Console.WriteLine("共 " + rows.Count + " 个节点。");
        else Console.WriteLine("匹配 " + matched + " 个节点" + (matched == 0 ? "（换个关键词，或用 --all 看全部）" : "") + "。");
        return matched == 0 && !all ? 1 : 0;
    }

    private static string Describe(NodeRow row)
    {
        StringBuilder sb = new StringBuilder();
        sb.Append("名称：").Append(row.Name.Length == 0 ? "(未命名)" : row.Name);
        if (row.Text.Length > 0) sb.Append("  文本：").Append(row.Text.Replace("\n", " "));
        sb.Append("  layer_id：").Append(row.LayerId);
        sb.Append("  位置：").Append(row.X.ToString("0.##")).Append(",").Append(row.Y.ToString("0.##"));
        return sb.ToString();
    }

    private static bool Matches(NodeRow row, List<string> keywords)
    {
        string haystack = (row.Name + "\n" + row.Text + "\n" + row.LayerId + "\n" + row.Ref).ToLowerInvariant();
        for (int i = 0; i < keywords.Count; i++)
        {
            if (haystack.IndexOf(keywords[i].ToLowerInvariant(), StringComparison.Ordinal) < 0) return false;
        }
        return true;
    }

    // ID = MX_ + sha256(页面键 + "\n" + ref) 前 32 位小写十六进制（与插件 JS 实现同口径）。
    private static string IdOf(string pageKey, string reference)
    {
        using (SHA256 sha = SHA256.Create())
        {
            byte[] bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(pageKey + "\n" + reference));
            StringBuilder hex = new StringBuilder(32);
            for (int i = 0; i < 16; i++) hex.Append(bytes[i].ToString("x2"));
            return IdPrefix + hex.ToString();
        }
    }

    private static void Walk(Dictionary<string, object> node, double x, double y, List<NodeRow> rows)
    {
        string reference = Str(node, "id");
        if (reference.Length == 0) return;

        Dictionary<string, object> style = Dict(node, "layoutStyle");
        double relX = Num(style, "relativeX");
        double relY = Num(style, "relativeY");
        double absX = x + relX;
        double absY = y + relY;

        NodeRow row = new NodeRow();
        row.Ref = reference;
        row.Name = Str(node, "name");
        row.Text = TextOf(node);
        int slash = reference.LastIndexOf('/');
        row.LayerId = slash >= 0 ? reference.Substring(slash + 1) : reference;
        row.X = absX;
        row.Y = absY;
        rows.Add(row);

        foreach (Dictionary<string, object> child in Children(node)) Walk(child, absX, absY, rows);
    }

    private static string TextOf(Dictionary<string, object> node)
    {
        object value;
        if (!node.TryGetValue("text", out value)) return "";
        StringBuilder sb = new StringBuilder();
        foreach (Dictionary<string, object> part in AsDicts(value))
        {
            sb.Append(Str(part, "text"));
        }
        return sb.ToString();
    }

    private static Dictionary<string, object> LoadSnapshot(string path)
    {
        string text = File.ReadAllText(path, new UTF8Encoding(false));
        JavaScriptSerializer serializer = new JavaScriptSerializer();
        serializer.MaxJsonLength = int.MaxValue;
        object parsed = serializer.DeserializeObject(text);
        Dictionary<string, object> top = parsed as Dictionary<string, object>;
        if (top == null) throw new Exception("JSON 顶层不是对象");
        Dictionary<string, object> dsl = DictOrNull(top, "dsl");
        if (dsl == null) throw new Exception("缺少 dsl 字段（需要 getDsl 输出或 dsl.snapshot.json）");
        List<Dictionary<string, object>> nodes = AsDicts(dsl.ContainsKey("nodes") ? dsl["nodes"] : null);
        if (nodes.Count == 0) throw new Exception("dsl.nodes 为空");
        return nodes[0];
    }

    private static string FindSnapshot()
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        string[] names = new string[] { "dsl.snapshot.json", "getDsl.json" };
        // 从 exe 所在目录向上最多 3 层，每层都算上它自己与它的 Generated\：
        // 这样「exe 放在 <项目>\tools\page-node-id\」这种布局也能找到 <项目>\Generated\...。
        List<string> dirs = new List<string>();
        DirectoryInfo info = new DirectoryInfo(dir);
        for (int up = 0; info != null && up <= 3; up++)
        {
            dirs.Add(info.FullName);
            dirs.Add(Path.Combine(info.FullName, "Generated"));
            info = info.Parent;
        }
        // 采集产物按页归档后位于 <项目>/Generated/runs/<页面名>/，把每个页面目录也列为候选。
        foreach (string baseDir in dirs.ToArray())
        {
            string runs = Path.Combine(baseDir, "runs");
            if (!Directory.Exists(runs)) continue;
            foreach (string pageDir in Directory.GetDirectories(runs)) dirs.Add(pageDir);
        }
        foreach (string d in dirs)
        {
            foreach (string n in names)
            {
                string candidate = Path.Combine(d, n);
                if (File.Exists(candidate)) return candidate;
            }
        }
        return null;
    }

    private static Dictionary<string, object> Dict(Dictionary<string, object> source, string key)
    {
        Dictionary<string, object> hit = DictOrNull(source, key);
        return hit == null ? new Dictionary<string, object>() : hit;
    }

    private static Dictionary<string, object> DictOrNull(Dictionary<string, object> source, string key)
    {
        object value;
        if (source == null || !source.TryGetValue(key, out value)) return null;
        return value as Dictionary<string, object>;
    }

    private static string Str(Dictionary<string, object> source, string key)
    {
        object value;
        if (source == null || !source.TryGetValue(key, out value) || value == null) return "";
        return Convert.ToString(value);
    }

    private static double Num(Dictionary<string, object> source, string key)
    {
        object value;
        if (source == null || !source.TryGetValue(key, out value) || value == null) return 0.0;
        try { return Convert.ToDouble(value); }
        catch { return 0.0; }
    }

    private static List<Dictionary<string, object>> Children(Dictionary<string, object> node)
    {
        object value;
        if (node == null || !node.TryGetValue("children", out value)) return new List<Dictionary<string, object>>();
        return AsDicts(value);
    }

    private static List<Dictionary<string, object>> AsDicts(object value)
    {
        List<Dictionary<string, object>> list = new List<Dictionary<string, object>>();
        IEnumerable items = value as IEnumerable;
        if (items == null) return list;
        foreach (object item in items)
        {
            Dictionary<string, object> dict = item as Dictionary<string, object>;
            if (dict != null) list.Add(dict);
        }
        return list;
    }

    private static void Usage()
    {
        Console.WriteLine("MasterGoPageNodeId —— 按名字查 MasterGo 设计稿节点的页面 ID");
        Console.WriteLine();
        Console.WriteLine("  MasterGoPageNodeId.exe <关键词> [<关键词>...]   # 名称/文本/layer_id 全部命中才列出");
        Console.WriteLine("  MasterGoPageNodeId.exe --all                    # 列出全部节点");
        Console.WriteLine("  MasterGoPageNodeId.exe <关键词> --snapshot <dsl.snapshot.json|getDsl.json>");
        Console.WriteLine();
        Console.WriteLine("默认在本 exe 同目录（及其 Generated/、上一级目录）里查找 dsl.snapshot.json / getDsl.json。");
        Console.WriteLine("输出：<页面 ID>  名称：…  文本：…  layer_id：…  位置：x,y");
    }
}
