# 2026-10-16 GAS（アットホーム プレミアム公開）で「見学予約のお知らせ」も取り込む

## 依頼
- 貼り付けられた GAS（`runAthomePremium`）が「【アットホーム　売戸建・土地　プレミアム公開】見学予約のお知らせ_個人情報をメールで通知」を取得できるか
- 件名の不一致は確認済み。それ以外で必要な改修をする

## 調べたこと
- 送信先 ① `backend/src/handlers/athome_kaeru_update.php` は `athome_db_kaeru` に email で突合して INSERT／UPDATE し、`portal/athome_kaeru.php` で `inquiry_customer_kaeru` に `INSERT IGNORE`（inquiry_id = `athome_{id}`）
- 受け取る項目: inquiryDate〜tourDate1・registered・remarks（**第二・第三希望日時の列は無い**。知らない項目は無視される）

## 件名以外の問題（見学予約のメール）
| # | 問題 | 原因 |
|---|---|---|
| 1 | 問い合わせ日時が空 | GAS は「資料請求日時」だけを探す。見学予約は「お問い合わせ日時」 |
| 2 | 第一希望日時が保存されない | `tourDate1` に「ご希望のエリア１」を入れていた（見学予約では空）。第二・第三もどこにも残らない |
| 3 | 資料請求と見学予約の区別がつかない | どちらも同じ表・同じ形で保存される |
- 氏名・住所／郵便番号・電話・メール・物件名は今のままでも取れる（全角スペース・空欄・CRLF も可）

## 変更（GAS。リポジトリ外: Downloads/gas_athome_premium.js）
- 検索条件に見学予約の件名を追加（資料請求と OR）
- 関数 `detectAthomePremiumKind` を追加（本文の見出し ≪見学予約… / ≪資料請求… で判定）
- `inquiryDate` = 「資料請求日時」がなければ「お問い合わせ日時」
- `tourDate1` = 見学予約は「第一希望日時」、資料請求は従来どおり「ご希望のエリア１」
- `tourDate2` / `tourDate3`（第二・第三希望日時）と `inquiryKind`（種別）を remarks に出す（PHP に列が無いため remarks のみ）
- 関数 `buildAthomePremiumPayload` を追加（Gmail に触らずに送信データを作る。テスト用に切り出し）。`runAthomePremium` はこれを呼ぶだけにした
- ① PHP・DB は変更なし

## 確認
- サンプルと同じ並びの本文（個人情報はダミー）で、見学予約（LF・CRLF）と資料請求（想定の形）を抽出
  - 見学予約: 種別=見学予約、問い合わせ日時=2026/10/15 23:59、第一希望日時=2026年10月17日 午後、第二=2026年10月17日 11:00～、郵便番号・住所の分離も正しい
  - 資料請求: 種別=資料請求、資料請求日時、tourDate1=ご希望のエリア１（従来どおり）
- 種別の判定: 「≪資料請求の内容≫ … 見学予約もできます」→ 資料請求（見出し優先）
- 構文チェック（node --check）通過
- ⚠️ 未確認: GAS 上での Gmail 検索（件名の OR が実際のメールに当たるか）と ① への送信。GAS エディタで `runAthomePremium` を実行してログを確認すること

## 気をつける点（今回は変えていない）
- ① の PHP は **email が同じなら athome_db_kaeru を上書き**し、inquiry_customer_kaeru には `INSERT IGNORE` なので、**先に資料請求した人が後で見学予約すると、反響一覧には新しい反響として出ない**（athome_db_kaeru の内容だけ見学予約に置き換わる）
- 資料請求の remarks では「第一希望日時：（ご希望のエリア１の値）」と出る（従来からの動き）

