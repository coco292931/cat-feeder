import worker from "../dist/cat-feeder.js";
const base = "https://cat-feeder.example.workers.dev";
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ["/health", "/bing", "/guokr/column/institute"];
for (const p of routes) {
  const res = await worker.fetch(new Request(base + p), {});
  const body = await res.text();
  const items = (body.match(/<item>/g) || []).length;
  const t = (/<title>([\s\S]*?)<\/title>/.exec(body) || [])[1] || "";
  console.log(p, "|", res.status, "|", items + " items |", t.trim().slice(0, 60));
}
