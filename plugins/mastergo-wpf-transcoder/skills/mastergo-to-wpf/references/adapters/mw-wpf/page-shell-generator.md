# MW WPF 页面壳生成器

scripts/gen-mw-wpf-page.js 用一个页面清单生成独立页面的固定 WPF 宿主壳：

- UI/<area>/View/<Page>View.xaml
- UI/<area>/View/<Page>View.xaml.cs
- UI/<area>/ViewModel/<Page>ViewModel.cs

脚本同时将这些文件，以及清单中声明的 Icon Page 和页面 XML Content，补入目标旧式 .csproj。需要一次生成 XML、Icon、Layout、WPF 宿主和审计文件时，使用 scripts/gen-mastergo-page-bundle.js；页面 XML 的控件内容和 Icon Geometry 不在本脚本中猜测，分别由 IOContorl XML 和页面 Icon 生成器从 MasterGo DSL 发射。

**生成的 View 不合并页面 Icon 资源字典**：`<Page>View.xaml` 只由 `UserControl` 头 + `<Grid>` 里的 `uidesign:PageDesign` 组成，**不生成** `<UserControl.Resources><ResourceDictionary Source="/<程序集>;component/Resources/Pages/<页面名>/<页面名>Icons.xaml" /></UserControl.Resources>` 这一段。页面 Icon 文件本身仍照常生成，并按 Icon Page 注册进 `.csproj`；宿主脚本不写页面级资源合并声明。

**脚本层面的精确事实与两路线的差异**：`scripts/gen-mw-wpf-page.js` 的 `renderView` **没有路线分支**——它对两条路线都恒不发射这段合并声明。因此：

- 对**作业 B（`mtslg-iocontrol`，当前唯一启用）**：这就是最终形态，View 只输出 `UserControl` 头 + `PageDesign`；
- 对**作业 A（`mw-wpf`，停用中）**：这是**缺口**。作业 A 页面用 `{StaticResource …Geometry}` 引用图标，`StaticResource` 加载期解析，页面自身没有合并点就会抛 `XamlParseException`（框架规则 R5）。**作业 A 重新启用前，必须给该脚本增加路线分支（或由另一生成器）为作业 A 补上本页 Icon 字典的合并点，并做加载验证**——只在文档里写"复核"不足以修复。

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
                        NewTeaching();                            // 方法名 = 显式 methodName；未登记时 = LangName 去 MenuItem 前缀
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
- 生成器不推断按钮语义，也不写业务逻辑；按钮的**英文方法名**只从已登记的名字派生，见下节。

### 按钮处理方法（一钮一方法）

解析出英文方法名的按钮：`case` 只负责调用该按钮的处理方法，方法体只留 `// TODO: <按钮名> 按钮处理`，业务由工程师按方法填：

- `private void <方法名>()`：一钮一方法，方法体为空骨架；`/// <summary>` 写**设计稿按钮文案（中文）**，便于工程师对照底部菜单定位。
- 方法名取值链（机械、可审计，不猜语义）：
  1. `menuItems[].methodName`：工程师在本页清单里显式登记的方法名。**登记了就只认它**——值为非法 C# 标识符或 C# 关键字时直接退回内联 TODO，不再回退第 2 条（显式登记的名字绝不静默改写）；
  2. 未登记 `methodName`（字段缺省、空串、纯空白都算未登记）时，取 `menuItems[].langName` 去掉 `MenuItem` 前缀：菜单键命名空间就是 `MenuItem + 英文语义名`（如 `MenuItemFocus` → `Focus`、`MenuItemZAxisCalibration` → `ZAxisCalibration`、`MenuItemActionParam` → `ActionParam`）。
- 退回内联 TODO 的情形（**不改名、不猜名、不失败**）按取值链逐条对应，不是一个混合清单：① 第 1 条来源不可用时（登记的 `methodName` 不是合法标识符或命中 C# 关键字）**不再回退第 2 条**；② 第 2 条来源不可用时（没有 `langName`；`langName` 是临时键 `MenuItemIndex<n>`，即语言键派生器拿不到语义名时的占位；去前缀后不是合法标识符；命中 C# 关键字）。这些 case 保留旧的 `// TODO: <按钮名> 按钮处理` + `break;` 形状。
- 一句话记法：**一个按钮 = 一个 `case` = 一个处理方法**，脚本不推断按钮语义、也不写业务逻辑。
- **撞名是输入错误，直接失败（不退回、不静默改名）**：算出的方法名与 ViewModel 固定成员同名（`pageDesign` / `OnViewLoaded` / `PageDesign_Loaded` / `HandleButtonEvent` / `OKCmd`）或与 ViewModel 类名同名，或两个按钮算出同一个方法名时，脚本立即报错并指出是哪个按钮——这类输入会生成重复的 C# 成员（如 `private void OKCmd()` 与恒发射的 `public void OKCmd()`、或两个同名 `private void`），编译必然失败。处理方式：修改该按钮的 `menuItems[].methodName` 或它的 `LanguageKey`（页面名不适合时改页面名）。
- 脚本 stdout 的 `viewModel.buttonMethods`（`<按钮名> -> <方法名>`）与 `viewModel.inlineTodoCases`（按钮名 + 退回原因）是本节的审计口径。

## 执行

    node scripts/gen-mw-wpf-page.js --manifest .\page.json

已有宿主文件不会静默覆盖。明确需要重新生成时，**必须同时满足两个条件**：清单里 `operation` 为 `modify-existing` 或 `replace-existing`，并显式加 `--overwrite`（只加 `--overwrite` 而清单 `operation` 仍是新建模式时，脚本会直接失败并提示 `operation=replace-existing`）：

    {
      "operation": "replace-existing",
      ...其余清单字段...
    }

    node scripts/gen-mw-wpf-page.js --manifest .\page.json --overwrite

覆盖前会为已有宿主文件和被修改的 .csproj 创建 .bak-时间戳 备份。
