// 広告流入トラッキング（v2.2.199）。各ブランドサイトのフッターに貼る:
//   <script src="https://api.khg-marketing.info/t/v1/tracker.js" data-site="SITE_KEY" defer></script>
// ⚠️ フォーム（form_get）は改修しない。フォームが読む localStorage のキー（landing_params / source / campaign）に書く。
// ⚠️ 訪問者ID（khg_vid）を全員に振り、landing_params に付ける。ほかのスクリプト（MA など）は window.khgVisitorId で読める。
// ⚠️ 素の JS（ES2017）。外部ライブラリに頼らない。⚠️ Cookie は使わない。
// ⚠️⚠️ 全体を try/catch で囲む。このスクリプトのエラーでサイト・フォームを止めてはいけない。
// ⚠️ 行頭が // の行は配信時に ② が取り除く（features/tracking/publicRouter.ts）。行の途中にコメントを書かないこと。
(function () {
  try {
    var script = document.currentScript;
    var siteKey = script && script.dataset ? script.dataset.site || '' : '';
    if (!siteKey || window.khgTrackingDisabled === true) return;
    var store = window.localStorage;
    if (!store) return;
    // ⚠️ 指示書 §4 の対象キー。⚠️ ② の features/tracking/params.ts と同じ並び・同じ長さ
    var KEYS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'yclid', 'gad_source', 'gad_campaignid',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'flyer'];
    var MAX = 500;
    var ENDPOINT = 'https://api.khg-marketing.info/api/track/touch';
    var uuid = function () {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
      var b = new Uint8Array(16);
      window.crypto.getRandomValues(b);
      b[6] = (b[6] & 15) | 64;
      b[8] = (b[8] & 63) | 128;
      var h = [];
      for (var i = 0; i < 16; i++) h.push((b[i] + 256).toString(16).slice(1));
      return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' + h.slice(6, 8).join('') + '-' + h.slice(8, 10).join('') + '-' + h.slice(10).join('');
    };
    var visitor = function () {
      var id = store.getItem('khg_vid');
      if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        id = uuid();
        store.setItem('khg_vid', id);
      }
      return id;
    };
    // ⚠️⚠️ 訪問者ID（khg_vid）は広告で来た人だけでなく全員に振る（2026-10-20 の追加指示。MA で顧客を識別するため）。
    // ⚠️ landing_params に必ず khg_vid を入れる → フォームがそのまま送るので、どの反響にも ID が付く。
    // ⚠️ 空なら khg_vid だけ、あれば末尾に付ける（§5-1-8 の補修。フォームのあるページはフォームが ? 以降で上書きするため）。
    // ⚠️ ID はサイト（ドメイン）ごと。localStorage はドメインをまたげない。
    var repair = function () {
      var id = visitor();
      var lp = store.getItem('landing_params') || '';
      if (lp === '') store.setItem('landing_params', 'khg_vid=' + encodeURIComponent(id));
      else if (lp.indexOf('khg_vid=') < 0) store.setItem('landing_params', lp + '&khg_vid=' + encodeURIComponent(id));
      window.khgVisitorId = id;
    };
    // ⚠️ フォームのページでは、フォーム（iframe）が後から landing_params を上書きして khg_vid を消す。
    // ⚠️ そのページから送っても ID が付くよう、開いている間（最大30分）1秒ごとに付け直す（読むだけなので軽い）。
    var keep = function () {
      var n = 0;
      var timer = window.setInterval(function () {
        try { repair(); } catch (e) { window.clearInterval(timer); }
        if (++n >= 1800) window.clearInterval(timer);
      }, 1000);
    };
    var url = new URL(window.location.href);
    var params = {};
    var found = false;
    KEYS.forEach(function (k) {
      var v = url.searchParams.get(k);
      if (v !== null && v !== '') { params[k] = v.slice(0, MAX); found = true; }
    });
    // ⚠️ 広告のパラメータが無いページ（自然検索・直接・回遊）では、前の値を消さない・送らない
    if (!found) { repair(); keep(); return; }
    var vid = visitor();
    window.khgVisitorId = vid;
    var query = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); });
    query.push('khg_vid=' + encodeURIComponent(vid));
    store.setItem('landing_params', query.join('&'));
    keep();
    // ⚠️ source の決め方はフォーム（Form.tsx の sourceMap）と同じ順
    var source = params.utm_source || (params.fbclid ? 'Facebook/Instagram' : '')
      || (params.gclid || params.wbraid || params.gbraid ? 'Google' : '') || (params.yclid ? 'Yahoo' : '') || (params.flyer ? 'Flyer' : '');
    if (source) store.setItem('source', source);
    if (params.utm_campaign) store.setItem('campaign', params.utm_campaign);
    var body = JSON.stringify({
      site_key: siteKey, visitor_id: vid, params: params,
      landing_url: (url.origin + url.pathname).slice(0, 2000),
      referrer: (document.referrer || '').slice(0, 2000),
    });
    // ⚠️ text/plain で送る（CORS のプリフライトを起こさない）。⚠️ 結果は使わない
    var sent = false;
    try {
      if (navigator.sendBeacon) sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
    } catch (e) { sent = false; }
    if (!sent && window.fetch) {
      window.fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true, mode: 'cors', headers: { 'Content-Type': 'text/plain' } })
        .catch(function () { return null; });
    }
  } catch (e) {
    // 何もしない（プライベートブラウズで localStorage が使えないときなど）
  }
})();
