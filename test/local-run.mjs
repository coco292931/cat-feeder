import worker from "../src/index.js";

const base = "https://cat-feeder.example.workers.dev";
const routes = (process.argv.slice(2).length ? process.argv.slice(2) : [
  "/health",
  "/bing",
  "/nasa/apod?days=5",
  "/bjp/apod?limit=5",
  "/mittrchina/hot",
  "/ycwb/1",
  "/afdian/dynamic/nekotou",
  "/guokr/column/institute",
  "/guokr/scientific",
  "/pixiv/ranking/day",
  "/pixiv/user/159912",
  "/yande/post/popular_recent/1w",
  "/yande/piclens?tags=futanari",
  "/img?u=https%3A%2F%2Fi.pximg.net%2Fimg-master%2Fimg%2F2026%2F10%2F08%2F00%2F00%2F13%2F150578881_p0_master1200.jpg"
]);

for (const path of routes) {
  const t0 = Date.now();
  try {
    const res = await worker.fetch(new Request(base + path), {});
    const ct = res.headers.get("content-type") || "";
    const buf = Buffer.from(await res.arrayBuffer());
    const body = buf.toString("utf8");
    const items = (body.match(/<item>/g) || []).length;
    const first = (/<title>([\s\S]*?)<\/title>/.exec(body) || [])[1] || "";
    console.log([path, res.status, ct.split(";")[0], buf.length + "B", items + " items", (Date.now() - t0) + "ms",
      body.startsWith("cat-feeder error") ? body.trim().slice(0, 160) : first.trim().slice(0, 60)].join("  |  "));
  } catch (e) {
    console.log(path + "  |  THROW  |  " + e.message);
  }
}
