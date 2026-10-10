// 纯函数：解析上游数据 + 拼 RSS。不碰网络，方便单独测。
export const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
export const PIXIV_HEADERS = { "User-Agent": UA, "Referer": "https://www.pixiv.net/", "Accept": "application/json, text/plain, */*", "Accept-Language": "zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7" };

export function esc(s) {
  return String(s === undefined || s === null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function cdata(s) {
  return String(s === undefined || s === null ? "" : s).replace(/]]>/g, "]]&gt;");
}

export function toDate(x) {
  if (x === undefined || x === null || x === "") return null;
  var d;
  if (typeof x === "number") d = new Date(x < 1000000000000 ? x * 1000 : x);
  else d = new Date(x);
  return isNaN(d.getTime()) ? null : d;
}

export function abs(base, href) {
  if (!href) return "";
  if (/^https?:\/\//i.test(href)) return href;
  var b = String(base).replace(/\/+$/, "");
  return b + (String(href).charAt(0) === "/" ? href : "/" + href);
}

var ENT = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", ldquo: "\u201c", rdquo: "\u201d" };

export function decodeEntities(s) {
  return String(s === undefined || s === null ? "" : s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (m, e) {
    if (ENT[e] !== undefined) return ENT[e];
    if (e.charAt(0) === "#") {
      var code = (e.charAt(1) === "x" || e.charAt(1) === "X") ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return isNaN(code) ? m : String.fromCodePoint(code);
    }
    return m;
  });
}

export function textOf(html) {
  return decodeEntities(String(html === undefined || html === null ? "" : html).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export function pickImg(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.url || v.large || v.original || v.middle || v.small || v.thumb || "";
  return "";
}

function imgTag(u, alt) {
  return u ? "<p><img src=\"" + esc(u) + "\" alt=\"" + esc(alt || "") + "\" /></p>" : "";
}

export function renderDesc(it) {
  var body = it.description ? String(it.description) : "";
  return imgTag(it.image, it.title) + body;
}

export function buildFeed(meta, items, selfUrl) {
  var L = [];
  L.push("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
  L.push("<rss version=\"2.0\" xmlns:atom=\"http://www.w3.org/2005/Atom\" xmlns:media=\"http://search.yahoo.com/mrss/\">");
  L.push("<channel>");
  L.push("<title>" + esc(meta.title) + "</title>");
  L.push("<link>" + esc(meta.link) + "</link>");
  L.push("<description>" + esc(meta.description || meta.title) + "</description>");
  if (meta.image) L.push("<image><url>" + esc(meta.image) + "</url><title>" + esc(meta.title) + "</title><link>" + esc(meta.link) + "</link></image>");
  if (selfUrl) L.push("<atom:link href=\"" + esc(selfUrl) + "\" rel=\"self\" type=\"application/rss+xml\" />");
  L.push("<lastBuildDate>" + new Date().toUTCString() + "</lastBuildDate>");
  L.push("<generator>cat-feeder</generator>");
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var d = toDate(it.pubDate);
    L.push("<item>");
    L.push("<title>" + esc(it.title) + "</title>");
    L.push("<link>" + esc(it.link) + "</link>");
    L.push("<guid isPermaLink=\"false\">" + esc(it.guid || it.link || it.title) + "</guid>");
    if (d) L.push("<pubDate>" + d.toUTCString() + "</pubDate>");
    if (it.author) L.push("<author>" + esc(it.author) + "</author>");
    if (it.category) L.push("<category>" + esc(it.category) + "</category>");
    if (it.image) L.push("<media:content url=\"" + esc(it.image) + "\" medium=\"image\" />");
    if (it.enclosure) L.push("<enclosure url=\"" + esc(it.enclosure) + "\" type=\"" + esc(it.enclosureType || "image/jpeg") + "\" length=\"0\" />");
    L.push("<description><![CDATA[" + cdata(renderDesc(it)) + "]]></description>");
    L.push("</item>");
  }
  L.push("</channel>");
  L.push("</rss>");
  return L.join("\n");
}

// ---------- bing ----------
export function parseBing(json) {
  var mcs = json.MediaContents || [];
  var items = mcs.map(function (mc) {
    var ic = mc.ImageContent || {};
    var raw = (ic.Image && ic.Image.Url) || "";
    var img = abs("https://cn.bing.com", raw.replace(/_\d+x\d+\.(webp|jpg|jpeg|png)$/i, "_1920x1080.jpg"));
    var ssd = String(mc.Ssd || "");
    var pub = ssd.length === 8 ? ssd.slice(0, 4) + "-" + ssd.slice(4, 6) + "-" + ssd.slice(6, 8) + "T00:00:00+08:00" : "";
    var desc = "";
    if (ic.Headline) desc += "<p>" + esc(ic.Headline) + "</p>";
    if (ic.Description) desc += "<p>" + esc(ic.Description) + "</p>";
    if (ic.Copyright) desc += "<p>" + esc(ic.Copyright) + "</p>";
    return { title: ic.Title || "Bing 壁纸", link: abs("https://cn.bing.com", ic.BackstageUrl || "/"), image: img, pubDate: pub, description: desc };
  });
  return { title: "Bing 每日壁纸", link: "https://cn.bing.com/", items: items };
}

// ---------- NASA APOD ----------
// api.nasa.gov 那个接口现在只会返回占位数据，老 apod.nasa.gov 也已跳转到新站，
// 只有 science.nasa.gov/feed/apod-basic/ 这个官方 feed 还是真数据。
export function parseApodFeed(xml, limit) {
  var out = [];
  var blocks = String(xml).match(/<item>[\s\S]*?<\/item>/g) || [];
  for (var i = 0; i < blocks.length && out.length < limit; i++) {
    var b = blocks[i];
    var title = decodeEntities((/<title>([\s\S]*?)<\/title>/.exec(b) || [])[1] || "").trim();
    var link = ((/<link>([\s\S]*?)<\/link>/.exec(b) || [])[1] || "").trim();
    var date = ((/<pubDate>([\s\S]*?)<\/pubDate>/.exec(b) || [])[1] || "").trim();
    var hd = decodeEntities(((/<apod:hdurl>([\s\S]*?)<\/apod:hdurl>/.exec(b) || [])[1] || "").trim());
    var desc = ((/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/.exec(b) || [])[1] || "").trim();
    if (!title || !link) continue;
    out.push({ title: title, link: link, image: hd, enclosure: hd, pubDate: date, description: desc });
  }
  return { title: "NASA 天文每日一图 (APOD)", link: "https://science.nasa.gov/apod/", items: out };
}

// ---------- 知乎日报 ----------
// 官方 www.zhihu.com/rss 早就下线了（200 但 0 字节），日报这个是活的、免登录。
export function parseZhihuDaily(json, day) {
  var items = [];
  var seen = {};
  var push = function (s) {
    if (!s || !s.id || seen[s.id]) return;
    seen[s.id] = 1;
    var img = (s.images && s.images[0]) || s.image || "";
    items.push({
      title: s.title,
      link: s.url || ("https://daily.zhihu.com/story/" + s.id),
      image: img,
      pubDate: day,
      description: ""
    });
  };
  (json.top_stories || []).forEach(push);
  (json.stories || []).forEach(push);
  return { title: "知乎日报" + (day ? " " + day.slice(0, 10) : ""), link: "https://daily.zhihu.com/", items: items };
}

// 单篇正文：daily.zhihu.com/api/4/news/<id>，body 本身就是排好版的 HTML。
// 它自带的 css 挂在 news-at.zhihu.com 上（已经死了），所以不引，交给阅读器自己的样式。
export function zhihuStoryHtml(s) {
  var body = String((s && s.body) || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  // 头图不用在这儿加，item.image 已经由 buildFeed 渲染了，再加就重复
  return body;
}
// ---------- AIHOT 日报 ----------
// 正文走它给 Agent 的 Markdown（/api/v1/agent/daily/<date>）：排版本来就是
// 「头条 -> 各栏目 + 简介 -> 快讯」，还自带「来源 / 另有 N 家信源报道」。
// 里面缺的两样去日报页 HTML 里补：头条导语、今日看点。期号自己算（第 1 期 = 2026-04-22）。
var AIHOT_ISSUE1 = Date.parse("2026-04-22T00:00:00Z");

export function aihotIssueNo(date) {
  var t = Date.parse(String(date) + "T00:00:00Z");
  return isNaN(t) ? 0 : Math.round((t - AIHOT_ISSUE1) / 86400000) + 1;
}

export function aihotDailyCover(date) {
  return date ? ("https://aihot.news/og/reports/daily/" + date + ".png") : "";
}

export function aihotLeadOf(md) {
  var m = /^头条[:：]\s*(.+)$/m.exec(String(md || ""));
  return m ? m[1].trim() : "";
}

// 头条导语：头版 section 里的第一个 <p>（class 带 leading-[1.9]）
export function parseAihotLead(html) {
  var s = String(html || "");
  var i = s.indexOf("头版");
  if (i < 0) i = s.indexOf("头条");
  if (i < 0) return "";
  var chunk = s.slice(i, i + 8000);
  var m = /<p[^>]*leading-\[1\.9\][^>]*>([\s\S]*?)<\/p>/.exec(chunk);
  if (!m) m = /<p[^>]*>([^<]{40,})<\/p>/.exec(chunk);
  return m ? decodeEntities(m[1].replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim() : "";
}

// 今日看点：头版 section 里头条下面那个 <ol>；href 是 /daily/<date>#r-<条目id>
export function parseAihotHighlights(html) {
  var s = String(html || "");
  var i = s.indexOf("看点");
  if (i < 0) return [];
  var ol = s.indexOf("<ol", i);
  if (ol < 0) return [];
  var end = s.indexOf("</ol>", ol);
  var chunk = s.slice(ol, end < 0 ? ol + 8000 : end);
  var out = [];
  var re = /<li><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g;
  var m;
  while ((m = re.exec(chunk)) !== null) {
    var inner = m[2];
    var rank = "", title = "", src = "";
    var sre = /<span([^>]*)>([^<]*)<\/span>/g, sm;
    while ((sm = sre.exec(inner)) !== null) {
      var cls = sm[1], txt = decodeEntities(sm[2]).replace(/\s+/g, " ").trim();
      if (!txt) continue;
      if (!rank && cls.indexOf("num") >= 0 && /^[0-9]+$/.test(txt)) rank = txt;
      else if (!title && cls.indexOf("font-bold") >= 0) title = txt;
      else if (!src && cls.indexOf("truncate") >= 0) src = txt;
    }
    if (!title) continue;
    var idm = /#r-([A-Za-z0-9]+)/.exec(m[1]);
    out.push({
      rank: rank || String(out.length + 1),
      title: title,
      source: src,
      url: idm ? ("https://aihot.news/items/" + idm[1]) : "https://aihot.news/daily"
    });
  }
  return out;
}

// 条目 id -> 原站原文链接。Markdown 那份里只有 AIHOT 站内链接，原文要从 JSON 接口拿。
export function aihotOriginalMap(json) {
  var map = {};
  var rep = (json && json.report) || {};
  var take = function (i) {
    if (!i || !i.links) return;
    var m = /\/items\/([A-Za-z0-9]+)/.exec(i.links.aihot || "");
    if (m && i.links.original) map[m[1]] = i.links.original;
  };
  (rep.sections || []).forEach(function (s) { (s.items || []).forEach(take); });
  (rep.flashes || []).forEach(take);
  return map;
}

export function renderAihotMarkdown(md, date, highlights, lead, originals) {
  var origLink = function (u) {
    var m = /\/items\/([A-Za-z0-9]+)/.exec(u || "");
    var o = (m && originals && originals[m[1]]) || "";
    return o ? ("<a href=\"" + esc(o) + "\">原文</a>") : "";
  };
  var metaLine = function (meta, url) {
    var parts = [];
    if (meta) parts.push(esc(meta));
    var o = origLink(url);
    if (o) parts.push(o);
    return parts.join(" · ");
  };
  var raw = String(md || "").split("\n");
  var s = -1, e = -1;
  raw.forEach(function (l, i) {
    if (s < 0 && l.indexOf("不可信外部资料开始") >= 0) s = i;
    if (l.indexOf("不可信外部资料结束") >= 0) e = i;
  });
  var body = raw.slice(s < 0 ? 0 : s + 1, e < 0 ? raw.length : e);

  // 第一趟：拆成结构，顺手把标题和链接对上
  var seq = [];
  body.forEach(function (line) {
    if (!line.trim()) return;
    var lm = /\[([^\]]+)\]\(([^)]+)\)/.exec(line);
    var url = lm ? lm[2] : "";
    var plain = line.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
    var m;
    if ((m = /^头条[:：]\s*(.+)$/.exec(plain))) { seq.push({ k: "lead", title: m[1] }); return; }
    if ((m = /^【(.+)】$/.exec(plain)) || (m = /^#+\s*(.+)$/.exec(plain))) { seq.push({ k: "h2", text: m[1] }); return; }
    if ((m = /^\d+\.\s+(.+)$/.exec(plain))) {
      var parts = m[1].split(" · ");
      seq.push({ k: "item", title: parts.shift(), meta: parts.join(" · "), url: url });
      return;
    }
    if ((m = /^-\s+(.+)$/.exec(plain))) {
      if (/^相关[:：]/.test(m[1])) return;
      var bits = m[1].split(" · ");
      var tm = /^(\d{2}-\d{2} \d{2}:\d{2})$/.exec(bits[0]);
      if (tm) {
        bits.shift();
        var src = bits.length > 1 ? bits.pop() : "";
        seq.push({ k: "flash", title: bits.join(" · "), meta: [src, tm[1]].filter(Boolean).join(" · "), url: url });
      } else {
        seq.push({ k: "flash", title: m[1], meta: "", url: url });
      }
      return;
    }
    seq.push({ k: "p", text: plain });
  });

  // 标题 -> 链接，给头条用（头条那行本身不带链接）
  var urls = {};
  seq.forEach(function (x) { if (x.k === "item" && x.url) urls[x.title] = x.url; });

  var wk = ["日", "一", "二", "三", "四", "五", "六"];
  var dt = new Date(String(date) + "T00:00:00+08:00");
  var n = aihotIssueNo(date);
  var dailyUrl = "https://aihot.news/daily/" + date;
  var L = [];
  var seenHi = 0;
  if (n > 0) L.push("<p class=\"issue\">第 " + n + " 期 · " + date + (isNaN(dt.getTime()) ? "" : " · 星期" + wk[dt.getDay()]) + "</p>");
  var hiBlock = function () {
    if (seenHi || !highlights || !highlights.length) return;
    seenHi = 1;
    L.push("<h2>今日看点</h2>");
    L.push("<ol>");
    highlights.forEach(function (hi) {
      L.push("<li><a href=\"" + esc(hi.url) + "\"><b>" + esc(hi.title) + "</b></a>" + (hi.source ? "<small>" + esc(hi.source) + "</small>" : "") + "</li>");
    });
    L.push("</ol>");
  };
  seq.forEach(function (x) {
    if (x.k === "lead") {
      L.push("<h2>头条</h2>");
      var lu = urls[x.title] || dailyUrl;
      L.push("<h3 class=\"hl\"><a href=\"" + esc(lu) + "\">" + esc(x.title) + "</a></h3>");
      if (lead) L.push("<p>" + esc(lead) + "</p>");
      if (origLink(lu)) L.push("<p class=\"src\"><small>" + origLink(lu) + "</small></p>");
      return;
    }
    if (x.k === "h2") { hiBlock(); L.push("<h2>" + esc(x.text) + "</h2>"); return; }
    if (x.k === "item") {
      L.push(x.url
        ? "<h3><a href=\"" + esc(x.url) + "\">" + esc(x.title) + "</a></h3>"
        : "<h3>" + esc(x.title) + "</h3>");
      var ml = metaLine(x.meta, x.url);
      if (ml) L.push("<p class=\"src\"><small>" + ml + "</small></p>");
      return;
    }
    if (x.k === "flash") {
      L.push("<p class=\"flash\">" + (x.url ? "<a href=\"" + esc(x.url) + "\"><b>" + esc(x.title) + "</b></a>" : "<b>" + esc(x.title) + "</b>") + (x.meta ? "<small>" + esc(x.meta) + "</small>" : "") + "</p>");
      return;
    }
    L.push("<p>" + esc(x.text) + "</p>");
  });
  return L.join("\n");
}
// ---------- 北京天文馆 ----------
export function parseBjpList(html, limit) {
  var out = [];
  var blocks = String(html).match(/<b>[\s\S]*?<\/b>/gi) || [];
  for (var i = 0; i < blocks.length && out.length < limit; i++) {
    var b = blocks[i];
    var href = /<a[^>]+href="([^"]+)"/i.exec(b);
    if (!href || href[1].indexOf("/APOD/") === -1) continue;
    var dm = /([0-9]{4}-[0-9]{2}-[0-9]{2})/.exec(b);
    if (!dm) continue;
    var tm = /title="([^"]*)"/i.exec(b);
    var am = /<a[^>]*>([\s\S]*?)<\/a>/i.exec(b);
    var title = decodeEntities(tm ? tm[1] : (am ? textOf(am[1]) : "")).trim();
    if (!title) continue;
    out.push({ date: dm[1] + "T00:00:00+08:00", link: abs("https://www.bjp.org.cn", href[1]), title: title });
  }
  return out;
}

export function parseBjpItem(html) {
  var m = /<img[^>]*\ssrc="([^"]+)"/i.exec(html);
  if (!m) return "";
  var src = m[1];
  if (/\.thumb\.(jpg|jpeg|png|webp)$/i.test(src)) src = src.replace(/\.thumb\.(jpg|jpeg|png|webp)$/i, "");
  return abs("https://www.bjp.org.cn", src);
}

