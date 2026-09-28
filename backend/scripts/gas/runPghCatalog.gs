// =====================================================================
// 【PG HOUSE九州】資料請求メール → 反響として取り込む
//
// ⚠️ 送信元 : no-reply@kyusyu.pg-house.jp
// ⚠️ 件名   : 【PG HOUSE九州】資料請求がありました。
//
// ⚠️ 送り先 : ① の api/gateway/ → backend/src/handlers/pgh_order.php
//              → inquiry_customer
//
// ⚠️⚠️ **参照した catalog_resale の GAS とは本文の書式が違う。**
//   ⚠️ あちらは 【お名前】 の**次の行**が値。
//   ⚠️ ⚠️ **こちらは `お名前：中島健太` と同じ行に全角コロンで並ぶ。**
//   ⚠️ そのため抽出ロジックは流用できず、コロンで割る形で書き直してある。
//
// ⚠️⚠️ **ここでは本文を割って送るだけ。**
//   ⚠️ 氏名の扱い・カナ変換・住所の分解・媒体の決定は
//     ⚠️ **すべて pgh_order.php がやる。**
//   ⚠️ ⚠️ **GAS に判断を持たせないこと。** 直すたびに貼り替えが要るため。
//
// ⚠️⚠️ **同じ問い合わせが2通届く**（2026-09-28 に判明）。
//   ⚠️ 受け側が「誰が・いつ」で弾くので、⚠️ **ここでは気にしなくてよい。**
//   ⚠️ ⚠️ **ただしスレッド内の関係ないメールは送らない**（下の絞り込みを参照）。
// =====================================================================

/**
 * ⚠️ 送信先。
 *   ⚠️ 既存の GAS（catalog_resale）と**同じ入口**である。
 *   ⚠️ ⚠️ **書き換える必要はない。**
 */
const PGH_CATALOG_API_URL = 'https://khg-marketing.info/dashboard/api/gateway/';

/** ⚠️ 本文から拾う項目。⚠️ **左がメール本文の見出し、右が送信するキー** */
const PGH_CATALOG_FIELDS = {
  'お名前': 'name',
  'ふりがな': 'kana',
  'フリガナ': 'kana',            // ⚠️ 表記ゆれ対策
  '郵便番号': 'zip',
  '住所': 'address',
  'ご連絡先電話番号': 'tel',
  '連絡可能時間': 'contactTime',
  'メールアドレス': 'email',
  'ご質問等': 'question',
  'お申込のきっかけを選択してください': 'trigger',
  'ご紹介者のお名前': 'introducer',
  'その他の内容': 'other',
  '問い合わせのページURL': 'pageUrl'
};

/**
 * 本文を `見出し：値` で割る。
 *
 * ⚠️ 全角コロン（：）と半角コロン（:）の両方を受ける。
 * ⚠️⚠️ **見出しに一致しない行は、直前の項目の続き**として足す。
 *   ⚠️ 「ご質問等」が複数行になることがあるため。
 * ⚠️ 見出しの前後に空白が入ることがあるので trim してから比べる。
 */
function extractPghCatalogData(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const result = {};
  Object.keys(PGH_CATALOG_FIELDS).forEach(function (label) {
    result[PGH_CATALOG_FIELDS[label]] = '';
  });

  let currentKey = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // ⚠️ 署名や区切り線が来たら打ち切る
    if (trimmed.indexOf('--') === 0 || trimmed.indexOf('個人情報') === 0) break;

    const matched = trimmed.match(/^([^：:]+)\s*[：:]\s*(.*)$/);

    if (matched) {
      const label = matched[1].trim();
      const key = PGH_CATALOG_FIELDS[label];

      if (key) {
        currentKey = key;
        result[key] = matched[2].trim();
        continue;
      }
      // ⚠️ 見出しに無い `xxx：yyy` は、直前の項目の続きとして扱う
    }

    if (currentKey && trimmed !== '') {
      result[currentKey] = result[currentKey] ? result[currentKey] + '\n' + trimmed : trimmed;
    }
  }

  // ⚠️ 郵便番号に 〒 やハイフンが混ざることがある。数字だけにして渡す
  if (result.zip) result.zip = result.zip.replace(/[〒\-ー－\s]/g, '').trim();

  return result;
}

