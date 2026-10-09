# cat-feeder

照着 RSSHub 的路由规则重写的自建 feed，一个 Cloudflare Worker，零依赖。

## 路由

| 路径 | 对应 RSSHub | 上游 |
| --- | --- | --- |
| /bing | /bing | cn.bing.com/hp/api/model |
| /nasa/apod | /nasa/apod | science.nasa.gov/feed/apod-basic/（官方 feed） |
| /zhihu/daily?date=YYYYMMDD | /zhihu/daily | daily.zhihu.com/api/4/news/…（免登录；官方的 www.zhihu.com/rss 已下线） |
| /aihot/daily?limit=7&date= | — | aihot.news/api/v1/agent/daily（它给 Agent 用的 Markdown 版，本来就是「头条 → 各栏目 + 简介 → 快讯」，这里只是把外层给 AI 的说明剥掉；期号按 2026-04-22 = 第 1 期算出来） |
| /bjp/apod?limit=10 | /bjp/apod | www.bjp.org.cn/APOD/list.shtml（抓页面） |
| /pixiv/ranking/:mode | /pixiv/ranking/:mode | www.pixiv.net/ranking.php?format=json（免 token） |
| /pixiv/user/:id?limit=12 | /pixiv/user/:id | www.pixiv.net/ajax/user/... （免 token） |
| /mittrchina/:type | /mittrchina/:type | apii.web.mittrchina.com |
| /ycwb/:node | /ycwb/:node | 6api.ycwb.com |
| /afdian/dynamic/:slug | /afdian/dynamic/:uid | afdian.com/api/... |
| /guokr/column/:channel | /guokr/column/:channel | guokr.com/apis/minisite/article.json |
| /guokr/scientific | /guokr/scientific | guokr.com/beta/proxy/science_api/articles |
| /yande/post/popular_recent/:period | /yande/post/popular_recent/:period | yande.re/post/popular_recent.json |
| /yande/piclens?tags= | — | 原样转发 yande.re/post/piclens |
| /img?u= | — | 图片代理，给 i.pximg.net 补 Referer |

换成自己的域名以后，只要把 OPML 里的 `https://rsshub.app` 替换成 Worker 的地址即可。

## 几个坑（都踩过了）

- **pixiv 图片必须带 Referer**：i.pximg.net 不带 `Referer: https://www.pixiv.net/` 一律 403。所以 feed 里的图全指向本 Worker 的 /img，由它去补头。顺手把 `/c/480x960/` 这段去掉就是原图（实测 211KB -> 659KB）。
- **pixiv 官方那条路由要 refreshToken**，这里绕开了：排行用 `ranking.php?format=json`，用户动态用 `ajax/user/{id}/profile/all` + `profile/illusts`，都不用登录。
- **NASA 的老接口废了**：api.nasa.gov 现在只回占位数据，apod.nasa.gov 也跳转到新站。唯一还有真数据的是 `science.nasa.gov/feed/apod-basic/`，本 Worker 转发并重排。
- **果壳专栏路径变了**：老 URL `/guokr/institute` 现在是 `/guokr/column/institute`（内部映射 institute -> channel_key=predator）。
- **ycwb 接口的时间是 +08:00**，直接 new Date 会被当 UTC，代码里已经补上时区。

## 本地测试

```
node test/parse-test.mjs     # 拿真实样本数据喂给解析函数
node test/local-run.mjs      # 直接调 Worker 的 fetch handler（需要上游 DNS 可达）
node test/misc-test.mjs      # 图片代理与错误分支
```

## 部署（两种，挑一种）

**A. 面板里粘一下（不用装任何东西）**

Cloudflare 后台 → Workers & Pages → Create → Worker → 把 `dist/cat-feeder.js` 整个文件的内容粘进去 → Deploy。
这个文件是 `tools/bundle.mjs` 生成的单文件版，改了 src 以后重新跑一次 `node tools/bundle.mjs`。

**B. 命令行**

```
npm install
npx wrangler deploy      # 读 wrangler.toml，用 src/index.js + src/lib.js 两个模块
```

部署后 workers.dev 的地址在国内多半解析不出来（DNS 污染），建议在 Cloudflare 上绑一个自己的域名。
