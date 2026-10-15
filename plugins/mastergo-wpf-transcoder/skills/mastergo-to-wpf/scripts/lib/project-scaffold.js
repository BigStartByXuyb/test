#!/usr/bin/env node
"use strict";

// 目标项目脚手架（唯一实现）：没有现成项目时，按同一套形状创建 .csproj 与 framework.config.json，
// 并建出页面/Icon/Layout/Generated 目录。Bundle（第 10 步）与 Bundle 清单构建器（第 9 步）都调这里——
// 第 9 步要先有 .csproj 才能推导项目名与命名空间，因此脚手架必须在第 9 步就能落地，不能只写在 Bundle 里。

const fs = require("fs");
const path = require("path");
const { fail, xmlAttr } = require(path.join(__dirname, "script-helpers.js"));

const PAGE_ROOT = "Resources/Pages";
const LAYOUT_DIR = "Resources/Layout";
const DEFAULT_LAYOUT_PATH = "Resources/Layout/Layout.xml";

function resolvePath(base, value, field) {
  if (typeof value !== "string" || !value.trim()) fail(field + " 必须提供");
  const result = path.resolve(base, value);
  const root = path.resolve(base) + path.sep;
  if (result !== path.resolve(base) && !result.startsWith(root)) {
    fail(field + " 必须落在项目目录内: " + value);
  }
  return result;
}

function scaffoldName(value, fallback) {
  const raw = String(value === undefined || value === null ? "" : value).trim();
  const compact = raw.replace(/[^A-Za-z0-9_]/g, "_").replace(/^_+/, "");
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(compact) ? compact : fallback;
}

function scaffoldCsproj(rootNamespace, assemblyName) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<Project ToolsVersion="15.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">',
    '  <Import Project="$(MSBuildExtensionsPath)\\$(MSBuildToolsVersion)\\Microsoft.Common.props" Condition="Exists(\'$(MSBuildExtensionsPath)\\$(MSBuildToolsVersion)\\Microsoft.Common.props\')" />',
    '  <PropertyGroup>',
    '    <Configuration Condition=" \'$(Configuration)\' == \'\' ">Debug</Configuration>',
    '    <Platform Condition=" \'$(Platform)\' == \'\' ">AnyCPU</Platform>',
    '    <OutputType>Library</OutputType>',
    '    <RootNamespace>' + xmlAttr(rootNamespace) + '</RootNamespace>',
    '    <AssemblyName>' + xmlAttr(assemblyName) + '</AssemblyName>',
    '    <TargetFrameworkVersion>v4.6.1</TargetFrameworkVersion>',
    '    <FileAlignment>512</FileAlignment>',
    '    <Deterministic>true</Deterministic>',
    '  </PropertyGroup>',
    '  <ItemGroup>',
    '    <Reference Include="PresentationCore" />',
    '    <Reference Include="PresentationFramework" />',
    '    <Reference Include="System" />',
    '    <Reference Include="System.Core" />',
    '    <Reference Include="System.Xaml" />',
    '    <Reference Include="WindowsBase" />',
    '  </ItemGroup>',
    '  <Import Project="$(MSBuildToolsPath)\\Microsoft.CSharp.targets" />',
    '</Project>',
    ''
  ].join('\n');
}

function scaffoldFrameworkConfig(manifest) {
  return JSON.stringify({
    schemaVersion: "mastergo-project-config/1",
    mode: manifest.route || "mtslg-iocontrol",
    scaffold: true,
    source_root: manifest.sourceRoot || "",
    index_root: manifest.indexRoot || "",
    pages_root: manifest.pagesRoot || PAGE_ROOT,
    icons_root: manifest.iconsRoot || PAGE_ROOT,
    resource_roots: Array.isArray(manifest.resourceRoots) ? manifest.resourceRoots : [],
    layout_file: manifest.layoutPath || DEFAULT_LAYOUT_PATH,
    key_catalog: manifest.keyCatalog || "",
    generated_root: manifest.generatedRoot || "Generated",
    runtime_bindings: "pending"
  }, null, 2) + "\n";
}

