# 2026-10-09 GAS runMemberKaeru（かえるホーム会員登録メール取込）の書式対応

## 依頼
- 新しい文面（フリガナ・ご年齢・携帯番号なし、【個人情報保護方針】あり、Outlook転送ヘッダー付き）でも取り込めるようにマッピングオブジェクトを変更する
- `from:c.nagata@kh-house.jp`（転送）のメールも取得する

## 対象
- *GAS（Googleスプレッドシート側のスクリプト。リポジトリ外）* **runMemberKaeru のgsファイル**
- バックエンド（`backend/src/handlers/member_kaeru_update.php` / `portal/member_kaeru.php`）は変更なし

## 変更点
| 項目 | 変更前 | 変更後 |
|---|---|---|
| マッピング | `memberKaeruColumnNameMap`（見出しのみ）と `extractMemberKaeruData` 内の個別 `extract(...)` | **`memberKaeruFields`**（key / 見出し / ブロック / 整形）に一本化。`memberKaeruColumnNameMap` はここから生成（remarks 用、内容は同じ） |
| 無い項目 | 空文字 | 空文字（変わらず）。旧書式・新書式どちらも同じ定義で読める |
| 電話番号 | tel にそのまま | **携帯番号欄が無く、電話番号が 070/080/090 なら mobile に回す**（Dashboard は mobile→携帯、tel→固定電話で取り込むため）。旧書式（携帯番号欄あり）は従来どおり |
| 転送メール | — | 改行 `\r\n` を正規化、Outlook が付ける `<mailto:...>` `<https://...>` を除去、見出し前のインデントを許容 |
| registered | 受信メールの日時 | 本文に `Sent:` / `送信日時:` があれば**元メールの送信日時**を優先（転送時刻で受付日がずれないように）。無ければ従来どおり |
| 検索条件 | `from:ask@kaeruhome.jp ...` | `from:(ask@kaeruhome.jp OR c.nagata@kh-house.jp) ...`（件名・本文条件は同じ。件名 `【かえるホーム】新規会員登録発生通知メール` / `FW: ...` も一致） |

### 追加した関数・定数
- `memberKaeruFields`（定数）
- `MEMBER_KAERU_MOBILE_PATTERN`（定数）
- `escapeMemberKaeruRegExp(str)`
- `cleanMemberKaeruValue(value)`
- `formatMemberKaeruDate(d)`
- `parseMemberKaeruOriginalSent(text)`

### 修正した関数
- `extractMemberKaeruData(text)`
- `runMemberKaeru()`

## 重複について
API（member_kaeru_update.php）は email で重複判定し、既存なら UPDATE。ask@ と c.nagata@ の両方で同じ登録が届いても1件にまとまる。
`inquiry_customer_kaeru` 側は `INSERT IGNORE`（inquiry_id = `hp_member_` + member_kaeru.id）なので二重登録されない。

## 確認
node でスクラッチ実行（PIIはダミーに置換）
- 新書式（転送・提示文面）: 名前/メール/郵便番号 8610533/住所/希望エリア1〜3/学区（複数行）/その他/媒体 Instagram を抽出。電話 080… → mobile。Sent → `2026-10-09 00:13:00`
- 同じ文面を CRLF + `<mailto:>` 付きにしても同結果
- 旧書式（フリガナ・年齢・携帯あり）: 従来と同じ値（郵便番号のハイフンも従来どおり残す、年齢の「歳」除去）
- `送信日時: 2026年10月9日 13:05` / `12:05 PM` の解析
- GAS 実環境（GmailApp.search）では未実行

