// =====================================================================
// ハウジングバザールの問い合わせ通知メール → 反響（inquiry_customer）として取り込む（v2.2.210）
//
// ⚠️ 送信元: ハウジングバザール <bazar@g-rexjapan.co.jp>
// ⚠️ 件名  : 【ハウジングバザール】お問い合わせがありました。（頭に [marketing]: [lead]: が付く）
// ⚠️ トリガー: HousingBtoDashboard（関数名は以前と同じ）
//
// ⚠️ 送り先:
//   1. ② https://api.khg-marketing.info/api/gateway （request: housing_bazar_entry）
//   2. ② に届かない（通信エラー・5xx）ときだけ ① https://khg-marketing.info/dashboard/api/gateway/ へ送り直す
//      （① の handlers/housing_bazar_entry.php が同じ処理をする）
//   ⚠️ 同じ inquiry_id は二度入らない（2回目は status: exists）。何度実行しても二重にならない。
//
// ⚠️⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY（合い言葉）が要る。⚠️ 会員登録の GAS と同じ値。⚠️ ここに直書きしない。
// ⚠️ ブランド・店舗は送らない（受け側が「KHG・ブランド・店舗未設定」で入れる）。
//
// ⚠️ 以前の版（api/portal.php 宛て。portal.php は誤って消えた）から直したところ:
//   - ラベルで探さない（件名で探す）
//   - Parser ライブラリを使わない（「◆ 見出し：値」を行ごとに読む。値が次の行に続く住所・建築予定地も拾う）
//   - 住所の頭の1文字が欠けていた（改行を消してから slice(9) していたため）→ 郵便番号と住所を分けて読む
//   - 建築予定地は「無し／有り」と場所を分ける（場所は area、土地の有無は備考）
//   - 家族人数・年齢・建築予定時期・予算・資料請求・ご要望を備考（remarks）に残す
// =====================================================================

const BAZAR_EXPRESS_URL = 'https://api.khg-marketing.info/api/gateway';
const BAZAR_PHP_URL = 'https://khg-marketing.info/dashboard/api/gateway/';
/** ⚠️ 件名で探す（指示）。⚠️ 頭の [marketing]: [lead]: はメーリングリストが付けるもの（部分一致なので気にしない） */
const BAZAR_SUBJECT = '【ハウジングバザール】お問い合わせがありました';
const BAZAR_QUERY = 'subject:"' + BAZAR_SUBJECT + '" newer_than:7d';

/** 半角・全角の空白を前後から除く */
function bazarTrim(text) {
  return String(text || '').replace(/^[\s　]+|[\s　]+$/g, '');
}

