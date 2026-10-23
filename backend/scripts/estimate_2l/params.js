/*
 * 2L 簡単見積もり（2lhome.net/mitsumori/）の URL パラメータを、フォームと一緒に送る。（v2.2.216）
 *
 * ⚠️ index.html の </body> の直前に <script src="./params.js"></script> を1行足して使う。
 * ⚠️ 送る値（form_get の pageParams.ts と同じ考え方）:
 *   - url_params     … 送信したページの ? 以降（# より前）
 *   - landing_params … このサイトで最後に開いた、パラメータ付きページの ? 以降（localStorage に覚える）
 * ⚠️ 保存を禁止したブラウザでは覚えられないが、送信は止めない。
 */
(function () {
    'use strict';
    var KEY = 'landing_params';
    var query = location.search.replace(/^\?/, '');

    try {
        if (query !== '') localStorage.setItem(KEY, query);
    } catch (e) { /* 覚えられなくても送信には影響しない */ }

    function landing() {
        try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; }
    }

    function put(form, name, value) {
        var input = form.querySelector('input[name="' + name + '"]');
        if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            form.appendChild(input);
        }
        input.value = value;
    }

    function attach() {
        var form = document.querySelector('form[action*="result_api.php"]');
        if (!form) return;
        // ⚠️ 送る直前に入れる（ページを開いたあとに覚えた値も拾う）
        form.addEventListener('submit', function () {
            put(form, 'url_params', query);
            put(form, 'landing_params', landing());
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
})();
