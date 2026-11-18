import { defineConfig } from "@playwright/test";
export default defineConfig({testDir:"tests/ui",workers:1,timeout:300000,reporter:"list",use:{trace:"retain-on-failure"}});