// ---------- pixiv ----------
var PIXIV_RANK_MODE = {
  day: "daily", week: "weekly", month: "monthly",
  day_male: "male", day_female: "female", day_ai: "daily_ai",
  week_original: "original", week_rookie: "rookie",
  day_r18: "daily_r18", day_r18_ai: "daily_r18_ai",
  day_male_r18: "male_r18", day_female_r18: "female_r18",
  week_r18: "weekly_r18", week_r18g: "r18g"
};

export function pixivRankApiMode(mode) {
  return PIXIV_RANK_MODE[mode] || PIXIV_RANK_MODE[mode + "_r18"] || null;
}

export function parsePixivRanking(json, mode) {
  var list = json.contents || [];
  var items = list.map(function (c) {
    var img = (c.url || "").replace(/\/c\/[^/]+\//, "/");
    return {
      title: "#" + c.rank + " " + c.title,
      link: "https://www.pixiv.net/artworks/" + c.illust_id,
      image: img,
      enclosure: img,
      pubDate: c.date,
      author: c.user_name,
      category: (c.tags || []).slice(0, 3).join(" / "),
      description: "<p>作者：" + esc(c.user_name) + "</p><p>标签：" + esc((c.tags || []).join(" ")) + "</p>"
    };
  });
  return { title: "pixiv 排行 - " + mode, link: "https://www.pixiv.net/ranking.php?mode=" + (PIXIV_RANK_MODE[mode] || mode), items: items };
}

export function parsePixivUser(profile, detail, uid) {
  var works = (detail && detail.body && detail.body.works) || {};
  var illusts = (profile && profile.body && profile.body.illusts) || {};
  var ids = Object.keys(illusts).map(Number).sort(function (a, b) { return b - a; });
  var items = [];
  for (var i = 0; i < ids.length; i++) {
    var w = works[String(ids[i])];
    if (!w) continue;
    var img = (w.url || "").replace(/\/c\/[^/]+\//, "/");
    items.push({
      title: w.title, link: "https://www.pixiv.net/artworks/" + w.id, image: img, enclosure: img,
      pubDate: w.createDate, author: w.userName, category: (w.tags || []).slice(0, 3).join(" / "),
      description: "<p>标签：" + esc((w.tags || []).join(" ")) + "</p>"
    });
  }
  var name = items.length && items[0].author ? items[0].author : uid;
  return { title: "pixiv - " + name, link: "https://www.pixiv.net/users/" + uid, items: items };
}

// ---------- MIT 科技评论 ----------
export function parseMittrchina(json) {
  var d = (json && json.data) || {};
  var list = Array.isArray(d) ? d : (d.items || []);
  var items = list.map(function (a) {
    var authors = (a.authors || []).map(function (x) { return x.username; }).filter(Boolean).join(", ");
    return {
      title: a.name || a.title, link: "https://www.mittrchina.com/news/detail/" + a.id,
      image: a.cover || "", pubDate: a.start_time, author: authors, category: a.typeName || "",
      description: "<p>" + esc(a.summary || "") + "</p>"
    };
  });
  return { title: "MIT 科技评论", link: "https://www.mittrchina.com/", items: items };
}

// ---------- 羊城晚报 ----------
export function parseYcwb(json) {
  var list = json.artiles || [];
  var items = list.map(function (a) {
    var pics = String(a.PICLINKS || "").split(",").map(function (s) { return s.trim(); }).filter(function (s) { return /^https?:/.test(s); });
    return {
      title: a.TITLE, link: a.PUBURL, image: pics[0] || "",
      pubDate: String(a.PUBTIME || "").replace(/^([0-9]{4}-[0-9]{2}-[0-9]{2}) ([0-9]{2}:[0-9]{2}:[0-9]{2})$/, "$1T$2+08:00") || a.PUBTIME,
      author: a.NODENAME, category: a.NODENAME,
      description: a.ABSTRACT ? "<blockquote><p>" + esc(a.ABSTRACT) + "</p></blockquote>" : ""
    };
  });
  return { title: "羊城晚报 " + ((list[0] || {}).NODENAME || ""), link: "https://www.ycwb.com/", items: items };
}

// ---------- 爱发电 ----------
export function parseAfdian(profile, posts) {
  var user = (profile && profile.data && profile.data.user) || {};
  var list = (posts && posts.data && posts.data.list) || [];
  var items = list.map(function (p) {
    var pics = p.pics || [];
    var body = decodeEntities(String(p.content || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
    return {
      title: p.title || "(无标题)", link: "https://afdian.com/p/" + p.post_id,
      image: pics[0] || p.cover || "", pubDate: Number(p.publish_time) * 1000, author: user.name || "",
      description: "<p>" + esc(body) + "</p>"
    };
  });
  return { title: (user.name || "") + " 的爱发电动态", link: "https://afdian.com/a/" + (user.url_slug || ""), image: user.avatar || "", items: items };
}

// ---------- 正文提取（阅读器要正文，光有摘要它抓不动 SPA 页面）----------
export function sanitizeHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<img([^>]*?)\sdata-src="([^"]+)"/gi, "<img$1 src=\"$2\"")
    .replace(/\s(?:style|class|data-[a-z-]+|align|lang|dir|width|height)="[^"]*"/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/>\s+</g, "><")
    .replace(/\s+$/g, "")
    .trim();
}

