// =====================================================================
// 土地新着ネットの「新規会員登録発生通知メール」→ 反響（inquiry_customer）として取り込む（v2.2.212）
//
// ⚠️ 送信元: 土地新着ネット <ask@tochi-shinchaku.net>
// ⚠️ 件名  : 新規会員登録発生通知メール
// ⚠️ トリガー: TochishinchakuToDashboard（関数名は以前と同じ）
//
// ⚠️ 送り先:
//   1. ② https://api.khg-marketing.info/api/gateway （request: tochishinchaku_entry）
//   2. ② に届かない（通信エラー・5xx）ときだけ ① https://khg-marketing.info/dashboard/api/gateway/ へ送り直す
//      （① の handlers/tochishinchaku_entry.php が同じ処理をする）
//   ⚠️ 同じ inquiry_id（と、同じ日の同じ人）は二度入らない（2回目は status: exists）。何度実行しても二重にならない。
//
// ⚠️⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY（合い言葉）が要る。⚠️ 会員登録の GAS と同じ値。⚠️ ここに直書きしない。
//   ⚠️ 以前の版が Authorization ヘッダーに直書きしていた合い言葉は使わない（消してよい）。
// ⚠️ ブランド・店舗は送らない（受け側が「KHG・ブランド・店舗未設定」で入れる。指示）。
//
// ⚠️ 以前の版（api/ 宛て。php は誤って消えた）から直したところ:
//   - ラベルで探さない（件名で探す）。Parser ライブラリを使わない（行ごとに読む）
//   - 「電話番号」も送る（以前は読んでいたが保存されていなかった）
//   - 希望エリアの全部・希望価格・面積・校区・路線・建築の予定・ハウスメーカー・その他・発生源を備考（remarks）に残す
//   - 名前もメールも電話も読めないメールは送らない
// =====================================================================

const TOCHI_EXPRESS_URL = 'https://api.khg-marketing.info/api/gateway';
const TOCHI_PHP_URL = 'https://khg-marketing.info/dashboard/api/gateway/';
/** ⚠️ 件名で探す（指示）。⚠️ 本文の見出しでも土地新着ネットのメールか確かめる */
const TOCHI_SUBJECT = '新規会員登録発生通知メール';
const TOCHI_BODY_MARK = '土地新着ネットの新規会員登録情報';
/** ⚠️ 以前と同じく 3日分を毎回読む（取り込み済みは受け側が飛ばす） */
const TOCHI_QUERY = 'subject:"' + TOCHI_SUBJECT + '" newer_than:3d';

/** 上の段の「見出し：値」（⚠️ 本文の見出しのまま） */
const TOCHI_LABELS = ['発生源', 'メールアドレス', 'お名前', 'フリガナ', '住所', '電話番号', '携帯番号', 'メール送信'];
/** 「土地希望条件」の ■ 見出しのうち、備考に残すもの（⚠️ この順で並べる） */
const TOCHI_CONDITIONS = ['希望エリア', '希望路線', '希望価格', '希望土地面積', '希望校区',
  '建築の予定はありますか？', 'ハウスメーカーはお決まりですか？', 'その他希望条件'];

/** 半角・全角の空白を前後から除く */
function tochiTrim(text) {
  return String(text || '').replace(/^[\s　]+|[\s　]+$/g, '');
}

