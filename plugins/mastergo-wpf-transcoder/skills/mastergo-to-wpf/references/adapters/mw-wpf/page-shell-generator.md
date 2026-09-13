# MW WPF 页面壳生成器

scripts/gen-mw-wpf-page.js 用一个页面清单生成独立页面的固定 WPF 宿主壳：

- UI/<area>/View/<Page>View.xaml
- UI/<area>/View/<Page>View.xaml.cs
- UI/<area>/ViewModel/<Page>ViewModel.cs

脚本同时将这些文件，以及清单中声明的 Icon Page 和页面 XML Content，补入目标旧式 .csproj。需要一次生成 XML、Icon、Layout、WPF 宿主和审计文件时，使用 scripts/gen-mastergo-page-bundle.js；页面 XML 的控件内容和 Icon Geometry 不在本脚本中猜测，分别由 IOContorl XML 和页面 Icon 生成器从 MasterGo DSL 发射。

**生成的 View 不合并页面 Icon 资源字典**：`<Page>View.xaml` 只由 `UserControl` 头 + `<Grid>` 里的 `uidesign:PageDesign` 组成，**不生成** `<UserControl.Resources><ResourceDictionary Source="/<程序集>;component/Resources/Pages/<页面名>/<页面名>Icons.xaml" /></UserControl.Resources>` 这一段。页面 Icon 文件本身仍照常生成，并按 Icon Page 注册进 `.csproj`；Icon 资源键在运行时如何解析由目标宿主负责，宿主脚本不写页面级资源合并声明。

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
                        // TODO: 新建示教 按钮处理
                        break;
                    case "对焦":
                        // TODO: 对焦 按钮处理
                        break;
            }
        }
    }

    public void OKCmd() { pageDesign.SaveXml(); }                  // 确认按钮
}
```

依据（框架事实，不可猜测）：`ButtonEvent` = `MaxwellFramework.Core.Events.ButtonEvent`（ctor `ButtonEvent(bool isMouseDown, string buttonName)`，属性 `IsMouseDown` / `ButtonName`）；`IOScreen` 上 `OnViewLoaded` 为 `protected virtual`、`HandleButtonEvent(ButtonEvent)` 为 `public virtual`，因此这两个成员必须用 `override`。`OKCmd` 为页面确认按钮命令，如某页确认无此按钮，可在生成后由工程师删除。

### switch case 的来源

`switch (message.ButtonName)` 的 `case` **按本页底部按钮逐个生成**（每个 `case` 带一行 `// TODO: <按钮名> 按钮处理` 与 `break;`，业务由工程师填）：

- 来源：清单里的 `menuItems`（Bundle 传的就是本页 Layout Menu 的 MenuItem 列表），取每项 `name`；也可用 `buttonNames: ["…"]` 直接给出。
- 规则：按菜单顺序生成；重复名称只生成一次；**空名称的菜单项不生成 case**（Layout 里 `Name=""` 的占位项没有可用按钮名）。
- 缩进：`case` 相对 `switch` 的 `{` 再缩进一层（4 空格），`case` 体（TODO 注释与 `break;`）再缩进一层。
- 生成器不推断按钮语义，也不写业务逻辑。

## 执行

    node scripts/gen-mw-wpf-page.js --manifest .\page.json

已有宿主文件不会静默覆盖。明确需要重新生成时：

    node scripts/gen-mw-wpf-page.js --manifest .\page.json --overwrite

覆盖前会为已有宿主文件和被修改的 .csproj 创建 .bak-时间戳 备份。
