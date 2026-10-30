// =====================================================================
// LIFULL HOME'S「不動産売却査定サービス」の査定依頼メール → 売り反響（brokerage_listings の kind = leads）として取り込む（v2.2.236）
//
// ⚠️ 取り込むメール: 件名「【LIFULL HOME'S】＜実名＞査定依頼がありました」（差出人 support@homes.co.jp）
//   ⚠️ 頭の [marketing]: [khr]: はメーリングリストが付けるもの。⚠️ ＜匿名＞の査定依頼（連絡先が無い）は取り込まない。
// ⚠️ トリガー: HomesSaleAssessmentToDashboard を 5分おき。⚠️ 毎回 newer_than:1d（直近1日）を読む。
// ⚠️ 送り先: ② https://api.khg-marketing.info/api/gateway （request: homes_sale_assessment_entry）
//   ⚠️ ① に予備は無い（② が直れば、次の実行で直近1日分を取り込み直す）。
//   ⚠️ 同じ査定ID、または前後90日に同じ電話番号の売り反響があれば ② が入れない（status: exists）。何度送っても二重にならない。
// ⚠️⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY（合い言葉）が要る。⚠️ 会員登録の GAS と同じ値。⚠️ ここに直書きしない。
// =====================================================================

const HOMES_SALE_URL = 'https://api.khg-marketing.info/api/gateway';
const HOMES_SALE_SUBJECT = "【LIFULL HOME'S】＜実名＞査定依頼がありました";
const HOMES_SALE_QUERY = 'subject:"' + HOMES_SALE_SUBJECT + '" newer_than:1d';

/** 本文の見出し → 送る項目。⚠️ 見出しは 2026-10 のメールの見本から。HOME'S が見出しを変えたら、ここも変えること */
const HOMES_SALE_LABELS = {
  '査定ID（問合せ番号）': 'assessment_id',
  '物件種別': 'property_type',
  '所在地': 'location',
  '間取り': 'layout',
  '建物面積': 'building_area',
  '土地面積': 'land_area',
  '築年': 'built_year',
  '現況': 'current_status',
  '名義': 'ownership',
  '売却理由': 'reason',
  '売却希望時期': 'timing',
  'ご要望': 'wish',
  'お名前': 'name',
  'フリガナ': 'kana',
  'ご住所': 'customer_address',
  '電話番号': 'phone',
  'メールアドレス': 'mail',
  '希望の連絡時間': 'contact_time',
  '希望の連絡方法': 'contact_method',
  '同時送信社数': 'companies'
};

/** 半角・全角の空白を前後から除く */
function homesSaleTrim(text) {
  return String(text || '').replace(/^[\s　]+|[\s　]+$/g, '');
}

/**
 * 本文を読む。⚠️ お客様の情報は ┏ と ┗ の罫線に挟まれた部分だけ（サポートデスクの電話・住所を拾わない）。
 * ⚠️ 見出しと値は全角のコロン（最初のコロンで分ける）。⚠️ 「同時送信社数」より後の行はお客様の自由記入（free_text）。
 * ⚠️ 受信日時は罫線の上の「（受信日時：YYYY/MM/DD HH:MM:SS）」、Manager の URL も罫線の上から拾う。
 */
function homesSaleParse(body) {
  const result = { fields: {}, freeLines: [], receivedAt: '', managerUrl: '' };
  const lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');
  let inBlock = false;
  let afterCompanies = false;

  for (const line of lines) {
    const trimmed = homesSaleTrim(line);
    if (/^┏/.test(trimmed)) { inBlock = true; continue; }
    if (/^┗/.test(trimmed)) { break; }
    if (!inBlock) {
      const received = trimmed.match(/受信日時[：:]\s*(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
      if (received) result.receivedAt = received[1];
      if (/^https:\/\/manager\.homes\.co\.jp\//.test(trimmed)) result.managerUrl = trimmed;
      continue;
    }
    if (trimmed === '') continue;

    const matched = trimmed.match(/^([^：:]+?)[\s　]*[：:][\s　]*(.*)$/);
    const key = matched ? HOMES_SALE_LABELS[homesSaleTrim(matched[1])] : undefined;
    if (key && !afterCompanies) {
      result.fields[key] = homesSaleTrim(matched[2]);
      if (key === 'companies') afterCompanies = true;
      continue;
    }
    if (afterCompanies) result.freeLines.push(trimmed);
  }
  return result;
}

/** 1通のメールから送る内容を作る。⚠️ 送らないメールは { skip: 理由 } */
function homesSaleBuildPayload(subject, body, date) {
  const s = String(subject || '');
  if (/^\s*(re|fw|fwd)\s*[:：]/i.test(s)) return { skip: '返信・転送' };
  if (s.indexOf(HOMES_SALE_SUBJECT) === -1) return { skip: '件名が違う' };

  const parsed = homesSaleParse(body);
  const f = parsed.fields;
  if (!/^\d+$/.test(f.assessment_id || '')) return { skip: '査定IDが読めない' };
  if (!f.name) return { skip: 'お名前が読めない' };
  if (!f.phone && !f.mail) return { skip: '電話もメールも無い' };

  const payload = { request: 'homes_sale_assessment_entry' };
  Object.keys(HOMES_SALE_LABELS).forEach(function (label) {
    const key = HOMES_SALE_LABELS[label];
    if (f[key]) payload[key] = f[key];
  });
  payload.free_text = parsed.freeLines.join('\n');
  payload.manager_url = parsed.managerUrl;
  // ⚠️ 本文の受信日時が読めないときはメールの日時
  payload.received_at = parsed.receivedAt || Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  return payload;
}

// =====================================================================
// ⚠️ メインの実行関数。⚠️ **トリガーはこれを指定する**（5分おき）
// =====================================================================
function HomesSaleAssessmentToDashboard() {
  const key = PropertiesService.getScriptProperties().getProperty('MEMBER_ENTRY_KEY');
  if (!key) {
    Logger.log('⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY が未設定です。取り込みを中止しました。');
    return;
  }
  const count = { success: 0, exists: 0, skip: 0, error: 0 };
  // ⚠️ search はスレッド単位で返すので、返信などが混ざる。1通ずつ確かめる
  GmailApp.search(HOMES_SALE_QUERY).forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      const payload = homesSaleBuildPayload(message.getSubject(), message.getPlainBody(), message.getDate());
      if (payload.skip) {
        count.skip++;
        Logger.log('送らない（' + payload.skip + '）: ' + message.getSubject());
        return;
      }
      payload.key = key;
      try {
        const response = UrlFetchApp.fetch(HOMES_SALE_URL, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });
        const code = response.getResponseCode();
        const text = response.getContentText();
        // ⚠️ ログにお客様の名前・連絡先は出さない（査定IDだけ）
        Logger.log(code + ' 査定ID ' + payload.assessment_id + ' : ' + text);
        if (code === 200 && text.indexOf('"exists"') !== -1) count.exists++;
        else if (code === 200) count.success++;
        else count.error++;
      } catch (e) {
        count.error++;
        Logger.log('送信エラー 査定ID ' + payload.assessment_id + ' : ' + e.toString());
      }
    });
  });
  Logger.log('おわり: 登録 ' + count.success + ' 件 / 取り込み済み ' + count.exists + ' 件 / 送らない ' + count.skip + ' 件 / エラー ' + count.error + ' 件');
}