/** 全角の英数字・記号を半角に（電話・郵便番号用） */
function tochiToHalfWidth(text) {
  return String(text || '').replace(/[！-～]/g, function (ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
}

/**
 * 本文を読む。⚠️ 戻り値は { fields: { 見出し: 値 }, conditions: { ■見出し: [行, ...] } }。
 *
 * ⚠️ 上の段は「見出し：値」（全角コロン）。⚠️ 値が空の見出し（電話番号：）もある。
 * ⚠️ 「土地希望条件」より下は「■ 見出し」の次の行からが値（複数行）。次の ■ か「このメールは」で閉じる。
 */
function tochiParse(body) {
  const result = { fields: {}, conditions: {} };
  const lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');
  let inConditions = false;
  let current = '';

  for (const line of lines) {
    const trimmed = tochiTrim(line);
    if (trimmed === '土地希望条件') { inConditions = true; current = ''; continue; }
    if (/^このメールは/.test(trimmed)) break;

    if (inConditions) {
      const head = trimmed.match(/^■[\s　]*(.+)$/);
      if (head) { current = tochiTrim(head[1]); result.conditions[current] = []; continue; }
      if (current && trimmed !== '') result.conditions[current].push(trimmed);
      continue;
    }
    const matched = trimmed.match(/^([^：:]+?)[\s　]*[：:][\s　]*(.*)$/);
    if (matched && TOCHI_LABELS.indexOf(matched[1]) !== -1) result.fields[matched[1]] = tochiTrim(matched[2]);
  }
  return result;
}

/**
 * 住所「〒893-0032　鹿児島県鹿屋市…」→ [郵便番号（893-0032 の形。以前と同じ）, 住所]
 * ⚠️ 〒 が無い・郵便番号が無い住所でもそのまま住所として返す。
 */
function tochiSplitAddress(text) {
  const value = tochiTrim(text);
  const m = tochiToHalfWidth(value).match(/^〒?[\s　]*(\d{3})-?(\d{4})[\s　]*/);
  if (!m) return ['', value.replace(/^〒[\s　]*/, '')];
  return [m[1] + '-' + m[2], tochiTrim(value.slice(m[0].length))];
}

/** 1通のメールから送る内容を作る。⚠️ 送らないメールは { skip: 理由 } */
function tochiBuildPayload(subject, body, date) {
  const s = String(subject || '');
  if (s.indexOf(TOCHI_SUBJECT) === -1) return { skip: '件名が違う' };
  if (/^\s*(re|fw|fwd)\s*[:：]/i.test(s)) return { skip: '返信・転送' };
  if (String(body || '').indexOf(TOCHI_BODY_MARK) === -1) return { skip: '土地新着ネットのメールではない' };

  const parsed = tochiParse(body);
  const f = parsed.fields;
  const c = parsed.conditions;
  const name = (f['お名前'] || '').replace(/[\s　]+/g, ' ');
  const mail = tochiToHalfWidth(f['メールアドレス']).replace(/[\s　]/g, '');
  const mobile = tochiToHalfWidth(f['携帯番号']).replace(/[\s　]/g, '');
  const tel = tochiToHalfWidth(f['電話番号']).replace(/[\s　]/g, '');
  if (name === '') return { skip: 'お名前が読めない' };
  if (mail === '' && mobile === '' && tel === '') return { skip: 'メールも電話も無い' };

  const address = tochiSplitAddress(f['住所']);
  const areas = c['希望エリア'] || [];
  const remarks = TOCHI_CONDITIONS
    .map(function (label) { return [label, (c[label] || []).join('、')]; })
    .concat([['発生源', f['発生源'] || ''], ['メール送信', f['メール送信'] || '']])
    .filter(function (pair) { return pair[1]; })
    .map(function (pair) { return pair[0] + '：' + pair[1]; })
    .join('\n');

  return {
    request: 'tochishinchaku_entry',
    // ⚠️ 以前と同じ形（tochishinchaku_＋受信日＋受信日時）。⚠️ 変えないこと（取り込み済みのメールが二重に入る）
    inquiry_id: 'tochishinchaku_' + Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd')
      + Utilities.formatDate(date, 'Asia/Tokyo', 'yyyyMMdd_HHmmss'),
    inquiry_date: Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd'),
    name: name,
    kana: (f['フリガナ'] || '').replace(/[\s　]+/g, ' '),
    mail: mail,
    mobile: mobile,
    tel: tel,
    zip: address[0],
    address: address[1],
    // ⚠️ 以前と同じく希望エリアの1行目（全部は備考に入る）
    area: areas[0] || '',
    remarks: remarks
  };
}

/**
 * 送る。② → だめなら ①。
 * ⚠️ ① に送り直すのは「② に届かなかった」とき（通信エラー・5xx）だけ。401・400 は ① でも同じなので送り直さない。
 */
function tochiPost(payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const targets = [['②', TOCHI_EXPRESS_URL], ['①', TOCHI_PHP_URL]];
  for (const target of targets) {
    try {
      const response = UrlFetchApp.fetch(target[1], options);
      const code = response.getResponseCode();
      Logger.log(target[0] + ' ' + code + ' ' + payload.inquiry_id + ' : ' + response.getContentText());
      if (code < 500) return code === 200;
    } catch (e) {
      Logger.log(target[0] + ' 送信エラー ' + payload.inquiry_id + ' : ' + e.toString());
    }
  }
  return false;
}

// =====================================================================
// ⚠️ メインの実行関数。⚠️ **トリガーはこれを指定する**（以前と同じ関数名）
// =====================================================================
function TochishinchakuToDashboard() {
  const key = PropertiesService.getScriptProperties().getProperty('MEMBER_ENTRY_KEY');
  if (!key) {
    Logger.log('⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY が未設定です。取り込みを中止しました。');
    return;
  }
  GmailApp.search(TOCHI_QUERY).forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      const payload = tochiBuildPayload(message.getSubject(), message.getPlainBody(), message.getDate());
      if (payload.skip) {
        Logger.log('送らない（' + payload.skip + '）: ' + message.getSubject());
        return;
      }
      payload.key = key;
      tochiPost(payload);
    });
  });
}