// manifest: { projectRoot, projectName?, rootNamespace?, csproj?, frameworkConfigPath?, name, area, route? }
function ensureScaffold(manifest) {
  const scaffold = manifest.scaffold === true || manifest.projectMode === "scaffold";
  if (typeof manifest.projectRoot !== "string" || !manifest.projectRoot.trim()) {
    fail("projectRoot 必须提供；脚手架模式也必须明确指定要创建的目标目录");
  }
  const projectRoot = path.resolve(manifest.projectRoot);
  if (!fs.existsSync(projectRoot)) {
    if (!scaffold) fail("projectRoot 不存在: " + projectRoot);
    fs.mkdirSync(projectRoot, { recursive: true });
  }
  if (!scaffold) return { projectRoot, scaffold: false, frameworkConfigPath: null };

  const projectName = scaffoldName(manifest.projectName || path.basename(projectRoot), "MasterGoProject");
  const rootNamespace = manifest.rootNamespace || projectName;
  const csprojRelative = manifest.csproj || projectName + ".csproj";
  const csprojPath = resolvePath(projectRoot, csprojRelative, "csproj");
  if (!fs.existsSync(csprojPath)) {
    fs.mkdirSync(path.dirname(csprojPath), { recursive: true });
    fs.writeFileSync(csprojPath, scaffoldCsproj(rootNamespace, projectName), "utf8");
  }
  manifest.csproj = csprojRelative;
  manifest.rootNamespace = rootNamespace;
  const configRelative = manifest.frameworkConfigPath || "framework.config.json";
  const frameworkConfigPath = resolvePath(projectRoot, configRelative, "frameworkConfigPath");
  if (!fs.existsSync(frameworkConfigPath)) {
    fs.mkdirSync(path.dirname(frameworkConfigPath), { recursive: true });
    fs.writeFileSync(frameworkConfigPath, scaffoldFrameworkConfig(manifest), "utf8");
  }
  else if (manifest.route) {
    // 路线是目标项目的核心路由字段：脚手架配置允许在**仍是脚手架配置**（scaffold=true）时按当前路线刷新，
    // 否则第 9 步先落盘的配置会把第 10 步的路线钉死成第一次调用时的缺省值（页面是 XAML、配置写着页面 XML）。
    // 已接入的真实项目配置（scaffold 非 true）一律不动。
    let existing = null;
    try { existing = JSON.parse(fs.readFileSync(frameworkConfigPath, "utf8")); }
    catch (error) { fail("framework.config.json 不是合法 JSON: " + frameworkConfigPath + " - " + error.message); }
    if (existing && existing.scaffold === true && existing.mode !== manifest.route) {
      existing.mode = manifest.route;
      fs.writeFileSync(frameworkConfigPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
    }
  }
  manifest.frameworkConfigPath = configRelative;
  const dirs = [
    PAGE_ROOT, LAYOUT_DIR, PAGE_ROOT + "/" + String(manifest.name), "Generated",
    // area 已在清单校验里 fail-closed 校验过（缺失直接报错），这里不得再给任何默认值：
    // 兜底默认值会让"清单漏字段"变成"写到另一个区域目录"的静默错误。
    "UI/" + String(manifest.area) + "/View",
    "UI/" + String(manifest.area) + "/ViewModel"
  ];
  dirs.forEach(function (relative) { fs.mkdirSync(path.join(projectRoot, ...relative.split("/")), { recursive: true }); });
  return { projectRoot, scaffold: true, frameworkConfigPath };
}

module.exports = {
  ensureScaffold,
  scaffoldCsproj,
  scaffoldFrameworkConfig,
  scaffoldName,
  PAGE_ROOT,
  LAYOUT_DIR,
  DEFAULT_LAYOUT_PATH
};