// 果壳：apis.guokr.com/minisite/article/<id>.json 的 result.content 就是排好的 HTML
export function guokrContent(json) {
  return sanitizeHtml((json && json.result && json.result.content) || "");
}

// MIT 科技评论：/information/details?id=<id> 的 data.content（纯文本，按行分段）
export function mittrContent(json) {
  var c = (json && json.data && json.data.content) || "";
  if (/<[a-z][^>]*>/i.test(c)) return sanitizeHtml(c);
  return String(c).split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean)
    .map(function (x) { return "<p>" + esc(x) + "</p>"; }).join("");
}

// 北京天文馆：正文就在详情页那几个 <p> 里（第一段是站点介绍，丢掉）
export function bjpText(html) {
  var out = [];
  var re = /<p[^>]*>([\s\S]*?)<\/p>/gi, m;
  while ((m = re.exec(String(html || ""))) !== null) {
    var t = decodeEntities(m[1].replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
    if (!t || t.indexOf("探索宇宙") === 0) continue;
    out.push("<p>" + esc(t) + "</p>");
  }
  return out.join("");
}

// 羊城晚报：正文在 .main_article 里，后面跟着分享/评论之类，切掉
export function ycwbArticle(html) {
  var s = String(html || "");
  var i = s.indexOf("main_article");
  if (i < 0) return "";
  var start = s.indexOf(">", i);
  if (start < 0) return "";
  var seg = s.slice(start + 1, start + 30000);
  var cuts = ["<div class=\"share", "<div class=\"comments", "<div class=\"foot", "<div class=\"related", "<!-- 百度分享"];
  var end = seg.length;
  cuts.forEach(function (c) { var k = seg.indexOf(c); if (k > 0 && k < end) end = k; });
  return sanitizeHtml(seg.slice(0, end));
}

// ---------- 果壳 ----------
export function parseGuokr(list, title, link) {
  var items = (list || []).map(function (a) {
    var author = (a.author && a.author.nickname) || (Array.isArray(a.authors) && a.authors[0] && a.authors[0].nickname) || "";
    return {
      title: a.title, link: "https://www.guokr.com/article/" + a.id + "/",
      image: pickImg(a.image) || pickImg(a.small_image), pubDate: a.date_published, author: author,
      category: (a.subject && a.subject.name) || "",
      description: "<p>" + esc(a.summary || "") + "</p>"
    };
  });
  return { title: title, link: link, items: items };
}

// ---------- yande ----------
export function parseYande(list, period) {
  var items = (list || []).map(function (p) {
    var img = p.sample_url || p.jpeg_url || p.file_url || p.preview_url || "";
    var tags = String(p.tags || "").split(" ").filter(Boolean);
    return {
      title: "yande #" + p.id + " " + tags.slice(0, 4).join(" "),
      link: "https://yande.re/post/show/" + p.id,
      image: img, enclosure: p.file_url || img,
      pubDate: Number(p.created_at) * 1000, category: tags.slice(0, 3).join(" / "),
      description: "<p>score " + esc(p.score) + " | rating " + esc(p.rating) + " | " + esc(p.width) + "x" + esc(p.height) + "</p><p>" + esc(tags.join(" ")) + "</p>"
    };
  });
  return { title: "yande.re 热门 (" + period + ")", link: "https://yande.re/post/popular_recent", items: items };
}
