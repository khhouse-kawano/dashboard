// =====================================================================
// ホームページの会員登録の通知メール → 反響（inquiry_customer）として取り込む（v2.2.209）
//
// ⚠️ 対象: 国分ハウジング（KH）・ニーエルホーム（2L）・なごみ工務店（Nagomi）・ジャスフィーホーム（JH）
// ⚠️ トリガー: MEMBERtoDashboard（関数名は以前と同じ）
//
// ⚠️ 送り先:
//   1. ② https://api.khg-marketing.info/api/gateway （request: member_entry）
//   2. ② に届かない（通信エラー・5xx）ときだけ ① https://khg-marketing.info/dashboard/api/gateway/ へ送り直す
//      （① の handlers/member_entry.php が同じ処理をする）
//   ⚠️ 同じ inquiry_id は二度入らない（2回目は status: exists）。何度実行しても二重にならない。
//
// ⚠️⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY（合い言葉）が要る。⚠️ ① ② と同じ値。⚠️ ここに直書きしない。
//
// ⚠️ 以前の版（api/member.php 宛て）から直したところ:
//   - Parser ライブラリを使わない（行ごとに「見出し : 値」で読む。見出しの後ろの空白の数が変わっても読める）
//   - 氏名・かな・電話・メールの空白を全部消す（以前は最初の1つだけ）
//   - 郵便番号を住所から分ける・なごみの「町村・番地」を拾う
//   - 店舗の割り当てをポータル反響（sync の utils/portalShopList.ts）と同じ表にする
//     （福岡県 → KH久留米店 を追加。存在しない「DJH八代店」「2L出水店」を使わない）
//   - 退会の通知・氏名が読めないメール・連絡先が無いメールは送らない
//   - 送信の結果（成功・登録済み・失敗）をログに残す
// =====================================================================

/** ② のゲートウェイ */
const MEMBER_EXPRESS_URL = 'https://api.khg-marketing.info/api/gateway';
/** ① のゲートウェイ（② に届かないときだけ） */
const MEMBER_PHP_URL = 'https://khg-marketing.info/dashboard/api/gateway/';

/**
 * ブランドごとの設定。
 *
 * ⚠️ query は以前の GAS と同じラベル・件名（Gmail のフィルタでラベルが付く）。
 * ⚠️ labels は「メール本文の見出し → 取り出す項目」。⚠️ 見出しは前後の空白を除いて完全一致で比べる。
 * ⚠️ campaign は inquiry_id と hp_campaign に入る。⚠️ **変えないこと**（変えると同じメールが別の反響として二重に入る）。
 */
const MEMBER_BRANDS = [
  {
    brand: 'KH',
    campaign: '【KH共通】会員登録',
    query: 'label:会員登録_KH newer_than:2d',
    labels: {
      'お名前': 'name',
      'ふりがな': 'kana',
      'メールアドレス': 'mail',
      '携帯電話番号': 'mobile',
      '年齢': 'age',
      'ご住所': 'address',
      '町村・番地': 'street',
      '何を見て「国分ハウジング」お知りになりましたか？': 'medium',
      '新しいお住まいのご希望': 'wish',
      'ご希望の土地のエリア': 'area',
      'ご質問・ご相談等': 'question'
    }
  },
  {
    brand: '2L',
    campaign: '【2L鹿児島】会員登録',
    query: 'label:ラクリア_2L subject:"【2Lhome】会員登録がありました" newer_than:2d',
    labels: {
      '名前(漢字)': 'name',
      '名前(かな)': 'kana',
      'メールアドレス': 'mail',
      '電話番号': 'mobile',
      '年齢': 'age',
      '郵便番号': 'zip',
      '都道府県': 'pref',
      '市・区': 'city',
      '町村・番地': 'street',
      'ビル名・建物名・番号': 'building',
      '何を見て「ニーエルホーム」をお知りになりましたか？': 'medium',
      '会員登録のきっかけ': 'trigger',
      '新しいお住まいのご希望': 'wish',
      'ご希望の土地のエリア': 'area',
      'ご意見・ご質問等': 'question'
    }
  },
  {
    brand: 'Nagomi',
    campaign: '【なごみ共通】会員登録',
    query: 'label:会員登録_なごみ subject:会員登録がありました newer_than:2d',
    labels: {
      'お名前': 'name',
      'ふりがな': 'kana',
      'メールアドレス': 'mail',
      '携帯電話番号': 'mobile',
      '年齢': 'age',
      'ご住所': 'address',
      '町村・番地': 'street',
      '何を見て「なごみ工務店」お知りになりましたか？': 'medium',
      '新しいお住まいのご希望': 'wish',
      'ご希望の土地のエリア': 'area',
      'ご質問・ご相談等': 'question'
    }
  },
  {
    brand: 'JH',
    campaign: '【JH共通】会員登録',
    query: 'label:会員登録_JH subject:会員登録がありました newer_than:2d',
    labels: {
      'お名前': 'name',
      'フリガナ': 'kana',
      '電話番号': 'mobile',
      'メールアドレス': 'mail',
      'ご住所': 'address',
      'ジャスフィーホームを知ったきっかけ': 'medium',
      'ご希望の土地のエリアを教えてください': 'area',
      'ご質問・ご相談等': 'question'
    }
  }
];

