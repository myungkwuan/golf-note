// ============================================================
// 매크로 대시보드 데이터 프록시  (FRED + Stooq + CNN Fear&Greed)
// ------------------------------------------------------------
// FRED·Stooq·CNN 은 브라우저에서 직접 호출하면 CORS 로 막힘.
// 이 서버가 중간에서 대신 호출하고 CORS 헤더를 붙여 돌려줌.
//
//   실행:   node data-proxy.js
//   포트:   8787
//   의존성: 없음 (Node 18+ 내장 fetch 사용)
//
// 지원 경로:
//   GET /health                         → 상태 확인
//   GET /fred/series/observations?...   → FRED 중계
//   GET /stooq/q/d/l/?s=^spx&...         → Stooq CSV 중계
//   GET /cnn-fng                        → CNN 공포·탐욕 최신값
//   GET /cnn-fng/2024-01-01             → CNN 공포·탐욕 (날짜부터 히스토리)
// ============================================================

const http = require('http');
const { URL } = require('url');

const PORT = 8787;

const server = http.createServer(async (req, res) => {
  // ---- CORS ----
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const incoming = new URL(req.url, `http://localhost:${PORT}`);
  const path = incoming.pathname;

  // ---- 헬스체크 ----
  if (path === '/' || path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'macro-data-proxy',
      port: PORT,
      routes: ['/fred/*', '/stooq/*', '/cnn-fng', '/cnn-fng/:date'],
    }));
    return;
  }

  // ---- 라우팅: 어디로 중계할지 결정 ----
  let targetUrl = null;
  let tag = '';
  let extraHeaders = {};

  if (path.startsWith('/fred/')) {
    targetUrl = `https://api.stlouisfed.org${path}${incoming.search}`;
    tag = 'FRED ' + (incoming.searchParams.get('series_id') || '?');
  }
  else if (path.startsWith('/stooq/')) {
    targetUrl = `https://stooq.com/${path.replace('/stooq/', '')}${incoming.search}`;
    tag = 'STOOQ ' + (incoming.searchParams.get('s') || '?');
  }
  else if (path === '/cnn-fng' || path.startsWith('/cnn-fng/')) {
    // /cnn-fng            → 최신값
    // /cnn-fng/2024-01-01 → 그 날짜부터의 히스토리
    const datePart = path === '/cnn-fng' ? '' : '/' + path.slice('/cnn-fng/'.length);
    targetUrl = `https://production.dataviz.cnn.io/index/fearandgreed/graphdata${datePart}`;
    tag = 'CNN-FNG' + (datePart || '');
    // CNN 은 브라우저처럼 보이지 않으면 403 — Referer/Origin 필수
    extraHeaders = {
      'Referer': 'https://edition.cnn.com/',
      'Origin': 'https://edition.cnn.com',
    };
  }

  if (!targetUrl) {
    console.log(`[403] 알 수 없는 경로: ${path}`);
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'unknown route',
      path,
      hint: 'use /fred/*, /stooq/*, or /cnn-fng',
    }));
    return;
  }

  // ---- 실제 중계 호출 ----
  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json,text/csv,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        ...extraHeaders,
      },
    });
    const body = await upstream.text();
    console.log(`[${upstream.ok ? 'OK ' : 'ERR'}] ${upstream.status}  ${tag}`);
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'text/plain',
    });
    res.end(body);
  } catch (err) {
    console.error(`[FAIL] ${tag}  ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'proxy fetch failed', detail: err.message }));
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  매크로 데이터 프록시 실행 중');
  console.log(`  http://localhost:${PORT}`);
  console.log('');
  console.log('  /fred/*    FRED 경제지표');
  console.log('  /stooq/*   S&P / NASDAQ 지수');
  console.log('  /cnn-fng   CNN 공포·탐욕 지수');
  console.log('');
});
