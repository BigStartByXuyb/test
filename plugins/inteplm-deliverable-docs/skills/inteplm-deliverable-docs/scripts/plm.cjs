const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { resolveInteplmPage } = require("./page-selection.cjs");
const { resolveExactNumberOption } = require("./number-selection.cjs");
const { parseRowIndexes } = require("./row-selection.cjs");

const CDP = "http://127.0.0.1:9222";
const SHOTS = path.join(process.env.USERPROFILE, ".codex", "browser-profiles", "inteplm-shots");

const out = (v) => process.stdout.write(JSON.stringify(v, null, 2) + "\n", () => process.exit(0));

const shot = async (page, label) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const file = path.join(SHOTS, label + ".png");
  await page.screenshot({ path: file });
  return file;
};

const fileRows = (t) =>
  t.evaluate(() => {
    const body = document.querySelectorAll("table.vxe-table--body")[0];
    if (!body) return [];
    return Array.from(body.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((td) =>
        String(td.innerText || "").replace(/\s+/g, " "),
      ),
    );
  });

const clickByText = (t, text, selector) =>
  t.evaluate(
    ({ text, selector }) => {
      const hit = Array.from(document.querySelectorAll(selector)).find(
        (el) => String(el.innerText || "").trim() === text,
      );
      hit.click();
    },
    { text, selector },
  );

const inputs = (t) =>
  t.evaluate(() =>
    Array.from(document.querySelectorAll("input.el-input__inner")).map((el) => ({
      value: String(el.value || "").slice(0, 80),
      placeholder: el.placeholder || "",
      disabled: el.disabled === true,
    })),
  );

