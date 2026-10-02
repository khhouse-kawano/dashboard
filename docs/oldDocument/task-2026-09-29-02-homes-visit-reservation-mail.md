# 2026-09-29 HOME'S 新築一戸建て見学予約メールの取込

## ⚠️ 依頼

⚠️ 既存の HOME'S（かえる）メール取込GASを修正し、⚠️⚠️ **見学予約メールも取り込めるようにする。**

| | |
|---|---|
| ⚠️ 差出人 | ⚠️ **support-k@homes.co.jp**（⚠️ 既存は `support@homes.co.jp`） |
| ⚠️ 件名 | ⚠️ **【LIFULL HOME'S新築一戸建て見学予約】** を含む |
| ⚠️ 受け口 | ⚠️⚠️ **`homes_db_kaeru` をそのまま使う** |
| ⚠️ 注意 | ⚠️⚠️ **リード宛にも届くので2通来る** |

---

## ⚠️ 変えたもの

| ディレクトリ | ファイル | |
|---|---|---|
| `backend/scripts/gas/` | ⚠️⚠️ **runHomesKaeru.gs**（新規） | ⚠️ 既存GASに見学予約の取込を足したもの |

⚠️⚠️ **PHPは1行も変えていない。**

| なぜ変えなくてよかったか |
|---|
| ⚠️ `backend/src/core/db.php` が ⚠️ **受け取ったJSONをそのまま `$data` にしている** |
| ⚠️ `backend/src/handlers/homes_db_kaeru.php` は ⚠️ **`$data` のキー名をそのまま列に流すだけ** |
| ⚠️ ⚠️ **つまり、GAS側で既存のキー名に合わせて送れば、そのまま既存の表に入る** |

---

## ⚠️ 追加した関数

| 関数 | |
|---|---|
| ⚠️ **`extractHomesVisitData(text)`** | ⚠️ 見学予約メールから項目を取り出す |
| ⚠️ **`isHomesBlank(value)`** | ⚠️ `------` のような空欄の代わりの記号を空にする |
| ⚠️ **`homesMessageDate(msg)`** | ⚠️ Gmailの受信日時を `YYYY-MM-DD HH:MM:SS` に |
| ⚠️ **`buildHomesRemarks(data, columnNameMap)`** | ⚠️ メモを組み立てる（⚠️ **①②で共用**） |
| ⚠️ **`runHomesVisitKaeru()`** | ⚠️ 見学予約メールの取込 |
| ⚠️ **`runHomesAll()`** | ⚠️⚠️ **トリガーに設定する関数**（①②を順に呼ぶ） |

| 定数 | |
|---|---|
| ⚠️ **`homesVisitColumnNameMap`** | ⚠️ 見学予約メール用の項目名の辞書 |

⚠️ ⚠️ **既存の `extractHomesData` / `homesColumnNameMap` / `postHomesToPhpApi` / `padZeroHomes` は触っていない。**
⚠️ `runHomesKaeru` は ⚠️ **メモ生成と日時生成を共用関数に置き換えただけ**で、⚠️ **動きは同じ。**

---

## ⚠️ マッピング

| メールの項目 | `homes_db_kaeru` の列 | |
|---|---|---|
| 物件名 | `propertyName` | |
| 物件番号 | `propertyId` | |
| 所在地 | `area` | |
| 交通 | `railway` | |
| URL | `propertyUrl` | |
| ⚠️⚠️ **見学予約番号** | ⚠️⚠️ **`userId`** | ⚠️⚠️ **`visit` を頭に付ける**（下記） |
| 予約受付日時 | `registered` | ⚠️⚠️ **`/` を `-` に直す**（下記） |
| 名前 | `name` | |
| メールアドレス | `mail` | |
| 電話番号 | `mobile` | |
| ご質問など | `note` | |
| ⚠️ （メールに無い） | `category` | ⚠️ **`新築一戸建て見学予約` を入れる**（⚠️ 後から見分けるため） |
| ⚠️ フリガナ | ⚠️⚠️ **列が無い** | ⚠️ **`remarks` にだけ入る** |
| ⚠️ 見学希望日（第1・第2候補） | ⚠️⚠️ **列が無い** | ⚠️ **`remarks` にだけ入る** |
| ⚠️ ご希望の連絡時間帯 | ⚠️⚠️ **列が無い** | ⚠️ **`remarks` にだけ入る** |

⚠️ ⚠️ **見学予約メールに無い項目**: 価格 / 面積 / 間取 / 自社管理番号 / ユーザー詳細URL → ⚠️ **空**

### ⚠️⚠️ なぜ `visit` を付けるか

⚠️ ⚠️ **問合せ番号（例 `44447773`）と見学予約番号（例 `11105640`）は別の番号体系なのに、
⚠️ どちらも同じ `userId` 列に入る。**

⚠️ `homes_db_kaeru.php` は ⚠️⚠️ **`userId` が一致したら UPDATE する。**
⚠️ ⚠️ **番号がたまたま一致すると、見学予約が本物の問合せを上書きしてしまう。**

