# Project Adapter Initialization

Use this reference when a target project has no confirmed `framework.config.json`, component catalog, or resource-key catalog.

If there is no target project at all, initialize a complete project scaffold from the selected adapter and the empty-template structure: create `.csproj`, `framework.config.json`, RootNamespace/project skeleton, WPF host shell, page, Icon, Layout, mapping, and audit directories/files. Leave runtime assembly paths, business bindings, and resource keys pending or empty when there is no evidence. Skip compilation and runtime loading until a real target project is supplied.

## Ownership

Project discovery data belongs to the target project, not to this Skill. Do not copy project-private source code, DLLs, business pages, real MasterGo URLs, absolute paths, or resource dumps into `references/`.

Recommended project-local files:

```text
<project-root>/framework.config.json
<project-root>/docs/ai-index/framework-index.json
<project-root>/docs/component-catalog.json
<project-root>/docs/mtslg-keys.json
<project-root>/docs/style-library-lock.json
```

## First-use flow

1. Locate the project root from the current workspace and user-provided target path.
2. Read `framework.config.json` if it exists. Resolve relative paths from the directory containing that file.
3. If the file is missing, or required paths are invalid, scan the project for likely source, index, resource, page, and layout directories. Read the target `.csproj` (or equivalent project file) as authoritative path evidence: `Content Include` page entries determine the page directory, `Page Include` icon entries determine the page-icon directory, and a declared `Layout.xml` entry determines the Layout path even when the file does not yet exist. This scan discovers paths only; it must not infer an adapter mode from project names, source types, or directory names.
4. The adapter has already been selected by the Skill's adapter-selection gate. Show the candidate paths to the user and ask for confirmation or corrections before writing configuration; do not ask the user to reconfirm the mode merely because the configuration file was absent. Do not use `Generated/` as the default candidate when the project file gives a unique runtime path.
5. Write the confirmed configuration only to the target project.
6. Scan the configured sources and existing pages to create or update project-local indexes.
7. Record the source paths, scan time, and a source fingerprint in the index metadata.

Do not silently select a guessed project root, runtime directory, resource library, or page directory when multiple candidates exist.

## Reuse and refresh

Initialization is normally one-time per project. On later tasks:

- reuse a valid configuration and existing indexes without asking the same path questions again;
- validate that configured paths still exist before using them;
- refresh only a missing/invalid index, a changed source fingerprint, or when the user explicitly asks to rescan;
- ask before overwriting user-edited catalog entries;
- keep task-specific MasterGo mappings separate from the reusable project catalog.

## Configuration shape

The exact field names may be extended by an adapter, but paths must be project-relative or explicitly confirmed absolute paths:

```json
{
  "mode": "mtslg-iocontrol",
  "source_root": "./Framework",
  "index_root": "./docs/ai-index",
  "pages_root": "./Resources/Pages",
  "resource_roots": ["./Resources"],
  "layout_file": "./Resources/Layout/Layout.xml",
  "key_catalog": "./docs/mtslg-keys.json"
}
```

`mode`, `source_root`, and `index_root` are the core routing fields. `pages_root`, `resource_roots`, `layout_file`, and `key_catalog` are adapter-specific and must be validated against the target project before use. A declared `layout_file` may be created from the selected adapter's formal template when the target project is new and the user requests new-page generation; absence of an existing file is not evidence to borrow one from another project.

When `framework.config.json` is absent, the confirmed project-file paths may be recorded in a newly created project-local configuration. Keep generated provenance under `Generated/` (or another explicitly named audit directory) while writing runtime page, icon, and Layout files to the project-file paths.

If the project uses reusable style libraries, add the selected library ID and version to the project configuration or a project-local lock file. Do not copy all available libraries into the project catalog and do not overwrite an existing profile version. Profile separation, version selection, and conflict handling are defined in [`style-library-profiles.md`](./style-library-profiles.md); read it when the project has more than one reusable style/theme/icon/resource library.

```json
{
  "framework_adapter": "mw-wpf",
  "style_library": "mw-style-a",
  "style_library_version": "1.1.0"
}
```

## Same framework, different resource library

If the XML/XAML protocol, `ControlType` set, property rules, and runtime lifecycle are unchanged, keep the existing adapter. Rebuild only the target project's component catalog and resource-key catalog. A different Button style library does not require a new adapter.

## New framework protocol

Create a new adapter only when the target framework changes the page format, control types, allowed properties, resource lookup, event/navigation protocol, coordinate host, or validation/synchronization lifecycle. The new adapter must be generic and sanitized; project-private facts remain in the target project's configuration and indexes.
