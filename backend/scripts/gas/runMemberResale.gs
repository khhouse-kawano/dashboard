// ==========================================
// 中古住宅専門店（chuko-senmon.jp）の会員登録メール → member_resale_update
//
// ⚠️ トリガー: runMemberResale（関数名は以前と同じ）
// ⚠️ 送り先: ① https://khg-marketing.info/dashboard/api/gateway/（request: member_resale_update。① の handlers/member_resale_update.php）
//   ⚠️ 同じメールアドレスの会員は上書き（① が見る）。何度実行しても二重にならない。
//
// ⚠️ 2026-11-24（v2.2.295）改修：今のメールの書式で取りこぼしていた項目を読む。
//   - 【当サイトをどこでお知りになりましたか？】を媒体（source）として読む
//     （⚠️ 以前は【ご登録のきっかけ】だけを見ていて、今の書式では source が空になり、反響の媒体も空になっていた。
//       ⚠️ 古い書式のメールのために【ご登録のきっかけ】も残す）
//   - 【郵便番号】と【ご希望条件】（第一〜第三希望エリア・※市区町村、学区など・その他希望条件）を読み、備考（remarks）に入れる
//     （⚠️ 送り先の表に列が無いため、それ自体は送らない）
//   - 【電話番号】が携帯（070/080/090）で【携帯番号】が無いときは、携帯番号として送る（反響では mobile が携帯の欄に入る）
//   - 値を読むのを、次の【見出し】か「このメールは…」の行の手前で止める
//     （⚠️ 以前は最後の見出しの値に【個人情報保護方針】やメールの末尾まで入ることがあった）
// ⚠️ 媒体の「Web検索」は ① へはそのまま送る。顧客DB に取り込むとき、画面（ListResale.tsx）が中古の媒体の名前「ネット検索」にそろえる。
// ==========================================

// ==========================================
// 辞書と抽出ロジック
// ==========================================
// ★変数名が他のファイルと衝突しないように変更
const memberResaleColumnNameMap = {
    email: "メールアドレス",
    name: "お名前",
    nameKana: "フリガナ",
    zip: "郵便番号",
    address: "住所",
    tel: "電話番号",
    mobile: "携帯番号",
    emailSendFlag: "メール送信",
    source: "当サイトをどこでお知りになりましたか？",
    desiredArea1: "第一希望エリア",
    desiredArea2: "第二希望エリア",
    desiredArea3: "第三希望エリア",
    areaNotes: "※市区町村、学区など",
    otherConditions: "その他希望条件",
    registered: "システム受付日時"
};

/** 送り先（member_resale_update.php）が受ける項目。⚠️ これ以外は備考にだけ入れる */
const MEMBER_RESALE_SEND_KEYS = ["email", "name", "nameKana", "address", "tel", "mobile", "emailSendFlag", "source", "registered", "remarks"];

/** 携帯電話の番号（070/080/090） */
const MEMBER_RESALE_MOBILE_PATTERN = /^0[789]0/;

function escapeMemberResaleRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 複数行の値は、行ごとに前後の空白（全角を含む）を除いて改行でつなぐ。空の行は落とす */
function cleanMemberResaleValue(value) {
    return value
        .replace(/<mailto:[^>]*>/g, "")
        .replace(/<https?:\/\/[^>]*>/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "")
        .join("\n");
}

