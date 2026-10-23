// =====================================================================
// オーナーズハウス募集の「過去の通知メール」→ owners_house_application へ取り込む（v2.2.215）
//
// ⚠️ 手で1回（必要なら数回）実行するもの。⚠️ トリガーには登録しない。
// ⚠️ 対象: 以前のフォーム（regist.php）が送っていたメール
//     件名「オーナーズハウスへの募集がありました。」／差出人 mkt@kh-house.jp／本文は HTML
//   ⚠️ v2.2.215 の新しいフォームのメールは件名が違う（【オーナーズハウス募集】…）ので取り込まない
//     （新しいフォームの応募は、送った時点で DB に入っている）。
// ⚠️ 送り先: ② https://api.khg-marketing.info/api/gateway （request: owners_house_application_import）
//   ⚠️ 同じメール（Gmail の ID）は二度入らない（2回目は status: exists）。何度実行しても二重にならない。
//   ⚠️ ② に届かないときは止める（① に予備は無い。② が直ってからもう一度実行する）。
// ⚠️⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY（合い言葉）が要る。⚠️ 会員登録の GAS と同じ値。⚠️ ここに直書きしない。
// ⚠️ 写真はメールに入っていないので取り込めない（Dashboard の画面にもその旨を出している）。
// =====================================================================

const OH_IMPORT_URL = 'https://api.khg-marketing.info/api/gateway';
const OH_IMPORT_SUBJECT = 'オーナーズハウスへの募集がありました';
const OH_IMPORT_QUERY = 'subject:"' + OH_IMPORT_SUBJECT + '"';
/** ⚠️ GmailApp.search は1回に最大500スレッド。⚠️ 100ずつ読む */
const OH_IMPORT_PAGE = 100;

/** 本文の見出し（以前の regist.php の文言のまま）→ 送る項目 */
const OH_IMPORT_LABELS = {
  'お施主様名': 'name',
  '郵便番号': 'zip',
  '契約した店舗': 'shop',
  '担当営業': 'staff',
  '写真撮影について': 'photo_mode',
  'ご自宅のタイトル': 'title',
  'ご自宅の見どころ①': 'feature1',
  'ご自宅の見どころ②': 'feature2',
  'ご自宅の見どころ③': 'feature3',
  'ご自宅の見どころ④': 'feature4',
  'ご自宅の見どころ⑤': 'feature5'
};

/** HTML の本文を行に直す（<br> を改行、タグを除き、よく出る文字参照だけ戻す） */
function ohImportToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
}

/**
 * 1通のメールから送る内容を作る。⚠️ 送らないメールは { skip: 理由 }
 * ⚠️ 見出しと値は半角コロン（「お施主様名:山田様」）。⚠️ 値の中のコロンは残す（最初のコロンで分ける）。
 */
function ohImportBuildPayload(subject, html, date, messageId) {
  const s = String(subject || '');
  if (s.indexOf(OH_IMPORT_SUBJECT) === -1) return { skip: '件名が違う' };
  if (/^\s*(re|fw|fwd)\s*[:：]/i.test(s)) return { skip: '返信・転送' };

  const payload = { request: 'owners_house_application_import', message_id: messageId };
  ohImportToText(html).split('\n').forEach(function (line) {
    const trimmed = line.trim();
    const at = trimmed.search(/[:：]/);
    if (at === -1) return;
    const key = OH_IMPORT_LABELS[trimmed.slice(0, at).trim()];
    if (key && payload[key] === undefined) payload[key] = trimmed.slice(at + 1).trim();
  });

  // ⚠️ 「山田様」の「様」を外す
  payload.name = String(payload.name || '').replace(/[\s　]*様$/, '').trim();
  if (payload.name === '') return { skip: 'お施主様名が読めない' };
  payload.received_at = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  return payload;
}

// =====================================================================
// ⚠️ 手で実行する関数
// =====================================================================
function OwnersHouseMailImport() {
  const key = PropertiesService.getScriptProperties().getProperty('MEMBER_ENTRY_KEY');
  if (!key) {
    Logger.log('⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY が未設定です。取り込みを中止しました。');
    return;
  }
  const count = { success: 0, exists: 0, skip: 0, error: 0 };

  for (let start = 0; ; start += OH_IMPORT_PAGE) {
    const threads = GmailApp.search(OH_IMPORT_QUERY, start, OH_IMPORT_PAGE);
    if (threads.length === 0) break;
    for (const thread of threads) {
      for (const message of thread.getMessages()) {
        const payload = ohImportBuildPayload(message.getSubject(), message.getBody(), message.getDate(), message.getId());
        if (payload.skip) {
          count.skip++;
          Logger.log('送らない（' + payload.skip + '）: ' + message.getSubject());
          continue;
        }
        payload.key = key;
        const response = UrlFetchApp.fetch(OH_IMPORT_URL, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });
        const code = response.getResponseCode();
        const text = response.getContentText();
        Logger.log(code + ' ' + payload.received_at + ' ' + payload.name + ' : ' + text);
        if (code >= 500) {
          Logger.log('⚠️ ② に届きません。取り込みを止めました。② が直ってから、もう一度実行してください（取り込み済みは飛ばします）。');
          Logger.log(JSON.stringify(count));
          return;
        }
        if (code === 200 && text.indexOf('"exists"') !== -1) count.exists++;
        else if (code === 200) count.success++;
        else count.error++;
      }
    }
  }
  Logger.log('おわり: 取り込み ' + count.success + ' 件 / 取り込み済み ' + count.exists + ' 件 / 送らない ' + count.skip + ' 件 / エラー ' + count.error + ' 件');
}
