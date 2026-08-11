/**
 * publog.js — @heitzz 공개 발행 로그 생성기
 *
 * 스레드 공식 API에서 실제 게시물(시각·첫 줄·링크)을 읽어 log/index.html 을 만든다.
 * 손으로 적는 로그가 아니라 **서버 기록 그대로**라 조작 여지가 없다 — "공개 실험" 신뢰 장치.
 * from: MONEY 스레드 운영 「스레드 무인발행 작업계획」 (2026-08-11 사용자 지시 — 외부 공개 로그).
 *
 * 실행: THREADS_ACCESS_TOKEN=... node scripts/publog.js
 * (GitHub Actions publog.yml이 6시간마다 실행 · 로컬에서도 같은 방식으로 실행 가능)
 */
"use strict";
const fs = require("fs");
const path = require("path");

const HOST = "https://graph.threads.net/v1.0";
const TOKEN = process.env.THREADS_ACCESS_TOKEN;
const OUT_DIR = path.join(__dirname, "..", "log");

async function api(pathname, params) {
  const url = new URL(`${HOST}/${pathname}`);
  for (const [k, v] of Object.entries({ ...params, access_token: TOKEN })) url.searchParams.set(k, v);
  const res = await fetch(url);
  const j = await res.json();
  if (!res.ok || j.error) throw new Error(`API ${res.status}: ${(j.error || {}).message || ""}`);
  return j;
}

/** 게시물 전부(최대 200) — 리포스트 껍데기는 걸러낸다 */
async function fetchPosts() {
  const out = [];
  let after;
  while (out.length < 200) {
    const page = await api("me/threads", {
      fields: "id,text,timestamp,permalink,media_type",
      limit: 50,
      ...(after ? { after } : {}),
    });
    const rows = (page.data || []).filter((p) => p.media_type !== "REPOST_FACADE" && p.text);
    out.push(...rows);
    after = page.paging && page.paging.cursors ? page.paging.cursors.after : null;
    if (!after || !(page.data || []).length) break;
  }
  return out;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const TYPE_ICON = { TEXT_POST: "✏️", IMAGE: "🖼", VIDEO: "🎬", CAROUSEL_ALBUM: "🎞" };

function kst(ts) {
  const d = new Date(ts);
  const p = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(d);
  const g = (t) => (p.find((x) => x.type === t) || {}).value || "";
  return {
    date: `${g("year")}-${g("month")}-${g("day")}`,
    day: g("weekday"),
    time: `${g("hour")}:${g("minute")}`,
  };
}

function render(posts) {
  const byDate = new Map();
  for (const p of posts) {
    const k = kst(p.timestamp);
    if (!byDate.has(k.date)) byDate.set(k.date, { day: k.day, rows: [] });
    byDate.get(k.date).rows.push({ time: k.time, p });
  }
  const sections = [...byDate.entries()].map(([date, { day, rows }]) => {
    const trs = rows.map(({ time, p }) => {
      const head = esc(p.text.split("\n").find((l) => l.trim()) || "").slice(0, 48);
      return `<tr><td class="t">${time}</td><td class="i">${TYPE_ICON[p.media_type] || "✏️"}</td>` +
        `<td class="h">${head}</td><td class="l"><a href="${p.permalink}" target="_blank" rel="noopener">보기 ↗</a></td></tr>`;
    }).join("\n");
    return `<section><h2>${date} (${day}) <span class="n">${rows.length}건</span></h2>\n` +
      `<table><tbody>\n${trs}\n</tbody></table></section>`;
  }).join("\n");

  const now = kst(new Date().toISOString());
  return `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>@heitzz 발행 로그</title>
<meta property="og:title" content="@heitzz 발행 로그 — 스레드 자동화 공개 실험">
<meta property="og:description" content="언제 무엇이 발행됐는지, 스레드 서버 기록 그대로. 조작 없이 자동 갱신됩니다.">
<style>
:root{--bg:#fff;--fg:#1c1c1e;--mut:#8e8e93;--line:#e5e5ea;--card:#f7f7f8;--acc:#4f46e5}
@media(prefers-color-scheme:dark){:root{--bg:#101014;--fg:#f2f2f7;--mut:#8e8e93;--line:#2c2c31;--card:#1a1a1f;--acc:#8b85f4}}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;
  max-width:640px;margin:0 auto;padding:32px 16px 64px;line-height:1.6}
h1{font-size:1.4rem;margin-bottom:4px}
.sub{color:var(--mut);font-size:.85rem;margin-bottom:28px}
.sub a{color:var(--acc);text-decoration:none}
section{margin-bottom:24px}
h2{font-size:.95rem;padding:8px 12px;background:var(--card);border-radius:8px;margin-bottom:8px}
h2 .n{color:var(--mut);font-weight:400;font-size:.8rem;margin-left:6px}
table{width:100%;border-collapse:collapse}
td{padding:8px 6px;border-bottom:1px solid var(--line);font-size:.9rem;vertical-align:top}
td.t{white-space:nowrap;color:var(--mut);font-variant-numeric:tabular-nums;width:52px}
td.i{width:28px}
td.h{word-break:break-all}
td.l{white-space:nowrap;text-align:right;width:56px}
td.l a{color:var(--acc);text-decoration:none;font-size:.85rem}
footer{color:var(--mut);font-size:.78rem;margin-top:36px;border-top:1px solid var(--line);padding-top:12px}
</style></head><body>
<h1>@heitzz 발행 로그</h1>
<p class="sub">스레드 자동화 공개 실험 — 언제 무엇이 나갔는지 서버 기록 그대로.
계정: <a href="https://www.threads.com/@heitzz" target="_blank" rel="noopener">threads.com/@heitzz</a></p>
${sections}
<footer>총 ${posts.length}건 · 마지막 갱신 ${now.date} ${now.time} (KST) · 6시간마다 자동 갱신 · 시각은 한국 기준</footer>
</body></html>`;
}

async function main() {
  if (!TOKEN) { console.error("THREADS_ACCESS_TOKEN 필요"); process.exit(1); }
  const posts = await fetchPosts();
  console.log(`[publog] 게시물 ${posts.length}건 수집`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), render(posts), "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "data.json"),
    JSON.stringify(posts.map((p) => ({ at: p.timestamp, type: p.media_type, head: p.text.split("\n")[0], link: p.permalink })), null, 1), "utf8");
  console.log("[publog] log/index.html · log/data.json 생성 ✅");
}

main().catch((e) => { console.error("🔴", e.message); process.exit(1); });
