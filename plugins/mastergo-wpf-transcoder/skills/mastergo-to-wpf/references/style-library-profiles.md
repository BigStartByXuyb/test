# Style Library Profiles

Use this reference when a framework has more than one reusable style, theme, icon, or resource library.

## Separate framework adapter from style profile

The framework adapter defines protocol and behavior: page format, control types, allowed properties, data/action/navigation rules, coordinate host, and validation lifecycle.

A style profile defines visual/resource facts: styles, brushes, fonts, sizes, icons, language keys, component variants, and real usage examples. Different style profiles must not overwrite one another or modify the framework adapter.

```text
generic Skill
  -> framework adapter
  -> selected style profile and version
  -> project-local overrides and indexes
```

## Profile manifest

Each reusable library has a stable ID and immutable versions:

```json
{
  "id": "mw-style-a",
  "display_name": "MW Style A",
  "framework_adapter": "mw-wpf",
  "versions": {
    "1.0.0": "./versions/1.0.0",
    "1.1.0": "./versions/1.1.0"
  },
  "default_version": "1.1.0"
}
```

The version directory contains the sanitized catalog and resource metadata required for conversion. Do not replace an existing version directory; publish a new version instead.

## Project selection

The project configuration selects one profile or an ordered list when the target framework explicitly supports layered libraries:

```json
{
  "framework_adapter": "mw-wpf",
  "style_library": "mw-style-a",
  "style_library_version": "1.1.0"
}
```

For multiple layers, use an explicit precedence list rather than guessing:

```json
{
  "style_libraries": [
    { "id": "mw-base", "version": "2.0.0" },
    { "id": "mw-style-a", "version": "1.1.0" },
    { "id": "project-overrides", "version": "0.3.0" }
  ]
}
```

If more than one candidate library is discovered and the project has no selection, ask the user to choose. Do not select by directory order, newest timestamp, or name similarity.

## Resolution and conflict rules

1. Load the framework adapter first.
2. Load the selected profile version(s) in configured order.
3. Apply project-local overrides last.
4. On conflicting Style, Icon, LangName, or component IDs, report both sources and the selected precedence; never silently overwrite.
5. A profile may only claim compatibility with the adapter IDs listed in its manifest.
6. A changed resource key or visual contract requires a new profile version, not an in-place rewrite.

## Initialization and upgrades

During first-use initialization, discover available manifests and ask the user to bind the project to a profile and version. Store that binding in the project's `framework.config.json`. Later tasks reuse the binding without asking again.

Refresh or upgrade only when the user requests it, the pinned version is missing, or compatibility validation fails. Before upgrading, show the old and candidate versions and record the change in the project worklog. Keep the old version available for rollback.

## Distribution

The generic Skill can be distributed independently from profile packages. A team may distribute profiles through a shared repository or approved directory. Do not copy private DLLs, source code, business pages, secrets, or unredacted resource dumps into the generic Skill. The target machine must still provide the actual framework/resource assemblies required at runtime.