## 全コード
```js
// ==========================================
// 辞書と抽出ロジック
// ==========================================
// 項目ごとに「本文の見出し」「どのブロックにあるか」「整形方法」をまとめて持つ。
// 本文に無い項目は空文字になるだけなので、書式（項目の有無）が違うメールでも同じ定義で読める。
//   section: 'top'       … 【見出し】の直後
//            'condition' … 【ご希望条件】の中の「・見出し」の直後
const memberKaeruFields = [
    { key: "email",           label: "メールアドレス",                       section: "top" },
    { key: "name",            label: "お名前",                               section: "top" },
    { key: "nameKana",        label: "フリガナ",                             section: "top" },
    { key: "zip",             label: "郵便番号",                             section: "top", clean: (v) => v.replace("〒", "").trim() },
    { key: "address",         label: "住所",                                 section: "top" },
    { key: "age",             label: "ご年齢",                               section: "top", clean: (v) => v.replace("歳", "").trim() },
    { key: "tel",             label: "電話番号",                             section: "top" },
    { key: "mobile",          label: "携帯番号",                             section: "top" },
    { key: "source",          label: "当サイトをどこでお知りになりましたか？", section: "top" },
    { key: "desiredArea1",    label: "第一希望エリア",                       section: "condition" },
    { key: "desiredArea2",    label: "第二希望エリア",                       section: "condition" },
    { key: "desiredArea3",    label: "第三希望エリア",                       section: "condition" },
    { key: "areaNotes",       label: "※市区町村、学区など",                 section: "condition" },
    { key: "otherConditions", label: "その他希望条件",                       section: "condition" },
    { key: "registered",      label: "システム受付日時",                     section: "none" }
];

// remarks（メモ）の見出しに使う。key → 見出し
const memberKaeruColumnNameMap = memberKaeruFields.reduce((map, f) => {
    map[f.key] = f.label;
    return map;
}, {});

// 携帯電話の番号（070/080/090）
const MEMBER_KAERU_MOBILE_PATTERN = /^0[789]0/;

function escapeMemberKaeruRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 転送メール（Outlook等）で付く <mailto:...> / <https://...> を取り除く
function cleanMemberKaeruValue(value) {
    return value
        .replace(/<mailto:[^>]*>/g, "")
        .replace(/<https?:\/\/[^>]*>/g, "")
        .replace(/\r/g, "")
        .trim();
}

function extractMemberKaeruData(text) {
    const body = text.replace(/\r\n?/g, "\n");

    const extract = (keyword) => {
        const regex = new RegExp(`【${escapeMemberKaeruRegExp(keyword)}】[\\s　]*([\\s\\S]*?)(?=\\n[ 　\\t]*【|$)`);
        const match = body.match(regex);
        return match ? cleanMemberKaeruValue(match[1]) : "";
    };

    const conditionsText = extract("ご希望条件");

    const extractCondition = (keyword) => {
        const regex = new RegExp(`・${escapeMemberKaeruRegExp(keyword)}[\\s　]*([\\s\\S]*?)(?=\\n[\\s　]*・|$)`);
        const match = conditionsText.match(regex);
        return match ? cleanMemberKaeruValue(match[1]) : "";
    };

    const data = {};
    for (const f of memberKaeruFields) {
        if (f.section === "none") continue;
        const raw = f.section === "condition" ? extractCondition(f.label) : extract(f.label);
        data[f.key] = f.clean ? f.clean(raw) : raw;
    }

    // 携帯番号の欄が無い書式では、電話番号が携帯なら携帯番号に回す
    // （Dashboard側は mobile→携帯、tel→固定電話 として取り込むため）
    const telDigits = data.tel.replace(/[^0-9]/g, "");
    if (!data.mobile && MEMBER_KAERU_MOBILE_PATTERN.test(telDigits)) {
        data.mobile = data.tel;
        data.tel = "";
    }

    return data;
}

function padZeroMemberKaeru(num) {
    return ('0' + num).slice(-2);
}

function formatMemberKaeruDate(d) {
    return `${d.getFullYear()}-${padZeroMemberKaeru(d.getMonth() + 1)}-${padZeroMemberKaeru(d.getDate())} ${padZeroMemberKaeru(d.getHours())}:${padZeroMemberKaeru(d.getMinutes())}:${padZeroMemberKaeru(d.getSeconds())}`;
}

// 転送メールなら、元メールの送信日時（Sent: / 送信日時:）を返す。読めなければ null
//   Sent: Friday, October 9, 2026 12:13 AM
//   送信日時: 2026年10月9日 0:13
function parseMemberKaeruOriginalSent(text) {
    const months = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

    const en = text.match(/^\s*Sent:\s*(?:[A-Za-z]+,\s*)?([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/im);
    if (en && months[en[1].toLowerCase()]) {
        let hour = Number(en[4]);
        const ampm = (en[7] || "").toUpperCase();
        if (ampm === "PM" && hour < 12) hour += 12;
        if (ampm === "AM" && hour === 12) hour = 0;
        return new Date(Number(en[3]), months[en[1].toLowerCase()] - 1, Number(en[2]), hour, Number(en[5]), Number(en[6] || 0));
    }

    const ja = text.match(/^\s*送信日時:\s*(\d{4})年(\d{1,2})月(\d{1,2})日[^\d]*(\d{1,2}):(\d{2})(?::(\d{2}))?/m);
    if (ja) {
        return new Date(Number(ja[1]), Number(ja[2]) - 1, Number(ja[3]), Number(ja[4]), Number(ja[5]), Number(ja[6] || 0));
    }

    return null;
}

// ==========================================
// API送信処理
// ==========================================
function postMemberKaeruToPhpApi(data) {
    const API_URL = "https://khg-marketing.info/dashboard/api/gateway/";
    const payload = {
        ...data,
        request: 'member_kaeru_update' // ★ かえるホーム会員登録用のリクエスト識別子
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
function runMemberKaeru() {
    // 検索条件: 1日以内
    // FROM: ask@kaeruhome.jp（直接の通知） / c.nagata@kh-house.jp（転送）
    // SUBJECT: 新規会員登録発生通知メール
    // 本文: かえるホームの新規会員登録情報
    const query = 'from:(ask@kaeruhome.jp OR c.nagata@kh-house.jp) subject:"新規会員登録発生通知メール" "かえるホームの新規会員登録情報" newer_than:1d';
    const threads = GmailApp.search(query);

    if (threads.length === 0) {
        Logger.log("処理対象のメール(Member Kaeru)はありません。");
        return;
    }

    Logger.log(`${threads.length}件のスレッドが見つかりました。`);

    for (const thread of threads) {
        const messages = thread.getMessages();

        for (const msg of messages) {
            // ★ API側で重複排除されるため、未読判定や既読化は行いません
            const emailText = msg.getPlainBody();
            const extractedData = extractMemberKaeruData(emailText);

            // 日時データの生成（転送メールは元メールの送信日時を優先する）
            const d = parseMemberKaeruOriginalSent(emailText) || msg.getDate();
            const registered = formatMemberKaeruDate(d);

            const finalData = { ...extractedData, registered: registered };

            // remarks（メモ）の生成
            const remarksList = [];
            for (const [key, val] of Object.entries(finalData)) {
                if (val && memberKaeruColumnNameMap[key]) {
                    remarksList.push(`${memberKaeruColumnNameMap[key]}：${val}`);
                }
            }
            finalData.remarks = remarksList.join('\n');

            // 必須データのチェック (nameが存在するか)
            if (finalData.name) {
                Logger.log("抽出データ: " + JSON.stringify(finalData));
                postMemberKaeruToPhpApi(finalData);
            } else {
                Logger.log("必要なデータ(name)が抽出できなかったためスキップします。");
            }
        }
    }
}
```
