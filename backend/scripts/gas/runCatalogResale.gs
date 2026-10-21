// ==========================================
// 中古住宅専門店（chuko-senmon.jp）の資料請求メール → catalog_resale_update
//
// ⚠️ 2026-10-21 改修：「不動産のまとめて資料請求発生通知メール」も取り込む。
//   - 件名：いつもの「資料請求」に加えて「まとめて資料請求」でも探す
//   - 本文：【資料請求対象不動産】の下の「-----」の線で読むのをやめないようにした（末尾の署名「--」の行だけで止める）
//   - 見出し：【電話番号】【携帯番号】を追加。tel には携帯番号を優先して入れる（反響では tel が携帯の欄に入るため）
//   - まとめて資料請求のときは catalog_request に「まとめて資料請求」と入れる（どちらのメールから来たか分かるように）
// ⚠️ 送り先（catalog_resale_update.php）が受ける項目は catalog_request・visit_reservation・name・nameKana・email・tel・
//   zip・address・property・registered・remarks だけ。⚠️ 携帯番号・電話番号は tel と remarks に入れ、それ自体は送らない。
// ==========================================

// ==========================================
// 辞書と抽出ロジック
// ==========================================
const catalogResaleColumnNameMap = {
    catalog_request: "資料請求",
    visit_reservation: "見学予約",
    name: "お名前",
    nameKana: "フリガナ",
    email: "メールアドレス",
    tel: "ご連絡先お電話番号",
    landline: "電話番号",
    mobile: "携帯番号",
    zip: "郵便番号",
    address: "ご住所",
    property: "資料請求対象不動産",
    registered: "メール受信日時"
};

// ★変数名が他のファイルと衝突しないように変更
const catalogResaleKeywordToKeyMap = {
    "【資料請求】": "catalog_request",
    "【見学予約】": "visit_reservation",
    "【お名前】": "name",
    "【フリガナ】": "nameKana",
    "【メールアドレス】": "email",
    "【ご連絡先お電話番号】": "tel",
    "【電話番号】": "landline",      // まとめて資料請求（固定電話）
    "【携帯番号】": "mobile",        // まとめて資料請求（携帯）
    "【郵便番号】": "zip",
    "【ご住所】": "address",
    "【資料請求対象不動産】": "property"
};

/** 「-----」だけの行（まとめて資料請求の対象不動産を囲む線）。⚠️ 読み飛ばすだけで、読むのはやめない */
const CATALOG_RESALE_RULE_LINE = /^[-－ー─━=＝]{3,}$/;

function extractCatalogResaleData(text) {
    const normalizedText = text.replace(/\r\n/g, '\n');
    const lines = normalizedText.split('\n');

    const result = {
        catalog_request: "", visit_reservation: "", name: "", nameKana: "",
        email: "", tel: "", landline: "", mobile: "", zip: "", address: "", property: ""
    };

    let currentKey = "";
    let expectValueNextLine = false;

    for (const line of lines) {
        const trimmed = line.trim();
        // ⚠️ 末尾の署名の区切り「--」の行（と個人情報保護方針）で終わり。「-----」の線では終わらない
        if (trimmed === "--" || trimmed.startsWith("【個人情報保護方針】")) break;
        if (CATALOG_RESALE_RULE_LINE.test(trimmed)) continue;

        let matchedKeyword = false;
        for (const [kw, key] of Object.entries(catalogResaleKeywordToKeyMap)) {
            if (trimmed.startsWith(kw)) {
                currentKey = key;
                expectValueNextLine = true;
                matchedKeyword = true;
                break;
            }
        }

        if (matchedKeyword) continue;

        if (currentKey) {
            if (expectValueNextLine) {
                if (trimmed !== "") {
                    result[currentKey] = trimmed;
                    // property（対象不動産）以外は1行完結ガード！
                    if (currentKey !== 'property') {
                        currentKey = "";
                    }
                    expectValueNextLine = false;
                }
            } else if (currentKey === 'property' && trimmed !== "") {
                // property（対象不動産）の時だけは、住所やURLなど複数行の追記を許可する
                result[currentKey] = result[currentKey] ? `${result[currentKey]}\n${trimmed}` : trimmed;
            }
        }
    }

    // データのクリーニング処理
    if (result.zip) result.zip = result.zip.replace("〒", "").trim();
    // ⚠️ tel は携帯番号を優先（反響では tel が携帯の欄に入る）。無ければ電話番号
    if (!result.tel) result.tel = result.mobile || result.landline;
    // ⚠️ まとめて資料請求のメールには【資料請求】の見出しが無い。どちらのメールか分かるように入れる
    if (!result.catalog_request && normalizedText.indexOf("まとめて資料請求") !== -1) {
        result.catalog_request = "まとめて資料請求";
    }

    return result;
}