/** 全角の英数字・記号を半角に（電話・郵便番号用） */
function bazarToHalfWidth(text) {
  return String(text || '').replace(/[！-～]/g, function (ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
}

/**
 * 本文を「◆ 見出し：値」で読む。⚠️ 戻り値は { 見出し: [1行目, 2行目, ...] }。
 *
 * ⚠️ ◆ で始まる行が見出し。⚠️ 見出しと値は全角・半角のコロンで分かれる（コロンが無い見出しもある）。
 * ⚠️ 見出しの後ろの空白（「年齢 ：」など）は除いて比べる。
 * ⚠️ 次の ◆・区切り線（===）・空行までが、その見出しの値の続き（住所・建築予定地・ご要望は複数行になる）。
 */
function bazarParse(body) {
  const fields = {};
  let current = null;
  const lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = bazarTrim(line);
    if (/^◆/.test(trimmed)) {
      const head = trimmed.replace(/^◆[\s　]*/, '');
      const at = head.search(/[：:]/);
      const label = bazarTrim(at === -1 ? head : head.slice(0, at)).replace(/[\s　]+/g, '');
      const value = at === -1 ? '' : bazarTrim(head.slice(at + 1));
      current = label;
      fields[label] = value === '' ? [] : [value];
      continue;
    }
    if (trimmed === '' || /^={3,}/.test(trimmed)) { current = null; continue; }
    if (current) fields[current].push(trimmed);
  }
  return fields;
}

/** 見出しの値（複数行は区切りでつなぐ） */
function bazarValue(fields, label, sep) {
  return (fields[label] || []).join(sep === undefined ? ' ' : sep).replace(/[\s　]+$/, '');
}

/**
 * 住所：「〒8995121」の行と、その下の住所の行。⚠️ 同じ行に続けて書かれていても分ける。
 * ⚠️ 戻り値は [郵便番号（数字7桁）, 住所]
 */
function bazarSplitAddress(lines) {
  const all = (lines || []).join(' ');
  const half = bazarToHalfWidth(all);
  const m = half.match(/〒?\s*(\d{3})-?(\d{4})/);
  const zip = m ? m[1] + m[2] : '';
  const rest = m ? all.slice(0, m.index) + all.slice(m.index + m[0].length) : all;
  return [zip, bazarTrim(rest.replace(/^[\s　]*〒/, '')).replace(/[\s　]+/g, ' ')];
}

/**
 * 建築予定地：1行目が「無し／有り」なら土地の有無、残りが場所。⚠️ 場所は「鹿児島県 霧島市」の形で来る。
 * ⚠️ 戻り値は [場所, 土地の有無]
 */
function bazarSplitPlace(lines) {
  const list = (lines || []).slice();
  let land = '';
  if (list.length && /^(無し|なし|有り|あり)$/.test(list[0])) land = list.shift();
  return [list.join(' ').replace(/[\s　]+/g, ' ').trim(), land];
}

/** 1通のメールから送る内容を作る。⚠️ 送らないメールは { skip: 理由 } */
function bazarBuildPayload(subject, body, date) {
  const s = String(subject || '');
  if (s.indexOf(BAZAR_SUBJECT) === -1) return { skip: '件名が違う' };
  if (/^\s*(re|fw|fwd)\s*[:：]/i.test(s)) return { skip: '返信・転送' };

  const f = bazarParse(body);
  const name = bazarValue(f, 'お名前').replace(/[\s　]+/g, ' ');
  const mobile = bazarToHalfWidth(bazarValue(f, 'TEL')).replace(/[\s　]/g, '');
  const mail = bazarToHalfWidth(bazarValue(f, 'Emailアドレス')).replace(/[\s　]/g, '');
  if (name === '') return { skip: 'お名前が読めない' };
  if (mail === '' && mobile === '') return { skip: 'メールも電話も無い' };

  const address = bazarSplitAddress(f['住所']);
  const place = bazarSplitPlace(f['建築予定地']);
  const remarks = [
    ['資料請求', bazarValue(f, '資料請求').replace(/、$/, '')],
    ['コンタクト方法', bazarValue(f, 'コンタクト方法')],
    ['建築予定地の土地', place[1]],
    ['家族人数', bazarValue(f, '家族人数')],
    ['年齢', bazarValue(f, '年齢')],
    ['勤務先', bazarValue(f, '勤務先')],
    ['建築予定時期', bazarValue(f, '建築予定時期')],
    ['建築予算', bazarValue(f, '建築予算')],
    ['既に話している会社', bazarValue(f, 'こちらの会社と既にお話しをされていますか？')],
    ['ご要望', bazarValue(f, 'その他ご要望', '\n')],
  ].filter(function (pair) { return pair[1]; })
    .map(function (pair) { return pair[0] + '：' + pair[1]; })
    .join('\n');

  return {
    request: 'housing_bazar_entry',
    // ⚠️ 以前の GAS と同じ形（housingBazar＋UTC の日時＋KHG）。⚠️ 取り込み済みのメールが二重に入らないように
    inquiry_id: 'housingBazar' + date.toISOString() + 'KHG',
    inquiry_date: Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd'),
    name: name,
    kana: bazarValue(f, 'フリガナ').replace(/[\s　]+/g, ' '),
    mobile: mobile,
    mail: mail,
    zip: address[0],
    address: address[1],
    area: place[0],
    remarks: remarks
  };
}

/**
 * 送る。② → だめなら ①。
 * ⚠️ ① に送り直すのは「② に届かなかった」とき（通信エラー・5xx）だけ。401・400 は ① でも同じなので送り直さない。
 */
function bazarPost(payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const targets = [['②', BAZAR_EXPRESS_URL], ['①', BAZAR_PHP_URL]];
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
function HousingBtoDashboard() {
  const key = PropertiesService.getScriptProperties().getProperty('MEMBER_ENTRY_KEY');
  if (!key) {
    Logger.log('⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY が未設定です。取り込みを中止しました。');
    return;
  }
  GmailApp.search(BAZAR_QUERY).forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      const payload = bazarBuildPayload(message.getSubject(), message.getPlainBody(), message.getDate());
      if (payload.skip) {
        Logger.log('送らない（' + payload.skip + '）: ' + message.getSubject());
        return;
      }
      payload.key = key;
      bazarPost(payload);
    });
  });
}