## GAS 全文
```js
// ==========================================
// アットホーム 売戸建・土地 プレミアム公開 → Dashboard（athome_kaeru_update）
//
// 2026-10-16 改修: 「資料請求」に加えて「見学予約のお知らせ」も取り込む
//   ・検索条件に見学予約の件名を追加
//   ・問い合わせ日時: 資料請求は「資料請求日時」、見学予約は「お問い合わせ日時」
//   ・第一希望日時（tourDate1）: 見学予約は「第一希望日時」。資料請求は従来どおり「ご希望のエリア１」
//   ・第二・第三希望日時と問い合わせの種別（資料請求／見学予約）を remarks に残す
//     （① の athome_kaeru_update.php に列が無いため。PHP 側は変更不要）
// ==========================================

// ==========================================
// 辞書と抽出ロジック
// ==========================================
// ★ 既存のテーブル構造をそのまま使用（変数名は衝突回避のためPremiumに変更）
// ⚠️ remarks には、このキーの順で「見出し：値」が並ぶ（値が空の項目は出ない）
const athomePremiumColumnNameMap = {
    inquiryKind: "お問い合わせ種別",
    inquiryDate: "お問合わせ日時",
    propertyType: "物件種目",
    buildingName: "建物名",
    transportation: "交通",
    station: "駅名",
    walkMinutes: "徒歩",
    busStop: "バス停名",
    busRideMinutes: "バス乗車分",
    busWalkMinutes: "バス停歩分",
    propertyAddress: "所在地",
    price: "価格",
    floorPlan: "間取り",
    buildingArea: "専有・建物面積",
    landArea: "土地面積",
    athomePropertyId: "at home 物件番号",
    companyPropertyId: "貴社物件管理番号",
    name: "お名前",
    email: "メールアドレス",
    zip: "郵便番号",
    address: "住所",
    tel: "電話番号",
    contactTime: "連絡希望の時間帯",
    otherContactMethod: "その他の連絡方法",
    gender: "性別",
    moveInTiming: "入居希望時期",
    tourDate1: "第一希望日時",
    tourDate2: "第二希望日時",
    tourDate3: "第三希望日時",
    registered: "システム受付日時"
};

/**
 * 問い合わせの種別。⚠️ 件名ではなく本文の見出し（≪…の内容≫）で判定する。
 *   資料請求 … ≪資料請求の内容≫ ／ 見学予約 … ≪見学予約のお問い合わせ内容≫
 */
function detectAthomePremiumKind(text) {
    // ⚠️ 見出しを先に見る（⚠️ 本文の案内文や署名に別の語が混ざっても取り違えないように）
    if (text.includes("≪見学予約")) return "見学予約";
    if (text.includes("≪資料請求")) return "資料請求";
    if (text.includes("見学予約")) return "見学予約";
    if (text.includes("資料請求")) return "資料請求";
    return "";
}

function extractAthomePremiumData(text) {
    const extract = (keyword) => {
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 全角半角スペース・見えない特殊空白文字に完全対応
        const regex = new RegExp(`${escapedKeyword}[^\\S\\r\\n]*[：:][^\\S\\r\\n]*([^\\r\\n]*)`);
        const match = text.match(regex);
        return match ? match[1].trim() : "";
    };

    const kind = detectAthomePremiumKind(text);

    // ① 住所と郵便番号の分離ロジック
    let rawAddress = extract("住所");
    let zip = "";
    let address = rawAddress;

    // 「〒890-0007 鹿児島県...」のような文字列から郵便番号を抽出して分離
    if (rawAddress.includes("〒")) {
        const zipMatch = rawAddress.match(/〒\s*([0-9-]{7,8})/);
        if (zipMatch) {
            zip = zipMatch[1];
            address = rawAddress.replace(zipMatch[0], "").trim();
        }
    }

    // ② 氏名
    const name = extract("氏名");

    // ③ 自由記述項目の結合（既存テーブルの枠に収まらない情報をまとめる）
    const other1 = extract("重視される条件");
    const other2 = extract("その他条件");
    const combinedOther = [other1, other2].filter(Boolean).join(" / ");

    // ④ 見学の希望日時
    //   ⚠️ 見学予約は「第一希望日時」をそのまま入れる。
    //   ⚠️ 資料請求には希望日時が無いので、従来どおり「ご希望のエリア１」を入れる（便宜上）。
    const tourDate1 = kind === "見学予約" ? extract("第一希望日時") : extract("ご希望のエリア１");

    // ⑤ マッピング（取得できないものは空文字、役割が似ているものは代入）
    return {
        inquiryKind: kind,
        // ⚠️ 資料請求は「資料請求日時」、見学予約は「お問い合わせ日時」
        inquiryDate: extract("資料請求日時") || extract("お問い合わせ日時"),
        propertyType: "", // 文面にないため空
        buildingName: extract("物件名"),
        transportation: "",
        station: "",
        walkMinutes: "",
        busStop: "",
        busRideMinutes: "",
        busWalkMinutes: "",
        propertyAddress: "",
        price: extract("ご予算"), // ご予算を「価格」枠に
        floorPlan: extract("ご希望の間取り"), // 希望間取りを「間取り」枠に
        buildingArea: extract("ご希望の建物面積"), // 希望建物面積を「建物面積」枠に
        landArea: extract("ご希望の土地面積"), // 希望土地面積を「土地面積」枠に
        athomePropertyId: "",
        companyPropertyId: "",
        name: name,
        email: extract("メールアドレス"),
        zip: zip,
        address: address,
        tel: extract("電話番号"),
        contactTime: "",
        otherContactMethod: combinedOther, // その他の連絡方法枠に、その他条件をねじ込む
        gender: extract("性別"),
        moveInTiming: extract("ご入居の希望時期"),
        tourDate1: tourDate1,
        // ⚠️ ① の PHP に列が無い。remarks に残すためだけに持つ（PHP は知らない項目を無視する）
        tourDate2: extract("第二希望日時"),
        tourDate3: extract("第三希望日時"),
    };
}

function padZeroAthomePremium(num) {
    return ('0' + num).slice(-2);
}

// ==========================================
// API送信処理
// ==========================================
function postAthomePremiumToPhpApi(data, requestType) {
    const API_URL = "https://khg-marketing.info/dashboard/api/gateway/";
    const payload = {
        ...data,
        request: requestType // 動的に決定したものをセット
    };

    const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    try {
        const response = UrlFetchApp.fetch(API_URL, options);
        Logger.log(`DB登録完了レスポンス (${requestType}): ` + response.getContentText());
        return true;
    } catch (e) {
        Logger.log(`API送信エラー (${requestType}): ` + e.toString());
        return false;
    }
}

/** 1通分の送信データ（remarks まで含む）を作る。⚠️ Gmail に触らないのでテストしやすい */
function buildAthomePremiumPayload(emailText, date) {
    const extractedData = extractAthomePremiumData(emailText);

    // 日時データの生成
    const d = date;
    const registered = `${d.getFullYear()}-${padZeroAthomePremium(d.getMonth() + 1)}-${padZeroAthomePremium(d.getDate())} ${padZeroAthomePremium(d.getHours())}:${padZeroAthomePremium(d.getMinutes())}:${padZeroAthomePremium(d.getSeconds())}`;

    const finalData = { ...extractedData, registered: registered };

    // remarks（メモ）の生成（既存テーブルのカラム名を利用）
    const remarksList = [];
    for (const [key, val] of Object.entries(finalData)) {
        if (val && athomePremiumColumnNameMap[key]) {
            remarksList.push(`${athomePremiumColumnNameMap[key]}：${val}`);
        }
    }
    finalData.remarks = remarksList.join('\n');
    return finalData;
}

// ==========================================
// ★ メインの実行関数
// ==========================================
function runAthomePremium() {
    // 検索条件: 1日以内
    // 件名: 「資料請求」と「見学予約のお知らせ」の両方（2026-10-16 に見学予約を追加）
    const query = 'from:info@kodate-athome-manage.jp ("【アットホーム　売戸建・土地　プレミアム公開】資料請求" OR "【アットホーム　売戸建・土地　プレミアム公開】見学予約") newer_than:1d';
    const threads = GmailApp.search(query);

    if (threads.length === 0) {
        Logger.log("処理対象のメール(Athome Premium)はありません。");
        return;
    }

    Logger.log(`${threads.length}件のスレッドが見つかりました。`);

    // 宛先: かえる（athome_kaeru_update）固定
    const requestType = "athome_kaeru_update";

    for (const thread of threads) {
        for (const msg of thread.getMessages()) {
            const finalData = buildAthomePremiumPayload(msg.getPlainBody(), msg.getDate());

            // 必須データのチェック (name または email が存在するか)
            if (finalData.name || finalData.email) {
                Logger.log(`抽出データ (${requestType}): ` + JSON.stringify(finalData));
                postAthomePremiumToPhpApi(finalData, requestType);
            } else {
                Logger.log("必要なデータ(name または email)が抽出できなかったためスキップします。");
            }
        }
    }
}
```