/** ⚠️ 見出しの無い行を「続き」として受ける項目（複数行になる自由記述） */
const MEMBER_MULTILINE_KEYS = ['question'];

/** 店舗が決まらないときの店舗名。⚠️ どれも Dashboard の店舗一覧（shop_list）に実在する */
const MEMBER_NOT_FOUND_SHOP = {
  KH: 'KH店舗未設定',
  Nagomi: 'なごみ店舗未設定',
  JH: 'JH店舗未設定',
  // ⚠️ 2L は店舗が1つだけなので、以前の GAS と同じく県外の住所でも 2L鹿児島店 にする
  '2L': '2L鹿児島店'
};

/**
 * 住所 → 店舗の表。⚠️⚠️ sync の utils/portalShopList.ts から 4ブランド分をそのまま写したもの（2026-10-22）。
 *
 * ⚠️ 照合は「ブランドが同じで、住所に area を含む最初の1件」。⚠️ **先に一致した行が勝つ。**
 * ⚠️ 追加は必ず末尾に（福岡県も末尾。2文字の area が他県の住所に偶然当たらないように）。
 * ⚠️ shop は shop_list の店舗名と完全一致させること（違うと一覧にも集計にも出ない顧客ができる）。
 * ⚠️ portalShopList.ts を直したら、ここも同じように直すこと。
 */