function extractMemberResaleData(text) {
    const body = text.replace(/\r\n?/g, "\n");

    // 【見出し】の値。⚠️ 次の【見出し】か「このメールは」の行の手前まで
    const extract = (keyword) => {
        const regex = new RegExp(`【${escapeMemberResaleRegExp(keyword)}】[ 　\\t]*([\\s\\S]*?)(?=\\n[ 　\\t]*【|\\n[ 　\\t]*このメールは|$)`);
        const match = body.match(regex);
        return match ? cleanMemberResaleValue(match[1]) : "";
    };

    // 【ご希望条件】の中の「・見出し」の値。⚠️ 次の「・」の行の手前まで
    const conditions = extract("ご希望条件");
    const extractCondition = (keyword) => {
        const regex = new RegExp(`・${escapeMemberResaleRegExp(keyword)}[ 　\\t]*([\\s\\S]*?)(?=\\n[ 　\\t]*・|$)`);
        const match = conditions.match(regex);
        return match ? cleanMemberResaleValue(match[1]) : "";
    };

    const data = {
        email: extract("メールアドレス"),
        name: extract("お名前"),
        nameKana: extract("フリガナ"),
        zip: extract("郵便番号").replace("〒", "").trim(),
        address: extract("住所"),
        tel: extract("電話番号"),
        mobile: extract("携帯番号"),
        emailSendFlag: extract("メール送信"),
        // ⚠️ 今の書式は「当サイトをどこでお知りになりましたか？」、古い書式は「ご登録のきっかけ」
        source: extract("当サイトをどこでお知りになりましたか？") || extract("ご登録のきっかけ"),
        desiredArea1: extractCondition("第一希望エリア"),
        desiredArea2: extractCondition("第二希望エリア"),
        desiredArea3: extractCondition("第三希望エリア"),
        areaNotes: extractCondition("※市区町村、学区など"),
        otherConditions: extractCondition("その他希望条件"),
    };

    // ⚠️ 携帯番号の欄が無く、電話番号が携帯なら携帯番号に回す（① は mobile → 携帯、tel → 固定電話 として反響に入れる）
    if (!data.mobile && MEMBER_RESALE_MOBILE_PATTERN.test(data.tel.replace(/[^0-9]/g, ""))) {
        data.mobile = data.tel;
        data.tel = "";
    }

    return data;
}

function padZeroMemberResale(num) {
    return ('0' + num).slice(-2);
}

/** 送る形にする（備考を作り、送り先が受けない項目を外す） */
function buildMemberResalePayload(extractedData, registered) {
    const finalData = { ...extractedData, registered: registered };

    // remarks（メモ）の生成
    const remarksList = [];
    for (const [key, val] of Object.entries(finalData)) {
        if (val && memberResaleColumnNameMap[key]) {
            remarksList.push(`${memberResaleColumnNameMap[key]}：${val}`);
        }
    }
    finalData.remarks = remarksList.join('\n');

    const payload = {};
    for (const key of MEMBER_RESALE_SEND_KEYS) payload[key] = finalData[key] || "";
    return payload;
}

// ==========================================
// API送信処理
// ==========================================
function postMemberResaleToPhpApi(data) {
    const API_URL = "https://khg-marketing.info/dashboard/api/gateway/";
    const payload = {
        ...data,
        request: 'member_resale_update' // ★ 中古住宅専門店 会員登録用のリクエスト識別子
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
function runMemberResale() {
    // 検索条件: 1日以内
    // FROM: ask@chuko-senmon.jp
    // SUBJECT: 新規会員登録発生通知メール
    // 本文: 国分ハウジンググループ中古住宅専門店の新規会員登録情報
    const query = 'from:ask@chuko-senmon.jp subject:"新規会員登録発生通知メール" "国分ハウジンググループ中古住宅専門店の新規会員登録情報" newer_than:1d';
    const threads = GmailApp.search(query);

    if (threads.length === 0) {
        Logger.log("処理対象のメール(Member Resale)はありません。");
        return;
    }

    Logger.log(`${threads.length}件のスレッドが見つかりました。`);

    for (const thread of threads) {
        const messages = thread.getMessages();

        for (const msg of messages) {
            // ★ API側で重複排除されるため、未読判定や既読化は行いません
            const emailText = msg.getPlainBody();
            const extractedData = extractMemberResaleData(emailText);

            // 日時データの生成
            const d = msg.getDate();
            const registered = `${d.getFullYear()}-${padZeroMemberResale(d.getMonth() + 1)}-${padZeroMemberResale(d.getDate())} ${padZeroMemberResale(d.getHours())}:${padZeroMemberResale(d.getMinutes())}:${padZeroMemberResale(d.getSeconds())}`;

            const finalData = buildMemberResalePayload(extractedData, registered);

            // 必須データのチェック (nameが存在するか)
            if (finalData.name) {
                Logger.log("抽出データ: " + JSON.stringify(finalData));
                postMemberResaleToPhpApi(finalData);
            } else {
                Logger.log("必要なデータ(name)が抽出できなかったためスキップします。");
            }
        }
    }
}
