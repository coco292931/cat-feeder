// 把 src/lib.js + src/index.js 合成单文件，方便直接粘进 Cloudflare 面板
import fs from "node:fs";

const lib = fs.readFileSync("src/lib.js", "utf8").replace(/^export /gm, "");
const idx = fs.readFileSync("src/index.js", "utf8")
  .replace(/^import \{[\s\S]*?\} from "\.\/lib\.js";\n/m, "");

const out = "// cat-feeder — 单文件版，由 tools/bundle.mjs 生成，别直接改这个文件\n"
  + "// ===== lib.js =====\n" + lib.trim() + "\n\n// ===== index.js =====\n" + idx.trim() + "\n";

fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/cat-feeder.js", out);
console.log("dist/cat-feeder.js", out.length, "字节");