const MEMBER_SHOP_LIST = [
  { brand: 'KH', shop: 'KH鹿児島店', area: '鹿児島市' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '鹿屋市' },
  { brand: 'KH', shop: 'KH加世田店', area: '枕崎市' },
  { brand: 'KH', shop: 'KH出水阿久根店', area: '阿久根市' },
  { brand: 'KH', shop: 'KH出水阿久根店', area: '出水市' },
  { brand: 'KH', shop: 'KH加世田店', area: '指宿市' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '垂水市' },
  { brand: 'KH', shop: 'KH薩摩川内店', area: '薩摩川内市' },
  { brand: 'KH', shop: 'KH鹿児島店', area: '日置市' },
  { brand: 'KH', shop: 'KH霧島店', area: '曽於市' },
  { brand: 'KH', shop: 'KH霧島店', area: '霧島市' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '曽於郡' },
  { brand: 'KH', shop: 'KH薩摩川内店', area: 'いちき串木野市' },
  { brand: 'KH', shop: 'KH加世田店', area: '南さつま市' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '志布志市' },
  { brand: 'KH', shop: 'KH加世田店', area: '南九州市' },
  { brand: 'KH', shop: 'KH姶良店', area: '伊佐市' },
  { brand: 'KH', shop: 'KH姶良店', area: '姶良市' },
  { brand: 'KH', shop: 'KH薩摩川内店', area: 'さつま町' },
  { brand: 'KH', shop: 'KH出水阿久根店', area: '長島町' },
  { brand: 'KH', shop: 'KH霧島店', area: '湧水町' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '大崎町' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '東串良町' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '錦江町' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '南大隅町' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '肝付町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '宮崎市' },
  { brand: 'KH', shop: 'KH都城店', area: '都城市' },
  { brand: 'KH', shop: 'KH延岡店', area: '延岡市' },
  { brand: 'KH', shop: 'KH都城店', area: '日南市' },
  { brand: 'KH', shop: 'KH都城店', area: '小林市' },
  { brand: 'KH', shop: 'KH延岡店', area: '日向市' },
  { brand: 'KH', shop: 'KH都城店', area: '串間市' },
  { brand: 'KH', shop: 'KH宮崎店', area: '西都市' },
  { brand: 'KH', shop: 'KH都城店', area: 'えびの市' },
  { brand: 'KH', shop: 'KH都城店', area: '三股町' },
  { brand: 'KH', shop: 'KH都城店', area: '高原町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '国富町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '綾町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '高鍋町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '新富町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '西米良村' },
  { brand: 'KH', shop: 'KH宮崎店', area: '木城町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '川南町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '都農町' },
  { brand: 'KH', shop: 'KH延岡店', area: '門川町' },
  { brand: 'KH', shop: 'KH延岡店', area: '諸塚村' },
  { brand: 'KH', shop: 'KH延岡店', area: '椎葉村' },
  { brand: 'KH', shop: 'KH延岡店', area: '美郷町' },
  { brand: 'KH', shop: 'KH延岡店', area: '高千穂町' },
  { brand: 'KH', shop: 'KH延岡店', area: '日之影町' },
  { brand: 'KH', shop: 'KH延岡店', area: '五ヶ瀬町' },
  { brand: 'KH', shop: 'KH熊本店', area: '熊本市' },
  { brand: 'KH', shop: 'KH八代店', area: '八代市' },
  { brand: 'KH', shop: 'KH八代店', area: '人吉市' },
  { brand: 'KH', shop: 'KH熊本店', area: '荒尾市' },
  { brand: 'KH', shop: 'KH出水阿久根店', area: '水俣市' },
  { brand: 'KH', shop: 'KH熊本店', area: '玉名市' },
  { brand: 'KH', shop: 'KH熊本店', area: '山鹿市' },
  { brand: 'KH', shop: 'KH熊本店', area: '菊池市' },
  { brand: 'KH', shop: 'KH八代店', area: '宇土市' },
  { brand: 'KH', shop: 'KH八代店', area: '上天草市' },
  { brand: 'KH', shop: 'KH八代店', area: '宇城市' },
  { brand: 'KH', shop: 'KH熊本店', area: '阿蘇市' },
  { brand: 'KH', shop: 'KH八代店', area: '天草市' },
  { brand: 'KH', shop: 'KH熊本店', area: '合志市' },
  { brand: 'KH', shop: 'KH熊本店', area: '美里町' },
  { brand: 'KH', shop: 'KH熊本店', area: '玉東町' },
  { brand: 'KH', shop: 'KH熊本店', area: '南関町' },
  { brand: 'KH', shop: 'KH熊本店', area: '長洲町' },
  { brand: 'KH', shop: 'KH熊本店', area: '和水町' },
  { brand: 'KH', shop: 'KH熊本店', area: '大津町' },
  { brand: 'KH', shop: 'KH熊本店', area: '菊陽町' },
  { brand: 'KH', shop: 'KH熊本店', area: '南小国町' },
  { brand: 'KH', shop: 'KH熊本店', area: '小国町' },
  { brand: 'KH', shop: 'KH熊本店', area: '産山村' },
  { brand: 'KH', shop: 'KH熊本店', area: '高森町' },
  { brand: 'KH', shop: 'KH熊本店', area: '西原村' },
  { brand: 'KH', shop: 'KH熊本店', area: '南阿蘇村' },
  { brand: 'KH', shop: 'KH熊本店', area: '御船町' },
  { brand: 'KH', shop: 'KH熊本店', area: '嘉島町' },
  { brand: 'KH', shop: 'KH熊本店', area: '益城町' },
  { brand: 'KH', shop: 'KH熊本店', area: '甲佐町' },
  { brand: 'KH', shop: 'KH熊本店', area: '山都町' },
  { brand: 'KH', shop: 'KH八代店', area: '氷川町' },
  { brand: 'KH', shop: 'KH八代店', area: '芦北町' },
  { brand: 'KH', shop: 'KH八代店', area: '津奈木町' },
  { brand: 'KH', shop: 'KH八代店', area: '錦町' },
  { brand: 'KH', shop: 'KH八代店', area: '多良木町' },
  { brand: 'KH', shop: 'KH八代店', area: '湯前町' },
  { brand: 'KH', shop: 'KH八代店', area: '水上村' },
  { brand: 'KH', shop: 'KH八代店', area: '相良村' },
  { brand: 'KH', shop: 'KH八代店', area: '五木村' },
  { brand: 'KH', shop: 'KH八代店', area: '山江村' },
  { brand: 'KH', shop: 'KH八代店', area: '球磨村' },
  { brand: 'KH', shop: 'KH八代店', area: 'あさぎり町' },
  { brand: 'KH', shop: 'KH八代店', area: '苓北町' },
  { brand: 'KH', shop: 'KH大分店', area: '大分市' },
  { brand: 'KH', shop: 'KH大分店', area: '別府市' },
  { brand: 'KH', shop: 'KH大分店', area: '中津市' },
  { brand: 'KH', shop: 'KH大分店', area: '日田市' },
  { brand: 'KH', shop: 'KH大分店', area: '佐伯市' },
  { brand: 'KH', shop: 'KH大分店', area: '臼杵市' },
  { brand: 'KH', shop: 'KH大分店', area: '津久見市' },
  { brand: 'KH', shop: 'KH大分店', area: '竹田市' },
  { brand: 'KH', shop: 'KH大分店', area: '豊後高田市' },
  { brand: 'KH', shop: 'KH大分店', area: '杵築市' },
  { brand: 'KH', shop: 'KH大分店', area: '宇佐市' },
  { brand: 'KH', shop: 'KH大分店', area: '豊後大野市' },
  { brand: 'KH', shop: 'KH大分店', area: '由布市' },
  { brand: 'KH', shop: 'KH大分店', area: '国東市' },
  { brand: 'KH', shop: 'KH大分店', area: '姫島村' },
  { brand: 'KH', shop: 'KH大分店', area: '日出町' },
  { brand: 'KH', shop: 'KH大分店', area: '九重町' },
  { brand: 'KH', shop: 'KH大分店', area: '玖珠町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '佐賀市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '唐津市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '鳥栖市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '多久市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '伊万里市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '武雄市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '鹿島市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '小城市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '嬉野市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '神埼市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '吉野ヶ里町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '基山町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '上峰町' },
  { brand: 'KH', shop: 'KH佐賀店', area: 'みやき町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '玄海町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '有田町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '大町町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '江北町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '白石町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '太良町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '鹿児島市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '鹿屋市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '枕崎市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '阿久根市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '出水市' },
  { brand: 'Nagomi', shop: 'なごみ加世田店', area: '指宿市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '垂水市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '薩摩川内市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '日置市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '曽於市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '霧島市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: 'いちき串木野市' },
  { brand: 'Nagomi', shop: 'なごみ加世田店', area: '南さつま市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '志布志市' },
  { brand: 'Nagomi', shop: 'なごみ加世田店', area: '南九州市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '伊佐市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '姶良市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: 'さつま町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '長島町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '湧水町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '大崎町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '東串良町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '錦江町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '南大隅町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '肝付町' },
  { brand: '2L', shop: '2L鹿児島店', area: '鹿児島市' },
  { brand: '2L', shop: '2L鹿児島店', area: '鹿屋市' },
  { brand: '2L', shop: '2L鹿児島店', area: '枕崎市' },
  { brand: '2L', shop: '2L鹿児島店', area: '阿久根市' },
  { brand: '2L', shop: '2L鹿児島店', area: '出水市' },
  { brand: '2L', shop: '2L鹿児島店', area: '指宿市' },
  { brand: '2L', shop: '2L鹿児島店', area: '垂水市' },
  { brand: '2L', shop: '2L鹿児島店', area: '薩摩川内市' },
  { brand: '2L', shop: '2L鹿児島店', area: '日置市' },
  { brand: '2L', shop: '2L鹿児島店', area: '曽於市' },
  { brand: '2L', shop: '2L鹿児島店', area: '霧島市' },
  { brand: '2L', shop: '2L鹿児島店', area: 'いちき串木野市' },
  { brand: '2L', shop: '2L鹿児島店', area: '南さつま市' },
  { brand: '2L', shop: '2L鹿児島店', area: '志布志市' },
  { brand: '2L', shop: '2L鹿児島店', area: '南九州市' },
  { brand: '2L', shop: '2L鹿児島店', area: '伊佐市' },
  { brand: '2L', shop: '2L鹿児島店', area: '姶良市' },
  { brand: '2L', shop: '2L鹿児島店', area: 'さつま町' },
  { brand: '2L', shop: '2L鹿児島店', area: '長島町' },
  { brand: '2L', shop: '2L鹿児島店', area: '湧水町' },
  { brand: '2L', shop: '2L鹿児島店', area: '大崎町' },
  { brand: '2L', shop: '2L鹿児島店', area: '東串良町' },
  { brand: '2L', shop: '2L鹿児島店', area: '錦江町' },
  { brand: '2L', shop: '2L鹿児島店', area: '南大隅町' },
  { brand: '2L', shop: '2L鹿児島店', area: '肝付町' },
  { brand: 'JH', shop: 'JH熊本店', area: '熊本市' },
  { brand: 'JH', shop: 'JH八代店', area: '八代市' },
  { brand: 'JH', shop: 'JH八代店', area: '人吉市' },
  { brand: 'JH', shop: 'JH熊本店', area: '荒尾市' },
  { brand: 'JH', shop: 'JH八代店', area: '水俣市' },
  { brand: 'JH', shop: 'JH熊本店', area: '玉名市' },
  { brand: 'JH', shop: 'JH熊本店', area: '山鹿市' },
  { brand: 'JH', shop: 'JH熊本店', area: '菊池市' },
  { brand: 'JH', shop: 'JH八代店', area: '宇土市' },
  { brand: 'JH', shop: 'JH八代店', area: '上天草市' },
  { brand: 'JH', shop: 'JH八代店', area: '宇城市' },
  { brand: 'JH', shop: 'JH熊本店', area: '阿蘇市' },
  { brand: 'JH', shop: 'JH八代店', area: '天草市' },
  { brand: 'JH', shop: 'JH熊本店', area: '合志市' },
  { brand: 'JH', shop: 'JH熊本店', area: '美里町' },
  { brand: 'JH', shop: 'JH熊本店', area: '玉東町' },
  { brand: 'JH', shop: 'JH熊本店', area: '南関町' },
  { brand: 'JH', shop: 'JH熊本店', area: '長洲町' },
  { brand: 'JH', shop: 'JH熊本店', area: '和水町' },
  { brand: 'JH', shop: 'JH熊本店', area: '大津町' },
  { brand: 'JH', shop: 'JH熊本店', area: '菊陽町' },
  { brand: 'JH', shop: 'JH熊本店', area: '南小国町' },
  { brand: 'JH', shop: 'JH熊本店', area: '小国町' },
  { brand: 'JH', shop: 'JH熊本店', area: '産山村' },
  { brand: 'JH', shop: 'JH熊本店', area: '高森町' },
  { brand: 'JH', shop: 'JH熊本店', area: '西原村' },
  { brand: 'JH', shop: 'JH熊本店', area: '南阿蘇村' },
  { brand: 'JH', shop: 'JH熊本店', area: '御船町' },
  { brand: 'JH', shop: 'JH熊本店', area: '嘉島町' },
  { brand: 'JH', shop: 'JH熊本店', area: '益城町' },
  { brand: 'JH', shop: 'JH熊本店', area: '甲佐町' },
  { brand: 'JH', shop: 'JH熊本店', area: '山都町' },
  { brand: 'JH', shop: 'JH八代店', area: '氷川町' },
  { brand: 'JH', shop: 'JH八代店', area: '芦北町' },
  { brand: 'JH', shop: 'JH八代店', area: '津奈木町' },
  { brand: 'JH', shop: 'JH八代店', area: '錦町' },
  { brand: 'JH', shop: 'JH八代店', area: '多良木町' },
  { brand: 'JH', shop: 'JH八代店', area: '湯前町' },
  { brand: 'JH', shop: 'JH八代店', area: '水上村' },
  { brand: 'JH', shop: 'JH八代店', area: '相良村' },
  { brand: 'JH', shop: 'JH八代店', area: '五木村' },
  { brand: 'JH', shop: 'JH八代店', area: '山江村' },
  { brand: 'JH', shop: 'JH八代店', area: '球磨村' },
  { brand: 'JH', shop: 'JH八代店', area: 'あさぎり町' },
  { brand: 'JH', shop: 'JH八代店', area: '苓北町' },
  { brand: 'KH', shop: 'KH久留米店', area: '北九州市' },
  { brand: 'KH', shop: 'KH久留米店', area: '福岡市' },
  { brand: 'KH', shop: 'KH久留米店', area: '大牟田市' },
  { brand: 'KH', shop: 'KH久留米店', area: '久留米市' },
  { brand: 'KH', shop: 'KH久留米店', area: '直方市' },
  { brand: 'KH', shop: 'KH久留米店', area: '飯塚市' },
  { brand: 'KH', shop: 'KH久留米店', area: '田川市' },
  { brand: 'KH', shop: 'KH久留米店', area: '柳川市' },
  { brand: 'KH', shop: 'KH久留米店', area: '八女市' },
  { brand: 'KH', shop: 'KH久留米店', area: '筑後市' },
  { brand: 'KH', shop: 'KH久留米店', area: '大川市' },
  { brand: 'KH', shop: 'KH久留米店', area: '行橋市' },
  { brand: 'KH', shop: 'KH久留米店', area: '豊前市' },
  { brand: 'KH', shop: 'KH久留米店', area: '中間市' },
  { brand: 'KH', shop: 'KH久留米店', area: '小郡市' },
  { brand: 'KH', shop: 'KH久留米店', area: '筑紫野市' },
  { brand: 'KH', shop: 'KH久留米店', area: '春日市' },
  { brand: 'KH', shop: 'KH久留米店', area: '大野城市' },
  { brand: 'KH', shop: 'KH久留米店', area: '宗像市' },
  { brand: 'KH', shop: 'KH久留米店', area: '太宰府市' },
  { brand: 'KH', shop: 'KH久留米店', area: '古賀市' },
  { brand: 'KH', shop: 'KH久留米店', area: '福津市' },
  { brand: 'KH', shop: 'KH久留米店', area: 'うきは市' },
  { brand: 'KH', shop: 'KH久留米店', area: '宮若市' },
  { brand: 'KH', shop: 'KH久留米店', area: '嘉麻市' },
  { brand: 'KH', shop: 'KH久留米店', area: '朝倉市' },
  { brand: 'KH', shop: 'KH久留米店', area: 'みやま市' },
  { brand: 'KH', shop: 'KH久留米店', area: '糸島市' },
  { brand: 'KH', shop: 'KH久留米店', area: '那珂川市' },
  { brand: 'KH', shop: 'KH久留米店', area: '宇美町' },
  { brand: 'KH', shop: 'KH久留米店', area: '篠栗町' },
  { brand: 'KH', shop: 'KH久留米店', area: '志免町' },
  { brand: 'KH', shop: 'KH久留米店', area: '須恵町' },
  { brand: 'KH', shop: 'KH久留米店', area: '新宮町' },
  { brand: 'KH', shop: 'KH久留米店', area: '久山町' },
  { brand: 'KH', shop: 'KH久留米店', area: '粕屋町' },
  { brand: 'KH', shop: 'KH久留米店', area: '芦屋町' },
  { brand: 'KH', shop: 'KH久留米店', area: '水巻町' },
  { brand: 'KH', shop: 'KH久留米店', area: '岡垣町' },
  { brand: 'KH', shop: 'KH久留米店', area: '遠賀町' },
  { brand: 'KH', shop: 'KH久留米店', area: '小竹町' },
  { brand: 'KH', shop: 'KH久留米店', area: '鞍手町' },
  { brand: 'KH', shop: 'KH久留米店', area: '桂川町' },
  { brand: 'KH', shop: 'KH久留米店', area: '筑前町' },
  { brand: 'KH', shop: 'KH久留米店', area: '東峰村' },
  { brand: 'KH', shop: 'KH久留米店', area: '大刀洗町' },
  { brand: 'KH', shop: 'KH久留米店', area: '大木町' },
  { brand: 'KH', shop: 'KH久留米店', area: '広川町' },
  { brand: 'KH', shop: 'KH久留米店', area: '香春町' },
  { brand: 'KH', shop: 'KH久留米店', area: '添田町' },
  { brand: 'KH', shop: 'KH久留米店', area: '糸田町' },
  { brand: 'KH', shop: 'KH久留米店', area: '川崎町' },
  { brand: 'KH', shop: 'KH久留米店', area: '大任町' },
  { brand: 'KH', shop: 'KH久留米店', area: '赤村' },
  { brand: 'KH', shop: 'KH久留米店', area: '福智町' },
  { brand: 'KH', shop: 'KH久留米店', area: '苅田町' },
  { brand: 'KH', shop: 'KH久留米店', area: 'みやこ町' },
  { brand: 'KH', shop: 'KH久留米店', area: '吉富町' },
  { brand: 'KH', shop: 'KH久留米店', area: '上毛町' },
  { brand: 'KH', shop: 'KH久留米店', area: '築上町' },
];

/** 全角の英数字・記号を半角に（電話・郵便番号用） */
function memberToHalfWidth(text) {
  return String(text || '').replace(/[！-～]/g, function (ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
}

/** 半角・全角の空白をすべて消す */
function memberRemoveSpaces(text) {
  return String(text || '').replace(/[\s　]+/g, '');
}

/**
 * 本文を「見出し : 値」で読む。
 *
 * ⚠️ 半角・全角のコロンを受ける。⚠️ 見出しの後ろの空白の数はメールごとに違うので trim して比べる。
 * ⚠️ 値が空の見出しは、⚠️ **次の行からが値**（KH・なごみの「何を見て…」は値が次の行に来る）。
 * ⚠️ 見出しの無い行は、直前の項目の続き。⚠️ ただし続きにするのは「何を見て」のように値が空だった項目と自由記述だけ。
 * ⚠️ `----` `====` の区切り線・知らない見出しで直前の項目を閉じる（2L の「その他を選択された方」などを混ぜない）。
 * ⚠️ `--` だけの行（署名の区切り）で読むのをやめる。
 */
function memberParseBody(body, labels) {
  const result = {};
  Object.keys(labels).forEach(function (label) { result[labels[label]] = ''; });

  let currentKey = '';
  let openForNextLine = false;
  const lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '--') break;
    if (/^[-=]{3,}/.test(trimmed)) { currentKey = ''; continue; }

    const matched = trimmed.match(/^([^:：]+?)\s*[:：]\s*(.*)$/);
    const key = matched ? labels[matched[1].trim()] : undefined;
    if (key) {
      currentKey = key;
      result[key] = matched[2].trim();
      openForNextLine = result[key] === '';
      continue;
    }
    // ⚠️ 自由記述の途中に「時間: 10時」のような行があっても続きとして受ける
    const continues = currentKey !== '' && (openForNextLine || MEMBER_MULTILINE_KEYS.indexOf(currentKey) !== -1);
    if (matched && !continues) { currentKey = ''; continue; }
    if (continues && trimmed !== '') {
      result[currentKey] = result[currentKey] ? result[currentKey] + '\n' + trimmed : trimmed;
      // ⚠️ 「何を見て」の値は1行だけ。次の行は別の項目
      if (MEMBER_MULTILINE_KEYS.indexOf(currentKey) === -1) { currentKey = ''; openForNextLine = false; }
    }
  }
  return result;
}

/**
 * 住所の先頭の郵便番号を分ける。「〒8740840 大分県別府市鶴見」→ ['8740840', '大分県別府市鶴見']
 * ⚠️ ハイフン・全角数字・〒 の有無を問わない。
 */
function memberSplitZip(address) {
  const text = String(address || '').trim();
  const matched = memberToHalfWidth(text).match(/^〒?\s*(\d{3})-?(\d{4})\s*/);
  if (!matched) return ['', text];
  return [matched[1] + matched[2], text.slice(matched[0].length).trim()];
}

/** ブランドと住所から店舗を決める（ポータル反響と同じ。先に一致した1件が勝つ） */
function memberResolveShop(brand, address) {
  const text = String(address || '');
  if (text !== '') {
    for (const row of MEMBER_SHOP_LIST) {
      if (row.brand === brand && text.indexOf(row.area) !== -1) return row.shop;
    }
  }
  return MEMBER_NOT_FOUND_SHOP[brand] || 'ブランド・店舗未設定';
}

/** 日本時間の日付 */
function memberFormatDate(date, pattern) {
  return Utilities.formatDate(date, 'Asia/Tokyo', pattern);
}

/**
 * 1通のメールから送る内容を作る。⚠️ 送らないメールは null（理由をログに出す）。
 */
function memberBuildPayload(config, subject, body, date) {
  // ⚠️ 退会の通知は反響にしない（件名か、本文の最初の行に「退会」）
  const firstLine = (String(body || '').trim().split('\n')[0] || '');
  if (String(subject || '').indexOf('退会') !== -1 || firstLine.indexOf('退会') !== -1) {
    return { skip: '退会の通知' };
  }

  const v = memberParseBody(body, config.labels);
  const name = memberRemoveSpaces(v.name);
  const mail = memberRemoveSpaces(v.mail);
  const mobile = memberToHalfWidth(memberRemoveSpaces(v.mobile));
  if (name === '') return { skip: 'お名前が読めない' };
  if (mail === '' && mobile === '') return { skip: 'メールも電話も無い' };

  // ⚠️ 2L は項目が分かれて届く。他は「ご住所（〒＋都道府県市区町村）」＋「町村・番地」
  let zip = memberToHalfWidth(String(v.zip || '').replace(/[〒\-ー－\s]/g, ''));
  let address = '';
  if (config.brand === '2L') {
    address = [v.pref, v.city, v.street, v.building].join('').trim();
  } else {
    const split = memberSplitZip(v.address);
    zip = split[0];
    address = (split[1] + (v.street || '')).trim();
  }

  const remarks = [
    ['年齢', v.age],
    ['会員登録のきっかけ', v.trigger],
    ['新しいお住まいのご希望', v.wish],
    ['ご希望の土地のエリア', v.area],
    ['ご質問・ご相談等', v.question]
  ].filter(function (pair) { return pair[1]; })
    .map(function (pair) { return pair[0] + '：' + pair[1]; })
    .join('\n');

  return {
    request: 'member_entry',
    // ⚠️ 以前の GAS と同じ形（homepage＋日時＋キャンペーン名）。切り替えの前後で同じメールが二重に入らないように
    inquiry_id: 'homepage' + memberFormatDate(date, 'yyyy/MM/ddHH:mm:ss') + config.campaign,
    inquiry_date: memberFormatDate(date, 'yyyy/MM/dd'),
    brand: config.brand,
    shop: memberResolveShop(config.brand, address),
    campaign: config.campaign,
    // ⚠️ 2L は複数選べる。以前と同じく最初の1つ
    response_medium: String(v.medium || '').split(/[,、]/)[0].trim(),
    name: name,
    kana: memberRemoveSpaces(v.kana),
    mobile: mobile,
    mail: mail,
    zip: zip,
    address: address,
    remarks: remarks
  };
}

/**
 * 送る。② → だめなら ①。
 * ⚠️ ① に送り直すのは「② に届かなかった」とき（通信エラー・5xx）だけ。
 *   401（合い言葉違い）・400（項目不足）は ① でも同じ結果なので送り直さない。
 */
function memberPost(payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const targets = [['②', MEMBER_EXPRESS_URL], ['①', MEMBER_PHP_URL]];

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
function MEMBERtoDashboard() {
  const key = PropertiesService.getScriptProperties().getProperty('MEMBER_ENTRY_KEY');
  if (!key) {
    Logger.log('⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY が未設定です。取り込みを中止しました。');
    return;
  }

  MEMBER_BRANDS.forEach(function (config) {
    const threads = GmailApp.search(config.query);
    threads.forEach(function (thread) {
      thread.getMessages().forEach(function (message) {
        const payload = memberBuildPayload(config, message.getSubject(), message.getPlainBody(), message.getDate());
        if (payload.skip) {
          Logger.log(config.brand + ' 送らない（' + payload.skip + '）: ' + message.getSubject());
          return;
        }
        payload.key = key;
        memberPost(payload);
      });
    });
  });
}
