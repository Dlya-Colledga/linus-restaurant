import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Run in the root of your cloned linus-restaurant repository.
const root = process.cwd();
const thisDir = path.dirname(fileURLToPath(import.meta.url));
const required = ["index.html", "menu.html", "order.html", "src/core/site.js"];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`File not found: ${file}. Run from the linus-restaurant repo root.`);
  }
}

const bootstrap = `    <script>
      (() => {
        try {
          const entry = JSON.parse(sessionStorage.getItem("linus.route-wipe.v1") || "null");
          if (entry && entry.path === location.pathname && Math.abs(Date.now() - entry.at) < 20000) {
            document.documentElement.classList.add("linus-route-pending");
            document.documentElement.dataset.linusRouteTitle = entry.title;
          }
        } catch {}
      })();
    </script>`;

const patches = [
  {file: "src/core/site.js", before: 'export function initSite() {', after: 'import { initPageTransitions } from "./page-transitions.js";\n\nexport function initSite() {\n  initPageTransitions();'},
  {file: "src/pages/index.js", before: 'import { initSite } from "../core/site.js";', after: 'import { initSite } from "../core/site.js";\nimport { navigateWithTransition } from "../core/page-transitions.js";'},
  {file: "src/pages/index.js", before: 'window.location.href = `menu.html?location=${encodeURIComponent(branch.id)}`;', after: 'void navigateWithTransition(`menu.html?location=${encodeURIComponent(branch.id)}`);'},
  {file: "src/pages/menu.js", before: 'import { initSite } from "../core/site.js";', after: 'import { initSite } from "../core/site.js";\nimport { navigateWithTransition } from "../core/page-transitions.js";'},
  {file: "src/pages/menu.js", before: 'window.location.href = `order.html?id=${encodeURIComponent(id)}`;', after: 'void navigateWithTransition(`order.html?id=${encodeURIComponent(id)}`);'},
  {file: "src/styles/shared.css", before: ':root {', after: '@import "./page-transitions.css";\n\n:root {'},
  ...["index.html", "menu.html", "order.html"].map(file => ({file, before: "  <head>", after: `  <head>\n${bootstrap}`})),
];

const updates = new Map();
for (const {file, before, after} of patches) {
  const original = updates.get(file) ?? fs.readFileSync(path.join(root, file), "utf8");
  if (original.includes(after)) continue; // idempotent
  const count = original.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected one match in ${file} for: ${before.slice(0, 60)} (found ${count})`);
  updates.set(file, original.replace(before, after));
}

for (const [file, content] of updates) {
  fs.writeFileSync(path.join(root, file), content);
  console.log(`Updated: ${file}`);
}
for (const file of ["src/core/page-transitions.js", "src/styles/page-transitions.css"]) {
  const source = path.join(thisDir, file);
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(source, target);
  console.log(`Installed: ${file}`);
}
console.log("\nDone. Run pnpm dev or npm run dev and test navigation between pages.");
