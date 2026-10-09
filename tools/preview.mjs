// tools/preview.mjs —— 把某条 feed 的第一个条目渲染成竖屏页面，看排版用
// 用法: node tools/preview.mjs "/aihot/daily?limit=1" preview/aihot-daily.html
// 明暗跟随系统；想固定看某一种，地址后面加 ?theme=dark 或 ?theme=light，页面上也有个小按钮。
import fs from "node:fs";
import worker from "../src/index.js";

const route = process.argv[2] || "/aihot/daily?limit=1";
const out = process.argv[3] || "preview/preview.html";

const res = await worker.fetch(new Request("https://cat-feeder.example.workers.dev" + route), {});
const xml = await res.text();
if (!res.ok) { console.log("接口返回 " + res.status + ": " + xml.slice(0, 200)); process.exit(1); }

const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
const first = items[0] || "";
const g = (re) => ((re.exec(first) || [,""])[1] || "");
const title = g(/<title>([\s\S]*?)<\/title>/);
const link = g(/<link>([\s\S]*?)<\/link>/);
const dateRaw = g(/<pubDate>([^<]*)/);
const dt = dateRaw ? new Date(dateRaw) : null;
const date = (dt && !isNaN(dt.getTime()))
  ? new Date(dt.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ") + " (北京时间)"
  : dateRaw;
const desc = g(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/);

const css = [
"* { box-sizing: border-box; }",
":root {",
"  color-scheme: light dark;",
"  --bg:#e8eaee; --card:#ffffff; --ink:#1b1b1b; --ink2:#3a3a3a; --muted:#9a9a9a;",
"  --line:#ececec; --line2:#f2f2f2; --accent:#c0392b; --link:#2b6cb0;",
"  --shadow:0 0 44px rgba(0,0,0,.08); --btn:#ffffff; --btnline:#e2e2e2;",
"}",
"@media (prefers-color-scheme: dark) {",
"  :root:not([data-theme='light']) {",
"    --bg:#0e1013; --card:#171a1f; --ink:#eaeaea; --ink2:#c2c6cc; --muted:#7c828b;",
"    --line:#262a31; --line2:#20242a; --accent:#ff6f61; --link:#7fb2f0;",
"    --shadow:0 0 44px rgba(0,0,0,.55); --btn:#1d2127; --btnline:#2b3038;",
"  }",
"}",
":root[data-theme='dark'] {",
"  --bg:#0e1013; --card:#171a1f; --ink:#eaeaea; --ink2:#c2c6cc; --muted:#7c828b;",
"  --line:#262a31; --line2:#20242a; --accent:#ff6f61; --link:#7fb2f0;",
"  --shadow:0 0 44px rgba(0,0,0,.55); --btn:#1d2127; --btnline:#2b3038;",
"}",
"body { margin:0; background:var(--bg); color:var(--ink); transition:background .2s;",
"  font:16.5px/1.85 -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif;",
"  -webkit-font-smoothing:antialiased; }",
".phone { max-width:432px; margin:0 auto; background:var(--card); min-height:100vh; padding-bottom:72px;",
"  box-shadow:var(--shadow); transition:background .2s; }",
".kicker { margin:0; padding:20px 24px 0; font:700 10px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;",
"  letter-spacing:.18em; color:var(--muted); opacity:.75; }",
".head { padding:12px 24px 20px; border-bottom:1px solid var(--line); }",
"h1 { font-size:20px; line-height:1.5; margin:0 0 10px; font-weight:800; letter-spacing:-.012em; }",
".meta { margin:0; color:var(--muted); font-size:12.5px; }",
".meta a { color:var(--muted); }",
".body { padding:0 24px; }",
"img { width:100%; border-radius:12px; display:block; margin:22px 0 6px; }",
"h2 { display:flex; align-items:center; gap:9px; margin:38px 0 6px;",
"  font-size:12.5px; font-weight:700; letter-spacing:.16em; color:var(--accent); }",
"h2:before { content:''; width:20px; height:2px; border-radius:2px; background:var(--accent); flex:0 0 auto; }",
"h3 { font-size:16.5px; line-height:1.6; font-weight:700; letter-spacing:-.005em; margin:22px 0 4px; }",
"h3.hl { font-size:19.5px; line-height:1.5; margin:4px 0 10px; }",
"p { margin:8px 0; color:var(--ink2); }",
"p.issue { margin:20px 0 0; color:var(--muted); font-size:12.5px; }",
"p.src { margin:0 0 10px; }",
"small { display:block; color:var(--muted); font-size:12px; line-height:1.7; letter-spacing:.01em; }",
"ol { list-style:none; counter-reset:s; margin:14px 0 0; padding:0; }",
"ol li { counter-increment:s; position:relative; padding:14px 0 14px 42px; border-bottom:1px solid var(--line2); }",
"ol li:before { content:counter(s); position:absolute; left:0; top:13px;",
"  font:800 21px/1 ui-monospace, SFMono-Regular, Menlo, monospace; color:var(--accent); }",
"ol li b { display:block; font-size:15.5px; line-height:1.55; font-weight:700; }",
"ol li small { margin-top:3px; }",
"p.flash { padding:11px 0 11px 15px; margin:0; border-left:2px solid var(--line); color:var(--ink); }",
"p.flash + p.flash { border-top:1px solid var(--line2); }",
"p.flash b { font-size:15px; font-weight:700; line-height:1.55; }",
"p.flash small { margin-top:2px; }",
"a { color:var(--link); text-decoration:none; }",
"#tg { position:fixed; right:18px; bottom:18px; width:38px; height:38px; border-radius:50%;",
"  border:1px solid var(--btnline); background:var(--btn); color:var(--ink); font-size:15px;",
"  cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,.18); }"
].join("\n");

const js = [
"(function(){",
"  var q = new URLSearchParams(location.search).get('theme');",
"  if (q === 'dark' || q === 'light') document.documentElement.dataset.theme = q;",
"  document.getElementById('tg').onclick = function(){",
"    var cur = document.documentElement.dataset.theme;",
"    if (!cur) cur = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';",
"    document.documentElement.dataset.theme = (cur === 'dark') ? 'light' : 'dark';",
"  };",
"})();"
].join("\n");

const shell = [
"<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">",
"<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
"<title>" + title.replace(/[<>&]/g, "") + "</title>",
"<style>" + css + "</style></head><body><div class=\"phone\">",
"<p class=\"kicker\">FEED PREVIEW · " + route.replace(/[<>&]/g, "") + "</p>",
"<div class=\"head\"><h1>" + title + "</h1>",
"<p class=\"meta\">" + date + " · <a href=\"" + link + "\">原站页面</a></p></div>",
"<div class=\"body\">" + desc + "</div>",
"</div><button id=\"tg\" title=\"切换明暗\">◐</button>",
"<script>" + js + "</script></body></html>"
].join("\n");

const dir = out.replace(/[^/\\]+$/, "");
if (dir) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(out, shell);
console.log("写出 " + out + "（" + shell.length + " 字节，共 " + items.length + " 条，渲染第 1 条）");
