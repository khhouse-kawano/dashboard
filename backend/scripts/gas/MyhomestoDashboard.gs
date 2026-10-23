// =====================================================================
// マイホームズの「新規リード通知」メール → 反響（inquiry_customer）として取り込む（v2.2.214）
//
// ⚠️ 送信元: マイホームズ <no-reply@my-homes.jp>
// ⚠️ 件名  : 【マイホームズ】新規リード通知 ◯◯様／鹿児島県鹿児島市（頭に [marketing]: が付く）
// ⚠️ トリガー: MyhomestoDashboard（関数名は以前と同じ）
//
// ⚠️ 送り先:
//   1. ② https://api.khg-marketing.info/api/gateway （request: myhomes_entry）
//   2. ② に届かない（通信エラー・5xx）ときだけ ① https://khg-marketing.info/dashboard/api/gateway/ へ送り直す
//      （① の handlers/myhomes_entry.php が同じ処理をする）
//   ⚠️ 同じ inquiry_id（と、同じ日の同じ人）は二度入らない（2回目は status: exists）。何度実行しても二重にならない。
//
// ⚠️⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY（合い言葉）が要る。⚠️ 会員登録の GAS と同じ値。⚠️ ここに直書きしない。
//
// ⚠️ 以前の版（api/ 宛て。php は誤って消えた）から直したところ:
//   - ラベルで探さない（件名で探す）。Parser ライブラリを使わない（「【見出し】値」を行ごとに読む）
//   - inquiry_id をメールの「リードID」から作る（以前は php が受け取った時刻で、作り直せなかった）
//   - 店舗の照合の向きが逆だった（`表のエリア.includes(希望エリア)` → 実質いつも店舗未設定）。
//     sync の portalShopList.ts（最新）の KH 分で、希望エリア → 住所の順に探す
//   - 住所の空行・備考の区切り線と空行を入れない。名前とかなを「江口 舞（えぐち まい）」から分ける
//   - 年齢・希望内容・リードID・受付日時を備考（remarks）に残す
// =====================================================================

const MYHOMES_EXPRESS_URL = 'https://api.khg-marketing.info/api/gateway';
const MYHOMES_PHP_URL = 'https://khg-marketing.info/dashboard/api/gateway/';
/** ⚠️ 件名で探す（指示）。⚠️ 頭の [marketing]: はメーリングリストが付けるもの */
const MYHOMES_SUBJECT = '【マイホームズ】新規リード通知';
/** ⚠️ 以前と同じく 3日分を毎回読む（取り込み済みは受け側が飛ばす） */
const MYHOMES_QUERY = 'subject:"' + MYHOMES_SUBJECT + '" newer_than:3d';
/** ⚠️ 宛名は「株式会社国分ハウジング　ご担当者様」。⚠️ 国分ハウジングとして受けている */
const MYHOMES_BRAND = 'KH';
const MYHOMES_NOT_FOUND_SHOP = 'KH店舗未設定';

/** 備考に残す見出し（⚠️ この順で並べる）。⚠️ 名前・連絡先・住所・希望エリアは備考に入れない（それぞれの欄に入る） */
const MYHOMES_REMARK_LABELS = ['年齢', '建物代のご予算', 'ご希望の階数', '理想の間取り',
  '一緒に暮らす大人（18歳以上）', '18歳未満のお子様', '理想の土地の広さ', '土地の保有状況', 'リードID', '受付日時'];

/**
 * エリア・住所 → 店舗の表。⚠️⚠️ sync の utils/portalShopList.ts の **KH 分をそのまま写したもの**（2026-10-23）。
 *
 * ⚠️ 照合は「文字列に area を含む最初の1件」。⚠️ **先に一致した行が勝つ。**
 * ⚠️ 追加は必ず末尾に（福岡県も末尾。2文字の area が他県の住所に偶然当たらないように）。
 * ⚠️ shop は shop_list の店舗名と完全一致させること。⚠️ portalShopList.ts を直したら、ここも同じように直すこと。
 */
