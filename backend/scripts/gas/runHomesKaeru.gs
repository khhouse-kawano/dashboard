/**
 * LIFULL HOME'S（かえる）のメール取込。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2種類のメールを扱う。**
 *   ⚠️ ① お客様からの問合せ … support@homes.co.jp   → runHomesKaeru
 *   ⚠️ ② 新築一戸建て見学予約 … support-k@homes.co.jp → runHomesVisitKaeru
 *
 * ⚠️ ⚠️ **どちらも同じ受け口（request: 'homes_db_kaeru'）へ送る。**
 *   ⚠️ 保存先も同じ `homes_db_kaeru` テーブル。
 *   ⚠️ 受け口: backend/src/handlers/homes_db_kaeru.php
 *   ⚠️ ⚠️ **PHP側は変更していない。** ⚠️ 送るキー名をこちらで揃えている。
 *
 * ⚠️⚠️ **トリガーに設定するのは `runHomesAll` ひとつでよい。**
 *   ⚠️ ⚠️ **①だけ動いていた頃の `runHomesKaeru` もそのまま残してある**ので、
 *     ⚠️ 既存のトリガーを消さなくても動き続ける。
 * ─────────────────────────────────────────────
 */


// ==========================================
// 辞書と抽出ロジック（① お客様からの問合せ）
// ==========================================
const homesColumnNameMap = {
    userUrl: "ユーザー詳細URL",
    propertyUrl: "物件詳細URL",
    category: "物件種別",
    propertyName: "物件名",
    price: "価格",
    area: "所在地",
    railway: "交通",
    large: "面積",
    plan: "間取",
    propertyId: "物件番号",
    companyId: "自社管理番号",
    userId: "問合せ番号",
    name: "名前",
    mail: "メールアドレス",
    mobile: "電話番号",
    note: "お問合せ内容",
    registered: "システム受付日時"
};

function extractHomesData(text) {
    const extract = (regex) => {
        const match = text.match(regex);
        return match ? match[1].trim() : "";
    };

    return {
        userUrl: extract(/▼ユーザーの詳細データ\s+(https:\/\/[^\s]+)/),
        propertyUrl: extract(/下記URLをクリックすると問合せ物件の詳細を見ることができます。\s+(https:\/\/[^\s]+)/),
        category: extract(/物件種別：(.*)/),
        propertyName: extract(/物件名：(.*)/),
        price: extract(/価格：(.*)/),
        area: extract(/所在地：(.*)/),
        railway: extract(/交通：(.*)/),
        large: extract(/面積：(.*)/),
        plan: extract(/間取：(.*)/),
        propertyId: extract(/物件番号：(.*)/),
        companyId: extract(/自社管理番号：(.*)/),
        userId: extract(/問合せ番号：(.*)/),
        name: extract(/名前：(.*)/),
        mail: extract(/メールアドレス：(.*)/),
        mobile: extract(/電話番号：(.*)/),
        note: extract(/お問合せ内容：(.*)/)
    };
}


// ==========================================
// ★ 辞書と抽出ロジック（② 新築一戸建て見学予約）
// ==========================================

/**
 * ⚠️⚠️ **見学予約メールにしか無い項目は remarks（メモ）にだけ入る。**
 *   ⚠️ フリガナ / 見学希望日 / ご希望の連絡時間帯 は
 *     ⚠️ ⚠️ **`homes_db_kaeru` に対応する列が無い。**
 *   ⚠️ ⚠️ **列を足さずメモに残す**ことにした（⚠️ 表の構造を変えないため）。
 *
 * ⚠️ 見学予約メールに ⚠️ **無い**項目: 価格 / 面積 / 間取 / 自社管理番号 / ユーザー詳細URL
 */
const homesVisitColumnNameMap = {
    propertyUrl: "物件詳細URL",
    category: "物件種別",
    propertyName: "物件名",
    area: "所在地",
    railway: "交通",
    propertyId: "物件番号",
    // ⚠️⚠️ **`userId` ではなく `visitNo` を載せている。**
    //   ⚠️ ⚠️ **`userId` には `visit` を付けた値が入っている**ので、
    //     ⚠️ **メモには元の番号をそのまま見せる。**
    visitNo: "見学予約番号",
    name: "名前",
    kana: "フリガナ",
    visitDate1: "見学希望日（第1候補）",
    visitDate2: "見学希望日（第2候補）",
    mail: "メールアドレス",
    mobile: "電話番号",
    contactTime: "ご希望の連絡時間帯",
    note: "ご質問など",
    registered: "予約受付日時"
};

/**
 * ⚠️ `------------------------------` のような ⚠️ **空欄の代わりの記号**を空にする。
 *   ⚠️ ⚠️ **そのまま入れると第2候補に線が入って見える。**
 */
