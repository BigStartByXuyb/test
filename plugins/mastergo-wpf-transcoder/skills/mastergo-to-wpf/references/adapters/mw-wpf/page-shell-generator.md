# MW WPF 页面壳生成器

scripts/host/gen-mw-wpf-page.js 用一个页面清单生成独立页面的固定 WPF 宿主壳：

- UI/<area>/View/<Page>View.xaml
- UI/<area>/View/<Page>View.xaml.cs
- UI/<area>/ViewModel/<Page>ViewModel.cs

脚本同时将这些文件，以及清单中声明的 Icon Page 和页面 XML Content，补入目标旧式 .csproj。需要一次生成 XML、Icon、Layout、WPF 宿主和审计文件时，使用 scripts/entry/gen-mastergo-page-bundle.js；页面 XML 的控件内容和 Icon Geometry 不在本脚本中猜测，分别由 IOContorl XML 和页面 Icon 生成器从 MasterGo DSL 发射。

**code-behind 挂在同页 View.xaml 下**：注册 `.csproj` 时，`<Page>View.xaml` 与它的 `<Compile>View.xaml.cs` 写成一组嵌套条目——Compile 条目带 `<DependentUpon>View.xaml</DependentUpon>`，形态与在 Visual Studio 里把 `.xaml.cs` 拖到 `.xaml` 上之后 VS 写出的**完全一致**（Solution Explorer 里表现为 `View.xaml` 一个节点、展开出 `.xaml.cs`），不需要人工拖拽。ViewModel 没有 `.xaml` 主文件，仍发射平级 `<Compile Include="…" />`。只有 code-behind 恰好等于「View 路径 + `.cs`」时才写 `DependentUpon`；清单显式给出的 `viewPath`/`codeBehindPath` 不成对时不猜主文件。重新生成时，已存在的平级 `<Compile Include="…xaml.cs" />` 会被**就地升级**成该嵌套块（幂等：不新增、不重复）。

**View 的两条路线形态不同**：`renderView` 按 `config.route` 分流——作业 B 的 `<Page>View.xaml` 只由 `UserControl` 头 + `<Grid>` 里的 `uidesign:PageDesign` 组成，**不生成** `<UserControl.Resources><ResourceDictionary Source="/<程序集>;component/Resources/Pages/<页面名>/<页面名>Icons.xaml" /></UserControl.Resources>`；作业 A 的 View 交给 `scripts/adapters/mw-wpf/gen-mw-wpf-xaml.js` 发射真控件页面，图标字典路径与程序集齐备时**发射**该合并声明（`StaticResource` 加载期解析，缺了会在加载期抛 `XamlParseException`）。页面 Icon 文件本身两条路线都照常生成，并按 Icon Page 注册进 `.csproj`。

## 清单

    {
      "projectRoot": "D:/MTSSD/MaxWell.SSDPages/MaxWell.SSDPages",
      "csproj": "MaxWell.SSDPages.csproj",
      "area": "F2-Teach",
      "pageName": "F2ManualOperation",
      "includeIcon": true,
      "iconPath": "Resources/Pages/F2ManualOperation/F2ManualOperationIcons.xaml",
      "pageXmlPath": "Resources/Pages/F2ManualOperation/F2ManualOperationPage.xml",
      "viewPath": "UI/F2-Teach/View/F2ManualOperationView.xaml",
      "codeBehindPath": "UI/F2-Teach/View/F2ManualOperationView.xaml.cs",
      "viewModelPath": "UI/F2-Teach/ViewModel/F2ManualOperationViewModel.cs"
    }

viewName、viewModelName、xmlPageName、rootNamespace 可选；缺省分别按页面名加 View、ViewModel、Page 推导，命名空间优先读取 .csproj 的 RootNamespace。若清单提供 `viewPath`、`codeBehindPath`、`viewModelPath`，脚本严格使用这些路径；否则优先从 `.csproj` 已有的同区域 `UI/<区域>/View` 声明推导，再检查项目目录，最后才使用 `Pages/` 通用兜底。