const MYHOMES_SHOP_LIST = [
  { shop: 'KH鹿児島店', area: '鹿児島市' },
  { shop: 'KH鹿屋店', area: '鹿屋市' },
  { shop: 'KH加世田店', area: '枕崎市' },
  { shop: 'KH出水阿久根店', area: '阿久根市' },
  { shop: 'KH出水阿久根店', area: '出水市' },
  { shop: 'KH加世田店', area: '指宿市' },
  { shop: 'KH鹿屋店', area: '垂水市' },
  { shop: 'KH薩摩川内店', area: '薩摩川内市' },
  { shop: 'KH鹿児島店', area: '日置市' },
  { shop: 'KH霧島店', area: '曽於市' },
  { shop: 'KH霧島店', area: '霧島市' },
  { shop: 'KH鹿屋店', area: '曽於郡' },
  { shop: 'KH薩摩川内店', area: 'いちき串木野市' },
  { shop: 'KH加世田店', area: '南さつま市' },
  { shop: 'KH鹿屋店', area: '志布志市' },
  { shop: 'KH加世田店', area: '南九州市' },
  { shop: 'KH姶良店', area: '伊佐市' },
  { shop: 'KH姶良店', area: '姶良市' },
  { shop: 'KH薩摩川内店', area: 'さつま町' },
  { shop: 'KH出水阿久根店', area: '長島町' },
  { shop: 'KH霧島店', area: '湧水町' },
  { shop: 'KH鹿屋店', area: '大崎町' },
  { shop: 'KH鹿屋店', area: '東串良町' },
  { shop: 'KH鹿屋店', area: '錦江町' },
  { shop: 'KH鹿屋店', area: '南大隅町' },
  { shop: 'KH鹿屋店', area: '肝付町' },
  { shop: 'KH宮崎店', area: '宮崎市' },
  { shop: 'KH都城店', area: '都城市' },
  { shop: 'KH延岡店', area: '延岡市' },
  { shop: 'KH都城店', area: '日南市' },
  { shop: 'KH都城店', area: '小林市' },
  { shop: 'KH延岡店', area: '日向市' },
  { shop: 'KH都城店', area: '串間市' },
  { shop: 'KH宮崎店', area: '西都市' },
  { shop: 'KH都城店', area: 'えびの市' },
  { shop: 'KH都城店', area: '三股町' },
  { shop: 'KH都城店', area: '高原町' },
  { shop: 'KH宮崎店', area: '国富町' },
  { shop: 'KH宮崎店', area: '綾町' },
  { shop: 'KH宮崎店', area: '高鍋町' },
  { shop: 'KH宮崎店', area: '新富町' },
  { shop: 'KH宮崎店', area: '西米良村' },
  { shop: 'KH宮崎店', area: '木城町' },
  { shop: 'KH宮崎店', area: '川南町' },
  { shop: 'KH宮崎店', area: '都農町' },
  { shop: 'KH延岡店', area: '門川町' },
  { shop: 'KH延岡店', area: '諸塚村' },
  { shop: 'KH延岡店', area: '椎葉村' },
  { shop: 'KH延岡店', area: '美郷町' },
  { shop: 'KH延岡店', area: '高千穂町' },
  { shop: 'KH延岡店', area: '日之影町' },
  { shop: 'KH延岡店', area: '五ヶ瀬町' },
  { shop: 'KH熊本店', area: '熊本市' },
  { shop: 'KH八代店', area: '八代市' },
  { shop: 'KH八代店', area: '人吉市' },
  { shop: 'KH熊本店', area: '荒尾市' },
  { shop: 'KH出水阿久根店', area: '水俣市' },
  { shop: 'KH熊本店', area: '玉名市' },
  { shop: 'KH熊本店', area: '山鹿市' },
  { shop: 'KH熊本店', area: '菊池市' },
  { shop: 'KH八代店', area: '宇土市' },
  { shop: 'KH八代店', area: '上天草市' },
  { shop: 'KH八代店', area: '宇城市' },
  { shop: 'KH熊本店', area: '阿蘇市' },
  { shop: 'KH八代店', area: '天草市' },
  { shop: 'KH熊本店', area: '合志市' },
  { shop: 'KH熊本店', area: '美里町' },
  { shop: 'KH熊本店', area: '玉東町' },
  { shop: 'KH熊本店', area: '南関町' },
  { shop: 'KH熊本店', area: '長洲町' },
  { shop: 'KH熊本店', area: '和水町' },
  { shop: 'KH熊本店', area: '大津町' },
  { shop: 'KH熊本店', area: '菊陽町' },
  { shop: 'KH熊本店', area: '南小国町' },
  { shop: 'KH熊本店', area: '小国町' },
  { shop: 'KH熊本店', area: '産山村' },
  { shop: 'KH熊本店', area: '高森町' },
  { shop: 'KH熊本店', area: '西原村' },
  { shop: 'KH熊本店', area: '南阿蘇村' },
  { shop: 'KH熊本店', area: '御船町' },
  { shop: 'KH熊本店', area: '嘉島町' },
  { shop: 'KH熊本店', area: '益城町' },
  { shop: 'KH熊本店', area: '甲佐町' },
  { shop: 'KH熊本店', area: '山都町' },
  { shop: 'KH八代店', area: '氷川町' },
  { shop: 'KH八代店', area: '芦北町' },
  { shop: 'KH八代店', area: '津奈木町' },
  { shop: 'KH八代店', area: '錦町' },
  { shop: 'KH八代店', area: '多良木町' },
  { shop: 'KH八代店', area: '湯前町' },
  { shop: 'KH八代店', area: '水上村' },
  { shop: 'KH八代店', area: '相良村' },
  { shop: 'KH八代店', area: '五木村' },
  { shop: 'KH八代店', area: '山江村' },
  { shop: 'KH八代店', area: '球磨村' },
  { shop: 'KH八代店', area: 'あさぎり町' },
  { shop: 'KH八代店', area: '苓北町' },
  { shop: 'KH大分店', area: '大分市' },
  { shop: 'KH大分店', area: '別府市' },
  { shop: 'KH大分店', area: '中津市' },
  { shop: 'KH大分店', area: '日田市' },
  { shop: 'KH大分店', area: '佐伯市' },
  { shop: 'KH大分店', area: '臼杵市' },
  { shop: 'KH大分店', area: '津久見市' },
  { shop: 'KH大分店', area: '竹田市' },
  { shop: 'KH大分店', area: '豊後高田市' },
  { shop: 'KH大分店', area: '杵築市' },
  { shop: 'KH大分店', area: '宇佐市' },
  { shop: 'KH大分店', area: '豊後大野市' },
  { shop: 'KH大分店', area: '由布市' },
  { shop: 'KH大分店', area: '国東市' },
  { shop: 'KH大分店', area: '姫島村' },
  { shop: 'KH大分店', area: '日出町' },
  { shop: 'KH大分店', area: '九重町' },
  { shop: 'KH大分店', area: '玖珠町' },
  { shop: 'KH佐賀店', area: '佐賀市' },
  { shop: 'KH佐賀店', area: '唐津市' },
  { shop: 'KH佐賀店', area: '鳥栖市' },
  { shop: 'KH佐賀店', area: '多久市' },
  { shop: 'KH佐賀店', area: '伊万里市' },
  { shop: 'KH佐賀店', area: '武雄市' },
  { shop: 'KH佐賀店', area: '鹿島市' },
  { shop: 'KH佐賀店', area: '小城市' },
  { shop: 'KH佐賀店', area: '嬉野市' },
  { shop: 'KH佐賀店', area: '神埼市' },
  { shop: 'KH佐賀店', area: '吉野ヶ里町' },
  { shop: 'KH佐賀店', area: '基山町' },
  { shop: 'KH佐賀店', area: '上峰町' },
  { shop: 'KH佐賀店', area: 'みやき町' },
  { shop: 'KH佐賀店', area: '玄海町' },
  { shop: 'KH佐賀店', area: '有田町' },
  { shop: 'KH佐賀店', area: '大町町' },
  { shop: 'KH佐賀店', area: '江北町' },
  { shop: 'KH佐賀店', area: '白石町' },
  { shop: 'KH佐賀店', area: '太良町' },
  // ⚠️ 福岡県（portalShopList.ts で 2026-09-08 追加）。⚠️ 必ず末尾に置く
  { shop: 'KH久留米店', area: '北九州市' },
  { shop: 'KH久留米店', area: '福岡市' },
  { shop: 'KH久留米店', area: '大牟田市' },
  { shop: 'KH久留米店', area: '久留米市' },
  { shop: 'KH久留米店', area: '直方市' },
  { shop: 'KH久留米店', area: '飯塚市' },
  { shop: 'KH久留米店', area: '田川市' },
  { shop: 'KH久留米店', area: '柳川市' },
  { shop: 'KH久留米店', area: '八女市' },
  { shop: 'KH久留米店', area: '筑後市' },
  { shop: 'KH久留米店', area: '大川市' },
  { shop: 'KH久留米店', area: '行橋市' },
  { shop: 'KH久留米店', area: '豊前市' },
  { shop: 'KH久留米店', area: '中間市' },
  { shop: 'KH久留米店', area: '小郡市' },
  { shop: 'KH久留米店', area: '筑紫野市' },
  { shop: 'KH久留米店', area: '春日市' },
  { shop: 'KH久留米店', area: '大野城市' },
  { shop: 'KH久留米店', area: '宗像市' },
  { shop: 'KH久留米店', area: '太宰府市' },
  { shop: 'KH久留米店', area: '古賀市' },
  { shop: 'KH久留米店', area: '福津市' },
  { shop: 'KH久留米店', area: 'うきは市' },
  { shop: 'KH久留米店', area: '宮若市' },
  { shop: 'KH久留米店', area: '嘉麻市' },
  { shop: 'KH久留米店', area: '朝倉市' },
  { shop: 'KH久留米店', area: 'みやま市' },
  { shop: 'KH久留米店', area: '糸島市' },
  { shop: 'KH久留米店', area: '那珂川市' },
  { shop: 'KH久留米店', area: '宇美町' },
  { shop: 'KH久留米店', area: '篠栗町' },
  { shop: 'KH久留米店', area: '志免町' },
  { shop: 'KH久留米店', area: '須恵町' },
  { shop: 'KH久留米店', area: '新宮町' },
  { shop: 'KH久留米店', area: '久山町' },
  { shop: 'KH久留米店', area: '粕屋町' },
  { shop: 'KH久留米店', area: '芦屋町' },
  { shop: 'KH久留米店', area: '水巻町' },
  { shop: 'KH久留米店', area: '岡垣町' },
  { shop: 'KH久留米店', area: '遠賀町' },
  { shop: 'KH久留米店', area: '小竹町' },
  { shop: 'KH久留米店', area: '鞍手町' },
  { shop: 'KH久留米店', area: '桂川町' },
  { shop: 'KH久留米店', area: '筑前町' },
  { shop: 'KH久留米店', area: '東峰村' },
  { shop: 'KH久留米店', area: '大刀洗町' },
  { shop: 'KH久留米店', area: '大木町' },
  { shop: 'KH久留米店', area: '広川町' },
  { shop: 'KH久留米店', area: '香春町' },
  { shop: 'KH久留米店', area: '添田町' },
  { shop: 'KH久留米店', area: '糸田町' },
  { shop: 'KH久留米店', area: '川崎町' },
  { shop: 'KH久留米店', area: '大任町' },
  { shop: 'KH久留米店', area: '赤村' },
  { shop: 'KH久留米店', area: '福智町' },
  { shop: 'KH久留米店', area: '苅田町' },
  { shop: 'KH久留米店', area: 'みやこ町' },
  { shop: 'KH久留米店', area: '吉富町' },
  { shop: 'KH久留米店', area: '上毛町' },
  { shop: 'KH久留米店', area: '築上町' },
];

