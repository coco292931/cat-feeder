import {
  UA, PIXIV_HEADERS, esc, buildFeed,
  parseBing, parseApodFeed, parseZhihuDaily, zhihuStoryHtml, renderAihotMarkdown, aihotLeadOf, parseAihotHighlights, parseAihotLead, aihotDailyCover, parseBjpList, parseBjpItem,
  parsePixivRanking, parsePixivUser, pixivRankApiMode,
  parseMittrchina, parseYcwb, parseAfdian, parseGuokr, parseYande
} from "./lib.js";

const XML = { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" };

async function getText(url, headers) {
  const h = Object.assign({ "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" }, headers || {});
  const r = await fetch(url, { headers: h });
  if (!r.ok) throw new Error("upstream " + r.status + " " + url);
  return r.text();
}

async function getJson(url, headers) {
  return JSON.parse(await getText(url, headers));
}

// pixiv 的图床必须带 Referer，否则 403 —— 一律走自己的 /img 代理
function proxied(u, origin) {
  if (!u) return u;
  try {
    const h = new URL(u).hostname;
    if (h.endsWith("pximg.net")) return origin + "/img?u=" + encodeURIComponent(u);
  } catch (e) { /* 相对地址或坏地址，原样返回 */ }
  return u;
}

function finalize(meta, items, origin, selfUrl) {
  for (const it of items) {
    if (it.image) it.image = proxied(it.image, origin);
    if (it.enclosure) it.enclosure = proxied(it.enclosure, origin);
  }
  return buildFeed(meta, items, selfUrl);
}

const ROUTES = [
  ["/bing", "Bing 每日壁纸"],
  ["/nasa/apod", "NASA 天文每日一图"],
  ["/zhihu/daily", "知乎日报（?date=YYYYMMDD 可翻历史）"],
  ["/aihot/daily", "AIHOT AI 日报 详细版（?limit=7 / ?date=YYYY-MM-DD）"],
  ["/bjp/apod", "北京天文馆 每日一图"],
  ["/pixiv/ranking/day", "pixiv 排行（day/week/month/day_male/day_female/week_original/week_rookie…）"],
  ["/pixiv/user/159912", "pixiv 用户动态（填 user id）"],
  ["/mittrchina/hot", "MIT 科技评论（index/hot/breaking/video）"],
  ["/ycwb/1", "羊城晚报（node id）"],
  ["/afdian/dynamic/nekotou", "爱发电用户动态（填 slug）"],
  ["/guokr/column/institute", "果壳专栏（calendar/institute/foodlab/pretty）"],
  ["/guokr/scientific", "果壳 科学人"],
  ["/yande/post/popular_recent/1w", "yande 热门（1d/1w/1m/1y）"],
  ["/yande/piclens?tags=futanari", "yande 标签直通（原样转发 piclens）"],
  ["/img?u=<encoded>", "图片代理（补 pixiv Referer）"]
];

function indexPage(origin) {
  const rows = ROUTES.map(function (r) {
    return "<li><a href=\"" + esc(r[0]) + "\">" + esc(r[0]) + "</a> — " + esc(r[1]) + "</li>";
  }).join("");
  return "<!doctype html><meta charset=\"utf-8\"><title>cat-feeder</title>" +
    "<h1>cat-feeder</h1><p>自建 feed，照着 RSSHub 的路由规则重写的。</p><ul>" + rows + "</ul>" +
    "<p>用法：把 OPML 里的 https://rsshub.app 换成 " + esc(origin) + " 即可。</p>";
}

async function imgProxy(url, origin) {
  const u = url.searchParams.get("u");
  if (!u) return new Response("missing u", { status: 400 });
  let t;
  try { t = new URL(u); } catch (e) { return new Response("bad u", { status: 400 }); }
  if (t.protocol !== "https:") return new Response("only https", { status: 400 });
  const h = t.hostname;
  const allowed = h.endsWith("pximg.net") || h.endsWith("yande.re") || h.endsWith("mittrchina.com") || h.endsWith("guokr.com");
  if (!allowed) return new Response("host not allowed: " + h, { status: 403 });
  const headers = { "User-Agent": UA };
  if (h.endsWith("pximg.net")) headers.Referer = "https://www.pixiv.net/";
  if (h.endsWith("yande.re")) headers.Referer = "https://yande.re/";
  const r = await fetch(t.toString(), { headers: headers });
  if (!r.ok) return new Response("upstream " + r.status, { status: 502 });
  return new Response(r.body, {
    status: 200,
    headers: {
      "Content-Type": r.headers.get("Content-Type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400, immutable",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = url.origin;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const seg = path.split("/").filter(Boolean);
    const q = url.searchParams;
    const selfUrl = origin + url.pathname + url.search;

    try {
      if (path === "/") return new Response(indexPage(origin), { headers: { "Content-Type": "text/html; charset=utf-8" } });
      if (path === "/health") return new Response("ok\n", { headers: { "Content-Type": "text/plain" } });
      if (seg[0] === "img") return await imgProxy(url, origin);

      // ---- bing ----
      if (path === "/bing") {
        const j = await getJson("https://cn.bing.com/hp/api/model?mtk=zh-CN");
        const p = parseBing(j);
        return new Response(finalize(p, p.items, origin, selfUrl), { headers: XML });
      }

      // ---- NASA APOD（官方 feed 转发 + 重排）----
      if (path === "/nasa/apod") {
        const xml = await getText("https://science.nasa.gov/feed/apod-basic/");
        const p = parseApodFeed(xml, Math.min(Number(q.get("limit")) || 10, 30));
        return new Response(finalize(p, p.items, origin, selfUrl), { headers: XML });
      }

      // ---- 知乎日报（原「知乎每日精选」的替代）----
      if (seg[0] === "zhihu" && (seg[1] === "daily" || seg[1] === undefined)) {
        const date = q.get("date");
        const api = date && /^[0-9]{8}$/.test(date)
          ? "https://daily.zhihu.com/api/4/news/before/" + date
          : "https://daily.zhihu.com/api/4/news/latest";
        const j = await getJson(api);
        const d = String(j.date || "");
        const day = d.length === 8 ? d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8) + "T00:00:00+08:00" : "";
        const pz = parseZhihuDaily(j, day);
        await Promise.all(pz.items.map(async function (it) {
          const id = (/([0-9]+)\/?$/.exec(it.link) || [])[1];
          if (!id) return;
          try {
            it.description = zhihuStoryHtml(await getJson("https://daily.zhihu.com/api/4/news/" + id));
          } catch (err) { /* 单篇拿不到就不带正文，不影响整条 feed */ }
        }));
        return new Response(finalize(pz, pz.items, origin, selfUrl), { headers: XML });
      }

      // ---- AIHOT 日报（用它的 agent 版 Markdown，原样抄一份）----
      if (seg[0] === "aihot" && seg[1] === "daily") {
        const one = q.get("date");
        const limit = Math.min(Number(q.get("limit")) || 7, 30);
        let dates;
        if (one && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(one)) dates = [one];
        else {
          const idxJson = await getJson("https://aihot.news/api/v1/dailies");
          dates = (idxJson.items || []).slice(0, limit).map(function (x) { return x.date; });
        }
        const mds = await Promise.all(dates.map(function (dd) {
          return getText("https://aihot.news/api/v1/agent/daily/" + dd, { "User-Agent": "aihot-api/2.0.0 cat-feeder" });
        }));
        const pages = await Promise.all(dates.map(function (dd) {
          return getText("https://aihot.news/daily/" + dd).catch(function () { return ""; });
        }));
        const his = pages.map(function (h) { return parseAihotHighlights(h); });
        const leads = pages.map(function (h) { return parseAihotLead(h); });
        const its = dates.map(function (dd, i) {
          const lead = aihotLeadOf(mds[i]);
          return {
            title: "AI 日报 · " + dd + (lead ? " — " + lead : ""),
            link: "https://aihot.news/daily/" + dd,
            guid: "aihot-daily-" + dd,
            pubDate: dd + "T08:00:00+08:00",
            image: aihotDailyCover(dd),
            description: renderAihotMarkdown(mds[i], dd, his[i], leads[i])
          };
        });
        const pa = { title: "AIHOT · AI 日报", link: "https://aihot.news/daily", items: its };
        return new Response(finalize(pa, pa.items, origin, selfUrl), { headers: XML });
      }

      // ---- 北京天文馆 ----      // ---- 北京天文馆 ----
      if (path === "/bjp/apod") {
        const html = await getText("https://www.bjp.org.cn/APOD/list.shtml");
        const limit = Math.min(Number(q.get("limit")) || 10, 20);
        const list = parseBjpList(html, limit);
        if (!list.length) throw new Error("bjp 列表解析为空，页面结构可能变了");
        const items = await Promise.all(list.map(async function (e) {
          let img = "";
          try { img = parseBjpItem(await getText(e.link)); } catch (err) { /* 单篇失败不影响整条 feed */ }
          return { title: e.title, link: e.link, image: img, pubDate: e.date };
        }));
        const p = { title: "北京天文馆 每日一图", link: "https://www.bjp.org.cn/APOD/list.shtml", items: items };
        return new Response(finalize(p, p.items, origin, selfUrl), { headers: XML });
      }

      // ---- pixiv 排行 ----
      if (seg[0] === "pixiv" && seg[1] === "ranking" && seg[2]) {
        const mode = seg[2];
        const api = pixivRankApiMode(mode);
        if (!api) return new Response("unknown mode: " + mode, { status: 400 });
        const j = await getJson("https://www.pixiv.net/ranking.php?mode=" + api + "&format=json", PIXIV_HEADERS);
        const p = parsePixivRanking(j, mode);
        return new Response(finalize(p, p.items, origin, selfUrl), { headers: XML });
      }

      // ---- pixiv 用户 ----
      if (seg[0] === "pixiv" && seg[1] === "user" && seg[2]) {
        const uid = seg[2];
        const profile = await getJson("https://www.pixiv.net/ajax/user/" + encodeURIComponent(uid) + "/profile/all?lang=zh", PIXIV_HEADERS);
        const ids = Object.keys((profile.body && profile.body.illusts) || {}).map(Number).sort(function (a, b) { return b - a; }).slice(0, Math.min(Number(q.get("limit")) || 12, 30));
        if (!ids.length) return new Response("该用户没有公开作品", { status: 404 });
        const qs = ids.map(function (i) { return "ids%5B%5D=" + i; }).join("&");
        const detail = await getJson("https://www.pixiv.net/ajax/user/" + encodeURIComponent(uid) +
          "/profile/illusts?" + qs + "&work_category=illust&is_first_page=0&lang=zh", PIXIV_HEADERS);
        const p = parsePixivUser(profile, detail, uid);
        return new Response(finalize(p, p.items, origin, selfUrl), { headers: XML });
      }

      // ---- MIT 科技评论 ----
      if (seg[0] === "mittrchina") {
        const type = seg[1] || "index";
        const apiPath = { index: "/information/index", hot: "/information/hot", breaking: "/flash", video: "/movie/index" }[type];
        if (!apiPath) return new Response("unknown type: " + type, { status: 400 });
        const limit = Math.min(Number(q.get("limit")) || 10, 30);
        let j;
        if (type === "breaking") {
          const r = await fetch("https://apii.web.mittrchina.com" + apiPath, {
            method: "POST",
            headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
            body: "page=1&size=" + limit
          });
          if (!r.ok) throw new Error("upstream " + r.status);
          j = await r.json();
        } else {
          j = await getJson("https://apii.web.mittrchina.com" + apiPath + "?limit=" + limit);
        }
        const p = parseMittrchina(j);
        return new Response(finalize(p, p.items, origin, selfUrl), { headers: XML });
      }

      // ---- 羊城晚报 ----
      if (seg[0] === "ycwb") {
        const node = seg[1] || "1";
        const j = await getJson("https://6api.ycwb.com/app_if/jy/getArticles?nodeid=" + encodeURIComponent(node) + "&pagesize=15");
        const p = parseYcwb(j);
        return new Response(finalize(p, p.items, origin, selfUrl), { headers: XML });
      }

      // ---- 爱发电 ----
      if (seg[0] === "afdian" && seg[1] === "dynamic" && seg[2]) {
        const slug = seg[2].replace(/^@/, "");
        const profile = await getJson("https://afdian.com/api/user/get-profile-by-slug?url_slug=" + encodeURIComponent(slug));
        const uid = profile && profile.data && profile.data.user && profile.data.user.user_id;
        if (!uid) return new Response("找不到该用户: " + slug, { status: 404 });
        const posts = await getJson("https://afdian.com/api/post/get-list?type=old&user_id=" + encodeURIComponent(uid));
        const p = parseAfdian(profile, posts);
        return new Response(finalize(p, p.items, origin, selfUrl), { headers: XML });
      }

      // ---- 果壳 ----
      if (seg[0] === "guokr" && seg[1] === "scientific") {
        const j = await getJson("https://www.guokr.com/beta/proxy/science_api/articles?retrieve_type=by_category&page=1");
        const p = parseGuokr(j, "果壳网 科学人", "https://www.guokr.com/scientific");
        return new Response(finalize(p, p.items, origin, selfUrl), { headers: XML });
      }
      if (seg[0] === "guokr" && seg[1] === "column" && seg[2]) {
        const map = { calendar: "pac", institute: "predator", foodlab: "predator", pretty: "beauty" };
        const channel = map[seg[2]] || seg[2];
        const j = await getJson("https://www.guokr.com/apis/minisite/article.json?retrieve_type=by_wx&channel_key=" +
          encodeURIComponent(channel) + "&offset=0&limit=10");
        const list = (j && j.result) || [];
        if (!list.length) return new Response("该栏目没有内容: " + seg[2], { status: 404 });
        const name = list[0].channels && list[0].channels[0] ? list[0].channels[0].name : seg[2];
        const p = parseGuokr(list, "果壳网 " + name, "https://www.guokr.com/");
        return new Response(finalize(p, p.items, origin, selfUrl), { headers: XML });
      }

      // ---- yande ----
      if (seg[0] === "yande" && seg[1] === "post" && seg[2] === "popular_recent") {
        const period = seg[3] || "1w";
        if (!/^(1d|1w|1m|1y)$/.test(period)) return new Response("period 应为 1d/1w/1m/1y", { status: 400 });
        const j = await getJson("https://yande.re/post/popular_recent.json?period=" + period);
        const p = parseYande(j, period);
        return new Response(finalize(p, p.items, origin, selfUrl), { headers: XML });
      }

      // ---- yande piclens 直通 ----
      if (seg[0] === "yande" && seg[1] === "piclens") {
        const tags = q.get("tags") || "";
        const page = q.get("page") || "1";
        const up = "https://yande.re/post/piclens?tags=" + encodeURIComponent(tags) + "&page=" + encodeURIComponent(page);
        const r = await fetch(up, { headers: { "User-Agent": UA } });
        return new Response(r.body, { status: r.status, headers: { "Content-Type": r.headers.get("Content-Type") || "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" } });
      }

      return new Response("no route: " + path + "\n", { status: 404, headers: { "Content-Type": "text/plain" } });
    } catch (e) {
      return new Response("cat-feeder error: " + (e && e.message ? e.message : String(e)) + "\n", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  }
};
