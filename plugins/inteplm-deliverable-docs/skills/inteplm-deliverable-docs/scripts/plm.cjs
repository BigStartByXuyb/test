const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { resolveInteplmPage } = require("./page-selection.cjs");

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
        String(td.innerText || "").replace(/\s+/g, " ").slice(0, 60),
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
    await t.evaluate((sel) => document.querySelector(sel).click(), args[0]);
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

  if (cmd === "numberGen") {
    await t.evaluate(() => document.querySelector(".number-generation-btn").click());
    await page.waitForTimeout(1600);
    const handle = await t.evaluateHandle(() => document.querySelector(".number-generation-dialog .el-select__input"));
    await handle.asElement().focus();
    await page.keyboard.type(args[0], { delay: 80 });
    await page.waitForTimeout(1600);
    await t.evaluate(
      ({ prefix }) => {
        Array.from(document.querySelectorAll(".el-select-dropdown__item"))
          .find((i) => String(i.innerText || "").trim().startsWith(prefix))
          .click();
      },
      { prefix: args[1] },
    );
    await page.waitForTimeout(1600);
    await clickByText(t, "保存", ".number-generation-dialog button");
    await page.waitForTimeout(2500);
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
      Array.from(document.querySelectorAll("input.el-input__inner"))
        .find((i) => i.placeholder === "请选择存储位置")
        .click();
    });
    await page.waitForTimeout(1600);
    await t.evaluate((name) => {
      Array.from(document.querySelectorAll(".ty-quick-choose-multiple__popper .el-tree-node__content"))
        .find((n) => String(n.innerText || "").trim() === name)
        .click();
    }, args[0]);
    await page.waitForTimeout(1000);
    await t.evaluate(() => {
      Array.from(document.querySelectorAll(".ty-quick-choose-multiple__popper button"))
        .find((b) => String(b.innerText || "").trim() === "确定")
        .click();
    });
    await page.waitForTimeout(1800);
    return out({ inputs: await inputs(t) });
  }

  if (cmd === "upload") {
    const chooser = page.waitForEvent("filechooser", { timeout: 20000 });
    await clickByText(t, "添加文件", "button");
    await (await chooser).setFiles(args);
    await page.waitForTimeout(3000);
    return out({ rows: await fileRows(t) });
  }

  if (cmd === "removeRows") {
    await t.evaluate((idxs) => {
      const rows = Array.from(document.querySelectorAll("table.vxe-table--body")[0].querySelectorAll("tr"));
      idxs.forEach((i) => rows[i].querySelector(".vxe-cell--checkbox").click());
    }, args.map(Number));
    await page.waitForTimeout(1200);
    await clickByText(t, "移除文件", "button");
    await page.waitForTimeout(2000);
    return out({ rows: await fileRows(t) });
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
