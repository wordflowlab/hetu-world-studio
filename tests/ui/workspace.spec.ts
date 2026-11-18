import { test, expect, _electron as electron } from "@playwright/test";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import manifest from "../../contracts/plugin-manifest.json" with { type: "json" };
import {
  scenario,
  original,
  base,
  selection,
  wav,
  sha,
} from "../support/scenario.ts";
import {prepareMedia} from "../support/assets.ts";
import {chromium} from "@playwright/test";
import {pathToFileURL} from "node:url";
import { config } from "../../src/domain/config.ts";
import { start, host } from "../support/machine.ts";
import { importText } from "../support/import.ts";
import { managed } from "../support/creative.ts";
test("真实Electron审阅、专业操作、导出、冲突保留与关闭重开", async ({}, info) => {
  test.setTimeout(600000);
  const c = await start();
  let app: any;
  const slug = manifest.id.replace("org.wordflowlab.", ""),
    errors: string[] = [];
  try {
    const refs = await importText(c, [original]),
      p = scenario(c.work);
    let record: any;
    const exports = path.join(c.directory, "exports");
    await mkdir(exports);
    app = await electron.launch({
      executablePath:
        process.env.HETU_PACKAGED_APP ??
        createRequire(path.join(host, "package.json"))("electron"),
      args: process.env.HETU_PACKAGED_APP
        ? []
        : [path.join(host, "apps/desktop")],
      env: c.env,
    });
    await app.evaluate(
      ({ dialog }: any, { workspace, exports }: any) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [workspace],
        });
        dialog.showSaveDialog = async (...args: any[]) => ({
          canceled: false,
          filePath:
            exports +
            "/" +
            (args.at(-1)?.defaultPath ?? "成果.html").split(/[\\/]/).pop(),
        });
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      },
      { workspace: c.workspace, exports },
    );
    const shell = await app.firstWindow();
    await shell
      .getByRole("button", { name: "打开作品", exact: true })
      .first()
      .click();
    await shell
      .getByRole("button", { name: "雨港来信", exact: false })
      .first()
      .click();
    const open = async () => {
      await shell
        .getByRole("button", { name: manifest.display["zh-CN"], exact: true })
        .click();
      await expect
        .poll(() =>
          app
            .context()
            .pages()
            .some((p: any) => p.url().startsWith("hetu-plugin:")),
        )
        .toBe(true);
      const page = app
        .context()
        .pages()
        .find((p: any) => p.url().startsWith("hetu-plugin:"));
      page.on("pageerror", (e: Error) => errors.push(e.message));
      return page;
    };
    let page: any = await open();
    await expect(
      page.getByRole("heading", { name: "从作品出发", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("empty.png"),
      fullPage: true,
    });
    await prepareMedia(c,p,refs,slug);
    record = await c.invoke("save_project", {
      content: p,
      source_refs: refs,
      expected_revision: 0,
      expected_sha256: "",
      operation_key: "ui-seed",
    });
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: p.title, level: 2, exact: true }),
    ).toBeVisible();
    for (const [index, name] of config.tabs.entries()) {
      await page.bringToFront();
      await page
        .getByRole("navigation", { name: "专业视图" })
        .getByRole("button", { name, exact: true })
        .click();
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await page.screenshot({
        path: info.outputPath("view-" + index + ".png"),
        fullPage: true,
      });
    }
    const tab = async (index: number) => {
      await page.bringToFront();
      const button=page.getByRole("navigation",{name:"专业视图"}).getByRole("button",{name:config.tabs[index],exact:true});
      await button.focus();await expect(button).toBeFocused();await button.click();
      await expect(button).toHaveAttribute("aria-current","page");
    };
    await tab(0);await page.getByRole("button",{name:"核对纪日与星期",exact:true}).first().click();await expect(page.getByLabel("固定依据")).toContainText("换算规则");
    await tab(2);await page.getByRole("button",{name:"计算此情景",exact:true}).click();await expect(page.getByLabel("固定依据")).toContainText("-3");
    await tab(1);await page.getByRole("button",{name:"检查依赖与假设",exact:true}).click();await expect(page.getByLabel("固定依据")).toContainText("旧站配给");
    await tab(3);await page.getByRole("button",{name:"查看修改影响",exact:true}).first().click();await expect(page.getByLabel("固定依据")).toContainText("受影响规则");
    const close = page.getByRole("button", { name: "关闭依据" });
    if (await close.count()) await close.click();
    await tab(config.tabs.length - 1);
    await page
      .getByRole("button", { name: "复制AI接续说明", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("已复制接续说明");
    const clipboard = await app.evaluate(({ clipboard }: any) =>
      clipboard.readText(),
    );
    expect(clipboard).toContain(manifest.id);
    expect(clipboard).toContain(record.object.object_id);
    const normalDisplay = await app.context().newCDPSession(page);
    await normalDisplay.send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-transparency",value:"no-preference"},{name:"prefers-contrast",value:"no-preference"}]});
    for (const theme of ["light", "dark"] as const) {
      await app.evaluate(({webContents}:any,theme:any)=>{for(const w of webContents.getAllWebContents())if(w.getURL().startsWith("hetu-plugin:"))w.send("plugin:preferences",{theme,language:"zh-CN"});},theme);
      await normalDisplay.send("Emulation.setEmulatedMedia",{features:[{name:"prefers-color-scheme",value:theme},{name:"prefers-reduced-transparency",value:"no-preference"},{name:"prefers-contrast",value:"no-preference"}]});
      for (const width of [1360, 760]) {
        await page.setViewportSize({ width, height: 900 });
        await page.screenshot({
          path: info.outputPath(theme + "-" + width + ".png"),
          fullPage: true,
        });
        for (const [viewIndex, viewName] of config.tabs.entries()) {
          await tab(viewIndex);
          await page.screenshot({
            path: info.outputPath(
              theme + "-" + width + "-view-" + viewIndex + ".png",
            ),
            fullPage: true,
          });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            ),
            viewName + " overflow",
          ).toBe(false);
        }
        const metrics = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          background: getComputedStyle(document.body).backgroundImage,
          sizes: [
            ...new Set(
              [...document.querySelectorAll("body *")]
                .filter((e) => {
                  const r = e.getBoundingClientRect();
                  return r.width && r.height;
                })
                .map((e) => getComputedStyle(e).fontSize),
            ),
          ],
        }));
        expect(metrics.overflow).toBe(false);
        expect(metrics.background).toContain("gradient");
        expect(metrics.sizes.length).toBeLessThanOrEqual(4);
      }
    }
    const focused = page.getByRole("button", { name: "让AI处理", exact: true });
    await focused.focus();
    await expect(focused).toBeFocused();
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
      "BODY",
    );
    const filesBeforeCancel = await readdir(exports);
    await app.evaluate(({ dialog }: any) => {
      dialog.showSaveDialog = async () => ({
        canceled: true,
        filePath: undefined,
      });
    });
    await page.getByRole("button", { name: "导出报告", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("已取消导出");
    expect(await readdir(exports)).toEqual(filesBeforeCancel);
    const display = await app.context().newCDPSession(page);
    await display.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
    });
    const metrics=await page.evaluate(()=>({reduced:matchMedia("(prefers-reduced-transparency:reduce)").matches,background:getComputedStyle(document.body).backgroundImage}));
    expect(metrics.reduced).toBe(true);expect(metrics.background).not.toContain("gradient");
    await page.screenshot({
      path: info.outputPath("reduced-transparency.png"),
      fullPage: true,
    });
    await page.locator("summary").filter({ hasText: "高级" }).click();
    await page
      .getByRole("button", { name: "编辑专业数据", exact: true })
      .click();
    record = await c.invoke("get_project", {
      object_id: record.object.object_id,
    });
    const draft = { ...record.object.content, title: "雨港来信 作者修订" };
    await page
      .getByLabel("专业数据", { exact: true })
      .fill(JSON.stringify(draft, null, 2));
    const external = { ...record.object.content, title: "外部Agent新修订" };
    await c.invoke("save_project", {
      ...base(record, "ui-external"),
      content: external,
    });
    await page.getByRole("button", { name: "保存修改", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("专业数据", { exact: true })).toHaveValue(
      JSON.stringify(draft, null, 2),
    );
    await page
      .getByRole("button", { name: "读取最新基线", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("已读取最新基线");
    await page.getByRole("button", { name: "保存修改", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("已保存");
    await expect(
      page.getByRole("heading", { name: draft.title, level: 2, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "返回作品", exact: true }).click();
    await expect
      .poll(() =>
        app
          .context()
          .pages()
          .some((p: any) => p.url().startsWith("hetu-plugin:")),
      )
      .toBe(false);
    page = await open();
    await expect(
      page.getByRole("heading", { name: draft.title, level: 2, exact: true }),
    ).toBeVisible();
    await page.locator("summary").filter({ hasText: "高级" }).click();
    await page
      .getByRole("button", { name: "编辑专业数据", exact: true })
      .click();
    const unsaved = JSON.stringify(
      { ...draft, title: "保留未保存编辑" },
      null,
      2,
    );
    await page.getByLabel("专业数据", { exact: true }).fill(unsaved);
    await expect
      .poll(async () => {
        const b: any = await page.evaluate(() => window.hetu.buffer());
        return b?.editor;
      })
      .toBe(unsaved);
    await page.getByRole("button", { name: "返回作品", exact: true }).click();
    page = await open();
    await expect(page.getByLabel("专业数据", { exact: true })).toHaveValue(
      unsaved,
    );
    await page.getByRole("button", { name: "取消编辑", exact: true }).click();
    expect(errors).toEqual([]);
    const dir = process.env.HETU_RECEIPT_DIRECTORY ?? "docs/research";
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "ui-acceptance.json"),
      JSON.stringify(
        {
          date: "2026-11-18",
          plugin_id: manifest.id,
          package_sha256: c.pkg.package_sha256,
          host_version: c.coreVersion,
          platform: process.platform,
          architecture: process.arch,
          tabs: config.tabs,
          empty_state: true,
          professional_actions: true,
          artifact_files: await readdir(exports),
          themes: ["light", "dark"],
          widths: [1360, 760],
          reduced_transparency: true,
          CAS_preserves_input: true,
          explicit_rebase: true,
          close_reopen: true,
          dirty_buffer_restore: true,
          page_errors: errors,
          limits: ["原生窗口材质、系统输入法及Windows/Linux未由本测试证明"],
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await app?.close();
    await c.client.close();
  }
});