const main = async () => {
  const argv = process.argv.slice(2);
  let frameKey = null;
  let pageIndex = null;
  const rest = [];
  for (const a of argv) {
    if (a.startsWith("--frame=")) frameKey = a.slice("--frame=".length);
    else if (a.startsWith("--page=")) {
      const value = a.slice("--page=".length);
      pageIndex = /^\d+$/.test(value) ? Number(value) : Number.NaN;
    }
    else rest.push(a);
  }
  const cmd = rest[0] || "snap";
  const args = rest.slice(1);

  const browser = await chromium.connectOverCDP(CDP);
  const pages = browser.contexts()[0].pages().filter((p) => !p.url().startsWith("devtools://"));
  if (cmd === "pages") return out(pages.map((p, index) => ({ index, url: p.url() })));

  const page = resolveInteplmPage(pages, pageIndex);
  page.setDefaultTimeout(20000);
  if (cmd === "frames") return out(page.frames().map((f) => ({ name: f.name(), url: f.url() })));

  const t = frameKey ? page.frames().filter((f) => f.url().includes(frameKey)).pop() : page;
  if (!t) {
    const urls = page.frames().map((f) => f.url()).filter(Boolean);
    throw new Error(
      [
        `未找到 URL 含 "${frameKey}" 的 frame。先运行 frames 查看当前可用的 frame。`,
        urls.length ? "当前 frame:\n" + urls.map((u) => "  - " + u).join("\n") : "当前没有可用的 frame。",
      ].join("\n"),
    );
  }

  if (cmd === "snap") {
    const info = {
      url: page.url(),
      text: await page.evaluate(() => document.body.innerText).then((s) => s.slice(0, 2000)),
      screenshot: await shot(page, args[0] || "snap-" + Date.now()),
    };
    if (frameKey) info.frameText = (await t.evaluate(() => document.body.innerText)).slice(0, 2000);
    return out(info);
  }

  if (cmd === "evalFile") {
    return out({ result: await t.evaluate(eval(fs.readFileSync(args[0], "utf8"))) });
  }

  if (cmd === "jsClick") {
    await t.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`未找到元素: ${sel}`);
      el.click();
    }, args[0]);
    await page.waitForTimeout(1500);
    return out({ clicked: args[0] });
  }

  if (cmd === "jsText") {
    const handle = await t.evaluateHandle((sel) => document.querySelector(sel), args[0]);
    await handle.asElement().focus();
    await page.keyboard.type(args[1], { delay: 80 });
    await page.waitForTimeout(1800);
    return out({ typed: args[1], options: await t.evaluate(() => Array.from(document.querySelectorAll(".el-select-dropdown__item")).filter((i) => i.getBoundingClientRect().height > 1).map((i) => String(i.innerText || "").trim())) });
  }

  if (cmd === "numberOptions" || cmd === "numberGen") {
    const requiredArgs = cmd === "numberOptions" ? 1 : 2;
    if (args.length !== requiredArgs) {
      throw new Error(cmd === "numberOptions" ? "用法: numberOptions <项目号和版本>" : "用法: numberGen <项目号和版本> <精确选项文本>");
    }
    if (!(await t.locator(".number-generation-dialog").count())) {
      await t.evaluate(() => {
        const button = document.querySelector(".number-generation-btn");
        if (!button) throw new Error("编号生成按钮未找到");
        button.click();
      });
    }
    await t.waitForTimeout(1600);
    await t.locator(".number-generation-dialog .el-select__input").fill(args[0]);
    await t.waitForTimeout(1600);
    const options = await t.evaluate(() =>
      Array.from(document.querySelectorAll(".el-select-dropdown__item"))
        .filter((item) => item.getBoundingClientRect().height > 1)
        .map((item) => String(item.innerText || "").trim()),
    );
    if (cmd === "numberOptions") return out({ options });
    const exactOption = resolveExactNumberOption(options, args[1]);
    await t.evaluate((label) => {
      const matches = Array.from(document.querySelectorAll(".el-select-dropdown__item"))
        .filter((item) => item.getBoundingClientRect().height > 1 && String(item.innerText || "").trim() === label);
      if (matches.length !== 1) throw new Error("编号候选项不再是唯一精确匹配");
      matches[0].click();
    }, exactOption);
    await t.waitForTimeout(1600);
    await clickByText(t, "保存", ".number-generation-dialog button");
    await t.waitForTimeout(2500);
    return out({ inputs: await inputs(t) });
  }

  if (cmd === "setName") {
    await t.evaluate((value) => {
      const el = Array.from(document.querySelectorAll("input.el-input__inner")).filter(
        (i) => !i.disabled && !i.placeholder && !String(i.value || "").startsWith("/"),
      )[0];
      if (!el) throw new Error("名称输入框未找到");
      el.focus();
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, args[0]);
    await page.waitForTimeout(800);
    return out({ inputs: await inputs(t) });
  }

  if (cmd === "setLocation") {
    await t.evaluate(() => {
      const input = Array.from(document.querySelectorAll("input.el-input__inner")).find(
        (i) => i.placeholder === "请选择存储位置",
      );
      if (!input) throw new Error("未找到「请选择存储位置」输入框");
      input.click();
    });
    await page.waitForTimeout(1600);
    await t.evaluate((name) => {
      const node = Array.from(document.querySelectorAll(".ty-quick-choose-multiple__popper .el-tree-node__content")).find(
        (n) => String(n.innerText || "").trim() === name,
      );
      if (!node) throw new Error(`存储位置「${name}」未找到`);
      node.click();
    }, args[0]);
    await page.waitForTimeout(1000);
    await t.evaluate(() => {
      const button = Array.from(document.querySelectorAll(".ty-quick-choose-multiple__popper button")).find(
        (b) => String(b.innerText || "").trim() === "确定",
      );
      if (!button) throw new Error("存储位置确认按钮未找到");
      button.click();
    });
    await page.waitForTimeout(1800);
    return out({ inputs: await inputs(t) });
  }

  if (cmd === "upload") {
    if (args.length !== 1) throw new Error("upload 每次只接受一个本地文件路径");
    const chooser = page.waitForEvent("filechooser", { timeout: 20000 });
    await clickByText(t, "添加文件", "button");
    await (await chooser).setFiles(args[0]);
    await page.waitForTimeout(3000);
    return out({ rows: await fileRows(t) });
  }

  if (cmd === "previewRows") {
    const rows = await fileRows(t);
    const indexes = parseRowIndexes(args, rows.length);
    return out({ selectedRows: indexes.map((index) => ({ index, cells: rows[index] })) });
  }

  if (cmd === "removeRows") {
    if (args[0] !== "--confirm") {
      throw new Error("先运行 previewRows 检查所选行并取得确认，再运行 removeRows --confirm <行索引>");
    }
    const rows = await fileRows(t);
    const indexes = parseRowIndexes(args.slice(1), rows.length);
    const selectedRows = indexes.map((index) => ({ index, cells: rows[index] }));
    await t.evaluate((idxs) => {
      const table = document.querySelectorAll("table.vxe-table--body")[0];
      if (!table) throw new Error("文件表格未找到,确认已打开交付物新建文档表单");
      const rows = Array.from(table.querySelectorAll("tr"));
      const checkboxes = idxs.map((index) => rows[index]?.querySelector(".vxe-cell--checkbox"));
      if (checkboxes.some((checkbox) => !checkbox)) throw new Error("待移除行未找到文件勾选框");
      checkboxes.forEach((checkbox) => checkbox.click());
    }, indexes);
    await page.waitForTimeout(1200);
    await clickByText(t, "移除文件", "button");
    await page.waitForTimeout(2000);
    return out({ removedRows: selectedRows, rows: await fileRows(t) });
  }

  if (cmd === "submit") {
    await clickByText(page, "确定", "button");
    await page.waitForTimeout(3000);
    return out({ screenshot: await shot(page, args[0] || "submitted") });
  }

  throw new Error("未知命令: " + cmd);
};

main().catch((err) => {
  process.stderr.write("ERR " + String(err.message || err).replace(/\s*\n\s*/g, " | ") + "\n");
  process.exit(1);
});
