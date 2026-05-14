/* ═══════════════════════════════════════════════════════════════════
   매크로 유동성 대시보드 - 수정 가이드

   📍 빠른 위치 찾기 (Ctrl+F 검색어):
     데이터:    "const M = {"     "const C = {"
     로직:      "const calcRegime" "const calcAlerts" "simulateRegimes"
     차트:      "const Spark"     "const BigChart"   "ComparisonChart"  "const Backtest"
     카드:      "NarrativeCard"   "CompactCard"      "MetricModal"
     모달/UI:   "AlertCenter"     "SettingsModal"    "LiveTicker"
     AI:        "AIAnalysis"      "AIRegimeAnalysis" "DailyBriefing"    "ChatBot"
     포트폴리오: "const Portfolio"
     PWA:       "const PWAMeta"
     앱 진입:   "export default function App"

   ✏️ 자주 수정하는 곳:
     - 색상 팔레트     → C 객체 (한 곳에서 색 전부 제어)
     - 지표 추가/수정  → M 객체
     - 매수신호 기준   → calcRegime
     - 알림 임계값     → calcAlerts
     - AI 프롬프트     → 각 AI 컴포넌트 내부 prompt 문자열

   📦 외부 데이터 소스:
     - 암호자산: CoinGecko (자동)
     - 환율:     open.er-api.com (자동)
     - 주식지수: FRED (S&P/NASDAQ/SOX 등)
     - 미국 매크로: FRED API (Settings에서 키 입력 시)

   💾 localStorage 키:
     analysis:{지표키}                - 각 지표 AI 분석
     analysis:overall_regime          - 종합 AI 분석
     analysis:overall_regime:auto     - 자동 갱신 토글
     briefing:daily                   - 데일리 브리핑
     note:{지표키}                    - 사용자 개인 메모
     portfolio:allocations            - 포트폴리오 비중
     settings:fredKey                 - FRED API 키

   🛡️ 수정 원칙:
     - 한 컴포넌트만 수정해도 다른 컴포넌트에 영향 X (의존성: DATA→LOGIC→UI)
     - 색상 변경은 C 객체 한 곳에서
     - 지표 변경은 M 객체 한 곳에서
     - 새 컴포넌트 추가 시 비슷한 기존 컴포넌트 참조 권장
   ═══════════════════════════════════════════════════════════════════ */

import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, LineChart, Line, ResponsiveContainer, ReferenceArea, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Target, AlertTriangle, ChevronRight, Sparkles, RefreshCw, MessageCircle, X, Send, Bell, Settings } from 'lucide-react';

// ============ DATA ============
const seed = (s) => { let x = s; return () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; }; };
const gen = (n, start, vol, trend, sd = 1) => {
  const r = seed(sd); const d = []; let v = start;
  for (let i = 0; i < n; i++) { v += (r() - 0.5) * vol + trend; d.push({ i, v: +v.toFixed(3) }); }
  return d;
};

const C = {
  pos: '#34d399', posBg: 'rgba(52,211,153,0.08)', posBorder: 'rgba(52,211,153,0.3)',
  neg: '#f87171', negBg: 'rgba(248,113,113,0.08)', negBorder: 'rgba(248,113,113,0.3)',
  warn: '#fb923c', warnBg: 'rgba(251,146,60,0.08)', warnBorder: 'rgba(251,146,60,0.4)',
};
const sc = (s) => s === 'pos' ? C.pos : s === 'neg' ? C.neg : C.warn;
const sbg = (s) => s === 'pos' ? C.posBg : s === 'neg' ? C.negBg : C.warnBg;
const sbd = (s) => s === 'pos' ? C.posBorder : s === 'neg' ? C.negBorder : C.warnBorder;

const M = {
  // === 유동성 ===
  usM2:       { name: 'US M2 증가율', ref: '역사 평균 5.8%', value: 4.62, unit: '%', delta: +0.34, signal: 'pos', series: gen(60, 2.1, 0.3, 0.04, 11),
                story: 'US M2 증가율 4.62%는 역사 평균(5.8%)보다 살짝 낮지만 최근 3개월 가속 중(+0.34pp). 코로나 직후 26%까지 폭증했다가 -4%까지 떨어진 뒤 회복 국면 진입. M2 가속 = 유동성 확장 시작 신호.' },
  krM2:       { name: 'KR M2 증가율', ref: '한국 광의통화', value: 6.14, unit: '%', delta: +0.21, signal: 'pos', series: gen(60, 4.5, 0.25, 0.03, 12),
                story: '한국 M2 6.14%는 미국보다 빠른 속도로 확장 중. 가계 신용과 부동산 자금이 주된 동력이라 서울 아파트 가격과 강하게 연동된다. 일본·중국발 외부 유동성도 일부 유입 중.' },
  fedAssets:  { name: 'Fed 총자산', ref: '피크 8.96T → 6.71T', value: 6.71, unit: 'T$', delta: -0.12, signal: 'neg', series: gen(60, 8.9, 0.15, -0.037, 13),
                story: 'Fed는 여전히 QT(양적긴축) 지속 중. 월 950억$ 페이스로 자산 축소 중이지만 속도가 점차 둔화되고 있어 2026년 중 종료 가능성이 거론된다. QT 종료는 곧 유동성 확장 재개를 의미.' },
  ecbAssets:  { name: 'ECB 총자산', ref: '피크 8.8T → 6.4T', value: 6.43, unit: 'T€', delta: -0.08, signal: 'neg', series: gen(60, 7.8, 0.12, -0.022, 14),
                story: 'ECB도 Fed와 같이 QT 진행 중이나 속도는 더 점진적. 유럽 경기 둔화 우려로 추가 완화 가능성이 거론되며, 글로벌 유동성 회복의 잠재적 추가 동력으로 작용할 수 있다.' },
  bojAssets:  { name: 'BOJ 총자산', ref: '역사 신고점 갱신', value: 754, unit: 'T¥', delta: +1.20, signal: 'pos', series: gen(60, 720, 5, 0.6, 15),
                story: 'BOJ는 Fed·ECB가 긴축하는 동안에도 완화 기조를 유지해 온 중앙은행. 엔 약세 + 글로벌 캐리 트레이드 자금원으로 작용한다. 일본은행 정책 정상화는 글로벌 유동성에 큰 충격이 될 수 있어 주시 필요.' },
  globalLiq:  { name: '글로벌 유동성 (G3)', ref: 'Fed·ECB·BOJ 합산', value: 18.2, unit: 'T$', delta: +0.21, signal: 'pos', series: gen(60, 21.1, 0.25, -0.05, 16) },

  // === 금리 ===
  fedRate:    { name: 'Fed Funds', ref: '연준 기준금리', value: 4.25, unit: '%', delta: -0.25, signal: 'pos', series: gen(60, 5.5, 0.05, -0.022, 21),
                story: 'Fed Funds 4.25%는 피크(5.50%)에서 1.25%pp 인하된 수준. 통화정책 완화 사이클 진입을 확인하는 가장 직접적인 신호. 추가 인하 속도가 위험자산 향방의 핵심 변수.' },
  us2y:       { name: 'US 2Y', ref: '단기 정책금리 민감', value: 4.12, unit: '%', delta: -0.18, signal: 'pos', series: gen(60, 5.2, 0.1, -0.019, 22),
                story: '2년물 금리는 시장이 예상하는 향후 2년간의 Fed 정책 경로를 가장 잘 반영. 현재 4.12%는 Fed Funds(4.25%)보다 낮아 시장이 추가 인하를 기대하고 있다는 시그널.' },
  us10y:      { name: 'US 10Y', ref: '장기 성장·인플레', value: 4.41, unit: '%', delta: +0.06, signal: 'neu', series: gen(60, 4.0, 0.12, 0.007, 23),
                story: '10년물 금리는 장기 성장과 인플레 기대를 종합 반영. 4.41%는 역사적으로 정상 수준이나 기술주 밸류에이션엔 부담 요인. 4.5% 돌파 시 위험자산 변동성 확대 가능성.' },
  realRate:   { name: '실질금리 (10Y Real)', ref: '명목 - 기대인플레', value: 2.12, unit: '%', delta: -0.14, signal: 'pos', series: gen(60, 2.6, 0.08, -0.008, 24),
                story: '실질금리 2.12%는 1년 전 2.6%에서 하락 중. 실질금리가 떨어지면 현금·채권 보유의 기회비용이 커져 위험자산(주식·코인·금)으로 자금이 이동한다. 매크로 관점에서 가장 중요한 단일 지표.' },
  yieldCurve: { name: '10Y-2Y 스프레드', ref: '0 이상 = 정상', value: 0.29, unit: '%', delta: +0.24, signal: 'pos', series: gen(60, -0.5, 0.08, 0.013, 25),
                story: '10Y-2Y가 -0.5%(역전)에서 +0.29%까지 정상화. 역사적으로 역전 해소 후 6~18개월 사이 경기침체가 시작된 사례가 많아 신중하게 봐야 할 시그널.' },

  // === 신용 ===
  bankLoans:  { name: '은행 대출 증가율', ref: 'YoY', value: 2.84, unit: '%', delta: +0.31, signal: 'pos', series: gen(60, 1.2, 0.15, 0.027, 31),
                story: '은행 대출 증가율 2.84%는 회복 국면. 은행이 돈을 풀어야 실물 경기가 살아나는 만큼 신용 사이클의 1차 지표다. 절대값보다 가속도가 중요하며 현재 +0.31pp 가속 중.' },
  corpCredit: { name: '기업 신용 증가율', ref: '회사채 + 대출', value: 5.21, unit: '%', delta: +0.42, signal: 'pos', series: gen(60, 3.1, 0.2, 0.035, 32),
                story: '기업 신용 5.21%는 견조한 회복. 기업이 차입을 확대한다는 건 투자·M&A 활동이 활발하다는 의미로 주식시장 강세와 동행하는 경향. 현재는 AI 인프라 투자가 견인 중.' },
  hhCredit:   { name: '가계 신용 증가율', ref: '주담대 + 신용대출', value: 3.07, unit: '%', delta: +0.18, signal: 'pos', series: gen(60, 2.0, 0.12, 0.018, 33),
                story: '가계 신용 3.07%는 안정적 확장. 너무 빠르면 거품, 너무 느리면 소비 위축이라 현재 수준은 균형. 한국은 미국 대비 가파르며 부동산 시장과 직결된다.' },
  hyOas:      { name: 'HY 스프레드', ref: '300bp 미만 = 타이트', value: 281, unit: 'bp', delta: -12, signal: 'pos', series: gen(60, 420, 15, -2.3, 34),
                story: 'HY(하이일드) 스프레드 281bp는 역사적으로 매우 타이트한 수준. 투자자들이 부실 위험을 거의 가격에 반영하지 않고 있다는 의미로, 위험선호가 강하다는 뜻이지만 동시에 거품 가능성도 시사한다.' },

  // === 인플레 ===
  cpi:        { name: 'CPI', ref: 'Fed 목표 2%', value: 2.71, unit: '%', delta: -0.13, signal: 'pos', series: gen(60, 4.2, 0.15, -0.025, 41),
                story: '헤드라인 CPI 2.71%는 Fed 목표(2%)에 근접 중. 에너지·식품 포함 종합 물가로 일반 소비자 체감 물가와 가장 가깝다. 추세 하락이 Fed 추가 인하 명분을 제공한다.' },
  coreCpi:    { name: 'Core CPI', ref: '에너지·식품 제외', value: 3.18, unit: '%', delta: -0.08, signal: 'pos', series: gen(60, 4.5, 0.12, -0.022, 42),
                story: 'Core CPI 3.18%는 Fed 목표(2%) 위지만 추세적으로 하락 중. 에너지·식품을 제외한 근원 물가가 안정화되면 Fed가 금리 인하 여력을 더 갖게 된다.' },
  pce:        { name: 'PCE', ref: 'Fed 선호 지표', value: 2.42, unit: '%', delta: -0.11, signal: 'pos', series: gen(60, 3.6, 0.13, -0.020, 43),
                story: 'PCE는 Fed가 가장 선호하는 인플레 지표. CPI보다 소비 패턴 변화를 잘 반영한다. 2.42%는 목표 2%에 더 근접한 수준으로 Fed 정책 전환의 핵심 근거.' },
  bei:        { name: '기대인플레 (BEI)', ref: '10Y Breakeven', value: 2.29, unit: '%', delta: +0.04, signal: 'neu', series: gen(60, 2.3, 0.08, 0.000, 44),
                story: '10년물 Breakeven 2.29%는 채권시장이 예상하는 향후 10년 평균 인플레율. 명목금리에서 이 값을 빼면 실질금리가 나온다. 안정적 수준 유지가 시장 신뢰의 표시.' },

  // === 자산 ===
  nasdaq:     { name: 'NASDAQ', ref: '52주 신고가권', value: 18742, unit: '', delta: +1.84, signal: 'pos', series: gen(60, 14500, 200, 70, 51),
                story: 'NASDAQ은 기술주 + 유동성 베타가 가장 높은 지수. 실질금리 하락 시 가장 빨리 반응하는 자산군 중 하나. 현재 AI 모멘텀과 유동성 확장이 동시 작용 중.' },
  spx:        { name: 'S&P 500', ref: '52주 신고가권', value: 5871, unit: '', delta: +1.27, signal: 'pos', series: gen(60, 4800, 50, 18, 52),
                story: 'S&P 500은 미국 경제의 광범위한 척도. 52주 신고가권은 강세장 확인이지만 동시에 밸류에이션 부담(Forward P/E 21배) 시점. 광범위한 종목 참여 여부가 핵심.' },

  // === 위험 ===
  vix:        { name: 'VIX', ref: '20↑ = 경계', value: 15.8, unit: '', delta: -1.4, signal: 'pos', series: gen(60, 22, 1.5, -0.10, 61),
                story: 'VIX 15.8은 시장이 매우 안정적이라고 인식 중. 20 이상은 경계, 30 이상은 공포. 다만 너무 낮으면(12 이하) 역설적으로 과열 신호이기도 하다. 현재는 강세 모멘텀 지속 영역.' },
  fearGreed:  { name: '공포·탐욕 지수', ref: 'CNN · 미국 주식시장', value: 50, unit: '', delta: 0, signal: 'neu', series: gen(60, 50, 8, 0, 62) },

  // === AI ===

  // === 유동성 보강 ===
  rrp:        { name: 'RRP (역레포)', ref: '피크 2.4T → 0.4T', value: 0.42, unit: 'T$', delta: -0.06, signal: 'pos', series: gen(60, 1.8, 0.15, -0.025, 81),
                story: 'Fed의 RRP는 머니마켓펀드들이 단기 자금을 Fed에 맡겨두는 곳. 잔액이 감소하면 그만큼 자금이 시장으로 이동한다. 피크 2.4T에서 0.4T까지 감소했고, 이게 최근 1~2년 위험자산 강세의 숨은 동력. 비어가는 RRP는 곧 유동성 호황의 종료 시그널이 될 수 있다.' },
  netLiq:     { name: '순유동성', ref: 'Fed - RRP - TGA', value: 5.67, unit: 'T$', delta: +0.24, signal: 'pos', series: gen(60, 4.8, 0.18, 0.014, 82),
                story: 'Fed 자산에서 RRP와 TGA를 차감한 실질 시장 유동성. BTC·나스닥과 12개월 상관계수 0.93으로 가장 정확한 위험자산 선행지표. Fed가 QT 중이라도 RRP·TGA가 더 빨리 줄면 순유동성은 증가하며, 이게 현재 강세장의 본질.' },

  // === 신용 보강 ===
  igOas:      { name: 'IG 스프레드', ref: '100bp 미만 = 타이트', value: 92, unit: 'bp', delta: -3, signal: 'pos', series: gen(60, 135, 5, -0.7, 91),
                story: '우량 회사채(Investment Grade) 스프레드 92bp는 매우 타이트한 수준. HY와 함께 보면 신용시장 전반의 위험선호 강도를 알 수 있다. IG가 100bp 이하면 신용시장이 매우 우호적이라는 신호.' },

  // === 인플레 보강 ===
  wti:        { name: 'WTI 유가', ref: '인플레 1차 원인', value: 74.2, unit: '$', delta: +1.8, signal: 'neu', series: gen(60, 80, 4, -0.1, 101),
                story: 'WTI 유가는 인플레의 가장 직접적인 원인. $80 위로 가면 헤드라인 CPI 상방 압력이 되살아나고, $70 아래면 디플레 우려가 부각된다. 현재 $74 수준은 인플레이션에 중립적이며 Fed 정책에 부담을 주지 않는 구간.' },

  // === 위험 보강 ===

  // === 신규: FX ===
  dxy:        { name: 'DXY 달러인덱스', ref: '주요 6개 통화 가중', value: 106.8, unit: '', delta: -0.4, signal: 'pos', series: gen(60, 103, 1.5, 0.06, 121),
                story: '달러 인덱스는 글로벌 매크로의 메타지표. DXY 강세 = 달러 자금 미국 회귀 = 위험자산·신흥국 압박. 100 이하면 글로벌 위험자산 강세 환경. 현재 106 수준은 약간 부담스럽지만 약세 추세 진입 중.' },
  usdkrw:     { name: 'USD/KRW', ref: '원화 환율', value: 1387, unit: '', delta: -8, signal: 'pos', series: gen(60, 1320, 12, 1.1, 122),
                story: '원화 환율은 외국인 자금 흐름의 직접 지표. 1,400원대 = 외인 부담, 1,300원대 = 유입 우호 영역. 한국 자산에 투자할 때 환차손/익까지 고려한 종합 수익률을 봐야 한다.' },
  usdjpy:     { name: 'USD/JPY', ref: 'BOJ 정책 핵심 변수', value: 154.2, unit: '', delta: -1.1, signal: 'neu', series: gen(60, 148, 1.8, 0.1, 123),
                story: '엔화는 글로벌 캐리 트레이드의 자금원. 엔 약세 = 일본인 자금 해외 유출 = 미국 자산 강세. 다만 BOJ 정책 정상화 시 엔 급등 → 글로벌 위험자산 충격 가능성. 가장 큰 \'블랙스완\' 후보.' },

  // === 신규: 원자재/경기 ===

  // === 신규: 한국 매크로 ===
};

// favor 자동 할당 + 자기 키 부착
const DOWN_FAVOR = ['realRate', 'hyOas', 'igOas', 'vix', 'cpi', 'coreCpi', 'pce', 'fedRate', 'us2y', 'us10y', 'rrp', 'dxy', 'usdkrw', 'usdjpy'];
Object.keys(M).forEach(k => {
  M[k].favor = DOWN_FAVOR.includes(k) ? 'down' : 'up';
  M[k]._key = k;
});

// 국면 감지: 이동평균 기울기로 추세 구간 식별
const detectRegimes = (data, smoothing = 6) => {
  if (data.length < smoothing * 2) return [{ start: 0, end: data.length - 1, trend: 'up' }];
  const sma = data.map((_, i) => {
    const s = Math.max(0, i - smoothing);
    const slice = data.slice(s, i + 1);
    return slice.reduce((sum, x) => sum + x.v, 0) / slice.length;
  });
  const regimes = [];
  let cs = 0, ct = null;
  for (let i = smoothing; i < sma.length; i++) {
    const slope = sma[i] - sma[i - 1];
    const t = slope >= 0 ? 'up' : 'down';
    if (ct === null) ct = t;
    else if (t !== ct && i - cs >= smoothing) {
      regimes.push({ start: cs, end: i, trend: ct });
      cs = i; ct = t;
    }
  }
  regimes.push({ start: cs, end: sma.length - 1, trend: ct });
  return regimes;
};

