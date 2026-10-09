import fs from "node:fs";
import * as L from "../src/lib.js";

const S = JSON.parse(fs.readFileSync(new URL("./sample-data.json", import.meta.url), "utf8"));
const origin = "https://cat-feeder.example.workers.dev";
let fails = 0;
function ok(name, cond, extra) {
  if (!cond) fails++;
  console.log((cond ? "  ok   " : "  FAIL ") + name + (extra ? "  -> " + extra : ""));
}
function proxy(u) { return u && /pximg\.net$/.test(new URL(u).hostname) ? origin + "/img?u=" + encodeURIComponent(u) : u; }
function feed(p, self) {
  for (const it of p.items) { if (it.image) it.image = proxy(it.image); }
  const xml = L.buildFeed(p, p.items, self);
  const ni = (xml.match(/<item>/g) || []).length, nc = (xml.match(/<\/item>/g) || []).length;
  ok(p.title + " :: XML 结构", ni === nc && ni === p.items.length && xml.endsWith("</rss>"), ni + " items");
  ok(p.title + " :: 无非法 CDATA", !/\]\]>(?!<\/description>)/.test(xml.replace(/\]\]><\/description>/g, "")) , "");
  return xml;
}
const short = (s, n) => String(s || "").slice(0, n || 70).replace(/\s+/g, " ");

console.log("== bing ==");
{ const p = L.parseBing(S.bing); ok("有内容", p.items.length > 0, p.items.length + " 条"); ok("图片", /^https:\/\/cn\.bing\.com\/th\?id=.+_1920x1080\.jpg$/.test(p.items[0].image), short(p.items[0].image)); ok("日期", !!L.toDate(p.items[0].pubDate), p.items[0].pubDate); console.log("   ", short(p.items[0].title)); feed(p); }

console.log("== nasa ==");
{ const p = L.parseApodFeed(S.apod_xml, 10); ok("有内容", p.items.length > 0, p.items.length + " 条"); ok("图片", /^https:\/\/assets\.science\.nasa\.gov\//.test(p.items[0].image), short(p.items[0].image)); ok("日期", !!L.toDate(p.items[0].pubDate), p.items[0].pubDate); console.log("   ", short(p.items[0].title)); feed(p); }

console.log("== bjp ==");
{ const list = L.parseBjpList(S.bjp_list, 10); ok("列表条数", list.length >= 3, list.length + " 条"); console.log("   ", short(list[0].title), "|", list[0].date, "|", list[0].link);
  const img = L.parseBjpItem(S.bjp_item); ok("详情页取图", /^https:\/\/www\.bjp\.org\.cn\//.test(img), short(img));
  const p = { title: "北京天文馆 每日一图", link: "https://www.bjp.org.cn/APOD/list.shtml", items: list.map(e => ({ title: e.title, link: e.link, image: img, pubDate: e.date })) }; feed(p); }

console.log("== pixiv ranking ==");
{ const p = L.parsePixivRanking(S.pixiv_rank, "day"); ok("有内容", p.items.length > 0, p.items.length + " 条"); ok("原图", /i\.pximg\.net\/img-master\//.test(p.items[0].image), short(p.items[0].image)); console.log("   ", short(p.items[0].title)); feed(p); }

console.log("== pixiv user ==");
{ const p = L.parsePixivUser(S.pixiv_profile, S.pixiv_detail, "159912"); ok("有内容", p.items.length > 0, p.items.length + " 条"); ok("原图", /i\.pximg\.net\/img-master\//.test(p.items[0].image), short(p.items[0].image)); ok("日期", !!L.toDate(p.items[0].pubDate), p.items[0].pubDate); console.log("   ", short(p.items[0].title), "|", p.items[0].author); feed(p); }

console.log("== mittrchina ==");
{ const p = L.parseMittrchina(S.mittr); ok("有内容", p.items.length > 0, p.items.length + " 条"); ok("链接", /^https?:\/\//.test(p.items[0].link), p.items[0].link); console.log("   ", short(p.items[0].title), "|", p.items[0].author); feed(p); }

console.log("== ycwb ==");
{ const p = L.parseYcwb(S.ycwb); ok("有内容", p.items.length > 0, p.items.length + " 条"); ok("日期", !!L.toDate(p.items[0].pubDate), p.items[0].pubDate); console.log("   ", short(p.items[0].title)); feed(p); }

console.log("== afdian ==");
{ const p = L.parseAfdian(S.afdian_profile, S.afdian_posts); ok("有内容", p.items.length > 0, p.items.length + " 条"); ok("日期", !!L.toDate(p.items[0].pubDate), p.items[0].pubDate); console.log("   ", p.title, "|", short(p.items[0].title)); feed(p); }

console.log("== guokr column ==");
{ const p = L.parseGuokr(S.guokr_col.result, "果壳 吃货研究所", "https://www.guokr.com/"); ok("有内容", p.items.length > 0, p.items.length + " 条"); ok("链接", /guokr\.com\/article\/\d+\//.test(p.items[0].link), p.items[0].link); console.log("   ", short(p.items[0].title), "|", p.items[0].author, "|", p.items[0].pubDate); feed(p); }

console.log("== guokr scientific ==");
{ const p = L.parseGuokr(S.guokr_sci, "果壳 科学人", "https://www.guokr.com/scientific"); ok("有内容", p.items.length > 0, p.items.length + " 条"); console.log("   ", short(p.items[0].title), "|", p.items[0].author); feed(p); }

console.log("== yande ==");
{ const p = L.parseYande(S.yande, "1w"); ok("有内容", p.items.length > 0, p.items.length + " 条"); ok("日期", !!L.toDate(p.items[0].pubDate)); console.log("   ", short(p.items[0].title), "|", short(p.items[0].image)); feed(p); }

console.log(fails ? ("\n" + fails + " 项失败") : "\n全部通过");
process.exit(fails ? 1 : 0);
