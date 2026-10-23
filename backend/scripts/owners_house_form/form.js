/*
 * オーナーズハウス募集フォームの動き（v2.2.215）。
 *
 * ⚠️ 1ページの中で「1 基本情報 → 2 写真・見どころ → 3 確認 → 4 完了」を切り替える。
 * ⚠️ 送信先は同じフォルダの api.php（転送するだけ）→ ① handlers/owners_house_application.php。
 * ⚠️ 項目の確かめ方は ① の owners_house_application.php と同じにすること（最後はサーバーが確かめる）。
 * ⚠️ 写真はブラウザで長辺1920px の JPEG に縮小してから送る（スマホの写真は10MB を超えることがある。① の上限は12MB）。
 *   ⚠️ 縮小できない写真（ブラウザが読めない形式）は、その場でエラーにする。
 */
(function () {
    'use strict';

    var MAX_SIDE = 1920;
    var JPEG_QUALITY = 0.85;
    var LIMITS = { name: 50, staff: 50, title: 100, feature1: 200, feature2: 200, feature3: 200, feature4: 200, feature5: 200 };
    var REQUIRED = { name: 'お名前', title: 'タイトル', feature1: '見どころ①', feature2: '見どころ②' };
    var PHOTO_LABELS = ['外観写真', '内観写真①', '内観写真②', '内観写真③', '内観写真④'];

    var form = document.getElementById('pf-form');
    var alertBox = document.getElementById('pf-alert');
    var submitButton = document.getElementById('pf-submit');
    /** 縮小した写真（photo1〜5 → Blob） */
    var photos = {};

    function el(id) { return document.getElementById(id); }
    function value(id) { return el(id).value.trim(); }
    function toHalf(text) {
        return text.replace(/[！-～]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); });
    }
    function zipDigits() { return toHalf(value('zip')).replace(/\D/g, ''); }
    function photoMode() { return form.querySelector('input[name="photo_mode"]:checked').value; }

    function showError(key, message) {
        var box = document.querySelector('[data-error="' + key + '"]');
        if (!box) return;
        box.textContent = message;
        box.closest('.pf-field').setAttribute('data-invalid', message ? '1' : '0');
    }

    function check(keys) {
        var first = null;
        keys.forEach(function (key) {
            var message = '';
            if (key === 'zip') {
                if (!/^\d{7}$/.test(zipDigits())) message = '7桁の郵便番号を入力してください';
            } else if (key === 'shop') {
                if (value('shop') === '') message = 'ご契約いただいた店舗を選んでください';
            } else if (/^photo[1-5]$/.test(key)) {
                var n = Number(key.slice(5));
                if (photoMode() === 'attach' && n <= 3 && !photos[key]) message = PHOTO_LABELS[n - 1] + 'を選んでください';
            } else {
                var text = value(key);
                if (REQUIRED[key] && text === '') message = REQUIRED[key] + 'を入力してください';
                else if (text.length > LIMITS[key]) message = LIMITS[key] + '文字以内で入力してください';
            }
            showError(key, message);
            if (message && !first) first = key;
        });
        return first;
    }

    function setStep(step) {
        [1, 2, 3].forEach(function (n) { el('pf-step' + n).hidden = n !== step; });
        el('pf-step4').hidden = step !== 4;
        form.hidden = step === 4;
        document.querySelectorAll('.pf-steps li').forEach(function (li) {
            if (Number(li.getAttribute('data-step')) === step) li.setAttribute('aria-current', 'step');
            else li.removeAttribute('aria-current');
        });
        alertBox.hidden = true;
        el('pf-root').scrollIntoView({ behavior: 'auto', block: 'start' });
    }

    function focusFirst(key) {
        var target = el(key);
        if (target) target.focus();
    }

    // ---- 写真：選んだらすぐ縮小して見本を出す ----
    function shrink(file) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                var scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
                var canvas = document.createElement('canvas');
                canvas.width = Math.round(img.naturalWidth * scale);
                canvas.height = Math.round(img.naturalHeight * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('toBlob')); }, 'image/jpeg', JPEG_QUALITY);
            };
            img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
            img.src = url;
        });
    }

    [1, 2, 3, 4, 5].forEach(function (n) {
        var key = 'photo' + n;
        var input = el(key);
        var preview = input.parentNode.querySelector('img');
        input.addEventListener('change', function () {
            delete photos[key];
            preview.hidden = true;
            showError(key, '');
            var file = input.files && input.files[0];
            if (!file) return;
            shrink(file).then(function (blob) {
                photos[key] = blob;
                preview.src = URL.createObjectURL(blob);
                preview.hidden = false;
            }).catch(function () {
                input.value = '';
                showError(key, 'この写真は読み込めませんでした。JPG または PNG の写真を選んでください');
            });
        });
    });

    form.querySelectorAll('input[name="photo_mode"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
            el('pf-photos').hidden = photoMode() !== 'attach';
            [1, 2, 3, 4, 5].forEach(function (n) { showError('photo' + n, ''); });
        });
    });

    // ---- 進む・戻る ----
    el('pf-to-step2').addEventListener('click', function () {
        var first = check(['name', 'zip', 'shop', 'staff']);
        if (first) { focusFirst(first); return; }
        setStep(2);
    });

    el('pf-to-step3').addEventListener('click', function () {
        var first = check(['photo1', 'photo2', 'photo3', 'title', 'feature1', 'feature2', 'feature3', 'feature4', 'feature5']);
        if (first) { focusFirst(first); return; }
        buildSummary();
        setStep(3);
    });

    form.querySelectorAll('[data-back]').forEach(function (button) {
        button.addEventListener('click', function () { setStep(Number(button.getAttribute('data-back'))); });
    });

    function buildSummary() {
        var summary = el('pf-summary');
        summary.textContent = '';
        var zip = zipDigits();
        var rows = [
            ['お名前', value('name')],
            ['郵便番号', zip.slice(0, 3) + '-' + zip.slice(3)],
            ['ご契約店舗', value('shop')],
            ['担当営業', value('staff') || '（未入力）'],
            ['掲載写真', photoMode() === 'attach' ? '写真を添付する' : '写真撮影を依頼する'],
            ['タイトル', value('title')]
        ];
        [1, 2, 3, 4, 5].forEach(function (n) {
            if (value('feature' + n) !== '') rows.push(['見どころ' + '①②③④⑤'.charAt(n - 1), value('feature' + n)]);
        });
        rows.forEach(function (pair) {
            var row = document.createElement('div');
            row.className = 'pf-summary-row';
            var dt = document.createElement('dt');
            var dd = document.createElement('dd');
            dt.textContent = pair[0];
            dd.textContent = pair[1];
            row.appendChild(dt);
            row.appendChild(dd);
            summary.appendChild(row);
        });
        if (photoMode() === 'attach') {
            var row = document.createElement('div');
            row.className = 'pf-summary-row';
            var dt = document.createElement('dt');
            dt.textContent = '写真';
            var dd = document.createElement('dd');
            dd.className = 'pf-summary-photos';
            [1, 2, 3, 4, 5].forEach(function (n) {
                var blob = photos['photo' + n];
                if (!blob) return;
                var img = document.createElement('img');
                img.src = URL.createObjectURL(blob);
                img.alt = PHOTO_LABELS[n - 1];
                dd.appendChild(img);
            });
            row.appendChild(dt);
            row.appendChild(dd);
            summary.appendChild(row);
        }
    }

    // ---- 送信 ----
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        // ⚠️ 確認画面以外で Enter を押しても送らない（確認を飛ばさない）
        if (el('pf-step3').hidden) return;
        if (submitButton.getAttribute('aria-busy') === 'true') return;
        submitButton.setAttribute('aria-busy', 'true');
        submitButton.textContent = '送信しています…';

        var data = new FormData();
        ['name', 'shop', 'staff', 'title', 'feature1', 'feature2', 'feature3', 'feature4', 'feature5'].forEach(function (key) {
            data.append(key, value(key));
        });
        data.append('zip', zipDigits());
        data.append('photo_mode', photoMode());
        data.append('website_url', form.querySelector('input[name="website_url"]').value);
        if (photoMode() === 'attach') {
            [1, 2, 3, 4, 5].forEach(function (n) {
                if (photos['photo' + n]) data.append('photo' + n, photos['photo' + n], 'photo' + n + '.jpg');
            });
        }

        fetch('./api.php', { method: 'POST', body: data })
            .then(function (res) { return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, body: body }; }); })
            .then(function (result) {
                if (result.ok && result.body.status === 'success') {
                    el('pf-done-name').textContent = value('name') + ' 様';
                    setStep(4);
                    return;
                }
                // ⚠️ 項目の誤り（400）は該当の画面に戻して知らせる
                var fields = (result.body && result.body.fields) || [];
                if (fields.length) {
                    var step = fields.some(function (f) { return ['name', 'zip', 'shop', 'staff'].indexOf(f) !== -1; }) ? 1 : 2;
                    setStep(step);
                    fields.forEach(function (f) { showError(f === 'photo_mode' ? 'photo1' : f, '入力内容をご確認ください'); });
                }
                alertBox.textContent = (result.body && result.body.message) || '送信できませんでした。時間をおいて再度お試しください。';
                alertBox.hidden = false;
            })
            .catch(function () {
                alertBox.textContent = '通信エラーが発生しました。時間をおいて再度お試しください。';
                alertBox.hidden = false;
            })
            .finally(function () {
                submitButton.removeAttribute('aria-busy');
                submitButton.textContent = 'この内容で申し込む';
            });
    });
})();
