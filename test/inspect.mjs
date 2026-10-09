import worker from "../src/index.js";
const base = "https://cat-feeder.example.workers.dev";
for (const p of ["/nasa/apod?limit=2", "/bjp/apod?limit=2", "/bing", "/ycwb/1", "/afdian/dynamic/nekotou", "/guokr/column/institute"]) {
  const res = await worker.fetch(new Request(base + p), {});
  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  console.log("\n##### " + p + "  (" + items.length + " 条)");
  for (const it of items.slice(0, 2)) {
    const t = (/(?:<title>)([\s\S]*?)(?:<\/title>)/.exec(it) || [])[1];
    const l = (/(?:<link>)([\s\S]*?)(?:<\/link>)/.exec(it) || [])[1];
    const img = (/(?:<img src=")([^"]+)/.exec(it) || [])[1] || "-";
    const d = (/(?:<pubDate>)([\s\S]*?)(?:<\/pubDate>)/.exec(it) || [])[1] || "-";
    console.log("  " + t);
    console.log("    link: " + l);
    console.log("    date: " + d);
    console.log("    img : " + img.slice(0, 110));
  }
}