/** 半角・全角の空白を前後から除く */
function myhomesTrim(text) {
  return String(text || '').replace(/^[\s　]+|[\s　]+$/g, '');
}

/** 全角の英数字・記号を半角に（電話・郵便番号用） */
function myhomesToHalfWidth(text) {
  return String(text || '').replace(/[！-～]/g, function (ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
}

/**
 * 本文を「【見出し】値」で読む。⚠️ 戻り値は { 見出し: [1行目, 2行目, ...] }。
 * ⚠️ 見出しの無い行は直前の見出しの続き（【ご住所】は次の行から〒と住所が続く）。
 * ⚠️ 空行・区切り線（━）・「■ 」の小見出しで閉じる。
 */
function myhomesParse(body) {
  const fields = {};
  let current = '';
  const lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = myhomesTrim(line);
    if (trimmed === '' || /^━/.test(trimmed) || /^■/.test(trimmed)) { current = ''; continue; }
    const matched = trimmed.match(/^【([^】]+)】(.*)$/);
    if (matched) {
      current = matched[1];
      const value = myhomesTrim(matched[2]);
      fields[current] = value === '' ? [] : [value];
      continue;
    }
    if (current) fields[current].push(trimmed);
  }
  return fields;
}

function myhomesValue(fields, label) {
  return (fields[label] || []).join(' ');
}

/** 「江口 舞（えぐち まい）」→ [名前, かな]。⚠️ かっこが無ければ全部を名前に */
function myhomesSplitName(text) {
  const m = String(text || '').match(/^(.+?)[\s　]*[（(](.+?)[）)][\s　]*$/);
  return m ? [myhomesTrim(m[1]), myhomesTrim(m[2])] : [myhomesTrim(text), ''];
}

/**
 * 【ご住所】の行 → [郵便番号（数字7桁）, 住所（複数行をつなぐ）]
 * ⚠️ 〒の行が無い・同じ行に続けて書かれていても分ける。
 */
function myhomesSplitAddress(lines) {
  const all = (lines || []).join(' ');
  const m = myhomesToHalfWidth(all).match(/〒?\s*(\d{3})-?(\d{4})/);
  const rest = m ? all.slice(0, m.index) + all.slice(m.index + m[0].length) : all;
  return [m ? m[1] + m[2] : '', myhomesTrim(rest.replace(/〒/g, '')).replace(/[\s　]+/g, ' ')];
}

/** 表から店舗を探す（先に一致した1件が勝つ）。⚠️ 見つからなければ '' */
function myhomesFindShop(text) {
  const target = String(text || '');
  if (target === '') return '';
  for (const row of MYHOMES_SHOP_LIST) {
    if (target.indexOf(row.area) !== -1) return row.shop;
  }
  return '';
}

/** 1通のメールから送る内容を作る。⚠️ 送らないメールは { skip: 理由 } */
function myhomesBuildPayload(subject, body, date) {
  const s = String(subject || '');
  if (s.indexOf(MYHOMES_SUBJECT) === -1) return { skip: '件名が違う' };
  if (/^\s*(re|fw|fwd)\s*[:：]/i.test(s)) return { skip: '返信・転送' };

  const f = myhomesParse(body);
  const leadId = myhomesValue(f, 'リードID').replace(/[\s　]/g, '');
  if (leadId === '') return { skip: 'リードIDが読めない' };

  const nameKana = myhomesSplitName(myhomesValue(f, 'お名前'));
  const name = nameKana[0].replace(/[\s　]+/g, ' ');
  const mobile = myhomesToHalfWidth(myhomesValue(f, '電話番号')).replace(/[\s　]/g, '');
  const mail = myhomesToHalfWidth(myhomesValue(f, 'メールアドレス')).replace(/[\s　]/g, '');
  if (name === '') return { skip: 'お名前が読めない' };
  if (mail === '' && mobile === '') return { skip: 'メールも電話も無い' };

  const address = myhomesSplitAddress(f['ご住所']);
  const area = myhomesValue(f, 'ご希望エリア').replace(/[\s　]+/g, ' ');
  const remarks = MYHOMES_REMARK_LABELS
    .map(function (label) { return [label, myhomesValue(f, label)]; })
    .filter(function (pair) { return pair[1]; })
    .map(function (pair) { return pair[0] + '：' + pair[1]; })
    .join('\n');

  return {
    request: 'myhomes_entry',
    // ⚠️ リードIDから作る（同じメールは何度読んでも同じ値）。⚠️ 変えないこと
    inquiry_id: 'myhomes_' + leadId,
    inquiry_date: Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd'),
    brand: MYHOMES_BRAND,
    // ⚠️ 希望エリア → 住所 の順に探す
    shop: myhomesFindShop(area) || myhomesFindShop(address[1]) || MYHOMES_NOT_FOUND_SHOP,
    name: name,
    kana: nameKana[1].replace(/[\s　]+/g, ' '),
    mobile: mobile,
    mail: mail,
    zip: address[0],
    address: address[1],
    area: area,
    remarks: remarks
  };
}

/**
 * 送る。② → だめなら ①。
 * ⚠️ ① に送り直すのは「② に届かなかった」とき（通信エラー・5xx）だけ。401・400 は ① でも同じなので送り直さない。
 */
function myhomesPost(payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const targets = [['②', MYHOMES_EXPRESS_URL], ['①', MYHOMES_PHP_URL]];
  for (const target of targets) {
    try {
      const response = UrlFetchApp.fetch(target[1], options);
      const code = response.getResponseCode();
      Logger.log(target[0] + ' ' + code + ' ' + payload.inquiry_id + ' ' + payload.shop + ' : ' + response.getContentText());
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
function MyhomestoDashboard() {
  const key = PropertiesService.getScriptProperties().getProperty('MEMBER_ENTRY_KEY');
  if (!key) {
    Logger.log('⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY が未設定です。取り込みを中止しました。');
    return;
  }
  GmailApp.search(MYHOMES_QUERY).forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      const payload = myhomesBuildPayload(message.getSubject(), message.getPlainBody(), message.getDate());
      if (payload.skip) {
        Logger.log('送らない（' + payload.skip + '）: ' + message.getSubject());
        return;
      }
      payload.key = key;
      myhomesPost(payload);
    });
  });
}