/**
 * ⚠️⚠️ **そのメールが取り込み対象かを確かめる。**
 *
 * ⚠️ `GmailApp.search()` が返すのは ⚠️ **スレッド**である。
 *   ⚠️ ⚠️ **`thread.getMessages()` は、条件に合わない返信や自動応答も返す。**
 *   ⚠️ 絞らないと、⚠️ **無関係なメールから空の行を作ってしまう。**
 */
function isPghCatalogMail(msg) {
  const from = String(msg.getFrom() || '');
  const subject = String(msg.getSubject() || '');
  return from.indexOf('no-reply@kyusyu.pg-house.jp') !== -1
      && subject.indexOf('資料請求') !== -1;
}

/** ⚠️ 日時の桁合わせ。⚠️ 他のGASと関数名が衝突しないよう接頭辞を付けている */
function padZeroPghCatalog(num) {
  return ('0' + num).slice(-2);
}

/**
 * ① へ送る。
 *
 * ⚠️⚠️ **`{ request, data: [...] }` の形にすること。**
 *   ⚠️ 受け側の `portalReadBulkPayload()` がこの2つを見ている。
 *   ⚠️ ⚠️ **形が違うと 400 で弾かれる。**
 *
 * ⚠️ `muteHttpExceptions` を true にして、⚠️ **失敗しても本文をログに残す。**
 *   ⚠️ false だと例外の中身が読めず、原因が分からない。
 */
function postPghCatalog(rows) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ request: 'pgh_order', data: rows }),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(PGH_CATALOG_API_URL, options);
    Logger.log('送信結果 ' + response.getResponseCode() + ' : ' + response.getContentText());
    return true;
  } catch (e) {
    Logger.log('送信エラー: ' + e.toString());
    return false;
  }
}

// =====================================================================
// ⚠️ メインの実行関数。⚠️ **トリガーはこれを指定する**
// =====================================================================
function runPghCatalog() {
  // ⚠️ 1日以内。⚠️⚠️ **重複は受け側が messageId で弾く**ので、既読判定はしない
  const query = 'from:no-reply@kyusyu.pg-house.jp subject:"資料請求" newer_than:1d';
  const threads = GmailApp.search(query);

  if (threads.length === 0) {
    Logger.log('処理対象のメール(PGH資料請求)はありません。');
    return;
  }

  Logger.log(threads.length + '件のスレッドが見つかりました。');

  // ⚠️ まとめて1回で送る。⚠️ 受け側は 500件ずつ処理できる
  const rows = [];

  for (const thread of threads) {
    const messages = thread.getMessages();

    for (const msg of messages) {
      // ⚠️⚠️ **スレッドに混ざった別のメールは送らない**
      if (!isPghCatalogMail(msg)) continue;

      const body = msg.getPlainBody();
      const extracted = extractPghCatalogData(body);

      const d = msg.getDate();
      const registered = d.getFullYear()
        + '-' + padZeroPghCatalog(d.getMonth() + 1)
        + '-' + padZeroPghCatalog(d.getDate())
        + ' ' + padZeroPghCatalog(d.getHours())
        + ':' + padZeroPghCatalog(d.getMinutes())
        + ':' + padZeroPghCatalog(d.getSeconds());

      // ⚠️ 氏名が取れないものは送らない。⚠️ **誰のことか分からない行を作らない**
      if (!extracted.name) {
        Logger.log('お名前が取れなかったためスキップ: ' + msg.getId());
        continue;
      }

      rows.push({
        ...extracted,
        registered: registered,
        // ⚠️ 追跡用。⚠️⚠️ **重複排除には使われない**（受け側が「誰が・いつ」で弾く）
        messageId: msg.getId(),
        // ⚠️ 取りこぼしても後から読めるよう、本文をそのまま添える
        remarks: body
      });
    }
  }

  if (rows.length === 0) {
    Logger.log('送信できる行がありませんでした。');
    return;
  }

  Logger.log(rows.length + '件を送信します。');
  postPghCatalog(rows);
}