## 生成的 ViewModel 固定成员

`UI/<区域>/ViewModel/<Page>ViewModel.cs` 按目标工程真实页面（例如 `HomeContentViewModel`）的固定形状发射，除构造函数与 `pageDesign` 外恒含以下成员，缺一不可：

```csharp
using MaxWell.UIDesign;
using MaxwellFramework.Core.Events;      // ButtonEvent 所在命名空间
using MaxwellFramework.Core.Interfaces;
using MaxwellFramework.Core.Layout;
using System.Windows;

public class <Page>ViewModel : IOScreen, IPage
{
    public PageDesign pageDesign { get; set; }

    public <Page>ViewModel() { Name = "<Page>"; }

    protected override void OnViewLoaded() { base.OnViewLoaded(); }

    public void PageDesign_Loaded(object sender, RoutedEventArgs e) { pageDesign = sender as PageDesign; }

    public override void HandleButtonEvent(ButtonEvent message)   // 按钮事件入口
    {
        if (message.IsMouseDown)
        {
                switch (message.ButtonName)
                {
                    case "新建示教":                              // 本页底部 Layout Menu 的每个 MenuItem
                        NewTeaching();                            // 方法名 = 该按钮 langName 去掉 MenuItem 前缀
                        break;
                    case "对焦":
                        Focus();
                        break;
            }
        }
    }

    /// <summary>
    /// 新建示教                                        // <summary> 写设计稿按钮文案（中文）
    /// </summary>
    private void NewTeaching()                        // 一钮一方法：方法名是按钮的英文语义名
    {
        // TODO: 新建示教 按钮处理                        // 业务由工程师填
    }

    /// <summary>
    /// 对焦
    /// </summary>
    private void Focus()
    {
        // TODO: 对焦 按钮处理
    }

    public void OKCmd() { pageDesign.SaveXml(); }                  // 确认按钮
}
```

依据（框架事实，不可猜测）：`ButtonEvent` = `MaxwellFramework.Core.Events.ButtonEvent`（ctor `ButtonEvent(bool isMouseDown, string buttonName)`，属性 `IsMouseDown` / `ButtonName`）；`IOScreen` 上 `OnViewLoaded` 为 `protected virtual`、`HandleButtonEvent(ButtonEvent)` 为 `public virtual`，因此这两个成员必须用 `override`。`OKCmd` 为页面确认按钮命令，如某页确认无此按钮，可在生成后由工程师删除。

### switch case 的来源

`switch (message.ButtonName)` 的 `case` **按本页底部按钮逐个生成**（每个 `case` 以 `break;` 收尾，业务由工程师填）：

- 来源：清单里的 `menuItems`（Bundle 传的就是本页 Layout Menu 的 MenuItem 列表），取每项 `name`；也可用 `buttonNames: ["…"]` 直接给出。
- 规则：按菜单顺序生成；重复名称只生成一次；**空名称的菜单项不生成 case**（Layout 里 `Name=""` 的占位项没有可用按钮名）。
- 缩进：`case` 相对 `switch` 的 `{` 再缩进一层（4 空格），`case` 体（方法调用或 TODO 注释 + `break;`）再缩进一层。
- 生成器不推断按钮语义，也不写业务逻辑；按钮的**英文方法名**只从该按钮的 LanguageKey（`menuItems[].langName`）派生，见下节。

### 按钮处理方法（一钮一方法）

解析出英文方法名的按钮：`case` 只负责调用该按钮的处理方法，方法体只留 `// TODO: <按钮名> 按钮处理`，业务由工程师按方法填：

