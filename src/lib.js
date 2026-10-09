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
