import worker from "../src/index.js";
const base = "https://cat-feeder.example.workers.dev";
// 用果壳的图（本地 DNS 干净）验证 /img 代理的转发逻辑
const g = "https://3-im.guokr.com/-_JQ35wVFci7n7gOnv9IbT2bfnVo5ygwY6IwNWKt84yBAwAAfgEAAEpQ.jpg";
let res = await worker.fetch(new Request(base + "/img?u=" + encodeURIComponent(g)), {});
let buf = Buffer.from(await res.arrayBuffer());
console.log("/img 代理(果壳)      ->", res.status, res.headers.get("content-type"), buf.length + "B", "JPEG头:" + buf.slice(0,3).toString("hex"));
res = await worker.fetch(new Request(base + "/img?u=" + encodeURIComponent("https://evil.example.com/x.jpg")), {});
console.log("/img 白名单外        ->", res.status, (await res.text()).trim());
res = await worker.fetch(new Request(base + "/nosuch"), {});
console.log("未知道路             ->", res.status, (await res.text()).trim());
res = await worker.fetch(new Request(base + "/pixiv/ranking/nope"), {});
console.log("坏参数               ->", res.status, (await res.text()).trim());
res = await worker.fetch(new Request(base + "/yande/post/popular_recent/9z"), {});
console.log("坏参数2              ->", res.status, (await res.text()).trim());