function isHomesBlank(value) {
    return value === "" || /^[-‐－ー\s　]+$/.test(value);
}

function extractHomesVisitData(text) {
    const extract = (regex) => {
        const match = text.match(regex);
        return match ? match[1].trim() : "";
    };

    /**
     * ⚠️⚠️ **見学希望日は2行に分かれている。**
     *   見学希望日：第1候補　2026/09/30 14:00～16:00
     *   　　　　　　第2候補　------------------------------
     *   ⚠️ ⚠️ **「見学希望日：」を頼りにすると第2候補が取れない**ので、
     *     ⚠️ 「第1候補」「第2候補」を直接探す。
     */
    const visitDate1 = extract(/第1候補[\s　]*(.*)/);
    const visitDate2 = extract(/第2候補[\s　]*(.*)/);

    /**
     * ⚠️⚠️ **予約受付日時は `2026/09/28 19:22:30` の形で届く。**
     *   ⚠️ ⚠️ **DB側は `YYYY-MM-DD HH:MM:SS` でないといけない。**
     *     ⚠️ portal/homes_kaeru.php が `DATE_FORMAT(registered, '%Y/%m/%d')` で
     *       ⚠️ **反響日に変換している**ため、⚠️ **スラッシュのままだと日付が NULL になる。**
     */
    const rawRegistered = extract(/予約受付日時：(.*)/);
    const registered = rawRegistered.replace(/\//g, '-');

    /**
     * ⚠️⚠️ **見学予約番号はそのまま使わず `visit` を付ける。**
     *   ⚠️ ⚠️ **問合せ番号とは別の番号体系なのに、どちらも同じ `userId` 列に入る。**
     *     ⚠️ 番号がたまたま一致すると、⚠️⚠️ **PHP側の重複チェックが同じ行とみなして
     *       ⚠️ 本物の問合せを上書きしてしまう。**
     */
    const visitId = extract(/見学予約番号：(.*)/);

    return {
        propertyUrl: extract(/URL：(https:\/\/[^\s]+)/),
        // ⚠️ 見学予約メールに物件種別は書かれていない。⚠️ **後から見分けられるように入れる**
        category: "新築一戸建て見学予約",
        propertyName: extract(/物件名：(.*)/),
        area: extract(/所在地：(.*)/),
        railway: extract(/交通：(.*)/),
        propertyId: extract(/物件番号：(.*)/),
        userId: visitId === "" ? "" : "visit" + visitId,
        // ⚠️ メモに出すための元の番号（⚠️ **DBの列には無いので保存されない**）
        visitNo: visitId,
        name: extract(/名前：(.*)/),
        kana: extract(/フリガナ：(.*)/),
        visitDate1: isHomesBlank(visitDate1) ? "" : visitDate1,
        visitDate2: isHomesBlank(visitDate2) ? "" : visitDate2,
        mail: extract(/メールアドレス：(.*)/),
        mobile: extract(/電話番号：(.*)/),
        contactTime: extract(/ご希望の連絡時間帯：(.*)/),
        note: extract(/ご質問など：(.*)/),
        registered: registered
    };
}


// ゼロ埋めヘルパー
function padZeroHomes(num) {
    return ('0' + num).slice(-2);
}

/** ⚠️ Gmail の受信日時を `YYYY-MM-DD HH:MM:SS` にする */
function homesMessageDate(msg) {
    const d = msg.getDate();
    return d.getFullYear() + '-' + padZeroHomes(d.getMonth() + 1) + '-' + padZeroHomes(d.getDate())
        + ' ' + padZeroHomes(d.getHours()) + ':' + padZeroHomes(d.getMinutes()) + ':' + padZeroHomes(d.getSeconds());
}

/** ⚠️ メモ（remarks）を組み立てる。⚠️ **辞書に無いキーは入らない** */
function buildHomesRemarks(data, columnNameMap) {
    const remarksList = [];
    for (const [key, val] of Object.entries(data)) {
        if (val && columnNameMap[key]) {
            remarksList.push(columnNameMap[key] + '：' + val);
        }
    }
    return remarksList.join('\n');
}


// ==========================================
// API送信処理
// ==========================================
function postHomesToPhpApi(data) {
    const API_URL = "https://khg-marketing.info/dashboard/api/gateway/";
    const payload = {
        ...data,
        request: 'homes_db_kaeru' // ★ リクエスト種別をHomes用に変更
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
// ★ メインの実行関数（① お客様からの問合せ）
// ==========================================
function runHomesKaeru() {
    // 検索条件: 1日以内
    // FROM: support@homes.co.jp
    // TO: kaeru@kh-house.jp
    // SUBJECT: お客様からの問合せ
    // 本文: 株式会社国分ハウジング不動産様
    const query = 'from:support@homes.co.jp to:kaeru@kh-house.jp subject:"お客様からの問合せ" "株式会社国分ハウジング不動産様" newer_than:1d';
    const threads = GmailApp.search(query);

    if (threads.length === 0) {
        Logger.log("処理対象のメール(Homes)はありません。");
        return;
    }

    Logger.log(threads.length + "件のスレッドが見つかりました。");

    for (const thread of threads) {
        const messages = thread.getMessages();

        for (const msg of messages) {
            // ★ API側で重複排除されるため、未読判定や既読化は行いません
            const emailText = msg.getPlainBody();
            const extractedData = extractHomesData(emailText);

            const finalData = { ...extractedData, registered: homesMessageDate(msg) };

            // remarks（メモ）の生成
            finalData.remarks = buildHomesRemarks(finalData, homesColumnNameMap);

            // 必須データのチェック (propertyId と userId があるか)
            if (finalData.propertyId && finalData.userId) {
                Logger.log("抽出データ: " + JSON.stringify(finalData));
                postHomesToPhpApi(finalData); // 成功時の markRead() を削除
            } else {
                Logger.log("必要なデータ(propertyId または userId)が抽出できなかったためスキップします。"); // スキップ時の markRead() を削除
            }
        }
    }
}


// ==========================================
// ★ メインの実行関数（② 新築一戸建て見学予約）
// ==========================================

/**
 * ⚠️⚠️ **同じ見学予約が2通届く**（⚠️ リード宛にも配信されるため）。
 *
 * ⚠️ ⚠️ **PHP側が `userId` で重複を弾くので二重登録にはならない**が、
 *   ⚠️ **同じ内容を2回送るのは無駄**なので、1回の実行の中で見た番号は飛ばす。
 *
 * ⚠️⚠️ **宛先（to:）で絞っていないのは、どちらの宛先に届くか決まっていないため。**
 *   ⚠️ ⚠️ **絞ると片方しか来ないときに1件も取れなくなる。**
 */
function runHomesVisitKaeru() {
    // 検索条件: 1日以内
    // FROM: support-k@homes.co.jp
    // SUBJECT: 【LIFULL HOME'S新築一戸建て見学予約】
    //   ⚠️⚠️ **件名にアポストロフィ（HOME'S）が入るため、検索語には含めない。**
    //     ⚠️ ⚠️ **Gmail の検索式でクォートが壊れる。**
    const query = 'from:support-k@homes.co.jp subject:"新築一戸建て見学予約" newer_than:1d';
    const threads = GmailApp.search(query);

    if (threads.length === 0) {
        Logger.log("処理対象のメール(Homes見学予約)はありません。");
        return;
    }

    Logger.log(threads.length + "件のスレッド(見学予約)が見つかりました。");

    // ⚠️ この実行の中で送った見学予約番号（⚠️ **リード宛の同じメールを飛ばすため**）
    const sent = {};

    for (const thread of threads) {
        const messages = thread.getMessages();

        for (const msg of messages) {
            const emailText = msg.getPlainBody();
            const extractedData = extractHomesVisitData(emailText);

            // ⚠️ 予約受付日時が読めなかったときだけメールの受信日時で代用する
            if (!extractedData.registered) {
                extractedData.registered = homesMessageDate(msg);
            }

            // 必須データのチェック (propertyId と userId があるか)
            if (!extractedData.propertyId || !extractedData.userId) {
                Logger.log("必要なデータ(物件番号 または 見学予約番号)が抽出できなかったためスキップします。");
                continue;
            }

            if (sent[extractedData.userId]) {
                Logger.log("同じ見学予約番号を既に送信済みのためスキップします: " + extractedData.userId);
                continue;
            }

            // remarks（メモ）の生成
            extractedData.remarks = buildHomesRemarks(extractedData, homesVisitColumnNameMap);

            Logger.log("抽出データ(見学予約): " + JSON.stringify(extractedData));
            postHomesToPhpApi(extractedData);
            sent[extractedData.userId] = true;
        }
    }
}


// ==========================================
// ★ トリガーに設定する関数
// ==========================================

/**
 * ⚠️⚠️ **これをトリガーに設定する**（⚠️ 1時間ごとなど）。
 *
 * ⚠️ ⚠️ **片方が落ちても、もう片方は動かす。**
 *   ⚠️ 見学予約の取り込みで失敗しても、⚠️ **問合せの取り込みまで止まらないようにする。**
 */
function runHomesAll() {
    try {
        runHomesKaeru();
    } catch (e) {
        Logger.log("お客様からの問合せの取込でエラー: " + e.toString());
    }

    try {
        runHomesVisitKaeru();
    } catch (e) {
        Logger.log("見学予約の取込でエラー: " + e.toString());
    }
}