// 국면 색칠 + 시간/단위 명시된 큰 차트
const BigChart = ({ data, signal, favor = 'up', unit = '', fullscreen = false }) => {
  const [period, setPeriod] = useState('5Y');
  const c = sc(signal);

  // 60 포인트 = 60개월 월별 데이터 (5년)
  const periodMap = { '6M': 6, '1Y': 12, '2Y': 24, '5Y': 60 };

  const filtered = useMemo(() => {
    const cut = periodMap[period] || 60;
    const sliced = data.slice(-cut);
    const base = new Date(2026, 4, 14); // 2026.05
    return sliced.map((d, i) => {
      const monthsAgo = sliced.length - 1 - i;
      const date = new Date(base.getFullYear(), base.getMonth() - monthsAgo, 1);
      const yr = String(date.getFullYear()).slice(-2);
      const mo = String(date.getMonth() + 1).padStart(2, '0');
      return { ...d, i, label: `${yr}.${mo}` };
    });
  }, [data, period]);

  const regimes = useMemo(() => detectRegimes(filtered), [filtered]);
  const avg = filtered.reduce((s, d) => s + d.v, 0) / filtered.length;

  // 통계 (풀스크린 패널용)
  const stats = useMemo(() => {
    if (filtered.length < 2) return null;
    const vals = filtered.map(d => d.v);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const first = vals[0];
    const last = vals[vals.length - 1];
    const chgPct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
    // 변동성: 월별 변화율 표준편차
    const rets = [];
    for (let i = 1; i < vals.length; i++) {
      if (vals[i - 1] !== 0) rets.push((vals[i] - vals[i - 1]) / Math.abs(vals[i - 1]));
    }
    const meanRet = rets.reduce((s, r) => s + r, 0) / (rets.length || 1);
    const variance = rets.reduce((s, r) => s + (r - meanRet) ** 2, 0) / (rets.length || 1);
    const vol = Math.sqrt(variance) * 100;
    return { min, max, first, last, chgPct, vol, avg };
  }, [filtered, avg]);

  // 단위별 Y축 포맷
  const fmtY = (v) => {
    if (v === null || v === undefined || isNaN(v)) return '';
    if (unit === '%') return `${v.toFixed(1)}%`;
    if (unit === '$') return v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v.toFixed(0)}`;
    if (unit === 'T$' || unit === 'T€' || unit === 'T¥') return `${v.toFixed(1)}${unit[0]}`;
    if (unit === 'bp') return `${v.toFixed(0)}bp`;
    if (unit === 'B$') return `${v.toFixed(0)}B`;
    return v >= 10000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0);
  };

  // X축에 라벨 표시 (풀스크린은 더 많이)
  const xTicks = useMemo(() => {
    const n = filtered.length;
    const count = fullscreen ? 8 : 5;
    if (n <= count) return filtered.map(d => d.i);
    const step = (n - 1) / (count - 1);
    return Array.from({ length: count }, (_, k) => Math.round(k * step));
  }, [filtered, fullscreen]);

  const upCol = favor === 'up' ? C.pos : C.neg;
  const downCol = favor === 'up' ? C.neg : C.pos;
  const unitLabel = unit === '%' ? '%' : unit === '$' ? 'USD' : unit === 'bp' ? 'bp' : unit === 'B$' ? '10억$' : (unit === 'T$' || unit === 'T€' || unit === 'T¥') ? `조 ${unit[1]||'$'}` : '지수';

  const id = `bc-${Math.random().toString(36).slice(2, 8)}`;
  const chartHeight = fullscreen ? 360 : 185;

  return (
    <div>
      {/* 축 의미 명시 + 기간 선택 */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="text-[9.5px] flex items-center gap-1.5" style={{ color: '#7a7a85' }}>
          <span style={{ color: '#5a5a64' }}>가로</span>
          <span>시간(월)</span>
          <span style={{ color: '#3a3a44' }}>·</span>
          <span style={{ color: '#5a5a64' }}>세로</span>
          <span>{unitLabel}</span>
        </div>
        <div className="flex gap-0.5">
          {['6M', '1Y', '2Y', '5Y'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="text-[9px] px-1.5 py-0.5 rounded transition-colors active:opacity-60"
              style={{
                color: period === p ? '#fff' : '#5a5a64',
                background: period === p ? 'rgba(255,255,255,0.08)' : 'transparent'
              }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart data={filtered} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity={0.28} />
              <stop offset="100%" stopColor={c} stopOpacity={0} />
            </linearGradient>
          </defs>
          {regimes.map((r, idx) => (
            <ReferenceArea key={idx} x1={r.start} x2={r.end}
              fill={r.trend === 'up' ? upCol : downCol}
              fillOpacity={0.07} ifOverflow="visible" />
          ))}
          <CartesianGrid strokeDasharray="2 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="i"
            type="number"
            domain={['dataMin', 'dataMax']}
            ticks={xTicks}
            tickFormatter={(i) => filtered.find(d => d.i === i)?.label || ''}
            tick={{ fill: '#9a9aa3', fontSize: fullscreen ? 10 : 9 }}
            stroke="rgba(255,255,255,0.1)"
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
          />
          <YAxis
            tick={{ fill: '#9a9aa3', fontSize: fullscreen ? 10 : 9 }}
            stroke="rgba(255,255,255,0.1)"
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            width={52}
            tickFormatter={fmtY}
            domain={['auto', 'auto']}
          />
          <ReferenceLine y={avg} stroke="rgba(255,255,255,0.28)" strokeDasharray="3 3"
            label={{ value: `평균 ${fmtY(avg)}`, fill: '#a8a8b3', fontSize: 9, position: 'insideTopRight', offset: 5 }} />
          <Tooltip
            contentStyle={{ background: 'rgba(10,10,14,0.96)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
            labelStyle={{ color: '#7a7a85', fontSize: 10, marginBottom: 2 }}
            itemStyle={{ color: '#fff', padding: 0 }}
            labelFormatter={(i) => filtered.find(d => d.i === i)?.label || ''}
            formatter={(v) => [fmtY(v), '값']}
            cursor={{ stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1 }}
          />
          <Area type="monotone" dataKey="v" stroke={c} strokeWidth={fullscreen ? 2.2 : 1.8} fill={`url(#${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-3 mt-1.5 text-[9px]" style={{ color: '#7a7a85' }}>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: upCol, opacity: 0.4 }}></span>
          <span>{favor === 'up' ? '상승 구간 = 우호' : '상승 구간 = 비우호'}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: downCol, opacity: 0.4 }}></span>
          <span>{favor === 'up' ? '하락 구간 = 비우호' : '하락 구간 = 우호'}</span>
        </span>
      </div>

      {/* 풀스크린 전용 통계 패널 */}
      {fullscreen && stats && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: `${period} 변화율`, value: `${stats.chgPct > 0 ? '+' : ''}${stats.chgPct.toFixed(1)}%`, col: stats.chgPct >= 0 ? C.pos : C.neg },
            { label: '월 변동성', value: `${stats.vol.toFixed(1)}%`, col: '#a8a8b3' },
            { label: '평균', value: fmtY(stats.avg), col: '#a8a8b3' },
            { label: '최저', value: fmtY(stats.min), col: '#60a5fa' },
            { label: '최고', value: fmtY(stats.max), col: '#fb923c' },
            { label: '현재', value: fmtY(stats.last), col: c },
          ].map((s, i) => (
            <div key={i} className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-[9px] mb-0.5" style={{ color: '#7a7a85' }}>{s.label}</div>
              <div className="text-[13px] font-semibold tabular-nums" style={{ color: s.col }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// AI 심층 분석: API 호출 + 자동 저장 + 복원
const AIAnalysis = ({ metric }) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [timestamp, setTimestamp] = useState(null);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [userNote, setUserNote] = useState('');

  const storageKey = `analysis:${metric._key}`;
  const noteKey = `note:${metric._key}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await window.storage.get(storageKey);
        if (!cancelled && result?.value) {
          const data = JSON.parse(result.value);
          setAnalysis(data.content);
          setTimestamp(data.timestamp);
        }
      } catch (e) {
        // 키 없음 = 정상
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  // 이 지표의 사용자 메모 로드 (재분석 시 프롬프트에 포함)
  useEffect(() => {
    let cancelled = false;
    setUserNote('');
    (async () => {
      try {
        const result = await window.storage.get(noteKey);
        if (!cancelled && result?.value) {
          setUserNote(result.value);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [noteKey]);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      // 사용자 메모 섹션 (이 지표에 한정)
      const trimmedNote = (userNote || '').trim();
      const noteSection = trimmedNote
        ? `

[사용자가 이 지표에 적어둔 메모]
"${trimmedNote}"
※ 사용자의 개인 관찰·매매 기준. 분석 시 자연스럽게 인용하거나 메모와의 정합성을 짚어줄 것.`
        : '';

      const prompt = `매크로 투자 지표 데이터를 분석해줘. 한국어로 4~6문장의 심층 인사이트${trimmedNote ? ' (메모 인용 포함 시 7문장까지 허용)' : ''}.

[지표 정보]
- 이름: ${metric.name}
- 현재 값: ${metric.value}${metric.unit || ''}
- 최근 변화: ${metric.delta > 0 ? '+' : ''}${metric.delta}${metric.unit === '%' ? 'pp' : ''}
- 참조점: ${metric.ref}
- 현재 신호: ${metric.signal === 'pos' ? '위험자산 우호' : metric.signal === 'neg' ? '위험자산 비우호' : '중립'}
- 방향성: ${metric.favor === 'up' ? '상승할수록 위험자산에 우호적' : '하락할수록 위험자산에 우호적'}${noteSection}

[분석 요구사항]
1. 현재 수준을 역사적 맥락에서 평가
2. 최근 변화가 시사하는 매크로적 의미
3. 다른 지표와의 연결 (유동성·금리·신용·심리 측면)
4. 위험자산 투자자에게 주는 구체적 시사점
5. 단기와 장기 관점의 차이가 있다면 언급
${trimmedNote ? '6. 사용자가 적어둔 메모를 자연스럽게 인용하거나, 현재 매크로 환경에 비춰 메모 내용에 대한 짧은 코멘트' : ''}

[문체 가이드]
- 단정적 예측은 피하되 명료하게 서술
- 시장 전문가가 후배에게 조곤조곤 설명하는 톤
- 불필요한 수식어 없이 핵심만
- 번호나 불릿 없이 자연스러운 단락으로`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
      if (!text) throw new Error('빈 응답');

      const now = new Date().toISOString();
      setAnalysis(text);
      setTimestamp(now);

      try {
        await window.storage.set(storageKey, JSON.stringify({ content: text, timestamp: now }));
      } catch (storageErr) {
        console.warn('저장 실패:', storageErr);
      }
    } catch (e) {
      setError(`분석 생성 실패: ${e.message || '오류'}`);
    } finally {
      setLoading(false);
    }
  };

  const fmtTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const yr = String(d.getFullYear()).slice(-2);
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const mn = String(d.getMinutes()).padStart(2, '0');
    return `${yr}.${mo}.${dy} ${hr}:${mn}`;
  };

  return (
    <div className="mt-3 rounded-xl border p-3" style={{ background: 'rgba(96,165,250,0.04)', borderColor: 'rgba(96,165,250,0.2)' }}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Sparkles size={12} style={{ color: '#60a5fa', flexShrink: 0 }} />
          <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: '#60a5fa' }}>AI 심층 분석</span>
          {timestamp && (
            <span className="text-[9px] truncate" style={{ color: '#5a5a64' }}>· {fmtTime(timestamp)}</span>
          )}
          {userNote && userNote.trim() && (
            <span className="text-[9px] flex items-center gap-0.5 shrink-0" style={{ color: '#fbbf24' }} title="메모 내용이 분석에 반영됩니다">
              <span className="w-1 h-1 rounded-full" style={{ background: '#fbbf24', boxShadow: '0 0 4px #fbbf24' }}></span>
              메모
            </span>
          )}
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="text-[10px] px-2 py-1 rounded transition-all active:opacity-60 flex items-center gap-1 flex-shrink-0"
          style={{
            background: 'rgba(96,165,250,0.12)',
            color: '#60a5fa',
            border: '1px solid rgba(96,165,250,0.3)',
            opacity: loading ? 0.5 : 1
          }}>
          {loading && <RefreshCw size={9} className="animate-spin" />}
          {loading ? '생성 중' : analysis ? '다시 분석' : 'AI 분석'}
        </button>
      </div>

      {error && (
        <p className="text-[11px] py-1" style={{ color: C.neg }}>{error}</p>
      )}

      {!analysis && !loading && !error && loaded && (
        <p className="text-[11px] leading-relaxed" style={{ color: '#7a7a85' }}>
          버튼을 눌러 이 지표에 대한 최신 AI 분석을 받아보세요. 결과는 자동 저장되어 다음 방문 시에도 표시됩니다.
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-1.5">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#60a5fa' }}></div>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#60a5fa', animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#60a5fa', animationDelay: '0.4s' }}></div>
          <span className="text-[11px] ml-1" style={{ color: '#7a7a85' }}>매크로 맥락 분석 중...</span>
        </div>
      )}

      {analysis && !loading && (
        <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap" style={{ color: '#c0c0c8' }}>
          {analysis}
        </p>
      )}
    </div>
  );
};

// AI 종합 매크로 분석: 모든 핵심 지표 종합 → 시장 국면 평가
const AIRegimeAnalysis = ({ metrics, regime }) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [timestamp, setTimestamp] = useState(null);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [userNotes, setUserNotes] = useState({});
  const autoCheckedRef = React.useRef(false);

  const storageKey = 'analysis:overall_regime';
  const settingsKey = 'analysis:overall_regime:auto';
  const CACHE_HOURS = 6;

  // 사용자 메모 로드 (재분석 시 프롬프트에 포함)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const listed = await window.storage.list('note:');
        if (cancelled || !listed?.keys) return;
        const notes = {};
        await Promise.all(listed.keys.map(async (k) => {
          try {
            const r = await window.storage.get(k);
            if (r?.value) notes[k.replace('note:', '')] = r.value;
          } catch {}
        }));
        if (!cancelled) setUserNotes(notes);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [analysisData, autoData] = await Promise.all([
          window.storage.get(storageKey).catch(() => null),
          window.storage.get(settingsKey).catch(() => null),
        ]);
        if (cancelled) return;

        let storedTs = null;
        if (analysisData?.value) {
          const data = JSON.parse(analysisData.value);
          setAnalysis(data.content);
          setTimestamp(data.timestamp);
          storedTs = data.timestamp;
        }

        const isAutoOn = autoData?.value === 'true';
        setAutoEnabled(isAutoOn);

        // 자동 실행: 토글 ON + 캐시 만료 (6시간) + 1회만
        if (isAutoOn && !autoCheckedRef.current) {
          autoCheckedRef.current = true;
          const expired = !storedTs || (Date.now() - new Date(storedTs).getTime()) > CACHE_HOURS * 3600 * 1000;
          if (expired) {
            setTimeout(() => { if (!cancelled) generate(); }, 800); // 약간 지연 (사용자 시각 안정)
          }
        }
      } catch (e) {}
      finally { if (!cancelled) setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleAuto = async () => {
    const newVal = !autoEnabled;
    setAutoEnabled(newVal);
    try {
      await window.storage.set(settingsKey, String(newVal));
    } catch (e) {}
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const keyMetrics = [
        ['netLiq', '순유동성 (Net Liquidity)'],
        ['globalLiq', '글로벌 유동성 (G3)'],
        ['rrp', 'RRP (역레포)'],
        ['fedAssets', 'Fed 자산'],
        ['usM2', 'US M2'],
        ['fedRate', 'Fed Funds 금리'],
        ['realRate', '실질금리 (10Y Real)'],
        ['yieldCurve', '10Y-2Y 스프레드'],
        ['hyOas', 'HY 스프레드'],
        ['igOas', 'IG 스프레드'],
        ['coreCpi', 'Core CPI'],
        ['dxy', 'DXY 달러인덱스'],
        ['vix', 'VIX'],
        ['fearGreed', '공포·탐욕 지수'],
        ['spx', 'S&P 500'],
        ['nasdaq', 'NASDAQ'],
        ['usdkrw', 'USD/KRW'],
      ];

      const dataSummary = keyMetrics.map(([k, label]) => {
        const m = metrics[k];
        if (!m) return '';
        return `- ${label}: ${m.value}${m.unit || ''} (${m.delta > 0 ? '+' : ''}${m.delta}${m.unit === '%' ? 'pp' : ''}, ${m.signal === 'pos' ? '우호' : m.signal === 'neg' ? '비우호' : '중립'})`;
      }).filter(Boolean).join('\n');

      // 사용자 메모 섹션
      const notesEntries = Object.entries(userNotes).filter(([k, v]) => v && v.trim());
      const notesSection = notesEntries.length > 0
        ? `

[사용자가 적어둔 개인 메모·전략]
${notesEntries.map(([k, v]) => `- ${metrics[k]?.name || k}: "${v.trim()}"`).join('\n')}
※ 이 메모들은 사용자의 매매 기준/관찰. 종합 분석 시 자연스럽게 인용하거나 메모와의 정합성을 짚어줄 수 있음.`
        : '';

      const prompt = `매크로 유동성 기반 종합 시장 분석을 요청한다.

[자동 판정 결과]
종합 국면: ${regime.label}
매수 신호: ${regime.count}/4 (룰 기반 자동 계산)

[현재 매크로 환경 - 핵심 유동성 지표]
${dataSummary}${notesSection}

[분석 요구사항]
1. 현재 시장 국면을 한 줄로 정의 (어떤 매크로 환경인지)
2. 가장 중요한 시그널 3가지 (각각 왜 중요한지)
3. 위험자산(주식·코인) vs 안전자산(채권·현금)의 상대적 매력도
4. 단기(1~3개월) 관점에서 주의할 변수
5. 장기(6~12개월) 관점의 변곡점 후보
6. 위험자산(미국 주식) 배분 관점의 시사점
${notesEntries.length > 0 ? '7. 사용자가 적어둔 메모 중 현재 매크로 환경에서 특히 주목할 만한 것 짚어주기' : ''}

[문체 가이드]
- 8~12문장 분량
- 단정적이지 않게, 그러나 명료하게
- 시장 전문가가 후배 트레이더에게 정리해주는 톤
- 자연스러운 단락 (번호·불릿 X)
- 한국어`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
      if (!text) throw new Error('빈 응답');

      const now = new Date().toISOString();
      setAnalysis(text);
      setTimestamp(now);

      try {
        await window.storage.set(storageKey, JSON.stringify({ content: text, timestamp: now }));
      } catch (storageErr) {}
    } catch (e) {
      setError(`분석 생성 실패: ${e.message || '오류'}`);
    } finally {
      setLoading(false);
    }
  };

  const fmtTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const yr = String(d.getFullYear()).slice(-2);
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const mn = String(d.getMinutes()).padStart(2, '0');
    return `${yr}.${mo}.${dy} ${hr}:${mn}`;
  };

  return (
    <div className="rounded-2xl mt-3 p-4 border" style={{ background: 'rgba(96,165,250,0.05)', borderColor: 'rgba(96,165,250,0.25)' }}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Sparkles size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
          <span className="text-[13px] font-semibold whitespace-nowrap" style={{ color: '#60a5fa' }}>AI 종합 매크로 분석</span>
          {timestamp && (
            <span className="text-[9px] truncate" style={{ color: '#5a5a64' }}>· {fmtTime(timestamp)}</span>
          )}
          {Object.entries(userNotes).filter(([k, v]) => v && v.trim()).length > 0 && (
            <span className="text-[9px] flex items-center gap-0.5 shrink-0" style={{ color: '#fbbf24' }} title="메모가 분석에 반영됩니다">
              <span className="w-1 h-1 rounded-full" style={{ background: '#fbbf24', boxShadow: '0 0 4px #fbbf24' }}></span>
              메모 {Object.entries(userNotes).filter(([k, v]) => v && v.trim()).length}
            </span>
          )}
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="text-[11px] px-2.5 py-1.5 rounded transition-all active:opacity-60 flex items-center gap-1 flex-shrink-0 font-semibold"
          style={{
            background: 'rgba(96,165,250,0.15)',
            color: '#60a5fa',
            border: '1px solid rgba(96,165,250,0.4)',
            opacity: loading ? 0.5 : 1
          }}>
          {loading && <RefreshCw size={10} className="animate-spin" />}
          {loading ? '생성 중' : analysis ? '재분석' : '분석 시작'}
        </button>
      </div>

      {error && (
        <p className="text-[11.5px] py-1" style={{ color: C.neg }}>{error}</p>
      )}

      {!analysis && !loading && !error && loaded && (
        <p className="text-[12px] leading-relaxed" style={{ color: '#a8a8b3' }}>
          핵심 유동성·금리·신용 지표를 종합해 AI가 현재 시장 국면을 분석합니다. 위험자산 매력도와 단·장기 전망을 포괄합니다.
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-2">
          <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#60a5fa' }}></div>
          <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#60a5fa', animationDelay: '0.2s' }}></div>
          <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#60a5fa', animationDelay: '0.4s' }}></div>
          <span className="text-[12px] ml-1.5" style={{ color: '#7a7a85' }}>핵심 지표 종합 분석 중...</span>
        </div>
      )}

      {analysis && !loading && (
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: '#d0d0d8' }}>
          {analysis}
        </p>
      )}

      {/* 자동 새로고침 토글 */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-semibold" style={{ color: '#a8a8b3' }}>방문 시 자동 새로고침</span>
          <span className="text-[9px]" style={{ color: '#5a5a64' }}>6시간 이내 분석 있으면 그대로 사용</span>
        </div>
        <button
          onClick={toggleAuto}
          className="relative inline-flex rounded-full transition-colors shrink-0"
          style={{
            width: 36, height: 20,
            background: autoEnabled ? '#60a5fa' : 'rgba(255,255,255,0.1)',
          }}
        >
          <span
            className="absolute rounded-full bg-white transition-transform"
            style={{
              width: 14, height: 14, top: 3, left: 3,
              transform: autoEnabled ? 'translateX(16px)' : 'translateX(0)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        </button>
      </div>
    </div>
  );
};

// 데일리 브리핑: 매일 1회 자동 갱신되는 짧은 매크로 요약
const DailyBriefing = ({ metrics, regime, alerts }) => {
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const [briefingDate, setBriefingDate] = useState(null);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [userNotes, setUserNotes] = useState({});
  const autoCheckedRef = React.useRef(false);

  const storageKey = 'briefing:daily';
  const today = new Date().toISOString().slice(0, 10);

  // 사용자 메모 로드 (브리핑 생성 시 프롬프트에 참고 자료로 사용)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const listed = await window.storage.list('note:');
        if (cancelled || !listed?.keys) return;
        const notes = {};
        await Promise.all(listed.keys.map(async (k) => {
          try {
            const r = await window.storage.get(k);
            if (r?.value) notes[k.replace('note:', '')] = r.value;
          } catch {}
        }));
        if (!cancelled) setUserNotes(notes);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const keyMetrics = [
        ['netLiq', '순유동성'],
        ['globalLiq', '글로벌 유동성'],
        ['realRate', '실질금리'],
        ['hyOas', 'HY 스프레드'],
        ['vix', 'VIX'],
        ['fearGreed', '공포·탐욕'],
        ['dxy', 'DXY'],
        ['spx', 'S&P 500'],
        ['nasdaq', 'NASDAQ'],
        ['usdkrw', 'USD/KRW'],
      ];

      const dataSummary = keyMetrics.map(([k, label]) => {
        const m = metrics[k];
        return `${label} ${m.value}${m.unit || ''} (${m.delta > 0 ? '+' : ''}${m.delta}${m.unit === '%' ? 'pp' : ''})`;
      }).join(', ');

      const alertsSummary = alerts.length > 0
        ? alerts.slice(0, 5).map(a => a.title).join(', ')
        : '없음';

      // 사용자 메모 섹션 (있을 때만)
      const notesEntries = Object.entries(userNotes).filter(([k, v]) => v && v.trim());
      const notesSection = notesEntries.length > 0
        ? `

[사용자가 적어둔 개인 메모]
${notesEntries.map(([k, v]) => `- ${metrics[k]?.name || k}: "${v.trim()}"`).join('\n')}
※ 이 메모는 사용자의 매매 기준·관찰. 오늘 브리핑과 연관성이 있을 때만 자연스럽게 한 줄 언급 (필수 아님).`
        : '';

      const prompt = `매크로 트레이더 대상 짧은 데일리 브리핑.

[현재 매크로 상태]
종합 국면: ${regime.label} (매수신호 ${regime.count}/4)
핵심 지표: ${dataSummary}
활성 알림: ${alertsSummary}${notesSection}

[브리핑 형식 - 엄격히 준수]
- 정확히 3~4문장 (메모 관련 언급 있을 때만 5문장까지 허용)
- 첫 문장: 오늘의 매크로 환경을 한 줄로 정의
- 둘째 문장: 가장 주목할 시그널 또는 변화
- 셋째 문장: 단기 행동 시사점 또는 관전 포인트
- (선택) 넷째 문장: 위험자산 배분 관점의 포인트
${notesEntries.length > 0 ? '- (선택) 사용자 메모와 오늘 환경 사이 연결고리가 있다면 한 줄로 짧게 언급' : ''}
- 한국어, 신문 리드 문단 같은 명료한 톤
- 단정적 예측 회피, 핵심만 압축
- 번호나 불릿 X, 자연스러운 단락`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
      if (!text) throw new Error('빈 응답');

      setBriefing(text);
      setBriefingDate(today);

      try {
        await window.storage.set(storageKey, JSON.stringify({ content: text, date: today, timestamp: new Date().toISOString() }));
      } catch (storageErr) {}
    } catch (e) {
      setError(`생성 실패: ${e.message || '오류'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await window.storage.get(storageKey);
        if (cancelled) return;

        let isToday = false;
        if (result?.value) {
          const data = JSON.parse(result.value);
          if (data.date === today) {
            setBriefing(data.content);
            setBriefingDate(data.date);
            isToday = true;
          } else {
            // 어제 이전 것: 일단 표시는 하되 자동 갱신 대상
            setBriefing(data.content);
            setBriefingDate(data.date);
          }
        }

        // 오늘 것 없으면 자동 생성 (1회만)
        if (!isToday && !autoCheckedRef.current) {
          autoCheckedRef.current = true;
          setTimeout(() => { if (!cancelled) generate(); }, 600);
        }
      } catch (e) {}
      finally { if (!cancelled) setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  const isStale = briefingDate && briefingDate !== today;

  return (
    <div
      className="rounded-2xl border p-3.5 mt-3"
      style={{
        background: 'linear-gradient(135deg, rgba(96,165,250,0.07), rgba(99,102,241,0.04))',
        borderColor: 'rgba(96,165,250,0.22)',
      }}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #60a5fa, #6366f1)' }}>
            <Sparkles size={12} className="text-white" strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-white leading-none">오늘의 브리핑</div>
            <div className="text-[9px] mt-0.5 leading-none truncate flex items-center gap-1.5" style={{ color: isStale ? '#fb923c' : '#7a7a85' }}>
              <span>{briefingDate ? (isStale ? `${briefingDate} · 갱신 필요` : `${briefingDate} · 최신`) : '매일 1회 자동 갱신'}</span>
              {Object.entries(userNotes).filter(([k, v]) => v && v.trim()).length > 0 && (
                <span className="flex items-center gap-0.5" style={{ color: '#fbbf24' }} title="메모가 브리핑에 반영됩니다">
                  <span className="w-1 h-1 rounded-full" style={{ background: '#fbbf24', boxShadow: '0 0 4px #fbbf24' }}></span>
                  메모 {Object.entries(userNotes).filter(([k, v]) => v && v.trim()).length}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="text-[10px] active:opacity-60 flex items-center gap-1 px-2 py-1 rounded-full shrink-0"
          style={{
            color: '#60a5fa',
            background: 'rgba(96,165,250,0.12)',
            border: '1px solid rgba(96,165,250,0.25)',
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          {loading ? '생성중' : briefing ? '새로' : '시작'}
        </button>
      </div>

      {loading && !briefing && (
        <div className="py-2 space-y-1.5">
          <div className="h-2 rounded-full animate-pulse" style={{ background: 'rgba(96,165,250,0.18)', width: '85%' }}></div>
          <div className="h-2 rounded-full animate-pulse" style={{ background: 'rgba(96,165,250,0.18)', width: '92%', animationDelay: '0.15s' }}></div>
          <div className="h-2 rounded-full animate-pulse" style={{ background: 'rgba(96,165,250,0.18)', width: '78%', animationDelay: '0.3s' }}></div>
        </div>
      )}

      {error && !briefing && (
        <p className="text-[11px] py-1" style={{ color: '#f87171' }}>{error}</p>
      )}

      {briefing && (
        <p className="text-[12.5px] leading-relaxed" style={{ color: '#e0e0e8' }}>{briefing}</p>
      )}

      {!briefing && !loading && !error && loaded && (
        <p className="text-[11px]" style={{ color: '#7a7a85' }}>
          오늘의 매크로 환경을 한 문단으로 요약합니다. 자동 생성 중...
        </p>
      )}
    </div>
  );
};

// 포트폴리오 트래커: 자산 비중 입력 → 현재 매크로 환경 적합성 평가
const Portfolio = ({ regime, onChange }) => {
  const [allocations, setAllocations] = useState({
    usStock: 0, krStock: 0, crypto: 0, bond: 0, gold: 0, cash: 100,
  });
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasUserData, setHasUserData] = useState(false);

  // 매크로 환경별 추천 비중 (단순 가이드라인)
  const recommended = {
    'RISK-ON': { usStock: 30, krStock: 15, crypto: 10, bond: 10, gold: 5, cash: 30 },
    'NEUTRAL': { usStock: 25, krStock: 10, crypto: 5, bond: 20, gold: 10, cash: 30 },
    'RISK-OFF': { usStock: 15, krStock: 5, crypto: 3, bond: 25, gold: 15, cash: 37 },
  };

  const target = recommended[regime.en] || recommended.NEUTRAL;

  const categories = [
    { key: 'usStock', label: '미국 주식', icon: '🇺🇸', desc: 'S&P 500, NASDAQ' },
    { key: 'krStock', label: '한국 주식', icon: '🇰🇷', desc: 'KOSPI, KOSDAQ' },
    { key: 'crypto',  label: '암호자산', icon: '₿',  desc: 'BTC, ETH, 알트' },
    { key: 'bond',    label: '채권',     icon: '📜', desc: '국채, 회사채' },
    { key: 'gold',    label: '금/원자재', icon: '🪙', desc: 'Gold, 원자재' },
    { key: 'cash',    label: '현금/MMF', icon: '💵', desc: '현금성 자산' },
  ];

  // 저장된 비중 복원
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await window.storage.get('portfolio:allocations');
        if (!cancelled && result?.value) {
          const data = JSON.parse(result.value);
          const a = data.allocations || data;
          setAllocations(a);
          setHasUserData(true);
          onChange?.(a);
        }
      } catch (e) {}
      finally { if (!cancelled) setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    try {
      await window.storage.set('portfolio:allocations', JSON.stringify({
        allocations,
        updatedAt: new Date().toISOString(),
      }));
      setHasUserData(true);
      onChange?.(allocations);
    } catch (e) {}
    setEditing(false);
  };

  const total = Object.values(allocations).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const totalValid = Math.abs(total - 100) < 0.5;

  // 적합성 점수 (실제 vs 추천 차이의 합 → 100점 환산)
  const fitScore = useMemo(() => {
    let totalDiff = 0;
    Object.keys(target).forEach(k => {
      totalDiff += Math.abs((allocations[k] || 0) - target[k]);
    });
    // 최대 차이 200% (전 자산 반대) → 100점 만점 환산
    return Math.max(0, Math.round(100 - totalDiff / 2));
  }, [allocations, target]);

  const fitColor = fitScore >= 75 ? C.pos : fitScore >= 50 ? C.warn : C.neg;
  const fitLabel = fitScore >= 75 ? '잘 정렬됨' : fitScore >= 50 ? '부분 정렬' : '재조정 권장';

  // 추천으로 즉시 채우기
  const applyRecommended = () => {
    setAllocations({ ...target });
  };

  return (
    <div className="rounded-2xl border p-3.5 mt-3" style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">💼</span>
          <div>
            <div className="text-[13px] font-semibold text-white leading-tight">내 포트폴리오 적합성</div>
            <div className="text-[10px] mt-0.5" style={{ color: '#7a7a85' }}>현재 매크로 환경({regime.label})에 맞나</div>
          </div>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="text-[10px] active:opacity-60 px-2 py-1 rounded-full"
          style={{
            color: '#60a5fa',
            background: 'rgba(96,165,250,0.12)',
            border: '1px solid rgba(96,165,250,0.25)',
          }}
        >
          {editing ? '취소' : hasUserData ? '편집' : '입력'}
        </button>
      </div>

      {editing ? (
        <div className="space-y-1.5">
          {categories.map(cat => (
            <div key={cat.key} className="flex items-center gap-2.5 rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="text-[15px]">{cat.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-white leading-tight">{cat.label}</div>
                <div className="text-[9px] mt-0.5" style={{ color: '#7a7a85' }}>{cat.desc}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  inputMode="decimal"
                  value={allocations[cat.key] || ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    setAllocations({ ...allocations, [cat.key]: isNaN(v) ? 0 : v });
                  }}
                  min="0" max="100"
                  className="w-14 text-right rounded px-1.5 py-1 text-[12px] outline-none font-mono"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                />
                <span className="text-[10px]" style={{ color: '#7a7a85' }}>%</span>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between rounded-lg p-2.5"
            style={{ background: totalValid ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)' }}>
            <span className="text-[11px]" style={{ color: '#a8a8b3' }}>합계</span>
            <span className="text-[14px] font-bold font-mono" style={{ color: totalValid ? C.pos : C.neg }}>
              {total.toFixed(0)}%
            </span>
          </div>

          <div className="flex gap-1.5 pt-1">
            <button onClick={applyRecommended}
              className="flex-1 rounded-xl py-2 text-[11px] font-semibold active:opacity-60"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#a8a8b3', border: '1px solid rgba(255,255,255,0.08)' }}>
              {regime.label} 추천 비중으로
            </button>
            <button onClick={save} disabled={!totalValid}
              className="flex-1 rounded-xl py-2 text-[12px] font-semibold active:opacity-60"
              style={{
                background: totalValid ? 'linear-gradient(135deg, #60a5fa, #6366f1)' : 'rgba(255,255,255,0.05)',
                color: totalValid ? '#fff' : '#5a5a64',
              }}>
              {totalValid ? '저장' : `${total.toFixed(0)}% (100% 필요)`}
            </button>
          </div>
        </div>
      ) : !hasUserData ? (
        <div className="py-4 text-center">
          <div className="text-[28px] mb-2">💼</div>
          <p className="text-[12px] mb-1" style={{ color: '#c0c0c8' }}>아직 포트폴리오를 입력하지 않았어요</p>
          <p className="text-[10.5px]" style={{ color: '#7a7a85' }}>
            "입력" 버튼을 눌러 자산 비중을 설정하면<br/>매크로 환경 적합성을 평가해드립니다
          </p>
        </div>
      ) : (
        <>
          {/* 적합성 점수 */}
          <div className="flex items-center justify-between mb-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: '#7a7a85' }}>매크로 적합성</div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-[28px] font-bold font-mono tabular-nums leading-none" style={{ color: fitColor }}>{fitScore}</span>
                <span className="text-[12px]" style={{ color: '#7a7a85' }}>/100</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold" style={{ color: fitColor }}>{fitLabel}</div>
              <div className="text-[9px] mt-0.5" style={{ color: '#7a7a85' }}>{regime.label} 환경 기준</div>
            </div>
          </div>

          {/* 자산별 현재 vs 추천 */}
          <div className="space-y-1.5">
            {categories.map(cat => {
              const current = allocations[cat.key] || 0;
              const ideal = target[cat.key];
              const diff = current - ideal;
              const sign = diff > 0 ? '+' : '';
              const diffColor = Math.abs(diff) < 3 ? '#7a7a85' : Math.abs(diff) < 10 ? C.warn : C.neg;
              return (
                <div key={cat.key} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span className="text-[14px]">{cat.icon}</span>
                  <span className="text-[11.5px] font-medium text-white flex-1 truncate">{cat.label}</span>
                  <div className="flex items-baseline gap-1.5 text-[11px] font-mono shrink-0">
                    <span className="text-white font-bold tabular-nums">{current}%</span>
                    <span style={{ color: '#5a5a64' }}>/ {ideal}%</span>
                    <span className="w-10 text-right tabular-nums" style={{ color: diffColor }}>
                      {Math.abs(diff) < 0.5 ? '─' : `${sign}${diff}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 해석 */}
          <div className="mt-3 rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[11.5px] leading-relaxed" style={{ color: '#a8a8b3' }}>
              <span style={{ color: fitColor }}>💡 </span>
              {fitScore >= 75
                ? `현재 ${regime.label} 환경에 잘 정렬된 포트폴리오입니다.`
                : fitScore >= 50
                ? `매크로 환경과 부분 정렬됨. 일부 자산 비중 조정을 검토할 만합니다.`
                : `현재 매크로 환경과 차이가 큽니다. 추천 비중 참고해 재조정 고려.`
              }
              {' '}이 점수는 참고용이며, 개인의 위험성향·투자 목표·기간에 따라 최적 비중은 달라집니다.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

const ChatBot = ({ metrics, regime, portfolio }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userNotes, setUserNotes] = useState({});
  const messagesEndRef = React.useRef(null);
  const inputRef = React.useRef(null);

  // 챗봇 열 때마다 사용자 메모 로드
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const listed = await window.storage.list('note:');
        if (cancelled || !listed?.keys) return;
        const notes = {};
        await Promise.all(listed.keys.map(async (k) => {
          try {
            const r = await window.storage.get(k);
            if (r?.value) notes[k.replace('note:', '')] = r.value;
          } catch {}
        }));
        if (!cancelled) setUserNotes(notes);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [open]);

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // 모달 열릴 때 input 포커스
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const buildSystemPrompt = () => {
    const keyMetrics = [
      'netLiq', 'globalLiq', 'rrp', 'fedAssets', 'usM2', 'krM2',
      'fedRate', 'us2y', 'us10y', 'realRate', 'yieldCurve', 'bei',
      'hyOas', 'igOas', 'bankLoans', 'corpCredit', 'hhCredit',
      'cpi', 'coreCpi', 'pce', 'dxy', 'vix', 'fearGreed',
      'spx', 'nasdaq', 'usdkrw', 'usdjpy'
    ];
    const summary = keyMetrics.map(k => {
      const m = metrics[k];
      if (!m) return '';
      return `- ${m.name}: ${m.value}${m.unit || ''} (${m.delta > 0 ? '+' : ''}${m.delta}, ${m.signal === 'pos' ? '우호' : m.signal === 'neg' ? '비우호' : '중립'})`;
    }).filter(Boolean).join('\n');

    // 포트폴리오 섹션
    const portfolioSection = portfolio
      ? `

[사용자 포트폴리오 비중]
- 미국 주식: ${portfolio.usStock || 0}%
- 한국 주식: ${portfolio.krStock || 0}%
- 암호자산: ${portfolio.crypto || 0}%
- 채권: ${portfolio.bond || 0}%
- 금/원자재: ${portfolio.gold || 0}%
- 현금/MMF: ${portfolio.cash || 0}%
※ 사용자가 자신의 포트폴리오를 입력했음. "내 포트폴리오", "내 비중", "내 자산" 등을 언급하면 위 데이터 기반으로 구체적 답변.`
      : `

[사용자 포트폴리오] 미입력 상태.
사용자가 포트폴리오 관련 질문 시 "포트폴리오를 먼저 입력하시면 더 구체적으로 분석해드릴 수 있습니다"라고 안내.`;

    // 사용자 개인 메모 섹션
    const notesEntries = Object.entries(userNotes || {}).filter(([k, v]) => v && v.trim());
    const notesSection = notesEntries.length > 0
      ? `

[사용자가 적어둔 개인 메모]
${notesEntries.map(([k, v]) => `- ${metrics[k]?.name || k}: "${v.trim()}"`).join('\n')}
※ 사용자가 직접 적어둔 매매 전략·관찰·기준. 관련 지표 질문 시 메모 내용을 자연스럽게 참고하고, 가능하면 "메모하신 기준대로..." 같은 표현 사용.`
      : '';

    return `당신은 매크로 유동성 기반 시장 분석 전문가다. 사용자의 매크로·투자·시장 관련 질문에 한국어로 답한다.

[현재 매크로 환경 - ${new Date().toISOString().slice(0,10)}]
종합 국면: ${regime.label} (매수신호 ${regime.count}/4)

[핵심 유동성 지표]
${summary}${portfolioSection}${notesSection}

[답변 가이드]
- 한국어로 답변
- 단정적 예측은 피하되 명료하게
- 4~6문장 정도로 간결하게 (복잡한 질문은 더 길게)
- 시장 전문가가 후배에게 설명하는 톤
- 위 매크로 데이터를 적절히 인용해 근거 제시
- 사용자 포트폴리오가 있으면 그에 맞춰 구체적 시사점 제시
- 사용자가 적어둔 개인 메모가 있으면 자연스럽게 인용·참고
- 매크로 환경과 포트폴리오 비중의 정합/부정합을 짚어주기
- 투자 조언보다는 분석·해설 중심
- 자연스러운 단락 (불필요한 불릿 X)`;
  };

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          system: buildSystemPrompt(),
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
      if (!text) throw new Error('빈 응답');

      setMessages([...newMessages, { role: 'assistant', content: text }]);
    } catch (e) {
      setMessages([...newMessages, { role: 'assistant', content: `응답 생성 실패: ${e.message || '오류'}`, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const presetQuestions = portfolio
    ? [
        '내 포트폴리오 어떤 자산을 줄여야 해?',
        '내 비중이 지금 매크로 환경에 적합해?',
        '내 포트폴리오 가장 큰 리스크가 뭐야?',
        '실질금리가 더 떨어지면 어떤 자산이 좋아?',
      ]
    : [
        '지금 비트코인 사도 될까?',
        '한국 주식 비중을 늘려야 할까?',
        '실질금리가 더 떨어지면 어떤 자산이 좋아?',
        '지금 시장이 과열인지 알려줘',
      ];

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed z-40 rounded-full shadow-2xl active:scale-95 transition-transform"
        style={{
          bottom: 'max(76px, calc(env(safe-area-inset-bottom) + 70px))',
          right: 16,
          width: 52,
          height: 52,
          background: 'linear-gradient(135deg, #60a5fa, #6366f1)',
          boxShadow: '0 8px 24px rgba(96,165,250,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset',
        }}
      >
        <MessageCircle size={22} className="text-white mx-auto" strokeWidth={2.2} />
      </button>

      {/* 풀스크린 모달 */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0a0a0e' }}>
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(10,10,14,0.95)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #60a5fa, #6366f1)' }}>
                <Sparkles size={14} className="text-white" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-white leading-none">매크로 AI</div>
                <div className="text-[10px] mt-0.5 leading-none" style={{ color: '#7a7a85' }}>핵심 지표 기반 실시간 분석</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="active:opacity-60 p-1">
              <X size={20} style={{ color: '#a8a8b3' }} />
            </button>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center" style={{ background: 'rgba(96,165,250,0.1)' }}>
                  <Sparkles size={24} style={{ color: '#60a5fa' }} />
                </div>
                <div className="text-[14px] font-semibold text-white mb-1">매크로 AI 어시스턴트</div>
                <p className="text-[11.5px] text-center max-w-[280px] mb-2 leading-relaxed" style={{ color: '#7a7a85' }}>
                  현재 시장 환경 데이터를 알고 있어요. 매크로·투자·시장 관련 무엇이든 물어보세요.
                </p>
                {portfolio && (
                  <div className="rounded-full px-2.5 py-1 mb-1.5 inline-flex items-center gap-1.5" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#34d399', boxShadow: '0 0 6px #34d399' }}></span>
                    <span className="text-[10px]" style={{ color: '#34d399' }}>당신 포트폴리오 인식 중</span>
                  </div>
                )}
                {Object.keys(userNotes).length > 0 && (
                  <div className="rounded-full px-2.5 py-1 mb-1.5 inline-flex items-center gap-1.5" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#fbbf24', boxShadow: '0 0 6px #fbbf24' }}></span>
                    <span className="text-[10px]" style={{ color: '#fbbf24' }}>메모 {Object.keys(userNotes).length}개 인식 중</span>
                  </div>
                )}
                {!portfolio && Object.keys(userNotes).length === 0 && <div className="mb-4"></div>}
                {(portfolio || Object.keys(userNotes).length > 0) && <div className="mb-3"></div>}
                <div className="w-full max-w-[320px] space-y-1.5">
                  <div className="text-[10px] mb-1.5" style={{ color: '#5a5a64' }}>예시 질문</div>
                  {presetQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(q)}
                      className="w-full text-left rounded-xl px-3 py-2.5 active:opacity-60 transition-opacity text-[12px]"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: '#c0c0c8'
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="rounded-2xl px-3.5 py-2.5 max-w-[85%] whitespace-pre-wrap text-[12.5px] leading-relaxed"
                    style={
                      m.role === 'user'
                        ? { background: 'linear-gradient(135deg, #60a5fa, #6366f1)', color: '#fff' }
                        : m.error
                          ? { background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }
                          : { background: 'rgba(255,255,255,0.04)', color: '#d0d0d8', border: '1px solid rgba(255,255,255,0.06)' }
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-3.5 py-3 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#60a5fa' }}></div>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#60a5fa', animationDelay: '0.2s' }}></div>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#60a5fa', animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 입력 영역 */}
          <div
            className="px-3 py-3 border-t"
            style={{
              borderColor: 'rgba(255,255,255,0.08)',
              background: 'rgba(10,10,14,0.95)',
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            }}
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="매크로·시장 질문을 입력하세요"
                className="flex-1 rounded-full px-4 py-2.5 text-[13px] outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff',
                }}
                disabled={loading}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="rounded-full w-10 h-10 flex items-center justify-center active:scale-95 transition-transform"
                style={{
                  background: input.trim() && !loading ? 'linear-gradient(135deg, #60a5fa, #6366f1)' : 'rgba(255,255,255,0.05)',
                  opacity: input.trim() && !loading ? 1 : 0.4,
                }}
              >
                <Send size={16} className="text-white" />
              </button>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-[10px] mt-2 active:opacity-60"
                style={{ color: '#5a5a64' }}
              >
                대화 초기화
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// 두 지표의 동행성 분석 (변화율 비교 + 상관계수)
const ComparisonChart = ({ metrics }) => {
  const presets = [
    { key: 'spx_netliq', label: 'S&P 500 ↔ 순유동성',     a: 'spx',    b: 'netLiq',
      insight: '순유동성(Fed−RRP−TGA)은 시장에 실제로 풀린 돈. 두 라인이 동행하면 유동성이 주가를 끌어올리고 있다는 신호.' },
    { key: 'ndx_real',   label: 'NASDAQ ↔ 실질금리',      a: 'nasdaq', b: 'realRate',
      insight: '실질금리가 떨어지면 기술주 밸류에이션 부담 완화. 역방향 움직임(실질금리↓ → 나스닥↑)이 정상.' },
    { key: 'spx_global', label: 'S&P 500 ↔ 글로벌 유동성', a: 'spx',    b: 'globalLiq',
      insight: 'Fed·ECB·BOJ 합산 유동성과 주가의 동행성. 글로벌 유동성 확장 국면에서 위험자산이 강세를 보인다.' },
    { key: 'ndx_dxy',    label: 'NASDAQ ↔ 달러지수',      a: 'nasdaq', b: 'dxy',
      insight: '달러 강세는 글로벌 유동성 위축 신호. 역방향(달러↑ → 나스닥↓)이 일반적인 패턴.' },
  ];

  const [selected, setSelected] = useState('spx_netliq');
  const preset = presets.find(p => p.key === selected);

  const mA = metrics[preset.a];
  const mB = metrics[preset.b];
  const labelA = mA.name;
  const labelB = mB.name;

  // 변화율 데이터
  const data = useMemo(() => {
    const sA = mA.series;
    const sB = mB.series;
    const n = Math.min(sA.length, sB.length);
    const startA = sA[0].v || 1;
    const startB = sB[0].v || 1;
    const base = new Date(2026, 4);
    return Array.from({ length: n }, (_, i) => {
      const monthsAgo = n - 1 - i;
      const date = new Date(base.getFullYear(), base.getMonth() - monthsAgo, 1);
      const yr = String(date.getFullYear()).slice(-2);
      const mo = String(date.getMonth() + 1).padStart(2, '0');
      return {
        i,
        label: `${yr}.${mo}`,
        a: (sA[i].v - startA) / Math.abs(startA) * 100,
        b: (sB[i].v - startB) / Math.abs(startB) * 100,
      };
    });
  }, [mA, mB]);

  // 상관계수 (Pearson)
  const corr = useMemo(() => {
    const sA = mA.series, sB = mB.series;
    const n = Math.min(sA.length, sB.length);
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      const x = sA[i].v, y = sB[i].v;
      sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; sumY2 += y * y;
    }
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return den === 0 ? 0 : num / den;
  }, [mA, mB]);

  const xTicks = useMemo(() => {
    const n = data.length;
    if (n <= 5) return data.map(d => d.i);
    return [0, Math.floor(n/4), Math.floor(n/2), Math.floor(3*n/4), n-1];
  }, [data]);

  const corrAbs = Math.abs(corr);
  const corrColor = corrAbs > 0.7 ? C.pos : corrAbs > 0.4 ? '#fbbf24' : '#7a7a85';
  const corrLabel = corrAbs > 0.7 ? '강한 동행성' : corrAbs > 0.4 ? '중간 동행성' : '약한 동행성';
  const corrSign = corr > 0 ? '정(+)' : '역(-)';

  return (
    <div className="rounded-2xl border p-3.5" style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🔗</span>
          <div>
            <div className="text-[13px] font-semibold text-white leading-tight">상관관계 분석</div>
            <div className="text-[10px] mt-0.5" style={{ color: '#7a7a85' }}>두 지표의 5년 동행성</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px]" style={{ color: '#5a5a64' }}>{corrSign} 상관 · ρ</div>
          <div className="text-[16px] font-mono font-bold leading-none" style={{ color: corrColor }}>{corr.toFixed(2)}</div>
        </div>
      </div>

      {/* 프리셋 칩 */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-3.5 px-3.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`.comp-chips::-webkit-scrollbar{display:none}`}</style>
        <div className="flex gap-1.5 comp-chips">
          {presets.map(p => (
            <button
              key={p.key}
              onClick={() => setSelected(p.key)}
              className="text-[10.5px] px-2.5 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-colors active:opacity-60"
              style={{
                background: selected === p.key ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
                color: selected === p.key ? '#60a5fa' : '#a8a8b3',
                border: `1px solid ${selected === p.key ? 'rgba(96,165,250,0.35)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 차트 */}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 6, right: 8, left: -10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="i"
            type="number"
            domain={['dataMin', 'dataMax']}
            ticks={xTicks}
            tickFormatter={(i) => data.find(d => d.i === i)?.label || ''}
            tick={{ fill: '#9a9aa3', fontSize: 9 }}
            stroke="rgba(255,255,255,0.1)"
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
          />
          <YAxis
            tick={{ fill: '#9a9aa3', fontSize: 9 }}
            stroke="rgba(255,255,255,0.1)"
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
            width={48}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
          <Tooltip
            contentStyle={{ background: 'rgba(10,10,14,0.96)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
            labelStyle={{ color: '#7a7a85', fontSize: 10, marginBottom: 4 }}
            labelFormatter={(i) => data.find(d => d.i === i)?.label || ''}
            formatter={(v, name) => [`${v > 0 ? '+' : ''}${v.toFixed(1)}%`, name === 'a' ? labelA : labelB]}
            cursor={{ stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1 }}
          />
          <Line type="monotone" dataKey="a" stroke="#60a5fa" strokeWidth={1.9} dot={false} name="a" isAnimationActive={false} />
          <Line type="monotone" dataKey="b" stroke="#fbbf24" strokeWidth={1.9} dot={false} name="b" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-4 mt-1.5 text-[10px]">
        <span className="flex items-center gap-1.5" style={{ color: '#60a5fa' }}>
          <span className="w-3 h-0.5" style={{ background: '#60a5fa' }}></span>
          {labelA}
        </span>
        <span className="flex items-center gap-1.5" style={{ color: '#fbbf24' }}>
          <span className="w-3 h-0.5" style={{ background: '#fbbf24' }}></span>
          {labelB}
        </span>
      </div>

      {/* 해석 */}
      <div className="mt-3 rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-[11.5px] leading-relaxed" style={{ color: '#a8a8b3' }}>
          <span style={{ color: corrColor, fontWeight: 600 }}>💡 </span>
          {preset.insight} 현재 상관계수 <span style={{ color: '#fff', fontWeight: 600 }}>{corr.toFixed(2)}</span>로 <span style={{ color: corrColor }}>{corrLabel}</span>.
        </p>
      </div>
    </div>
  );
};

// 6개월 윈도우 기반 과거 시그널 시뮬레이션 (백테스트용)
const simulateRegimes = () => {
  // 4개 시계열 중 가장 짧은 것 기준 (길이 불일치 방어)
  const series = [
    M.globalLiq?.series, M.netLiq?.series,
    M.realRate?.series, M.hyOas?.series,
  ];
  if (series.some(s => !s || s.length < 7)) return [];
  const len = Math.min(...series.map(s => s.length));
  const result = [];
  const W = 6;

  for (let i = W; i < len; i++) {
    const g = M.globalLiq.series[i], gW = M.globalLiq.series[i - W];
    const n = M.netLiq.series[i], nW = M.netLiq.series[i - W];
    const r = M.realRate.series[i], rW = M.realRate.series[i - W];
    const h = M.hyOas.series[i], hW = M.hyOas.series[i - W];
    if (!g || !gW || !n || !nW || !r || !rW || !h || !hW) continue;

    const liqChange = g.v - gW.v;
    const netChange = n.v - nW.v;
    const rateChange = r.v - rW.v;
    const hyChange = h.v - hW.v;

    let score = 0;
    if (liqChange > 0) score++;
    if (netChange > 0) score++;
    if (rateChange < 0) score++;
    if (hyChange < 0) score++;

    let regime;
    if (score >= 3) regime = 'RISK-ON';
    else if (score <= 1) regime = 'RISK-OFF';
    else regime = 'NEUTRAL';

    result.push({ i, regime, score });
  }
  return result;
};

// 백테스트: 과거 시점 시그널이 실제 자산 가격을 얼마나 잘 예측했는지
const Backtest = () => {
  const [asset, setAsset] = useState('spx');
  const assetData = M[asset];

  const regimes = useMemo(() => simulateRegimes(), []);

  // 시그널별 다음 기간 수익률 통계
  const stats = useMemo(() => {
    const buckets = { 'RISK-ON': [], 'NEUTRAL': [], 'RISK-OFF': [] };
    const aLen = assetData?.series?.length || 0;
    for (let j = 0; j < regimes.length - 1; j++) {
      const r = regimes[j];
      const next = regimes[j + 1];
      if (r.i >= aLen || next.i >= aLen) continue;
      const sp = assetData.series[r.i]?.v;
      const ep = assetData.series[next.i]?.v;
      if (sp == null || ep == null || sp <= 0) continue;
      const ret = (ep - sp) / sp * 100;
      if (isFinite(ret)) buckets[r.regime].push(ret);
    }
    const avg = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
    return {
      on: { count: buckets['RISK-ON'].length, avg: avg(buckets['RISK-ON']) },
      neu: { count: buckets.NEUTRAL.length, avg: avg(buckets.NEUTRAL) },
      off: { count: buckets['RISK-OFF'].length, avg: avg(buckets['RISK-OFF']) },
    };
  }, [regimes, assetData]);

  // 시그널 구간 그룹핑 (ReferenceArea용)
  const bands = useMemo(() => {
    const result = [];
    if (regimes.length === 0) return result;
    let cs = regimes[0].i, ct = regimes[0].regime;
    for (let i = 1; i < regimes.length; i++) {
      if (regimes[i].regime !== ct) {
        result.push({ start: cs, end: regimes[i - 1].i, regime: ct });
        cs = regimes[i].i;
        ct = regimes[i].regime;
      }
    }
    result.push({ start: cs, end: regimes[regimes.length - 1].i, regime: ct });
    return result;
  }, [regimes]);

  // 차트 데이터
  const chartData = useMemo(() => {
    const base = new Date(2026, 4);
    const len = M.globalLiq.series.length;
    const aLen = assetData?.series?.length || 0;
    return regimes.map(r => {
      const monthsAgo = len - 1 - r.i;
      const d = new Date(base.getFullYear(), base.getMonth() - monthsAgo, 1);
      return {
        i: r.i,
        label: `${String(d.getFullYear()).slice(-2)}.${String(d.getMonth() + 1).padStart(2, '0')}`,
        price: r.i < aLen ? assetData.series[r.i]?.v : null,
      };
    }).filter(d => d.price != null);
  }, [regimes, assetData]);

  const xTicks = useMemo(() => {
    const n = chartData.length;
    if (n <= 5) return chartData.map(d => d.i);
    return [0, Math.floor(n/4), Math.floor(n/2), Math.floor(3*n/4), n-1].map(idx => chartData[idx]?.i).filter(x => x != null);
  }, [chartData]);

  const fmtY = (v) => {
    if (v === null || v === undefined || isNaN(v)) return '';
    if (assetData.unit === '$' && v >= 1000) return `$${(v/1000).toFixed(0)}k`;
    if (assetData.unit === '$') return `$${v.toFixed(0)}`;
    return v >= 10000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0);
  };

  const regimeColor = (r) => r === 'RISK-ON' ? C.pos : r === 'RISK-OFF' ? C.neg : C.warn;

  const spread = stats.on.avg - stats.off.avg;
  const valid = spread > 0.3;

  const assetOptions = [
    ['spx', 'S&P 500'], ['nasdaq', 'NASDAQ'],
  ];

  return (
    <div className="rounded-2xl border p-3.5" style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🧪</span>
          <div>
            <div className="text-[13px] font-semibold text-white leading-tight">백테스트</div>
            <div className="text-[10px] mt-0.5" style={{ color: '#7a7a85' }}>5년 시그널 정확도 검증</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px]" style={{ color: '#5a5a64' }}>ON-OFF 스프레드</div>
          <div className="text-[14px] font-mono font-bold" style={{ color: valid ? C.pos : C.warn }}>
            {spread > 0 ? '+' : ''}{spread.toFixed(2)}%p
          </div>
        </div>
      </div>

      {/* 자산 선택 칩 */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-3.5 px-3.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`.bt-chips::-webkit-scrollbar{display:none}`}</style>
        <div className="flex gap-1.5 bt-chips">
          {assetOptions.map(([k, label]) => (
            <button key={k} onClick={() => setAsset(k)}
              className="text-[10.5px] px-2.5 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-colors active:opacity-60"
              style={{
                background: asset === k ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
                color: asset === k ? '#60a5fa' : '#a8a8b3',
                border: `1px solid ${asset === k ? 'rgba(96,165,250,0.35)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 차트: 자산 가격 + 시그널 색 배경 */}
      <ResponsiveContainer width="100%" height={195}>
        <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -8, bottom: 4 }}>
          <defs>
            <linearGradient id="bt-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
            </linearGradient>
          </defs>
          {bands.map((b, idx) => (
            <ReferenceArea key={idx} x1={b.start} x2={b.end}
              fill={regimeColor(b.regime)}
              fillOpacity={0.1} ifOverflow="visible" />
          ))}
          <CartesianGrid strokeDasharray="2 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="i"
            type="number"
            domain={['dataMin', 'dataMax']}
            ticks={xTicks}
            tickFormatter={(i) => chartData.find(d => d.i === i)?.label || ''}
            tick={{ fill: '#9a9aa3', fontSize: 9 }}
            stroke="rgba(255,255,255,0.1)"
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
          />
          <YAxis
            tick={{ fill: '#9a9aa3', fontSize: 9 }}
            stroke="rgba(255,255,255,0.1)"
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickFormatter={fmtY}
            width={48}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{ background: 'rgba(10,10,14,0.96)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
            labelStyle={{ color: '#7a7a85', fontSize: 10, marginBottom: 4 }}
            labelFormatter={(i) => chartData.find(d => d.i === i)?.label || ''}
            formatter={(v) => [fmtY(v), assetData.name]}
            cursor={{ stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1 }}
          />
          <Area type="monotone" dataKey="price" stroke="#ffffff" strokeWidth={1.8} fill="url(#bt-grad)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>

      {/* 시그널 범례 */}
      <div className="flex items-center justify-center gap-3 mt-1.5 mb-3 text-[10px]">
        {[['RISK-ON', C.pos], ['NEUTRAL', C.warn], ['RISK-OFF', C.neg]].map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5" style={{ color }}>
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: color, opacity: 0.45 }}></span>
            {label}
          </span>
        ))}
      </div>

      {/* 통계 카드 3개 */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {[
          { label: 'RISK-ON', count: stats.on.count, avg: stats.on.avg, color: C.pos },
          { label: 'NEUTRAL', count: stats.neu.count, avg: stats.neu.avg, color: C.warn },
          { label: 'RISK-OFF', count: stats.off.count, avg: stats.off.avg, color: C.neg },
        ].map(s => (
          <div key={s.label} className="rounded-lg border p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.02)', borderColor: `${s.color}30` }}>
            <div className="text-[8.5px] font-mono" style={{ color: s.color }}>{s.label}</div>
            <div className="text-[15px] font-mono font-bold mt-1 leading-none" style={{ color: s.color }}>
              {s.avg > 0 ? '+' : ''}{s.avg.toFixed(2)}%
            </div>
            <div className="text-[8.5px] mt-1" style={{ color: '#7a7a85' }}>{s.count}개월</div>
          </div>
        ))}
      </div>

      {/* 해석 */}
      <div className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-[11.5px] leading-relaxed" style={{ color: '#a8a8b3' }}>
          <span style={{ color: valid ? C.pos : C.warn, fontWeight: 600 }}>💡 </span>
          {valid
            ? `RISK-ON 구간의 ${assetData.name} 평균 월 수익률이 RISK-OFF 구간보다 ${spread.toFixed(2)}%p 높습니다. 모델 시그널이 ${assetData.name} 방향성을 유효하게 포착하고 있음.`
            : `RISK-ON과 RISK-OFF 구간의 수익률 차이가 ${spread.toFixed(2)}%p로 미미합니다. ${assetData.name}에는 이 시그널이 약하게 작용하거나 개별 자산 요인이 더 큰 영향을 미치는 것으로 보입니다.`
          }
        </p>
      </div>
    </div>
  );
};

// 실시간 시세 티커 (CoinGecko + 환율 API)
// FRED 시리즈 매핑: M의 키 → FRED series ID + units (lin: 그대로, pc1: YoY %)
const FRED_SERIES = {
  // --- 금리 ---
  fedRate:  { id: 'FEDFUNDS',  units: 'lin' },
  us10y:    { id: 'DGS10',     units: 'lin', freq: 'eop' },
  us2y:     { id: 'DGS2',      units: 'lin', freq: 'eop' },
  realRate: { id: 'DFII10',    units: 'lin', freq: 'eop' },
  bei:      { id: 'T10YIE',    units: 'lin', freq: 'eop' },
  // --- 변동성 ---
  vix:      { id: 'VIXCLS',    units: 'lin', freq: 'eop' },
  // --- 물가 (YoY%) ---
  cpi:      { id: 'CPIAUCSL',  units: 'pc1' },
  coreCpi:  { id: 'CPILFESL',  units: 'pc1' },
  pce:      { id: 'PCEPI',     units: 'pc1' },
  // --- 통화량 (YoY%) ---
  usM2:     { id: 'M2SL',      units: 'pc1' },
  // --- 신용 스프레드 (% → bp) ---
  hyOas:    { id: 'BAMLH0A0HYM2', units: 'lin', multiplier: 100, freq: 'eop' },
  igOas:    { id: 'BAMLC0A0CM',   units: 'lin', multiplier: 100, freq: 'eop' },

  // === 3단계: G3 유동성 구성요소 (Fed·ECB·BOJ) ===
  // Fed 총자산 (백만$ → 조$): WALCL
  fedAssets: { id: 'WALCL', units: 'lin', multiplier: 1e-6 },
  // RRP 역레포 (10억$ → 조$): RRPONTSYD
  rrp:       { id: 'RRPONTSYD', units: 'lin', multiplier: 1e-3 },
  // TGA 재무부 일반계정 (백만$ → 조$): WTREGEN — H.4.1 자료라 WALCL과 같은 백만$ 단위
  //   netLiq 계산용 (M에 직접 표시는 안 함)
  tga:       { id: 'WTREGEN', units: 'lin', multiplier: 1e-6, _internal: true },

  // === 5단계: 신용 확장 (YoY%) ===
  // 상업은행 대출·리스 총액 (월간)
  bankLoans:  { id: 'TOTLL',   units: 'pc1' },
  // 비금융기업 신용 (분기 데이터 — freq:'q')
  corpCredit: { id: 'BCNSDODNS', units: 'pc1', freq: 'q' },
  // 가계 신용 (분기 데이터 — freq:'q')
  hhCredit:   { id: 'CMDEBT',  units: 'pc1', freq: 'q' },

  // === 4단계: 한국 (FRED가 보유한 한국 시리즈) ===
  // 한국 M2 (YoY%) — FRED: MYAGM2KRM189S
  krM2:  { id: 'MYAGM2KRM189S', units: 'pc1' },
  // ⚠️ 한국 기준금리(BOK base rate)는 FRED에 없음 (OECD 시장금리만 존재).
  //    진짜 BOK 기준금리는 한국은행 ECOS API 필요 → 일단 mock 유지.
  //    krRate: ECOS 연동 시 추가 예정

  // === Yahoo 대체: 원자재·지수·달러 (FRED가 더 안정적) ===
  // 금: GOLDAMGBD228NLBM 2025년 단종 → mock 유지 (무료 대체 소스 없음)
  // 구리: PCOPPUSDM($/메트릭톤)이 LME 현물($/lb)과 단위·값이 불일치 → mock 유지
  // WTI 원유 ($/배럴) — 일간
  wti:    { id: 'DCOILWTICO', units: 'lin', freq: 'eop' },
  // 광의 달러지수 (DXY 대용 — Fed 무역가중 달러지수)
  dxy:    { id: 'DTWEXBGS', units: 'lin', freq: 'eop' },
  // S&P 500
  spx:    { id: 'SP500', units: 'lin', freq: 'eop' },
  // NASDAQ 종합
  nasdaq: { id: 'NASDAQCOM', units: 'lin', freq: 'eop' },
};

// G3 유동성에 쓰는 환율·해외 중앙은행 (FRED 시리즈)
const FRED_G3_SERIES = {
  // ECB 총자산 (백만€) — ECBASSETSW
  ecbAssets: { id: 'ECBASSETSW', units: 'lin', multiplier: 1e-6 },
  // BOJ 총자산 (1억엔 단위) — JPNASSETS
  bojAssets: { id: 'JPNASSETS', units: 'lin', multiplier: 1e-4 },
  // 환율 (달러 환산용)
  eurusd_fx: { id: 'DEXUSEU', units: 'lin' },   // USD per EUR
  usdjpy_fx: { id: 'DEXJPUS', units: 'lin' },   // JPY per USD
};

// FRED 프록시 설정
// - 브라우저는 FRED를 직접 호출 못 함 (CORS 차단)
// - fred-proxy.js 를 localhost:8787 에서 실행하면 그쪽을 경유
// - 프록시가 안 켜져 있으면 자동으로 실패 → mock 데이터 유지
const FRED_PROXY = 'http://localhost:8787';

// 프록시 살아있는지 1회 확인 (캐시)
let _fredProxyAlive = null;
const checkFredProxy = async () => {
  if (_fredProxyAlive !== null) return _fredProxyAlive;
  try {
    const r = await fetch(`${FRED_PROXY}/health`, { signal: AbortSignal.timeout(2000) });
    _fredProxyAlive = r.ok;
  } catch {
    _fredProxyAlive = false;
  }
  return _fredProxyAlive;
};

// FRED API 단일 시리즈 fetch (프록시 경유, 6년치)
// - freq='m'(기본): 월간 집계 (일간 데이터를 월평균으로). 일·월간 시리즈용
// - freq='q': 분기 데이터 그대로 (BCNSDODNS·CMDEBT 같은 분기 시리즈)
//   분기 데이터는 frequency=m 집계가 FRED에서 400 거부됨 → freq 옵션 없이 원본
// - pc1 unit은 FRED가 알아서 YoY% 변환
// - 간헐적 실패 대비 1회 재시도
const fetchFredSeries = async (seriesId, apiKey, units = 'lin', freq = 'm') => {
  const attempt = async () => {
    const base = {
      series_id: seriesId,
      api_key: apiKey,
      file_type: 'json',
      sort_order: 'desc',          // 최신 → 과거 (최신 데이터 확보 보장)
      limit: freq === 'q' ? '28' : '72',
      units,
    };
    // 'eop': 일간 시리즈 → 월말값 (금리·VIX·주가·유가 — 최신성 + 60개월)
    // 'm':   일간 시리즈 → 월평균 (거의 안 씀)
    // 'q':   분기 원본 (BCNSDODNS·CMDEBT)
    // 'native': 이미 월간인 시리즈 — 집계 안 함 (PCOPPUSDM·pc1 시리즈)
    if (freq === 'eop') {
      base.frequency = 'm';
      base.aggregation_method = 'eop';   // end of period = 그 달 마지막 값
    } else if (freq === 'm') {
      base.frequency = 'm';
      base.aggregation_method = 'avg';
    }
    const params = new URLSearchParams(base);
    const url = `${FRED_PROXY}/fred/series/observations?${params.toString()}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const data = await r.json();
    const obs = (data.observations || [])
      .filter(o => o.value !== '.' && o.value !== '')
      .map(o => ({ date: o.date, value: parseFloat(o.value) }))
      .filter(o => !isNaN(o.value));
    if (obs.length < 2) return null;
    // desc로 받았으므로 과거→최신 순으로 뒤집기
    obs.reverse();
    return obs;
  };
  // FRED rate limit 대비: 최대 3회 시도, 실패할수록 대기 증가 (400→800ms)
  for (let i = 0; i < 3; i++) {
    try {
      const result = await attempt();
      if (result) return result;
    } catch {
      // 네트워크 예외 — 재시도로 넘어감
    }
    if (i < 2) await new Promise(res => setTimeout(res, 400 * (i + 1)));
  }
  return null;
};

// 모든 매핑된 시리즈 동시 fetch → value + delta + 60개월 시계열 반환
// 반환: { _proxyAlive: bool, _updatedKeys: [], ...각 지표 }
// FRED rate limit 회피: 한꺼번에 안 쏘고 작은 배치로 나눠 순차 처리
// 동시 4개씩, 배치 사이 250ms 딜레이
const fetchInBatches = async (items, fn, batchSize = 4, delayMs = 250) => {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
  return results;
};

const fetchAllFred = async (apiKey) => {
  // 프록시 먼저 확인 — 안 켜져 있으면 빈 결과 (mock 유지)
  const proxyAlive = await checkFredProxy();
  if (!proxyAlive) {
    return { _proxyAlive: false, _updatedKeys: [] };
  }

  const keys = Object.keys(FRED_SERIES);
  const results = await fetchInBatches(
    keys,
    k => fetchFredSeries(FRED_SERIES[k].id, apiKey, FRED_SERIES[k].units, FRED_SERIES[k].freq || 'm')
  );
  const out = { _proxyAlive: true, _updatedKeys: [] };
  // _internal 시리즈의 raw 데이터 저장 (계산용, M에는 안 넣음)
  const internalRaw = {};

  // 분기 데이터(28개)를 월간 해상도(~60개)로 선형보간
  // 각 분기 사이를 3등분해서 부드러운 시계열 생성
  const interpolateQuarterly = (obs) => {
    if (obs.length < 2) return obs;
    const result = [];
    for (let i = 0; i < obs.length - 1; i++) {
      const a = obs[i].value;
      const b = obs[i + 1].value;
      // 각 분기 시작점 + 중간 2점
      for (let s = 0; s < 3; s++) {
        result.push({ date: obs[i].date, value: a + (b - a) * (s / 3) });
      }
    }
    result.push({ date: obs[obs.length - 1].date, value: obs[obs.length - 1].value });
    return result;
  };

  keys.forEach((k, i) => {
    let obs = results[i];
    if (!obs || obs.length < 2) return;

    // 분기 시리즈는 월간 해상도로 보간
    if (FRED_SERIES[k].freq === 'q') {
      obs = interpolateQuarterly(obs);
    }

    const mult = FRED_SERIES[k].multiplier || 1;
    const recent = obs.slice(-60);
    const series = recent.map((o, idx) => ({
      i: idx,
      v: +(o.value * mult).toFixed(3),
    }));

    const lastVal = recent[recent.length - 1].value * mult;
    const prevVal = recent[recent.length - 2].value * mult;

    // _internal 시리즈(tga 등)는 M에 안 넣고 계산용으로만 보관
    if (FRED_SERIES[k]._internal) {
      internalRaw[k] = { series, lastVal };
      return;
    }

    out[k] = {
      value: +lastVal.toFixed(2),
      change: +(lastVal - prevVal).toFixed(2),
      date: recent[recent.length - 1].date,
      series,
      pointCount: series.length,
    };
    out._updatedKeys.push(k);
  });

  // ===== 3단계: G3 유동성 계산 =====
  // 해외 중앙은행 + 환율 추가 fetch
  const g3Keys = Object.keys(FRED_G3_SERIES);
  const g3Results = await fetchInBatches(
    g3Keys,
    k => fetchFredSeries(FRED_G3_SERIES[k].id, apiKey, FRED_G3_SERIES[k].units)
  );
  const g3Raw = {};
  g3Keys.forEach((k, i) => {
    const obs = g3Results[i];
    if (!obs || obs.length < 2) return;
    const mult = FRED_G3_SERIES[k].multiplier || 1;
    const recent = obs.slice(-60);
    g3Raw[k] = recent.map(o => +(o.value * mult).toFixed(4));
  });

  // 시계열 정렬 헬퍼 — 길이 맞춰 마지막 N개로 트림
  const alignLen = (...arrs) => {
    const valid = arrs.filter(a => a && a.length >= 2);
    if (valid.length === 0) return 0;
    return Math.min(...valid.map(a => a.length));
  };

  // ECB·BOJ 자산을 달러로 환산한 시계열 만들기
  const fedSeries = out.fedAssets?.series?.map(p => p.v) || null;
  const ecbRaw = g3Raw.ecbAssets || null;       // 조€
  const bojRaw = g3Raw.bojAssets || null;       // 조¥
  const eurusd = g3Raw.eurusd_fx || null;       // USD per EUR
  const usdjpy = g3Raw.usdjpy_fx || null;       // JPY per USD

  // ECB 달러환산 = 조€ × (USD/EUR)
  let ecbUsd = null;
  if (ecbRaw && eurusd) {
    const L = alignLen(ecbRaw, eurusd);
    if (L >= 2) {
      ecbUsd = [];
      for (let i = 0; i < L; i++) {
        ecbUsd.push(ecbRaw[ecbRaw.length - L + i] * eurusd[eurusd.length - L + i]);
      }
    }
  }
  // BOJ 달러환산 = 조¥ ÷ (JPY/USD)
  let bojUsd = null;
  if (bojRaw && usdjpy) {
    const L = alignLen(bojRaw, usdjpy);
    if (L >= 2) {
      bojUsd = [];
      for (let i = 0; i < L; i++) {
        const jpy = usdjpy[usdjpy.length - L + i];
        bojUsd.push(jpy ? bojRaw[bojRaw.length - L + i] / jpy : 0);
      }
    }
  }

  // ECB·BOJ 자산 자체도 지표로 (원통화 단위)
  if (ecbRaw && ecbRaw.length >= 2) {
    out.ecbAssets = {
      value: +ecbRaw[ecbRaw.length - 1].toFixed(2),
      change: +(ecbRaw[ecbRaw.length - 1] - ecbRaw[ecbRaw.length - 2]).toFixed(2),
      series: ecbRaw.map((v, i) => ({ i, v: +v.toFixed(3) })),
    };
    out._updatedKeys.push('ecbAssets');
  }
  if (bojRaw && bojRaw.length >= 2) {
    out.bojAssets = {
      value: +bojRaw[bojRaw.length - 1].toFixed(1),
      change: +(bojRaw[bojRaw.length - 1] - bojRaw[bojRaw.length - 2]).toFixed(1),
      series: bojRaw.map((v, i) => ({ i, v: +v.toFixed(2) })),
    };
    out._updatedKeys.push('bojAssets');
  }

  // G3 통합 유동성 = Fed + ECB(USD) + BOJ(USD)  (모두 조$ 단위)
  if (fedSeries && ecbUsd && bojUsd) {
    const L = alignLen(fedSeries, ecbUsd, bojUsd);
    if (L >= 2) {
      const g3 = [];
      for (let i = 0; i < L; i++) {
        g3.push(
          fedSeries[fedSeries.length - L + i] +
          ecbUsd[ecbUsd.length - L + i] +
          bojUsd[bojUsd.length - L + i]
        );
      }
      out.globalLiq = {
        value: +g3[g3.length - 1].toFixed(2),
        change: +(g3[g3.length - 1] - g3[g3.length - 2]).toFixed(2),
        series: g3.map((v, i) => ({ i, v: +v.toFixed(2) })),
      };
      out._updatedKeys.push('globalLiq');
    }
  }

  // 순유동성 = Fed 총자산 - RRP - TGA  (조$ 단위)
  // RRP나 TGA가 누락돼도 가능한 만큼 계산 (graceful)
  const rrpSeries = out.rrp?.series?.map(p => p.v) || null;
  const tgaSeries = internalRaw.tga?.series?.map(p => p.v) || null;
  if (fedSeries && (rrpSeries || tgaSeries)) {
    const parts = [fedSeries, rrpSeries, tgaSeries].filter(Boolean);
    const L = alignLen(...parts);
    if (L >= 2) {
      const netLiq = [];
      for (let i = 0; i < L; i++) {
        let v = fedSeries[fedSeries.length - L + i];
        if (rrpSeries) v -= rrpSeries[rrpSeries.length - L + i];
        if (tgaSeries) v -= tgaSeries[tgaSeries.length - L + i];
        netLiq.push(v);
      }
      out.netLiq = {
        value: +netLiq[netLiq.length - 1].toFixed(2),
        change: +(netLiq[netLiq.length - 1] - netLiq[netLiq.length - 2]).toFixed(2),
        series: netLiq.map((v, i) => ({ i, v: +v.toFixed(2) })),
      };
      out._updatedKeys.push('netLiq');
    }
  }

  // 10Y-2Y 스프레드 = us10y - us2y  (%, 음수면 역전)
  const us10ySeries = out.us10y?.series?.map(p => p.v) || null;
  const us2ySeries = out.us2y?.series?.map(p => p.v) || null;
  if (us10ySeries && us2ySeries) {
    const L = alignLen(us10ySeries, us2ySeries);
    if (L >= 2) {
      const curve = [];
      for (let i = 0; i < L; i++) {
        curve.push(
          us10ySeries[us10ySeries.length - L + i] -
          us2ySeries[us2ySeries.length - L + i]
        );
      }
      out.yieldCurve = {
        value: +curve[curve.length - 1].toFixed(2),
        change: +(curve[curve.length - 1] - curve[curve.length - 2]).toFixed(2),
        series: curve.map((v, i) => ({ i, v: +v.toFixed(3) })),
      };
      out._updatedKeys.push('yieldCurve');
    }
  }

  return out;
};

// 설정 모달: FRED API 키 입력 + 저장
const SettingsModal = ({ isOpen, onClose, fredKey, setFredKey }) => {
  const [inputKey, setInputKey] = useState(fredKey || '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => { setInputKey(fredKey || ''); }, [fredKey, isOpen]);

  if (!isOpen) return null;

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const trimmed = inputKey.trim();
      if (trimmed) {
        await window.storage.set('settings:fredKey', trimmed);
        setFredKey(trimmed);
      } else {
        try { await window.storage.delete('settings:fredKey'); } catch {}
        setFredKey(null);
      }
      setStatus('success');
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    try { await window.storage.delete('settings:fredKey'); } catch {}
    setInputKey('');
    setFredKey(null);
    setStatus('cleared');
    setTimeout(() => setStatus(null), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-3"
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border overflow-y-auto"
        style={{
          background: '#0a0a0e',
          borderColor: 'rgba(255,255,255,0.08)',
          maxHeight: '85vh',
          animation: 'sheetUp 0.2s ease-out',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <Settings size={14} style={{ color: '#a8a8b3' }} />
            <span className="text-[13px] font-semibold text-white">설정</span>
          </div>
          <button onClick={onClose} className="active:opacity-60 p-1 -mr-1">
            <X size={18} style={{ color: '#a8a8b3' }} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-[12px] font-semibold text-white mb-1.5 flex items-center gap-2">
              <span>🇺🇸 FRED API 키</span>
              {fredKey && (
                <span className="rounded-full px-2 py-0.5 text-[9px]" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>● 연결됨</span>
              )}
            </div>
            <p className="text-[11px] mb-3 leading-relaxed" style={{ color: '#7a7a85' }}>
              무료 키 입력 시 미국 매크로 지표를 실시간 갱신합니다. M2, Fed Funds, CPI, 금리, HY/IG 스프레드, VIX 등 12개 지표 자동 연동.
            </p>

            <input
              type="text"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="abcdef0123456789abcdef0123456789"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className="w-full rounded-lg px-3 py-2.5 text-[12px] font-mono outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
              }}
            />

            <div className="flex gap-1.5 mt-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 rounded-lg py-2 text-[12px] font-semibold active:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #60a5fa, #6366f1)',
                  color: '#fff',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              {fredKey && (
                <button
                  onClick={clear}
                  className="rounded-lg px-3 text-[11px] font-semibold active:opacity-60"
                  style={{
                    background: 'rgba(248,113,113,0.08)',
                    color: '#f87171',
                    border: '1px solid rgba(248,113,113,0.25)',
                  }}
                >
                  삭제
                </button>
              )}
            </div>

            {status === 'success' && (
              <p className="text-[10.5px] mt-2" style={{ color: '#34d399' }}>✓ 저장됨. 새로고침 시 자동 갱신됩니다.</p>
            )}
            {status === 'error' && (
              <p className="text-[10.5px] mt-2" style={{ color: '#f87171' }}>저장 실패. 다시 시도해주세요.</p>
            )}
            {status === 'cleared' && (
              <p className="text-[10.5px] mt-2" style={{ color: '#7a7a85' }}>키 삭제됨. mock 데이터 사용.</p>
            )}

            <div className="mt-3 rounded-lg p-2.5 text-[10.5px] leading-relaxed" style={{ background: 'rgba(255,255,255,0.02)', color: '#a8a8b3' }}>
              <div style={{ color: '#7a7a85' }} className="mb-1">📋 키 받는 법</div>
              fred.stlouisfed.org 무료 가입 → My Account → API Keys → Request API Key
            </div>
          </div>

          {fredKey && (
            <div className="rounded-lg p-3 border" style={{ background: 'rgba(52,211,153,0.04)', borderColor: 'rgba(52,211,153,0.2)' }}>
              <div className="text-[11px] font-semibold mb-2" style={{ color: '#34d399' }}>FRED 연결 시 활성화 지표 (12개)</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px]" style={{ color: '#c0c0c8' }}>
                <div>• Fed Funds 금리</div>
                <div>• US 10Y / 2Y</div>
                <div>• 실질금리 (TIPS)</div>
                <div>• 기대인플레 (BEI)</div>
                <div>• CPI / Core CPI / PCE</div>
                <div>• US M2 증가율</div>
                <div>• HY / IG 스프레드</div>
                <div>• VIX</div>
              </div>
            </div>
          )}

          <div className="rounded-lg p-2.5 text-[10px] leading-relaxed" style={{ background: 'rgba(251,146,60,0.04)', borderColor: 'rgba(251,146,60,0.2)', border: '1px solid rgba(251,146,60,0.2)', color: '#a8a8b3' }}>
            <span style={{ color: '#fb923c' }}>⚠ 안내: </span>
            FRED는 CORS 제한이 있어 일부 환경에서 직접 호출이 차단될 수 있습니다. 차단 시 mock 데이터가 유지됩니다.
          </div>

          {/* 데이터 백업/복원 */}
          <DataBackup />
        </div>
      </div>
    </div>
  );
};

// 데이터 백업/복원: 모든 storage 데이터를 JSON으로 export·import
const DataBackup = () => {
  const [restoreStatus, setRestoreStatus] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = React.useRef(null);

  // export: 모든 storage 키를 모아 JSON 다운로드
  const exportData = async () => {
    try {
      const keys = [
        'analysis:overall_regime',
        'analysis:overall_regime:auto',
        'briefing:daily',
        'portfolio:allocations',
        'settings:fredKey',
      ];
      // 추가로 analysis:*, note:* 모든 키 수집
      let analysisKeys = [];
      let noteKeys = [];
      try {
        const listed = await window.storage.list('analysis:');
        if (listed?.keys) analysisKeys = listed.keys;
      } catch {}
      try {
        const listed = await window.storage.list('note:');
        if (listed?.keys) noteKeys = listed.keys;
      } catch {}

      const allKeys = [...new Set([...keys, ...analysisKeys, ...noteKeys])];
      const result = {};
      await Promise.all(allKeys.map(async (k) => {
        try {
          const r = await window.storage.get(k);
          if (r?.value !== undefined) result[k] = r.value;
        } catch {}
      }));

      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        data: result,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `macro-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setRestoreStatus({ type: 'success', msg: `백업 완료 (${Object.keys(result).length}개 항목)` });
      setTimeout(() => setRestoreStatus(null), 3000);
    } catch (e) {
      setRestoreStatus({ type: 'error', msg: '백업 실패: ' + (e.message || '오류') });
    }
  };

  // import: JSON 파일 파싱 → storage 복원
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 가능하게
    if (!file) return;

    setRestoring(true);
    setRestoreStatus(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed?.data || typeof parsed.data !== 'object') {
        throw new Error('잘못된 백업 파일');
      }
      const entries = Object.entries(parsed.data);
      let restored = 0;
      for (const [k, v] of entries) {
        try {
          await window.storage.set(k, v);
          restored++;
        } catch {}
      }
      setRestoreStatus({ type: 'success', msg: `복원 완료 (${restored}/${entries.length}). 새로고침 권장.` });
      setTimeout(() => setRestoreStatus(null), 5000);
    } catch (err) {
      setRestoreStatus({ type: 'error', msg: '복원 실패: ' + (err.message || '파일 오류') });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="rounded-lg p-3 border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="text-[12px] font-semibold text-white mb-1.5">💾 데이터 백업·복원</div>
      <p className="text-[10.5px] mb-3 leading-relaxed" style={{ color: '#7a7a85' }}>
        모든 AI 분석·포트폴리오·설정을 JSON 파일로 백업하거나 다른 기기에서 복원할 수 있습니다.
      </p>

      <div className="flex gap-1.5">
        <button
          onClick={exportData}
          className="flex-1 rounded-lg py-2 text-[12px] font-semibold active:opacity-60 btn-tap"
          style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}
        >
          ⬇ 백업 (JSON)
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={restoring}
          className="flex-1 rounded-lg py-2 text-[12px] font-semibold active:opacity-60 btn-tap"
          style={{ background: 'rgba(255,255,255,0.04)', color: '#a8a8b3', border: '1px solid rgba(255,255,255,0.08)', opacity: restoring ? 0.5 : 1 }}
        >
          ⬆ {restoring ? '복원 중...' : '복원'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </div>

      {restoreStatus && (
        <p className="text-[10.5px] mt-2" style={{ color: restoreStatus.type === 'success' ? '#34d399' : '#f87171' }}>
          {restoreStatus.type === 'success' ? '✓ ' : ''}
          {restoreStatus.msg}
        </p>
      )}
    </div>
  );
};

// Stooq 심볼 → M 키 매핑 (S&P 500 · NASDAQ 지수)
const STOOQ_MAP = {
  '^spx':    'spx',
  '^ndq':    'nasdaq',
};

// Stooq CSV 응답 → { value, delta, series(60개월) }
// q/d/l/?s=SYMBOL&d1=...&d2=...&i=d — 날짜 범위 주면 키 없이 CSV 응답
// CSV: Date,Open,High,Low,Close,Volume (헤더 1줄 + 일별 데이터)
const parseStooqCsv = (csv) => {
  try {
    if (!csv || typeof csv !== 'string') return null;
    const lines = csv.trim().split('\n');
    if (lines.length < 3) return null;
    const header = lines[0].toLowerCase();
    if (!header.includes('close') || !header.includes('date')) return null;
    const cols = header.split(',');
    const dateIdx = cols.indexOf('date');
    const closeIdx = cols.indexOf('close');
    if (dateIdx < 0 || closeIdx < 0) return null;

    // 일별 → 월말 종가
    const monthly = {};
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(',');
      const date = c[dateIdx];
      const close = parseFloat(c[closeIdx]);
      if (!date || isNaN(close)) continue;
      monthly[date.slice(0, 7)] = close; // YYYY-MM, 같은 달이면 뒤(최신)가 덮어씀
    }
    const months = Object.keys(monthly).sort();
    const recent = months.slice(-60);
    const series = recent.map((m, i) => ({ i, v: +monthly[m].toFixed(2) }));
    if (series.length < 2) return null;

    const lastVal = series[series.length - 1].v;
    const prevVal = series[series.length - 2].v;
    return {
      value: lastVal,
      delta: +((lastVal - prevVal) / prevVal * 100).toFixed(2),
      series,
    };
  } catch {
    return null;
  }
};

const LiveTicker = ({ onUpdate, refreshKey }) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(false);

    // 프록시 살아있는지 확인 (Stooq는 프록시 경유)
    let proxyAlive = false;
    try {
      const hr = await fetch(`${FRED_PROXY}/health`, { signal: AbortSignal.timeout(2000) });
      proxyAlive = hr.ok;
    } catch {
      proxyAlive = false;
    }

    // Stooq: 프록시 경유, CSV 다운로드 (날짜 범위 주면 키 불필요)
    const fetchStooq = async (sym) => {
      if (!proxyAlive) return null;
      try {
        const now = new Date();
        const fmt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const d2 = fmt(now);
        const d1 = fmt(new Date(now.getFullYear() - 6, now.getMonth(), now.getDate()));
        const url = `${FRED_PROXY}/stooq/q/d/l/?s=${encodeURIComponent(sym)}&d1=${d1}&d2=${d2}&i=d`;
        const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (!r.ok) return null;
        const csv = await r.text();
        return parseStooqCsv(csv);
      } catch {
        return null;
      }
    };

    try {
      // CoinGecko + er-api + Fear&Greed — CORS 허용, 직접 호출
      const cryptoPromise = fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true')
        .then(r => r.ok ? r.json() : null).catch(() => null);
      const fxPromise = fetch('https://open.er-api.com/v6/latest/USD')
        .then(r => r.ok ? r.json() : null).catch(() => null);
      // CNN Fear & Greed (전체 주식시장 기준) — 프록시 경유 (CORS 차단)
      // 2년치 히스토리: /cnn-fng/YYYY-MM-DD
      const fgFrom = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 2)
        .toISOString().slice(0, 10);
      const fgPromise = fetch(`${FRED_PROXY}/cnn-fng/${fgFrom}`)
        .then(r => r.ok ? r.json() : null).catch(() => null);

      // Stooq는 프록시 경유로 전부 병렬
      const stooqSyms = Object.keys(STOOQ_MAP);
      const stooqPromises = stooqSyms.map(s => fetchStooq(s));

      const [crypto, fx, fearGreed, ...stooqResults] = await Promise.all([
        cryptoPromise, fxPromise, fgPromise, ...stooqPromises,
      ]);

      // Stooq 결과 정리
      const stooq = {};
      stooqSyms.forEach((sym, i) => {
        if (stooqResults[i]) stooq[STOOQ_MAP[sym]] = stooqResults[i];
      });
      console.log(`[STOOQ] ${Object.keys(stooq).length}개 성공:`, Object.keys(stooq).join(', '));

      // CNN Fear & Greed 파싱
      // 응답: { fear_and_greed: {score}, fear_and_greed_historical: {data:[...]} }
      // historical 항목 키는 {x,y} 또는 {timestamp,value} 둘 다 대응
      let fgParsed = null;
      const fgHist = fearGreed?.fear_and_greed_historical?.data;
      if (Array.isArray(fgHist) && fgHist.length >= 2) {
        // 일별 데이터 → 월말값으로 다운샘플 (차트 60개월용)
        const byMonth = {};
        fgHist.forEach(d => {
          // CNN은 {x, y} 형태가 일반적이나, {timestamp, value}도 방어
          const ts = d?.x != null ? d.x : d?.timestamp;
          const val = d?.y != null ? d.y : d?.value;
          if (ts == null || val == null) return;
          const key = new Date(ts).toISOString().slice(0, 7); // YYYY-MM
          byMonth[key] = Math.round(val); // 같은 달이면 마지막(최신)값으로 덮어씀
        });
        const months = Object.keys(byMonth).sort();
        const chrono = months.map(m => byMonth[m]);
        if (chrono.length >= 2) {
          // 최신 현재값은 fear_and_greed.score 우선
          const latest = fearGreed?.fear_and_greed?.score != null
            ? Math.round(fearGreed.fear_and_greed.score)
            : chrono[chrono.length - 1];
          chrono[chrono.length - 1] = latest;
          const series = chrono.slice(-60).map((v, i) => ({ i, v }));
          fgParsed = {
            value: latest,
            delta: chrono.length >= 2 ? latest - chrono[chrono.length - 2] : 0,
            series,
          };
        }
      }

      const newData = {
        btc: crypto?.bitcoin ? { price: crypto.bitcoin.usd, change: crypto.bitcoin.usd_24h_change } : null,
        eth: crypto?.ethereum ? { price: crypto.ethereum.usd, change: crypto.ethereum.usd_24h_change } : null,
        sol: crypto?.solana ? { price: crypto.solana.usd, change: crypto.solana.usd_24h_change } : null,
        usdkrw: fx?.rates?.KRW,
        usdjpy: fx?.rates?.JPY,
        eurusd: fx?.rates?.EUR ? 1 / fx.rates.EUR : null,
        fearGreed: fgParsed,
        stooq,
      };

      setData(newData);
      setLastUpdate(new Date());
      onUpdate?.(newData);

      if (!crypto && !fx && Object.keys(stooq).length === 0) setError(true);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  const fmtTime = (d) => {
    if (!d) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const items = [
    { label: 'BTC', value: data.btc ? `$${(data.btc.price/1000).toFixed(1)}k` : '–', change: data.btc?.change },
    { label: 'ETH', value: data.eth ? `$${data.eth.price.toFixed(0)}` : '–', change: data.eth?.change },
    { label: 'SOL', value: data.sol ? `$${data.sol.price.toFixed(1)}` : '–', change: data.sol?.change },
    { label: 'USD/KRW', value: data.usdkrw ? `₩${data.usdkrw.toFixed(0)}` : '–' },
    { label: 'USD/JPY', value: data.usdjpy ? `¥${data.usdjpy.toFixed(2)}` : '–' },
    { label: 'EUR/USD', value: data.eurusd ? data.eurusd.toFixed(4) : '–' },
    { label: 'F&G', value: data.fearGreed ? String(data.fearGreed.value) : '–', change: data.fearGreed?.delta },
  ];

  return (
    <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)' }}>
      <div className="px-3 py-2 flex items-center gap-3">
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`w-1.5 h-1.5 rounded-full ${loading ? 'animate-pulse' : ''}`}
            style={{
              background: error ? '#f87171' : loading ? '#fbbf24' : '#34d399',
              boxShadow: error ? 'none' : `0 0 6px ${loading ? '#fbbf24' : '#34d399'}`,
            }}
          ></span>
          <span className="text-[9px] font-mono whitespace-nowrap" style={{ color: '#7a7a85' }}>
            {error ? 'OFFLINE' : loading ? 'LOAD' : `${fmtTime(lastUpdate)}`}
          </span>
        </div>

        <div
          className="flex gap-3 overflow-x-auto flex-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style>{`.live-tick::-webkit-scrollbar{display:none}`}</style>
          <div className="flex gap-3 live-tick">
            {items.map((it, i) => (
              <div key={i} className="flex items-baseline gap-1 shrink-0">
                <span className="text-[9.5px] font-mono" style={{ color: '#5a5a64' }}>{it.label}</span>
                <span className="text-[11px] font-mono font-semibold text-white whitespace-nowrap">{it.value}</span>
                {it.change != null && !isNaN(it.change) && (
                  <span className="text-[9.5px] font-mono" style={{ color: it.change >= 0 ? '#34d399' : '#f87171' }}>
                    {it.change >= 0 ? '+' : ''}{it.change.toFixed(2)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="shrink-0 active:opacity-60 p-1"
          title="새로고침"
        >
          <RefreshCw size={11} style={{ color: '#7a7a85' }} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  );
};

const fmt = (v, u) => {
  if (typeof v !== 'number') return v;
  if (u === '$' && v >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (u === '$') return '$' + v.toFixed(2);
  if (Math.abs(v) >= 10000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 100) return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return v.toFixed(2);
};

// 신호 점수 계산 — 유동성 환경 4대 핵심 지표
const calcRegime = () => {
  let bullCount = 0;
  const checks = [
    M.globalLiq.delta > 0,   // 글로벌 유동성 확장
    M.netLiq.delta > 0,      // 순유동성 증가
    M.realRate.delta < 0,    // 실질금리 하락
    M.hyOas.delta < 0,       // 신용 스프레드 타이트닝
  ];
  bullCount = checks.filter(Boolean).length;
  if (bullCount >= 3) return { label: '매수', en: 'RISK-ON', color: C.pos, bg: C.posBg, border: C.posBorder, count: bullCount,
    text: `유동성 환경이 위험자산에 우호적이다. 4개 핵심 지표 중 ${bullCount}개가 매수 신호 — 글로벌 유동성 ${M.globalLiq.delta > 0 ? '확장' : '위축'}, 순유동성 ${M.netLiq.delta > 0 ? '증가' : '감소'}, 실질금리 ${M.realRate.delta < 0 ? '하락' : '상승'}, HY 스프레드 ${Math.round(M.hyOas.value)}bp. 유동성 확장 + 실질금리 하락 조합은 위험자산에 우호적인 국면이다.` };
  if (bullCount <= 1) return { label: '매도', en: 'RISK-OFF', color: C.neg, bg: C.negBg, border: C.negBorder, count: bullCount,
    text: `4개 핵심 유동성 지표 중 매수 신호가 ${bullCount}개뿐이다. 유동성 위축 + 실질금리 상승 조합은 역사적으로 위험자산 약세 구간과 일치했다. 방어적 포지션 권장.` };
  return { label: '중립', en: 'NEUTRAL', color: C.warn, bg: C.warnBg, border: C.warnBorder, count: bullCount,
    text: '유동성 지표가 혼조 상태. 일부는 우호적이나 일부는 비우호적이라 명확한 방향성을 단정짓기 어려운 구간. 추가 신호 확인 필요.' };
};

// 현재 매크로 상태에서 알림 후보 추출 (임계값 기반)
const calcAlerts = (regime) => {
  const alerts = [];

  // 1. 레짐 알림
  if (regime.en === 'RISK-OFF') {
    alerts.push({ severity: 'high', title: '위험회피 국면', desc: '매크로 환경이 위험자산에 비우호적. 방어 포지션 권장.', metric: null });
  } else if (regime.en === 'NEUTRAL') {
    alerts.push({ severity: 'med', title: '중립 국면', desc: '매크로 신호 혼조. 추가 시그널 확인 필요.', metric: null });
  }

  // 2. 임계값 알림
  if (M.vix.value > 30) {
    alerts.push({ severity: 'high', title: 'VIX 공포 영역', desc: `VIX ${M.vix.value}로 30 돌파. 변동성 확대 국면.`, metric: 'vix' });
  } else if (M.vix.value > 25) {
    alerts.push({ severity: 'med', title: 'VIX 상승', desc: `VIX ${M.vix.value}로 25 돌파. 시장 불안 신호.`, metric: 'vix' });
  }

  if (M.fearGreed.value > 80) {
    alerts.push({ severity: 'med', title: '공포·탐욕 극탐욕', desc: `공포·탐욕 지수 ${M.fearGreed.value}로 극탐욕 진입. 단기 과열 가능.`, metric: 'fearGreed' });
  } else if (M.fearGreed.value < 25) {
    alerts.push({ severity: 'med', title: '공포·탐욕 극공포', desc: `공포·탐욕 지수 ${M.fearGreed.value}로 극공포. 역사적 매수 기회 영역.`, metric: 'fearGreed' });
  }

  if (M.hyOas.value > 500) {
    alerts.push({ severity: 'high', title: 'HY 스프레드 위험', desc: `HY ${Math.round(M.hyOas.value)}bp로 500 돌파. 신용 위험 경계.`, metric: 'hyOas' });
  }

  if (M.realRate.value > 3) {
    alerts.push({ severity: 'med', title: '실질금리 부담', desc: `실질금리 ${M.realRate.value}%로 3% 돌파. 위험자산 부담 영역.`, metric: 'realRate' });
  }

  if (M.dxy.value > 110) {
    alerts.push({ severity: 'med', title: '달러 강세', desc: `DXY ${M.dxy.value}로 110 돌파. 신흥국·위험자산 압박.`, metric: 'dxy' });
  }

  // 3. 자산 일변동 급변
  if (Math.abs(M.spx.delta) >= 2.5) {
    alerts.push({
      severity: M.spx.delta > 0 ? 'good' : 'high',
      title: M.spx.delta > 0 ? 'S&P 급등' : 'S&P 급락',
      desc: `S&P 500 ${M.spx.delta > 0 ? '+' : ''}${M.spx.delta}% 일변동.`,
      metric: 'spx'
    });
  }

  if (Math.abs(M.nasdaq.delta) >= 3) {
    alerts.push({
      severity: M.nasdaq.delta > 0 ? 'good' : 'high',
      title: M.nasdaq.delta > 0 ? 'NASDAQ 급등' : 'NASDAQ 급락',
      desc: `NASDAQ ${M.nasdaq.delta > 0 ? '+' : ''}${M.nasdaq.delta}% 일변동.`,
      metric: 'nasdaq'
    });
  }

  // 4. 긍정 시그널
  if (M.realRate.delta <= -0.2 && regime.en === 'RISK-ON') {
    alerts.push({ severity: 'good', title: '유동성 환경 개선', desc: `실질금리 ${M.realRate.delta}pp 하락. 위험자산 우호 강화.`, metric: 'realRate' });
  }

  if (M.netLiq.delta >= 0.2) {
    alerts.push({ severity: 'good', title: '순유동성 확장', desc: `순유동성 +${M.netLiq.delta}T$ 증가. 시장 자금 유입.`, metric: 'netLiq' });
  }

  return alerts;
};

// 과거 시점의 시그널 시뮬레이션 (6개월 모멘텀 기반)
const SignalPill = ({ label, value, signal, sub }) => (
  <div className="rounded-2xl px-3 py-3.5 border" style={{ background: sbg(signal), borderColor: sbd(signal) }}>
    <div className="text-[10px] text-[#a8a8b3] mb-1">{label}</div>
    <div className="text-[15px] font-bold leading-none mb-0.5" style={{ color: sc(signal) }}>{value}</div>
    {sub && <div className="text-[9px] mt-1" style={{ color: sc(signal), opacity: 0.7 }}>{sub}</div>}
  </div>
);

const Spark = ({ data, signal }) => {
  const c = sc(signal);
  const id = `s-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity={0.4} />
            <stop offset="100%" stopColor={c} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={c} strokeWidth={1.3} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

// 메인 지표 카드 (설명 포함)
const NarrativeCard = ({ m }) => {
  const c = sc(m.signal);
  const up = m.delta > 0;
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [hasNote, setHasNote] = useState(false);

  // 메모 유무 확인 (있으면 자동 펼침)
  useEffect(() => {
    if (!m._key) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await window.storage.get(`note:${m._key}`);
        if (!cancelled && r?.value && r.value.trim()) {
          setHasNote(true);
          setNoteExpanded(true);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [m._key]);

  return (
    <div className="rounded-2xl p-4 border" style={{ background: 'rgba(255,255,255,0.025)', borderColor: sbd(m.signal) }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-white mb-0.5 flex items-center gap-1.5">
            <span className="truncate">{m.name}</span>
            {m._live && (
              <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                <span className="w-1 h-1 rounded-full" style={{ background: '#34d399', boxShadow: '0 0 4px #34d399' }}></span>
                LIVE
              </span>
            )}
            {m._mock && (
              <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(150,150,160,0.1)', color: '#8a8a92', border: '1px solid rgba(150,150,160,0.25)' }}>
                참고용
              </span>
            )}
          </div>
          <div className="text-[11px]" style={{ color: '#7a7a85' }}>{m.ref}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[22px] font-bold leading-none tabular-nums" style={{ color: c }}>
            {fmt(m.value, m.unit)}{m.unit && m.unit !== '$' ? <span className="text-[13px] ml-0.5">{m.unit}</span> : ''}
          </div>
          <div className="text-[11px] font-mono mt-1" style={{ color: c }}>{up ? '+' : ''}{m.delta}{typeof m.delta === 'number' && m.unit === '%' ? 'pp' : ''}</div>
        </div>
      </div>
      <div className="mb-3 -mx-1">
        <BigChart data={m.series} signal={m.signal} favor={m.favor} unit={m.unit} />
      </div>
      {m.story && (
        <p className="text-[12.5px] leading-relaxed" style={{ color: '#c0c0c8' }}>{m.story}</p>
      )}
      {m._key && <AIAnalysis metric={m} />}
      {m._key && (
        <div className="mt-3">
          {noteExpanded ? (
            <NotePanel metricKey={m._key} />
          ) : (
            <button
              onClick={() => setNoteExpanded(true)}
              className="w-full rounded-xl border py-2.5 text-[11px] active:opacity-60 flex items-center justify-center gap-1.5 transition-colors"
              style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)', color: '#7a7a85' }}
            >
              <span>📝</span>
              <span>{hasNote ? '내 메모 보기' : '메모 추가'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// 컴팩트 그리드 카드 (설명 없음)
// 모달 트리거 컨텍스트 (CompactCard에서 자유롭게 호출 가능하도록)
const ModalContext = React.createContext(null);

const CompactCard = ({ m }) => {
  const setModal = React.useContext(ModalContext);
  const c = sc(m.signal);
  const up = m.delta > 0;
  return (
    <button
      onClick={() => setModal?.(m)}
      className="card-tap rounded-xl p-3 border text-left active:bg-[#101013] w-full"
      style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="text-[11px] text-[#a8a8b3] truncate flex items-center gap-1">
          {m._live && (
            <span className="w-1 h-1 rounded-full shrink-0" style={{ background: '#34d399', boxShadow: '0 0 4px #34d399' }} title="실시간 데이터"></span>
          )}
          {m._mock && (
            <span className="w-1 h-1 rounded-full shrink-0" style={{ background: '#6a6a72' }} title="참고용 데이터 (실시간 아님)"></span>
          )}
          <span className="truncate">{m.name}</span>
        </div>
        <span className="text-[10px] font-mono shrink-0" style={{ color: c }}>{up ? '+' : ''}{m.delta}</span>
      </div>
      <div className="text-[16px] font-bold text-white tabular-nums mb-1.5 leading-none">
        {fmt(m.value, m.unit)}
        {m.unit && m.unit !== '$' && <span className="text-[10px] text-[#7a7a85] ml-0.5 font-normal">{m.unit}</span>}
      </div>
      <Spark data={m.series} signal={m.signal} />
    </button>
  );
};

// 컴팩트 카드 탭 시 열리는 상세 bottom sheet
// 사용자 메모: 각 지표에 개인 메모 첨부 (디바운스 자동 저장)
const NotePanel = ({ metricKey }) => {
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const saveTimerRef = React.useRef(null);
  const storageKey = `note:${metricKey}`;

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setNote('');
    (async () => {
      try {
        const result = await window.storage.get(storageKey);
        if (!cancelled && result?.value) {
          setNote(result.value);
        }
      } catch {}
      finally { if (!cancelled) setLoaded(true); }
    })();
    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [storageKey]);

  const handleChange = (e) => {
    const v = e.target.value;
    setNote(v);
    setSaved(false);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        if (v.trim()) {
          await window.storage.set(storageKey, v);
        } else {
          await window.storage.delete(storageKey);
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      } catch {}
    }, 800);
  };

  return (
    <div className="rounded-2xl border p-3" style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: '#a8a8b3' }}>
          <span>📝</span>
          <span>내 메모</span>
        </div>
        {saved && (
          <span className="text-[9px] flex items-center gap-1" style={{ color: '#34d399' }}>✓ 저장됨</span>
        )}
      </div>
      <textarea
        value={note}
        onChange={handleChange}
        placeholder="이 지표에 대한 생각, 매매 전략, 관찰 등을 자유롭게 메모하세요..."
        rows={3}
        className="w-full rounded-lg px-3 py-2 text-[12px] outline-none resize-none leading-relaxed"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: '#e0e0e8',
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
};

const MetricModal = ({ metric, onClose }) => {
  const [chartFull, setChartFull] = useState(false);
  if (!metric) return null;
  const c = sc(metric.signal);
  const up = metric.delta > 0;

  // 풀스크린 차트 오버레이 (가로 모드 큰 차트)
  if (chartFull) {
    return (
      <div
        className="fixed inset-0 z-[60] flex flex-col"
        style={{ background: '#0a0a0e' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-white truncate flex items-center gap-1.5">
              <span className="truncate">{metric.name}</span>
              {metric._live && (
                <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                  <span className="w-1 h-1 rounded-full" style={{ background: '#34d399', boxShadow: '0 0 4px #34d399' }}></span>
                  LIVE
                </span>
              )}
              {metric._mock && (
                <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(150,150,160,0.1)', color: '#8a8a92', border: '1px solid rgba(150,150,160,0.25)' }}>
                  참고용
                </span>
              )}
            </div>
            <div className="text-[11px] mt-0.5 flex items-baseline gap-2">
              <span style={{ color: c }} className="font-semibold">{fmt(metric.value, metric.unit)}{metric.unit && metric.unit !== '$' ? metric.unit : ''}</span>
              <span style={{ color: c }} className="font-mono text-[10px]">{up ? '+' : ''}{metric.delta}{metric.unit === '%' ? 'pp' : ''}</span>
            </div>
          </div>
          <button onClick={() => setChartFull(false)} className="active:opacity-60 px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.06)', color: '#a8a8b3' }}>
            <X size={14} />
            <span>닫기</span>
          </button>
        </div>
        <div className="flex-1 px-3 py-4 overflow-y-auto">
          <BigChart data={metric.series} signal={metric.signal} favor={metric.favor} unit={metric.unit} fullscreen />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full overflow-y-auto rounded-t-3xl border-t"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0a0a0e',
          borderColor: 'rgba(255,255,255,0.08)',
          maxHeight: '92vh',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          animation: 'sheetUp 0.25s ease-out',
        }}
      >
        <style>{`@keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

        {/* 핸들 바 */}
        <div className="flex justify-center pt-2.5 pb-1.5">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }} />
        </div>

        {/* 헤더 */}
        <div className="flex items-start justify-between px-4 pt-1 pb-2">
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold text-white truncate flex items-center gap-1.5">
              <span className="truncate">{metric.name}</span>
              {metric._live && (
                <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                  <span className="w-1 h-1 rounded-full" style={{ background: '#34d399', boxShadow: '0 0 4px #34d399' }}></span>
                  LIVE
                </span>
              )}
              {metric._mock && (
                <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(150,150,160,0.1)', color: '#8a8a92', border: '1px solid rgba(150,150,160,0.25)' }}>
                  참고용
                </span>
              )}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: '#7a7a85' }}>{metric.ref}</div>
          </div>
          <button onClick={onClose} className="active:opacity-60 p-1.5 -mr-1.5 -mt-1.5">
            <X size={20} style={{ color: '#a8a8b3' }} />
          </button>
        </div>

        {/* 현재 값 + 변화 */}
        <div className="px-4 pb-3 flex items-baseline gap-2.5">
          <span className="text-[28px] font-bold tabular-nums leading-none" style={{ color: c }}>
            {fmt(metric.value, metric.unit)}
          </span>
          {metric.unit && metric.unit !== '$' && (
            <span className="text-[13px]" style={{ color: '#7a7a85' }}>{metric.unit}</span>
          )}
          <span className="text-[13px] font-mono ml-auto" style={{ color: c }}>
            {up ? '+' : ''}{metric.delta}{metric.unit === '%' ? 'pp' : ''}
          </span>
        </div>

        {/* 차트 + 풀스크린 버튼 */}
        <div className="px-3 pb-3">
          <div className="flex justify-end mb-1">
            <button
              onClick={() => setChartFull(true)}
              className="text-[10px] px-2 py-1 rounded-md flex items-center gap-1 active:opacity-60"
              style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}
            >
              <span style={{ fontSize: 11 }}>⛶</span>
              <span>크게 보기</span>
            </button>
          </div>
          <BigChart data={metric.series} signal={metric.signal} favor={metric.favor} unit={metric.unit} />
        </div>

        {/* mock 데이터 안내 */}
        {metric._mock && (
          <div className="px-4 pb-3">
            <div className="text-[11px] leading-relaxed rounded-lg px-3 py-2" style={{ background: 'rgba(150,150,160,0.07)', color: '#8a8a92', border: '1px solid rgba(150,150,160,0.15)' }}>
              이 지표는 무료 실시간 데이터 소스가 없어 참고용 시뮬레이션 값입니다. 추세 판단의 보조 지표로만 활용하세요.
            </div>
          </div>
        )}

        {/* 스토리 */}
        {metric.story && (
          <div className="px-4 pb-3">
            <p className="text-[12.5px] leading-relaxed" style={{ color: '#c0c0c8' }}>{metric.story}</p>
          </div>
        )}

        {/* AI 분석 */}
        {metric._key && (
          <div className="px-3 pb-3">
            <AIAnalysis metric={metric} />
          </div>
        )}

        {/* 사용자 메모 */}
        {metric._key && (
          <div className="px-3 pb-4">
            <NotePanel metricKey={metric._key} />
          </div>
        )}
      </div>
    </div>
  );
};

// 알림 센터: 헤더 종 아이콘 + 알림 목록 모달
const AlertCenter = ({ alerts }) => {
  const [open, setOpen] = useState(false);
  const setModal = React.useContext(ModalContext);

  const highCount = alerts.filter(a => a.severity === 'high').length;
  const goodCount = alerts.filter(a => a.severity === 'good').length;
  const hasAlerts = alerts.length > 0;
  const dotColor = highCount > 0 ? '#f87171' : alerts.some(a => a.severity === 'med') ? '#fb923c' : '#34d399';

  return (
    <>
      <button onClick={() => setOpen(true)} className="relative active:opacity-60 p-1.5 -mr-1.5">
        <Bell size={17} style={{ color: hasAlerts ? '#fb923c' : '#7a7a85' }} fill={hasAlerts ? 'rgba(251,146,60,0.15)' : 'none'} />
        {hasAlerts && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[8.5px] font-bold flex items-center justify-center"
            style={{ background: dotColor, color: '#fff', boxShadow: '0 0 0 2px rgba(10,10,14,1)' }}
          >
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-3"
          onClick={() => setOpen(false)}
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border overflow-y-auto"
            style={{
              background: '#0a0a0e',
              borderColor: 'rgba(255,255,255,0.08)',
              maxHeight: '85vh',
              animation: 'sheetUp 0.2s ease-out',
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <Bell size={14} style={{ color: '#fb923c' }} />
                <span className="text-[13px] font-semibold text-white">매크로 알림</span>
                <span className="text-[10px] font-mono" style={{ color: '#7a7a85' }}>{alerts.length}건</span>
              </div>
              <button onClick={() => setOpen(false)} className="active:opacity-60 p-1 -mr-1">
                <X size={18} style={{ color: '#a8a8b3' }} />
              </button>
            </div>

            <div className="p-3 space-y-2">
              {alerts.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell size={28} className="mx-auto mb-3 opacity-40" style={{ color: '#3a3a44' }} />
                  <p className="text-[12px]" style={{ color: '#7a7a85' }}>활성 알림 없음</p>
                  <p className="text-[10px] mt-1" style={{ color: '#5a5a64' }}>매크로 환경이 안정적입니다</p>
                </div>
              ) : (
                <>
                  {highCount > 0 && (
                    <div className="text-[9px] font-mono uppercase tracking-wider px-1 mb-1" style={{ color: '#f87171' }}>
                      ⚠ 위험 {highCount}건
                    </div>
                  )}
                  {alerts.map((alert, i) => {
                    const color = alert.severity === 'high' ? '#f87171'
                      : alert.severity === 'med' ? '#fb923c'
                      : alert.severity === 'good' ? '#34d399'
                      : '#7a7a85';
                    const bg = alert.severity === 'high' ? 'rgba(248,113,113,0.07)'
                      : alert.severity === 'med' ? 'rgba(251,146,60,0.06)'
                      : alert.severity === 'good' ? 'rgba(52,211,153,0.06)'
                      : 'rgba(255,255,255,0.02)';
                    const tag = alert.severity === 'high' ? '위험'
                      : alert.severity === 'med' ? '경계'
                      : alert.severity === 'good' ? '기회'
                      : '정보';
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          if (alert.metric && M[alert.metric]) {
                            setOpen(false);
                            setModal?.(M[alert.metric]);
                          }
                        }}
                        className="w-full text-left rounded-xl p-3 border active:opacity-70 transition-opacity flex items-start gap-2.5"
                        style={{ background: bg, borderColor: `${color}40` }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}` }}></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[12px] font-semibold" style={{ color }}>{alert.title}</span>
                            <span className="text-[8.5px] font-mono px-1 rounded" style={{ background: `${color}15`, color }}>{tag}</span>
                          </div>
                          <p className="text-[11px] leading-relaxed" style={{ color: '#c0c0c8' }}>{alert.desc}</p>
                        </div>
                        {alert.metric && (
                          <ChevronRight size={13} style={{ color: '#5a5a64', marginTop: 3 }} className="shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const SectionTitle = ({ emoji, title, sub }) => (
  <div className="flex items-center gap-2 mt-7 mb-3 px-1">
    <span className="text-base">{emoji}</span>
    <div>
      <h2 className="text-[15px] font-bold text-white leading-tight">{title}</h2>
      {sub && <div className="text-[11px] text-[#7a7a85] mt-0.5">{sub}</div>}
    </div>
  </div>
);

// 에러 경계: 한 컴포넌트가 깨져도 다른 부분은 정상 작동하도록 격리
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.name || '', error, info);
  }
  reset = () => this.setState({ hasError: false, error: null });
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl p-3.5 border my-2" style={{ background: 'rgba(248,113,113,0.04)', borderColor: 'rgba(248,113,113,0.25)' }}>
          <div className="flex items-start gap-2.5">
            <span className="text-[16px] mt-0.5">⚠️</span>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold mb-1" style={{ color: '#f87171' }}>
                {this.props.name ? `${this.props.name} 표시 오류` : '이 섹션을 표시할 수 없습니다'}
              </div>
              <p className="text-[10.5px] mb-2 break-words" style={{ color: '#a8a8b3' }}>
                {this.state.error?.message || '알 수 없는 오류'}
              </p>
              <button
                onClick={this.reset}
                className="text-[10px] active:opacity-60 px-2 py-1 rounded-full btn-tap"
                style={{ color: '#60a5fa', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)' }}
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// PWA 메타: 홈 화면 추가, 풀스크린, 상태바 컬러 (단일 JSX 안에서 동적 주입)
const PWAMeta = () => {
  useEffect(() => {
    const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1a1a24"/><stop offset="100%" stop-color="#0a0a0e"/></linearGradient><linearGradient id="line" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#34d399"/></linearGradient></defs><rect width="192" height="192" rx="42" fill="url(#bg)"/><rect x="32" y="32" width="128" height="128" rx="20" fill="none" stroke="#ffffff" stroke-opacity="0.05" stroke-width="2"/><path d="M 48 130 L 72 115 L 96 125 L 120 80 L 144 90 L 160 55" stroke="url(#line)" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="160" cy="55" r="14" fill="#34d399" fill-opacity="0.25"/><circle cx="160" cy="55" r="9" fill="#34d399"/></svg>`;
    const iconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(iconSvg)}`;

    const setMeta = (name, content, useProperty = false) => {
      const attr = useProperty ? 'property' : 'name';
      let m = document.querySelector(`meta[${attr}="${name}"]`);
      if (!m) {
        m = document.createElement('meta');
        m.setAttribute(attr, name);
        document.head.appendChild(m);
      }
      m.setAttribute('content', content);
    };

    const setLink = (rel, href, sizes) => {
      const selector = sizes ? `link[rel="${rel}"][sizes="${sizes}"]` : `link[rel="${rel}"]`;
      let l = document.querySelector(selector);
      if (!l) {
        l = document.createElement('link');
        l.setAttribute('rel', rel);
        if (sizes) l.setAttribute('sizes', sizes);
        document.head.appendChild(l);
      }
      l.setAttribute('href', href);
      if (rel === 'icon') l.setAttribute('type', 'image/svg+xml');
    };

    // 기본 메타
    setMeta('theme-color', '#0a0a0e');
    setMeta('color-scheme', 'dark');
    setMeta('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no');
    setMeta('description', '글로벌 유동성 기반 매크로 투자 분석 대시보드');

    // iOS PWA
    setMeta('apple-mobile-web-app-capable', 'yes');
    setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
    setMeta('apple-mobile-web-app-title', '매크로');
    setMeta('mobile-web-app-capable', 'yes');
    setMeta('format-detection', 'telephone=no');

    // OG
    setMeta('og:title', '매크로 유동성', true);
    setMeta('og:description', '글로벌 유동성 기반 매크로 투자 분석', true);
    setMeta('og:type', 'website', true);

    // 페이지 타이틀
    const origTitle = document.title;
    document.title = '매크로 유동성';

    // 아이콘
    setLink('icon', iconUrl);
    setLink('apple-touch-icon', iconUrl);

    // 매니페스트 동적 생성
    const manifest = {
      name: '매크로 유동성 대시보드',
      short_name: '매크로',
      description: '글로벌 유동성 기반 매크로 투자 분석',
      start_url: '.',
      scope: '.',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#0a0a0e',
      theme_color: '#0a0a0e',
      categories: ['finance', 'productivity'],
      icons: [
        { src: iconUrl, sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
      ],
    };
    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    setLink('manifest', manifestUrl);

    return () => {
      document.title = origTitle;
      // manifest blob URL은 페이지 라이프타임 동안 유지
    };
  }, []);

  return null;
};

// ============ APP ============
export default function App() {
  const [tab, setTab] = useState('home');
  const [, setTick] = useState(0);
  const [modalMetric, setModalMetric] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [fredKey, setFredKey] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null); // null | { type: 'loading' | 'done' | 'error', msg: string }

  // 모든 실시간 데이터 + FRED 동시 새로고침
  const handleGlobalRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setToast({ type: 'loading', msg: '데이터 갱신 중' });
    setRefreshKey(k => k + 1);
    setTimeout(() => {
      setRefreshing(false);
      setToast({ type: 'done', msg: '갱신 완료' });
      setTimeout(() => setToast(null), 1400);
    }, 1500);
  };
  const regime = calcRegime();
  const alerts = calcAlerts(regime);

  // 포트폴리오 storage 로드 (ChatBot 컨텍스트용)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await window.storage.get('portfolio:allocations');
        if (!cancelled && result?.value) {
          const data = JSON.parse(result.value);
          setPortfolio(data.allocations || data);
        }
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, []);

  // FRED 키 storage 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await window.storage.get('settings:fredKey');
        if (!cancelled && result?.value) {
          setFredKey(result.value);
        }
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, []);

  // FRED 캐시 로드 — 새로고침/페이지 이동 후 즉시 마지막 실데이터 복원
  // (fetch 완료 전까지 mock 대신 캐시값 표시 → "수치 틀어짐" 방지)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await window.storage.get('fred:cache');
        if (cancelled || !result?.value) return;
        const cached = JSON.parse(result.value);
        if (!cached || !cached.data) return;
        let applied = 0;
        Object.entries(cached.data).forEach(([k, v]) => {
          if (k.startsWith('_') || !M[k] || !v || isNaN(v.value)) return;
          M[k].value = v.value;
          if (v.change != null && !isNaN(v.change)) M[k].delta = v.change;
          if (v.series && v.series.length > 0) M[k].series = v.series;
          if (v.signal) M[k].signal = v.signal;
          M[k]._live = true;
          if (M[k]._mock) M[k]._mock = false;
          applied++;
        });
        if (applied > 0) {
          setTick(t => t + 1);
          console.log(`[FRED] 캐시 ${applied}개 복원 (갱신 대기 중)`);
        }
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, []);

  // FRED 키 있으면 자동 fetch → M 객체 value/delta/series 전체 교체
  // fredKey 로드 시 + 새로고침 버튼(refreshKey) 누를 때마다 실행
  useEffect(() => {
    if (!fredKey) return;
    let cancelled = false;
    (async () => {
      // 매번 프록시 상태 재확인 (사용자가 중간에 프록시 켰을 수 있음)
      _fredProxyAlive = null;
      const data = await fetchAllFred(fredKey);
      if (cancelled) return;

      // 프록시가 안 켜져 있는 경우 — 사용자에게 안내
      if (data._proxyAlive === false) {
        setToast({
          type: 'error',
          msg: 'FRED 프록시 미실행 (fred-proxy.js 필요)',
        });
        setTimeout(() => setToast(null), 3500);
        return;
      }

      let updatedCount = 0;
      const skipped = [];
      Object.entries(data).forEach(([k, v]) => {
        // 메타키(_proxyAlive, _updatedKeys) 건너뛰기
        if (k.startsWith('_')) return;
        if (!M[k]) { skipped.push(`${k}(M키없음)`); return; }
        if (!v) { skipped.push(`${k}(데이터없음)`); return; }
        if (isNaN(v.value)) { skipped.push(`${k}(값NaN)`); return; }
        M[k].value = v.value;
        if (v.change != null && !isNaN(v.change)) {
          M[k].delta = v.change;
        }
        // 시계열 전체 교체 (mock → 실데이터 60개월)
        if (v.series && v.series.length > 0) {
          M[k].series = v.series;
        }
        // 추세 기반 signal 재평가 (최근 6개월 평균 vs 그 전 6개월)
        if (v.series && v.series.length >= 12) {
          const recent = v.series.slice(-6).reduce((s, p) => s + p.v, 0) / 6;
          const earlier = v.series.slice(-12, -6).reduce((s, p) => s + p.v, 0) / 6;
          const diff = recent - earlier;
          const threshold = Math.abs(earlier) * 0.02;
          if (Math.abs(diff) < threshold) {
            M[k].signal = 'neu';
          } else {
            const trendUp = diff > 0;
            const favor = M[k].favor;
            const aligned = (favor === 'up' && trendUp) || (favor === 'down' && !trendUp);
            M[k].signal = aligned ? 'pos' : 'neg';
          }
        }
        // 실데이터 플래그 (UI 인디케이터용)
        M[k]._live = true;
        updatedCount++;
      });

      // 주요 지표 설명(story)을 실제 값 기반으로 동적 생성 (mock 텍스트 교체)
      const fmt1 = (v) => (v == null || isNaN(v)) ? '–' : (+v).toFixed(1);
      const fmt2 = (v) => (v == null || isNaN(v)) ? '–' : (+v).toFixed(2);
      const dir = (d) => d > 0 ? '상승' : d < 0 ? '하락' : '횡보';
      try {
        if (M.globalLiq?._live) {
          const v = M.globalLiq.value, d = M.globalLiq.delta;
          M.globalLiq.story = `Fed·ECB·BOJ 3대 중앙은행 자산을 달러로 환산해 합산한 글로벌 유동성 ${fmt1(v)}조$. 직전 대비 ${d>0?'+':''}${fmt2(d)}조$로 ${dir(d)} 중. 유동성 확장은 위험자산에 우호적, 축소는 비우호적 신호다. (중국 PBoC는 FRED 미제공으로 제외)`;
        }
        if (M.netLiq?._live) {
          const v = M.netLiq.value, d = M.netLiq.delta;
          M.netLiq.story = `순유동성(Fed 총자산 − RRP − TGA) ${fmt2(v)}조$. 직전 대비 ${d>0?'+':''}${fmt2(d)}조$ ${dir(d)}. 시장에 실제로 풀린 유동성을 측정하며, BTC·나스닥과 상관관계가 높다. 증가 시 강세장 우호.`;
        }
        if (M.realRate?._live) {
          const v = M.realRate.value, d = M.realRate.delta;
          M.realRate.story = `실질금리(10년물 − 기대인플레) ${fmt2(v)}%. 직전 대비 ${d>0?'+':''}${fmt2(d)}pp ${dir(d)}. 실질금리가 떨어지면 현금·채권의 기회비용이 커져 위험자산(주식·코인·금)으로 자금이 이동한다. 매크로에서 가장 중요한 단일 지표.`;
        }
        if (M.yieldCurve?._live) {
          const v = M.yieldCurve.value;
          M.yieldCurve.story = `10Y−2Y 스프레드 ${fmt2(v)}%p. ${v < 0 ? '역전 상태 — 역사적으로 6~18개월 내 경기침체 선행 신호.' : '정상(양수) — 역전에서 해소된 직후라면 침체 진입 가능성에 유의.'}`;
        }
        if (M.hyOas?._live) {
          const v = M.hyOas.value;
          M.hyOas.story = `하이일드 스프레드 ${Math.round(v)}bp. ${v < 300 ? '타이트한 수준 — 투자자들이 신용위험을 낮게 보고 위험선호가 강하다. 다만 과열 신호이기도 하다.' : v < 500 ? '중립 수준.' : '확대 — 신용 경계감이 커지고 있다.'}`;
        }
      } catch (e) {}

      // 디버그: FRED 매핑 키 중 out에 없는 것 + skip된 것
      const fredKeys = Object.keys(FRED_SERIES).filter(k => !FRED_SERIES[k]._internal);
      const missing = fredKeys.filter(k => !(k in data));
      if (missing.length > 0) console.log('[FRED] 응답 누락:', missing.join(', '));
      if (skipped.length > 0) console.log('[FRED] 반영 스킵:', skipped.join(', '));
      console.log(`[FRED] ${updatedCount}개 반영 완료`);
      if (updatedCount > 0) {
        setTick(t => t + 1);
        setToast({ type: 'done', msg: `FRED ${updatedCount}개 지표 갱신 완료` });
        setTimeout(() => setToast(null), 2200);
        // 캐시 저장 — 다음 새로고침 때 즉시 복원용
        try {
          const cacheData = {};
          Object.entries(data).forEach(([k, v]) => {
            if (k.startsWith('_') || !M[k]) return;
            cacheData[k] = {
              value: v.value, change: v.change,
              series: v.series, signal: M[k].signal,
            };
          });
          await window.storage.set('fred:cache', JSON.stringify({
            ts: Date.now(), data: cacheData,
          }));
        } catch (e) {}
      }
    })();
    return () => { cancelled = true; };
  }, [fredKey, refreshKey]);

  // LiveTicker가 실데이터 받아오면 M 객체에 반영 + 강제 리렌더
  const handleLiveUpdate = (live) => {
    let changed = false;

    // 추세 기반 signal 재평가 (FRED useEffect와 동일 로직)
    const reevalSignal = (mKey, series) => {
      if (!series || series.length < 12) return;
      const recent = series.slice(-6).reduce((s, p) => s + p.v, 0) / 6;
      const earlier = series.slice(-12, -6).reduce((s, p) => s + p.v, 0) / 6;
      const diff = recent - earlier;
      const threshold = Math.abs(earlier) * 0.02;
      if (Math.abs(diff) < threshold) {
        M[mKey].signal = 'neu';
      } else {
        const trendUp = diff > 0;
        const favor = M[mKey].favor;
        const aligned = (favor === 'up' && trendUp) || (favor === 'down' && !trendUp);
        M[mKey].signal = aligned ? 'pos' : 'neg';
      }
    };

    // 암호자산 (CoinGecko — 현재가만, 24h 변화)
    // 주의: btc/eth/sol 카드는 제거됨. M에 키가 있을 때만 갱신 (상단 티커용 잔존 대비)
    const updateCrypto = (mKey, item) => {
      if (!M[mKey] || item?.price == null) return false;
      const newPrice = mKey === 'btc' ? Math.round(item.price) : +item.price.toFixed(2);
      M[mKey].value = newPrice;
      if (item.change != null) M[mKey].delta = +item.change.toFixed(2);
      const lastIdx = M[mKey].series.length - 1;
      M[mKey].series = [...M[mKey].series.slice(0, lastIdx), { ...M[mKey].series[lastIdx], v: newPrice }];
      M[mKey]._live = true;
      return true;
    };
    if (updateCrypto('btc', live.btc)) changed = true;
    if (updateCrypto('eth', live.eth)) changed = true;
    if (updateCrypto('sol', live.sol)) changed = true;

    // 환율 (er-api — 현재가만)
    const updateFx = (mKey, val, round) => {
      if (val == null) return false;
      const newVal = round ? Math.round(val) : +val.toFixed(2);
      const oldVal = M[mKey].value;
      M[mKey].delta = +(newVal - oldVal).toFixed(2);
      M[mKey].value = newVal;
      const lastIdx = M[mKey].series.length - 1;
      M[mKey].series = [...M[mKey].series.slice(0, lastIdx), { ...M[mKey].series[lastIdx], v: newVal }];
      M[mKey]._live = true;
      return true;
    };
    if (updateFx('usdkrw', live.usdkrw, true)) changed = true;
    if (updateFx('usdjpy', live.usdjpy, false)) changed = true;

    // Stooq (개별종목·ETF·지수·KOSPI·금 — 60개월 시계열 전체 교체)
    if (live.stooq) {
      Object.entries(live.stooq).forEach(([mKey, y]) => {
        if (!M[mKey] || !y || y.value == null) return;
        M[mKey].value = y.value;
        if (y.delta != null && !isNaN(y.delta)) M[mKey].delta = y.delta;
        if (y.series && y.series.length > 0) {
          M[mKey].series = y.series;
          reevalSignal(mKey, y.series);
        }
        M[mKey]._live = true;
        M[mKey]._mock = false;  // 실데이터 들어왔으니 mock 해제
        changed = true;
      });
    }

    // Fear & Greed (CNN — 미국 주식시장 위험선호 지표)
    if (live.fearGreed && M.fearGreed && live.fearGreed.value != null) {
      const v = live.fearGreed.value;
      M.fearGreed.value = v;
      if (live.fearGreed.delta != null) M.fearGreed.delta = live.fearGreed.delta;
      if (live.fearGreed.series && live.fearGreed.series.length > 0) {
        M.fearGreed.series = live.fearGreed.series;
        reevalSignal('fearGreed', live.fearGreed.series);
      }
      // 실제 값 기준으로 스토리 동적 생성
      let zone, desc;
      if (v <= 24) { zone = '극공포(Extreme Fear)'; desc = '역사적으로 매수 기회 영역. 주식 투매 국면.'; }
      else if (v <= 44) { zone = '공포(Fear)'; desc = '위험회피 심리 우세. 자금이 안전자산으로 이동 중.'; }
      else if (v <= 55) { zone = '중립(Neutral)'; desc = '위험선호와 회피가 균형. 방향성 대기 구간.'; }
      else if (v <= 75) { zone = '탐욕(Greed)'; desc = '위험선호 우세. 강세 모멘텀이 지속될 수 있는 영역.'; }
      else { zone = '극탐욕(Extreme Greed)'; desc = '단기 과열 신호. 일부 차익실현 고려해볼 수준.'; }
      M.fearGreed.story = `CNN 공포·탐욕 지수 ${v}는 '${zone}' 구간. ${desc} 미국 주식시장의 투자심리를 7개 지표(주가 모멘텀·변동성·풋콜비율·정크본드 수요 등)로 종합한 값으로, 위험선호 환경의 핵심 척도다.`;
      M.fearGreed._live = true;
      changed = true;
    }

    if (changed) setTick(t => t + 1);
  };

  const tabs = [
    { id: 'home',   icon: '🎯', label: '종합' },
    { id: 'liq',    icon: '💧', label: '유동성' },
    { id: 'rate',   icon: '📊', label: '금리' },
    { id: 'credit', icon: '🏦', label: '신용' },
    { id: 'infl',   icon: '🔥', label: '물가' },
    { id: 'asset',  icon: '📈', label: '시장' },
    { id: 'fx',     icon: '💵', label: 'FX' },
  ];

  return (
    <ModalContext.Provider value={setModalMetric}>
    <PWAMeta />
    <style>{`
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .tab-anim { animation: fadeIn 0.22s ease-out; }

      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .shimmer {
        background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(96,165,250,0.12) 50%, rgba(255,255,255,0.04) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.6s linear infinite;
      }

      @keyframes priceFlash {
        0% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        30% { box-shadow: 0 0 0 2px rgba(52,211,153,0.4); }
        100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
      }

      @keyframes softPulse {
        0%, 100% { opacity: 0.85; }
        50% { opacity: 1; }
      }
      .soft-pulse { animation: softPulse 2.4s ease-in-out infinite; }

      .card-tap {
        transition: transform 0.12s ease-out, background-color 0.15s ease-out, border-color 0.15s ease-out;
      }
      .card-tap:active {
        transform: scale(0.975);
      }

      .btn-tap {
        transition: transform 0.1s ease-out, opacity 0.15s ease-out;
      }
      .btn-tap:active {
        transform: scale(0.96);
      }

      /* 헤더 스크롤 시 자연스러운 분리감 */
      .sticky-header {
        box-shadow: 0 2px 12px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.04) inset;
      }

      @keyframes toastIn {
        from { opacity: 0; transform: translate(-50%, 14px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
    `}</style>
    <div className="min-h-screen text-white pb-20" style={{
      background: '#0a0a0e',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
      backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)',
      backgroundSize: '22px 22px',
    }}>
      {/* HEADER */}
      <header className="sticky top-0 z-30 backdrop-blur-xl sticky-header" style={{ background: 'rgba(10,10,14,0.85)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[16px] font-bold text-white leading-none">매크로 유동성</div>
            <div className="text-[10px] mt-1" style={{ color: '#7a7a85' }}>2026.05.14 · 글로벌 유동성 신호</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full px-2.5 py-1 text-[10px] font-mono" style={{ background: 'rgba(52,211,153,0.1)', color: C.pos, border: '1px solid rgba(52,211,153,0.3)' }}>● LIVE</div>
            <AlertCenter alerts={alerts} />
            <button onClick={handleGlobalRefresh} className="active:opacity-60 p-1.5" disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} style={{ color: refreshing ? '#60a5fa' : '#7a7a85' }} />
            </button>
            <button onClick={() => setSettingsOpen(true)} className="active:opacity-60 p-1.5 -mr-1.5 relative">
              <Settings size={17} style={{ color: fredKey ? '#34d399' : '#7a7a85' }} />
              {fredKey && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: '#34d399', boxShadow: '0 0 0 2px rgba(10,10,14,1)' }}></span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 실시간 시세 티커 (CoinGecko + 환율 API) */}
      <ErrorBoundary name="실시간 티커">
        <LiveTicker onUpdate={handleLiveUpdate} refreshKey={refreshKey} />
      </ErrorBoundary>

      <main className="px-4 pt-2">
        <div key={tab} className="tab-anim">

        {(tab === 'home') && (
          <>
            {/* ============ HERO VERDICT ============ */}
            <div className="rounded-3xl p-5 mt-3 border" style={{
              background: 'rgba(255,255,255,0.025)',
              borderColor: regime.border,
              boxShadow: `0 0 0 1px ${regime.border}, 0 8px 32px ${regime.bg}`,
            }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target size={18} style={{ color: regime.color }} />
                  <span className="text-[14px] font-semibold text-white">종합 매크로 판단</span>
                </div>
                <div className="text-right">
                  <div className="rounded-full px-2 py-0.5 text-[10px] inline-block" style={{ background: 'rgba(255,255,255,0.05)', color: '#a8a8b3' }}>
                    매수신호 {regime.count}/4
                  </div>
                  <div className="text-[28px] font-bold leading-none mt-1" style={{ color: regime.color }}>{regime.label}</div>
                </div>
              </div>
              <p className="text-[12.5px] leading-relaxed" style={{ color: '#c0c0c8' }}>{regime.text}</p>
            </div>

            {/* ============ 오늘의 브리핑 ============ */}
            <ErrorBoundary name="데일리 브리핑">
              <DailyBriefing metrics={M} regime={regime} alerts={alerts} />
            </ErrorBoundary>

            {/* ============ 포트폴리오 적합성 ============ */}
            <ErrorBoundary name="포트폴리오">
              <Portfolio regime={regime} onChange={setPortfolio} />
            </ErrorBoundary>

            {/* ============ AI 종합 분석 ============ */}
            <ErrorBoundary name="AI 종합 분석">
              <AIRegimeAnalysis metrics={M} regime={regime} />
            </ErrorBoundary>

            {/* ============ QUICK SIGNALS ============ */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <SignalPill
                label="유동성"
                value={M.globalLiq.delta > 0 ? '확장' : M.globalLiq.delta < 0 ? '위축' : '횡보'}
                signal={M.globalLiq.delta > 0 ? 'pos' : M.globalLiq.delta < 0 ? 'neg' : 'neu'}
                sub={`G3 ${M.globalLiq.delta > 0 ? '+' : ''}${M.globalLiq.delta.toFixed(2)}T$`}
              />
              <SignalPill
                label="실질금리"
                value={M.realRate.delta < 0 ? '하락' : M.realRate.delta > 0 ? '상승' : '횡보'}
                signal={M.realRate.delta < 0 ? 'pos' : M.realRate.delta > 0 ? 'neg' : 'neu'}
                sub={`${M.realRate.delta > 0 ? '+' : ''}${M.realRate.delta.toFixed(2)}pp`}
              />
              <SignalPill
                label="신용"
                value={M.hyOas.value < 300 ? '타이트' : M.hyOas.value < 500 ? '중립' : '확대'}
                signal={M.hyOas.value < 300 ? 'pos' : M.hyOas.value < 500 ? 'neu' : 'neg'}
                sub={`HY ${Math.round(M.hyOas.value)}bp`}
              />
            </div>

            {/* ============ COMPARISON BAR ============ */}
            {(() => {
              const s = M.globalLiq.series;
              const cur = M.globalLiq.value;
              // 12개월 전 값 (시계열이 충분하면)
              const yrAgo = s && s.length >= 13 ? s[s.length - 13].v : null;
              const pct = yrAgo ? ((cur - yrAgo) / yrAgo * 100) : null;
              return (
                <div className="rounded-2xl px-4 py-3 mt-3 border flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div>
                    <div className="text-[11px]" style={{ color: '#7a7a85' }}>글로벌 유동성 (G3)</div>
                    <div className="text-[10px]" style={{ color: '#5a5a64' }}>
                      {yrAgo ? `12개월 전 ${yrAgo.toFixed(1)}T$ 대비` : '현재 ' + cur.toFixed(1) + 'T$'}
                    </div>
                  </div>
                  {pct != null && (
                    <div className="text-[18px] font-bold" style={{ color: pct >= 0 ? C.pos : C.neg }}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ============ WATCH BOX ============ */}
            <div className="rounded-2xl p-3.5 mt-3 flex items-start gap-2.5" style={{ background: C.warnBg, border: `1px solid ${C.warnBorder}` }}>
              <AlertTriangle size={14} style={{ color: C.warn, marginTop: 2 }} className="shrink-0" />
              <div>
                <div className="text-[11px] font-semibold mb-1" style={{ color: C.warn }}>관전 포인트</div>
                <p className="text-[12px] leading-relaxed" style={{ color: '#c0c0c8' }}>Fed 자산 축소는 지속되지만 BOJ·중국 완화로 전체 유동성은 확장. 실질금리 하락 추세 지속 시 위험자산 우호 환경 유지. 10Y-2Y 정상화 후 6~18개월 시차에 주의.</p>
              </div>
            </div>

            {/* ============ HIGHLIGHT METRICS ============ */}
            <SectionTitle emoji="📐" title="핵심 매크로 지표" sub="유동성·실질금리·신용·심리 핵심 4종" />
            <div className="space-y-2.5">
              <NarrativeCard m={M.globalLiq} />
              <NarrativeCard m={M.realRate} />
              <NarrativeCard m={M.hyOas} />
              <NarrativeCard m={M.fearGreed} />
            </div>

            {/* ============ 상관관계 분석 ============ */}
            <SectionTitle emoji="🔗" title="상관관계 분석" sub="유동성과 자산의 동행성" />
            <ErrorBoundary name="상관관계 차트">
              <ComparisonChart metrics={M} />
            </ErrorBoundary>

            {/* ============ 백테스트 ============ */}
            <SectionTitle emoji="🧪" title="백테스트" sub="과거 5년 시그널이 실제로 맞았나" />
            <ErrorBoundary name="백테스트">
              <Backtest />
            </ErrorBoundary>

            {/* ============ ALL SECTIONS PREVIEW ============ */}
            <SectionTitle emoji="🗂" title="섹션 바로가기" sub="세부 지표 보기" />
            <div className="grid grid-cols-2 gap-2">
              {tabs.filter(t => t.id !== 'home').map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} className="rounded-2xl p-3.5 border text-left active:opacity-70 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{t.icon}</span>
                    <span className="text-[13px] font-semibold text-white">{t.label}</span>
                  </div>
                  <ChevronRight size={14} style={{ color: '#5a5a64' }} />
                </button>
              ))}
            </div>
          </>
        )}

        {(tab === 'liq') && (
          <>
            <SectionTitle emoji="💧" title="글로벌 유동성" sub="M2 · 중앙은행 자산 · 순유동성" />
            <div className="space-y-2.5 mb-4">
              <NarrativeCard m={M.netLiq} />
              <NarrativeCard m={M.globalLiq} />
              <NarrativeCard m={M.rrp} />
              <NarrativeCard m={M.usM2} />
              <NarrativeCard m={M.fedAssets} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CompactCard m={M.krM2} />
              <CompactCard m={M.ecbAssets} />
              <CompactCard m={M.bojAssets} />
            </div>
          </>
        )}

        {(tab === 'rate') && (
          <>
            <SectionTitle emoji="📊" title="금리 & 실질금리" sub="기준금리 · 커브 · 실질금리" />
            <div className="space-y-2.5 mb-4">
              <NarrativeCard m={M.realRate} />
              <NarrativeCard m={M.yieldCurve} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CompactCard m={M.fedRate} />
              <CompactCard m={M.us2y} />
              <CompactCard m={M.us10y} />
            </div>
          </>
        )}

        {(tab === 'credit') && (
          <>
            <SectionTitle emoji="🏦" title="신용 확장" sub="대출 · 신용 · 스프레드" />
            <div className="space-y-2.5 mb-4">
              <NarrativeCard m={M.hyOas} />
              <NarrativeCard m={M.igOas} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CompactCard m={M.bankLoans} />
              <CompactCard m={M.corpCredit} />
              <CompactCard m={M.hhCredit} />
            </div>
          </>
        )}

        {(tab === 'infl') && (
          <>
            <SectionTitle emoji="🔥" title="인플레이션" sub="CPI · PCE · 기대인플레" />
            <div className="space-y-2.5 mb-4">
              <NarrativeCard m={M.coreCpi} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CompactCard m={M.cpi} />
              <CompactCard m={M.pce} />
              <CompactCard m={M.bei} />
            </div>
          </>
        )}

        {(tab === 'asset') && (
          <>
            <SectionTitle emoji="📈" title="자산시장 반응" sub="유동성에 반응하는 위험자산" />
            <div className="grid grid-cols-2 gap-2 mb-4">
              <CompactCard m={M.spx} />
              <CompactCard m={M.nasdaq} />
            </div>

            <SectionTitle emoji="⚠️" title="위험선호 / 변동성" sub="VIX · 공포·탐욕 지수" />
            <div className="space-y-2.5 mb-4">
              <NarrativeCard m={M.vix} />
              <NarrativeCard m={M.fearGreed} />
            </div>
          </>
        )}

        {(tab === 'fx') && (
          <>
            <SectionTitle emoji="💵" title="달러 & FX" sub="DXY · 주요 통화 페어" />
            <div className="space-y-2.5 mb-4">
              <NarrativeCard m={M.dxy} />
              <NarrativeCard m={M.usdkrw} />
              <NarrativeCard m={M.usdjpy} />
            </div>
          </>
        )}

        <div className="mt-8 mb-4 text-center text-[10px]" style={{ color: '#5a5a64' }}>
          데이터 · FRED · ECB · BOJ · CBOE · CoinGecko<br/>
          <span style={{ color: C.warn }}>투자판단은 본인 책임</span>
        </div>
        </div>
      </main>

      {/* ============ BOTTOM TABS ============ */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 backdrop-blur-xl" style={{ background: 'rgba(10,10,14,0.9)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div
          className="flex pt-2 pb-3 px-1 overflow-x-auto"
          style={{
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <style>{`nav div::-webkit-scrollbar{display:none}`}</style>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="btn-tap flex flex-col items-center gap-1 active:opacity-60 shrink-0 px-3 relative" style={{ minWidth: 64 }}>
              <span className="text-base leading-none transition-all duration-200" style={{ filter: tab === t.id ? 'none' : 'grayscale(0.7) opacity(0.55)', transform: tab === t.id ? 'scale(1.08)' : 'scale(1)' }}>{t.icon}</span>
              <span className="text-[10px] font-medium whitespace-nowrap transition-colors duration-200" style={{ color: tab === t.id ? '#ffffff' : '#7a7a85' }}>{t.label}</span>
              {tab === t.id && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: '#60a5fa', boxShadow: '0 0 6px #60a5fa' }}></span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* 매크로 AI 챗봇 (플로팅) */}
      <ErrorBoundary name="AI 챗봇">
        <ChatBot metrics={M} regime={regime} portfolio={portfolio} />
      </ErrorBoundary>

      {/* 컴팩트 카드 상세 모달 */}
      <ErrorBoundary name="지표 상세">
        <MetricModal metric={modalMetric} onClose={() => setModalMetric(null)} />
      </ErrorBoundary>

      {/* 설정 모달 (FRED 키 등) */}
      <ErrorBoundary name="설정">
        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          fredKey={fredKey}
          setFredKey={setFredKey}
        />
      </ErrorBoundary>

      {/* 글로벌 토스트 (새로고침 피드백 등) */}
      {toast && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: '50%',
            bottom: 'max(96px, calc(env(safe-area-inset-bottom) + 88px))',
            animation: 'toastIn 0.22s ease-out',
            transform: 'translateX(-50%)',
          }}
        >
          <div
            className="rounded-full px-3.5 py-2 backdrop-blur-md flex items-center gap-2 whitespace-nowrap"
            style={{
              background: 'rgba(20,20,28,0.94)',
              border: `1px solid ${toast.type === 'done' ? 'rgba(52,211,153,0.35)' : toast.type === 'error' ? 'rgba(248,113,113,0.35)' : 'rgba(96,165,250,0.3)'}`,
              boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
            }}
          >
            {toast.type === 'loading' && (
              <RefreshCw size={12} className="animate-spin" style={{ color: '#60a5fa' }} />
            )}
            {toast.type === 'done' && (
              <span className="text-[13px] leading-none" style={{ color: '#34d399' }}>✓</span>
            )}
            {toast.type === 'error' && (
              <span className="text-[13px] leading-none" style={{ color: '#f87171' }}>✕</span>
            )}
            <span className="text-[12px] font-medium text-white">{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
    </ModalContext.Provider>
  );
}