⚠️ ⚠️ **`userId` を `visit11105640` にすることで、絶対にぶつからないようにした。**
⚠️ `inquiry_customer_kaeru` 側の `inquiry_id` は ⚠️ **`homes_visit11105640`** になる。

⚠️ ⚠️ **メモ（remarks）には元の番号（`11105640`）をそのまま出している。**

### ⚠️⚠️ なぜ日時のスラッシュを直すか

⚠️ メールには ⚠️ **`2026/09/28 19:22:30`** と書かれている。

⚠️ `backend/src/handlers/portal/homes_kaeru.php` が

```sql
DATE_FORMAT(registered, '%Y/%m/%d')
```

⚠️ で ⚠️ **反響日（`inquiry_date`）を作っている。**
⚠️ ⚠️ **スラッシュのまま入れると `inquiry_date` が NULL になる。**

⚠️ ⚠️ **`-` に直して `2026-09-28 19:22:30` で保存する。**（⚠️ 既存の問合せメールも同じ形）

---

## ⚠️ 追加した関数（そのまま）

### ⚠️ `homesVisitColumnNameMap`

```js
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
```

### ⚠️ `isHomesBlank`

```js
/**
 * ⚠️ `------------------------------` のような ⚠️ **空欄の代わりの記号**を空にする。
 *   ⚠️ ⚠️ **そのまま入れると第2候補に線が入って見える。**
 */
function isHomesBlank(value) {
    return value === "" || /^[-‐－ー\s　]+$/.test(value);
}
```

### ⚠️ `extractHomesVisitData`

```js
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
```

### ⚠️ `homesMessageDate` / `buildHomesRemarks`

```js
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
```

### ⚠️ `runHomesVisitKaeru`

```js
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
```

### ⚠️ `runHomesAll`

```js
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
```

---

## ⚠️ ローカルでの確認（実施済み）

⚠️ ⚠️ **いただいたメール本文をそのままファイルにして、抽出 → ローカルの受け口へPOSTした。**

| # | 見たこと | 結果 |
|---|---|---|
| 1 | ⚠️ 物件名・物件番号・所在地・交通・URL | ⚠️ ✅ すべて取れた |
| 2 | ⚠️ 名前・フリガナ・メール・電話 | ⚠️ ✅ `甲斐　彩香` / `カイサヤカ` / `sysysy39@gmail.com` / `08043187262` |
| 3 | ⚠️ 見学希望日 第1候補 | ⚠️ ✅ `2026/09/30 14:00～16:00` |
| 4 | ⚠️⚠️ **第2候補（`------`）** | ⚠️ ✅ **空になった**（線が残らない） |
| 5 | ⚠️ 予約受付日時 | ⚠️ ✅ **`2026-09-28 19:22:30`**（スラッシュを直した） |
| 6 | ⚠️ `userId` | ⚠️ ✅ **`visit11105640`** |
| 7 | ⚠️ メモの見学予約番号 | ⚠️ ✅ **`11105640`**（元の番号） |
| 8 | ⚠️⚠️ **フッターの `E-MAIL：support-k@…` を拾わないか** | ⚠️ ✅ **拾わない** |
| 9 | ⚠️ 受け口へPOST（1回目） | ⚠️ ✅ `{"status":"success","action":"inserted"}` |
| 10 | ⚠️⚠️ **同じものをもう一度POST** | ⚠️ ✅ **`"action":"updated"`**（⚠️ 行は増えない） |
| 11 | ⚠️ `homes_db_kaeru` | ⚠️ ✅ 1行。⚠️ `category` が `新築一戸建て見学予約` |
| 12 | ⚠️⚠️ **`inquiry_customer_kaeru` への連携** | ⚠️ ✅ `homes_visit11105640` / ⚠️⚠️ **`inquiry_date = 2026/09/28`** / `brand = かえる` |

⚠️ ⚠️ **検証で入れた行は両方の表から削除済み**（⚠️ `homes_db_kaeru` は286行に戻した）。

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **トリガーは `runHomesAll` に付け替えること。** ⚠️ `runHomesKaeru` のままだと見学予約が取り込まれない |
| 2 | ⚠️ ⚠️ **既存のトリガーを消さなくても壊れない**（⚠️ `runHomesKaeru` はそのまま動く）。⚠️ **ただし見学予約は入らない** |
| 3 | ⚠️⚠️ **`medium` / `response_medium` は問合せと同じ `HOME'S`。** ⚠️ **見学予約を分けたい場合は PHP（portal/homes_kaeru.php）の修正が要る**ので指示をください |
| 4 | ⚠️ ⚠️ **見学予約メールの宛先が分からないため `to:` で絞っていない。** ⚠️ 判明すれば絞ったほうが確実 |
| 5 | ⚠️ ⚠️ **フリガナ・見学希望日は列が無いのでメモにしか残らない。** ⚠️ 表に出したい場合は列の追加が要る |
| 6 | ⚠️ ⚠️ **実際のGmailでの動作は未確認**（⚠️ 手元にメールが無いため）。⚠️ **一度手で実行してログを確認してください** |
| 7 | ⚠️⚠️ **MCP の説明文「既定の reaction」が古いまま**（持ち越し） |
