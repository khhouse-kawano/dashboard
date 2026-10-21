// 広告流入トラッキング（v2.2.199）。各ブランドサイトに入れる（GTM 用・フッター用のタグはトラッキング設定が出す）:
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
    var PV_ENDPOINT = 'https://api.khg-marketing.info/api/track/pv';
    var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // ⚠️ v2.2.201 自社のサイトどうし（見学クラウドを含む）は、リンクに顧客IDと広告の情報を付けて渡す。www の有無は同じとみなす
    var LINK_HOSTS = ['ie-miru.jp', 'kh-house.jp', 'day-just-house.com', 'nagomi-koumuten.jp', 'furukomi-home.com',
      '2lhome.net', 'miyazaki.pg-house.jp', 'jusfy-home.com'];
    var bare = function (host) { return host.toLowerCase().replace(/^www\./, ''); };
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
    var url = new URL(window.location.href);
    // ⚠️ v2.2.201 別の自社サイトから khg_vid 付きで来たら、その顧客IDを引き継ぐ（ドメインが違っても同じ人として結びつける）
    var passed = (url.searchParams.get('khg_vid') || '').toLowerCase();
    if (!UUID.test(passed)) passed = '';
    if (passed) store.setItem('khg_vid', passed);
    var visitor = function () {
      var id = store.getItem('khg_vid');
      if (!id || !UUID.test(id)) {
        id = uuid();
        store.setItem('khg_vid', id);
      }
      return id;
    };
    // ⚠️⚠️ 訪問者ID（khg_vid）は広告で来た人だけでなく全員に振る（2026-10-20 の追加指示。MA で顧客を識別するため）。
    // ⚠️ landing_params に必ず今の khg_vid を入れる → フォームがそのまま送るので、どの反響にも ID が付く。
    // ⚠️ 無ければ足し、引き継ぎで ID が変わっていたら差し替える（§5-1-8 の補修。フォームのあるページはフォームが ? 以降で上書きするため）。
    var repair = function () {
      var id = visitor();
      var lp = new URLSearchParams(store.getItem('landing_params') || '');
      if (lp.get('khg_vid') !== id) {
        lp.set('khg_vid', id);
        store.setItem('landing_params', lp.toString());
      }
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
    // ⚠️ v2.2.201 自社の別ドメインへのリンクを押したら、その瞬間に khg_vid と覚えている広告の情報を付け足す（行き先に既にあるキーは変えない）
    var decorate = function (e) {
      try {
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!a) return;
        var to = new URL(a.href, window.location.href);
        if (!/^https?:$/.test(to.protocol) || bare(to.hostname) === bare(window.location.hostname)) return;
        if (LINK_HOSTS.indexOf(bare(to.hostname)) < 0) return;
        var lp = new URLSearchParams(store.getItem('landing_params') || '');
        KEYS.forEach(function (k) {
          var v = lp.get(k);
          if (v && !to.searchParams.has(k)) to.searchParams.set(k, v);
        });
        to.searchParams.set('khg_vid', visitor());
        a.href = to.toString();
      } catch (err) {
        // 何もしない（リンクはそのまま開く）
      }
    };
    document.addEventListener('mousedown', decorate, true);
    document.addEventListener('click', decorate, true);
    // ⚠️ v2.2.201 広告以外の訪問も数える（アクセス数の解析用）。1回の訪問につき1件。最後に開いたページから30分たったら次の訪問
    var VISIT_MS = 30 * 60 * 1000;
    // ⚠️ v2.2.203 新しい訪問のときは訪問ID（khg_sid）を作り直し、ひとつ前のページ（khg_prev）を消す
    var visit = function () {
      var now = Date.now();
      var last = Number(store.getItem('khg_last') || 0);
      store.setItem('khg_last', String(now));
      var isNew = !(last > 0 && now - last < VISIT_MS);
      if (isNew || !UUID.test(store.getItem('khg_sid') || '')) {
        store.setItem('khg_sid', uuid());
        store.removeItem('khg_prev');
      }
      return isNew;
    };
    // ⚠️ 流入元はどこから来たか（リファラー）で決める。⚠️ ② の ORGANIC_SOURCE_PATTERN と同じ形。自社サイトからの移動は '' （数えない）
    var channel = function (ref) {
      var h = '';
      try { h = ref ? bare(new URL(ref).hostname) : ''; } catch (e) { h = ''; }
      if (!h) return 'direct';
      if (h === bare(window.location.hostname) || LINK_HOSTS.indexOf(h) >= 0) return '';
      if (/google/.test(h)) return 'organic/google';
      if (/yahoo/.test(h)) return 'organic/yahoo';
      if (/(^|\.)bing\.com$/.test(h)) return 'organic/bing';
      if (/instagram/.test(h)) return 'social/instagram';
      if (/facebook|^fb\.me$/.test(h)) return 'social/facebook';
      if (/^(t\.co|x\.com|twitter\.com)$/.test(h)) return 'social/x';
      if (/(^|\.)line\.me$|naver\.line/.test(h)) return 'social/line';
      if (/youtube/.test(h)) return 'social/youtube';
      if (/tiktok/.test(h)) return 'social/tiktok';
      return 'referral/' + h.replace(/[^a-z0-9.-]/g, '').slice(0, 150);
    };
    // ⚠️ text/plain で送る（CORS のプリフライトを起こさない）。⚠️ 結果は使わない
    var post = function (endpoint, payload) {
      var body = JSON.stringify(payload);
      var sent = false;
      try {
        if (navigator.sendBeacon) sent = navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }));
      } catch (e) { sent = false; }
      if (!sent && window.fetch) {
        window.fetch(endpoint, { method: 'POST', body: body, keepalive: true, mode: 'cors', headers: { 'Content-Type': 'text/plain' } })
          .catch(function () { return null; });
      }
    };
    var send = function (extra) {
      var payload = {
        site_key: siteKey, visitor_id: visitor(),
        landing_url: (url.origin + url.pathname).slice(0, 2000),
        referrer: (document.referrer || '').slice(0, 2000),
      };
      Object.keys(extra).forEach(function (k) { payload[k] = extra[k]; });
      post(ENDPOINT, payload);
    };
    var isNewVisit = visit();
    // ⚠️ v2.2.203 ページの閲覧はすべて送る（広告・自然検索・回遊とも。MA と PV・ページ遷移のため）。⚠️ ? 以降は送らない
    var here = (url.origin + url.pathname).slice(0, 2000);
    post(PV_ENDPOINT, {
      site_key: siteKey, visitor_id: visitor(), visit_id: store.getItem('khg_sid'),
      url: here, title: (document.title || '').slice(0, 255), prev: store.getItem('khg_prev') || '',
    });
    store.setItem('khg_prev', here);
    var params = {};
    var found = false;
    KEYS.forEach(function (k) {
      var v = url.searchParams.get(k);
      if (v !== null && v !== '') { params[k] = v.slice(0, MAX); found = true; }
    });
    // ⚠️ 広告のパラメータが無いページ（自然検索・直接・回遊）では、前の値を消さない。⚠️ 新しい訪問のときだけ流入元を付けて送る
    if (!found) {
      repair();
      keep();
      var ch = passed || !isNewVisit ? '' : channel(document.referrer);
      if (ch) send({ params: {}, source: ch });
      return;
    }
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
    // ⚠️ v2.2.201 自社サイトから引き継いだ広告の情報は、元のサイトで着地を記録済み。二重に数えないよう送らない
    if (passed) return;
    send({ params: params });
  } catch (e) {
    // 何もしない（プライベートブラウズで localStorage が使えないときなど）
  }
})();