- `private void <方法名>()`：一钮一方法，方法体为空骨架；`/// <summary>` 写**设计稿按钮文案（中文）**，便于工程师对照底部菜单定位。
- 方法名来源**只有一个**：`menuItems[].langName`（就是该按钮的 LanguageKey）。清单里**没有**独立的方法名字段，脚本也不推断中文语义。处理顺序只有一个读法——**先检查、再取名、再校验**：
  1. 检查一：没有 `langName` → 退回；
  2. 检查二：`langName` 是临时键 `MenuItemIndex<n>`（语言键派生器拿不到语义名时的占位）→ 退回。**这一检查发生在取名之前**，所以 `MenuItemIndex3` 不会派生出 `Index3`；
  3. 取名（**不是退回条件**）：以 `MenuItem` 开头就去掉该前缀，否则用整键——这一步只看前缀，与键的 `scope`、来源无关（无前缀键不限于自动派生器产物，手工/外部清单同样按整键取名）；得到候选名；
  4. 检查三/四：候选名不是合法 C# 标识符 → 退回；候选名命中 C# 关键字 → 退回。
  通过后即为按钮处理方法名，例如 `MenuItemFocus` → `Focus`、`MenuItemZAxisCalibration` → `ZAxisCalibration`、`MenuItemActionParam` → `ActionParam`。
- 退回内联 TODO 的**一共四类**，与脚本 `viewModel.inlineTodoCases` 的 reason 一一对应：① 没有 `langName`；② 临时键 `MenuItemIndex<n>`；③ 候选名不是合法 C# 标识符；④ 候选名命中 C# 关键字（**不改名、不猜名、不失败**）。退回的 case 保留旧的 `// TODO: <按钮名> 按钮处理` + `break;` 形状。
- 一句话记法：**一个按钮 = 一个 `case` = 一个处理方法**，脚本不推断按钮语义、也不写业务逻辑。
- **撞名是输入错误，直接失败（不退回、不静默改名）**：算出的方法名与 ViewModel 固定成员同名（`pageDesign` / `OnViewLoaded` / `PageDesign_Loaded` / `HandleButtonEvent` / `OKCmd`）或与 ViewModel 类名同名，或两个按钮算出同一个方法名时，脚本立即报错并指出是哪个按钮——这类输入会生成重复的 C# 成员（如 `private void OKCmd()` 与恒发射的 `public void OKCmd()`、或两个同名 `private void`），编译必然失败。处理方式：修改该按钮的 `menuItems[].langName`（即它的 LanguageKey，通常由图标资源名、术语表或该文案的英文译文派生）让它派生出别的名字；与 **ViewModel 类名**（= 页面名 + `ViewModel`）同名时改页面名。
- ViewModel 固定成员集合（`pageDesign` / `OnViewLoaded` / `PageDesign_Loaded` / `HandleButtonEvent` / `OKCmd`）在生成器里同一份登记为常量，`doc-rule-consistency.test.js` 会逐项比对本文清单与该常量，任一侧增删都会立刻失败。其中 `OKCmd` 属**恒发射**成员：若某页确认无此按钮，可在生成后删除，但删除后该页不得再出现派生名为 `OKCmd` 的按钮（脚本按"恒发射"口径拦截）。
- 脚本 stdout 的 `viewModel.buttonMethods`（`<按钮名> -> <方法名>`）与 `viewModel.inlineTodoCases`（按钮名 + 退回原因）是本节的审计口径。

## 执行

    node scripts/host/gen-mw-wpf-page.js --manifest .\page.json

已有宿主文件不会静默覆盖。明确需要重新生成时，**必须同时满足两个条件**：清单里 `operation` 为 `replace-existing`，并显式加 `--overwrite`（只加 `--overwrite` 而清单 `operation` 仍是新建模式时，脚本会直接失败并提示 `operation=replace-existing`）：

    {
      "operation": "replace-existing",
      ...其余清单字段...
    }

    node scripts/host/gen-mw-wpf-page.js --manifest .\page.json --overwrite

覆盖前会为已有宿主文件和被修改的 .csproj 创建 `.bak-<时间戳>` 备份；**同一目标文件只保留最近 2 份**，更早的副本在下次备份时自动删除（保留份数是 `lib/script-helpers.js` 的 `MAX_BACKUPS`，Bundle / Layout / 宿主壳三处共用同一实现）。
