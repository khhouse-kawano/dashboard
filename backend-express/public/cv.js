// 自社のフォームでないサイトの CV（v2.2.205。まずはかえるホーム kaeruhome.jp）。GTM で全ページに入れる（タグはアクセス解析が出す）。
// ⚠️ tracker.js と一緒に入れる（顧客ID khg_vid と流入の情報 landing_params は tracker.js が localStorage に書いたものを読む）。
// ⚠️ フォームの「確認画面へ」（data-button の文字を含むボタン）が押されたら、メール・電話を SHA-256 にして ② の /api/track/cv に送る。
// ⚠️⚠️ メールアドレス・電話番号そのものは送らない。ハッシュだけ。② は反響（通知メールから GAS が入れたもの）を同じ方法でハッシュにして突き合わせる。
// ⚠️ 正規化は ② の features/tracking/cvMatch.ts と同じ：メールは前後の空白を除いて小文字、電話は数字だけ（全角の数字も半角にする）。
// ⚠️ ボタンを押すと、すぐ次の画面へ移る。そのため SHA-256 は同期で計算し、sendBeacon（ページを移っても届く）で送る。
// ⚠️ 入力欄の名前は data-email / data-tel（カンマ区切り）。既定はかえるホームのもの（EMAIL・member_email／TELNO）。
// ⚠️⚠️ 全体を try/catch で囲む。このスクリプトのエラーでサイト・フォームを止めてはいけない。
// ⚠️ 行頭が // の行は配信時に ② が取り除く（features/tracking/publicRouter.ts）。行の途中にコメントを書かないこと。
(function () {
  try {
    var script = document.currentScript;
    var data = script && script.dataset ? script.dataset : {};
    var siteKey = data.site || '';
    if (!siteKey || window.khgTrackingDisabled === true || !window.localStorage) return;
    var ENDPOINT = 'https://api.khg-marketing.info/api/track/cv';
    var BUTTON = data.button || '確認画面へ';
    var EMAIL_NAMES = (data.email || 'EMAIL,member_email').split(',');
    var TEL_NAMES = (data.tel || 'TELNO').split(',');
    var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    var sha256 = function (text) {
      var bytes = unescape(encodeURIComponent(text));
      var len = bytes.length;
      var words = [];
      for (var i = 0; i < len; i++) words[i >> 2] |= (bytes.charCodeAt(i) & 255) << (24 - (i % 4) * 8);
      words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
      words[(((len + 8) >> 6) + 1) * 16 - 1] = len * 8;
      var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
      var w = [];
      var rotr = function (x, n) { return (x >>> n) | (x << (32 - n)); };
      for (var j = 0; j < words.length; j += 16) {
        var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7];
        for (var t = 0; t < 64; t++) {
          if (t < 16) w[t] = words[j + t] | 0;
          else {
            var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
            var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
            w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
          }
          var t1 = (k + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0;
          var t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
          k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
        h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + k) | 0;
      }
      var out = '';
      for (var m = 0; m < 8; m++) out += ('00000000' + (h[m] >>> 0).toString(16)).slice(-8);
      return out;
    };

    var halfWidth = function (s) { return s.replace(/[０-９＠．＿－＋]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); }); };
    var valueOf = function (form, names) {
      for (var i = 0; i < names.length; i++) {
        var el = form.querySelector('[name="' + names[i].trim() + '"]');
        if (el && typeof el.value === 'string' && el.value.trim() !== '') return el.value;
      }
      return '';
    };

    var send = function (form) {
      var vid = (window.localStorage.getItem('khg_vid') || '').toLowerCase();
      if (!UUID.test(vid)) return;
      var email = halfWidth(valueOf(form, EMAIL_NAMES)).trim().toLowerCase();
      var tel = halfWidth(valueOf(form, TEL_NAMES)).replace(/[^0-9]/g, '');
      if (email.indexOf('@') < 1) email = '';
      if (tel.length < 10) tel = '';
      if (!email && !tel) return;
      var payload = JSON.stringify({
        site_key: siteKey,
        visitor_id: vid,
        form: (location.pathname.split('/')[1] || '').slice(0, 50),
        email_hash: email ? sha256(email) : '',
        tel_hash: tel ? sha256(tel) : '',
        landing_params: window.localStorage.getItem('landing_params') || '',
        url: location.origin + location.pathname
      });
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'text/plain' }))) return;
      var xhr = new XMLHttpRequest();
      xhr.open('POST', ENDPOINT, true);
      xhr.setRequestHeader('Content-Type', 'text/plain');
      xhr.send(payload);
    };

    document.addEventListener('click', function (event) {
      try {
        var target = event.target;
        var button = target && target.closest ? target.closest('input[type="submit"], input[type="button"], button') : null;
        if (!button) return;
        var label = button.value || button.textContent || '';
        if (label.indexOf(BUTTON) < 0) return;
        var form = button.form || button.closest('form');
        if (form) send(form);
      } catch (e) {
        return;
      }
    }, true);
  } catch (e) {
    return;
  }
})();