function padZeroCatalogResale(num) {
    return ('0' + num).slice(-2);
}

// ==========================================
// API送信処理
// ==========================================
function postCatalogResaleToPhpApi(data) {
    const API_URL = "https://khg-marketing.info/dashboard/api/gateway/";
    const payload = {
        ...data,
        request: 'catalog_resale_update' // ★ 中古住宅専門店 資料請求用のリクエスト識別子
    };

    const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    try {
        const response = UrlFetchApp.fetch(API_URL, options);
        Logger.log("DB登録完了レスポンス: " + response.getContentText());
        return true;
    } catch (e) {
        Logger.log("API送信エラー: " + e.toString());
        return false;
    }
}

// ==========================================
// ★ メインの実行関数
// ==========================================
function runCatalogResale() {
    // 検索条件: 1日以内
    // FROM: ask@chuko-senmon.jp
    // SUBJECT: 資料請求（いつもの資料請求）／ 不動産のまとめて資料請求発生通知メール
    // ⚠️ Gmail の日本語の件名検索は区切り方しだいで部分一致しないことがあるため、まとめて資料請求は件名をまるごと書く
    const query = 'from:ask@chuko-senmon.jp subject:("資料請求" OR "不動産のまとめて資料請求発生通知メール") newer_than:1d';
    const threads = GmailApp.search(query);

    if (threads.length === 0) {
        Logger.log("処理対象のメール(Catalog Resale)はありません。");
        return;
    }

    Logger.log(`${threads.length}件のスレッドが見つかりました。`);

    for (const thread of threads) {
        const messages = thread.getMessages();

        for (const msg of messages) {
            // ★ API側で重複排除されるため、未読判定や既読化は行いません
            const emailText = msg.getPlainBody();
            const extractedData = extractCatalogResaleData(emailText);

            // 日時データの生成
            const d = msg.getDate();
            const registered = `${d.getFullYear()}-${padZeroCatalogResale(d.getMonth() + 1)}-${padZeroCatalogResale(d.getDate())} ${padZeroCatalogResale(d.getHours())}:${padZeroCatalogResale(d.getMinutes())}:${padZeroCatalogResale(d.getSeconds())}`;

            const finalData = { ...extractedData, registered: registered };

            // remarks（メモ）の生成
            // ⚠️ tel を電話番号・携帯番号から作ったときは、元の見出し（電話番号・携帯番号）で残し、tel の行は重ねて出さない
            const remarksList = [];
            for (const [key, val] of Object.entries(finalData)) {
                if (!val) continue;
                if (key === 'tel' && (finalData.mobile || finalData.landline)) continue;
                const jaKey = catalogResaleColumnNameMap[key] || key;
                remarksList.push(`${jaKey}：${val}`);
            }
            finalData.remarks = remarksList.join('\n');

            // ⚠️ 送り先が受けない項目は送らない（tel と remarks に入れ済み）
            delete finalData.landline;
            delete finalData.mobile;

            // 必須データのチェック (nameが存在するか)
            if (finalData.name) {
                Logger.log("抽出データ: " + JSON.stringify(finalData));
                postCatalogResaleToPhpApi(finalData);
            } else {
                Logger.log("必要なデータ(name)が抽出できなかったためスキップします。");
            }
        }
    }
}
