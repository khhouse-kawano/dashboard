# 2026-09-30 旧API changeShop.php の移植（v2.2.155）

## ⚠️ 依頼

| # | |
|---|---|
| 1 | ⚠️ 旧API `dashboard/api/changeShop.php` を ⚠️ **現行backend（①）と Express（②）へ移植** |
| 2 | ⚠️ `runBeforeSurvey` と `runMyHomeRobo` の ⚠️ **POST先を新APIへ向ける** |
| 3 | ⚠️ 版は上げず ⚠️ **v2.2.155 のまま進める** |

⚠️⚠️ **時間切れのため中断。** ⚠️ 未了は末尾の「明日の続き」を参照。

---

## ⚠️ 追加・変更したファイル

| ディレクトリ | ファイル | |
|---|---|---|
| `backend/src/handlers/` | ⚠️⚠️ **inquiry_update.php**（新規） | ① の受け口 |
| `backend-express/src/features/` | ⚠️⚠️ **inquiryUpdate.ts**（新規） | ② の受け口 |
| `backend-express/src/gateway/` | `registry.ts` | ⚠️ 7件の `register()` を追加 |
| `backend/src/core/` | `express_proxy.php` | ⚠️ 転送許可リストに7行追加 |
| `projects/sync/src/services/` | `runBeforeSurvey.ts` | ⚠️ POST先をゲートウェイへ |
| `projects/sync/src/services/` | `runMyHomeRobo.ts` | ⚠️ POST先をゲートウェイへ |
| `projects/sync/dist/services/` | `runBeforeSurvey.js` / `runMyHomeRobo.js` | ⚠️ `npx tsc` の出力 |

---

## ⚠️ 設計

### ⚠️⚠️ `demand` → `request` + `roll` に読み替えた

⚠️ 旧APIは枝分かれを `demand` で指定していた。
⚠️ ⚠️ **現行のゲートウェイは `request` で振り分け、その中の枝分かれは `roll`。**

| 旧 `demand` | 新 | |
|---|---|---|
| `robo` | `inquiry_update` / `roll: robo` | マイホームロボのID・URL |
| `before_survey` | `inquiry_update` / `roll: before_survey` | 事前アンケートを同期済みに |
| `sync` | `inquiry_update` / `roll: sync` | 同期済み＋pg_id |
| `sync_error` | `inquiry_update` / `roll: sync_error` | 同期の取り消し |
| `note` | `inquiry_update` / `roll: note` | 備考 |
| `shop`（`duplicate`） | `inquiry_update` / `roll: duplicate` | 重複名簿 |
| `new_customer` | `inquiry_update` / `roll: new_customer` | 顧客の新規作成 |

### ⚠️⚠️ 移植しなかったもの（⚠️ **意図的**）

| 旧 `demand` | 既存の受け口 |
|---|---|
| `shop`（通常） | `handlers/listAction/list_shop_change.php` |
| `staff` | `handlers/listAction/list_staff_change.php` |
| `tag` | `handlers/listAction/list_tag.php` |

⚠️ ⚠️ **二重に持たせない。**
⚠️⚠️ **特に `tag` は仕様ごと変わっている。**
⚠️ 旧APIは `black_list` 列へ空白区切りで追記し、⚠️ **出現回数の偶奇で ON/OFF を判定**していた。
⚠️ ⚠️ **現行はフラグ列（`duplicate_flag` 等）。** ⚠️ 旧方式を持ち込むと一覧の絞り込みが壊れる。

### ⚠️ 認証は要求しない（`auth: 'none'`）

⚠️⚠️ **呼び出し元は画面ではなくサーバー（projects/sync）であり、トークンを持てない。**
⚠️ 旧APIは合い言葉すら見ていなかった。⚠️ 他の同期向けハンドラ（`hotlead.php` 等）と同じ扱い。

### ⚠️ 返す形を変えた

⚠️ 旧APIは毎回 `inquiry_customer` の ⚠️ **全件（数万行）を返していた。**
⚠️ ⚠️ **呼び出し元はいずれも応答を捨てている**（`console.log` のみ）ため、`{status, message}` だけにした。

### ⚠️ 転送の扱い

⚠️ 7件とも `expressProxyRequests()` に入れ、⚠️⚠️ **`expressProxyExclusive()` には入れていない。**
⚠️ ① に PHP ハンドラが実在するので、⚠️ **② が落ちても ① へフォールバックして動く。**
⚠️ 転送が成功した時点で ① は実行しないため ⚠️ **二重書き込みにはならない**（`header_blacklist_*` と同じ扱い）。

⚠️⚠️ **`roll` まで書いている。** ⚠️ `'inquiry_update'` とだけ書くと、今後 ① にだけ足した `roll` も ② へ送られ、毎回502で往復する。

---

## ⚠️⚠️ 直した不具合（⚠️ **旧APIから持っていたもの**）

### ⚠️⚠️ ① `new_customer` は厳密モードで必ず落ちる

⚠️ `customers` の列は ⚠️ **すべて NOT NULL で既定値を持たない**（`trash` を除く）。
⚠️ ⚠️ **旧APIは8列しか指定していなかった**ため、

```
SQLSTATE[HY000]: General error: 1364 Field 'date' doesn't have a default value
```

⚠️ ⚠️ **実際にローカルで再現した。**
⚠️ 本番は非厳密設定で通っていたとみられる（⚠️ **空文字ではなく暗黙の既定値が入っていた**）。

⚠️ ⚠️ **全44列を明示する形に直した**（`CUSTOMERS_COLUMNS`）。
⚠️⚠️ **①と②で同じ表を持っている。片方だけ列を足さないこと。**

### ⚠️⚠️ ② `new_customer` は壊れたJSONを返しうる

⚠️ 旧APIは `customers` と `master_data` を ⚠️ **それぞれ判定してそれぞれ `echo` していた。**
⚠️ ⚠️ **両方作った場合、JSONが2つ連結された応答になる。**
⚠️ ⚠️ **最後に1回だけ返すようにした。**

### ⚠️⚠️ ③ `new_customer` は片方だけ作られうる

⚠️ `customers` だけ作られて `master_data` が無い状態を作りえた。
⚠️ ⚠️ **トランザクションにまとめた。**

### ⚠️⚠️ ④ `duplicate` は二度押すと `重複名簿重複名簿` になる

⚠️ `shop` に `CONCAT` で追記する仕様のため。
⚠️ ⚠️ **既に付いていれば何もしないようにした。**

### ⚠️ ⑤ 更新行数で成否を判断していない

⚠️⚠️ **MySQL は値が変わらなかった UPDATE を「0行」と数える。**
⚠️ ⚠️ **同じ値を送り直しただけで「失敗」になる。** ⚠️ 行の有無は別途 SELECT で確かめている。

---

## ⚠️ 追加した関数

### ⚠️ ① `backend/src/handlers/inquiry_update.php`

| 関数 | |
|---|---|
| `inquiryUpdateFail(int, string)` | ⚠️ 失敗応答をそろえる |
| `inquiryUpdateDone(string)` | ⚠️ 成功応答をそろえる |
| ⚠️ **`inquiryUpdateColumns(PDO, string, array, string)`** | ⚠️⚠️ **存在確認してから UPDATE** |

```php
/**
 * `inquiry_customer` を1行だけ更新する。
 *
 * ⚠️ 列名は呼び出し側が定数で渡す。⚠️ **リクエストの値を列名にしないこと。**
 * ⚠️⚠️ **更新行数では成否を判断しない。**
 *   ⚠️ MySQL は値が変わらなかった UPDATE を「0行」と数えるため、
 *     ⚠️ **同じ値をもう一度送っただけで「失敗」になってしまう。**
 */
function inquiryUpdateColumns(PDO $pdo, string $setClause, array $params, string $inquiryId): bool
{
    $exists = $pdo->prepare('SELECT 1 FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1');
    $exists->execute([$inquiryId]);

    if ($exists->fetchColumn() === false) {
        return false;
    }

    $params[] = $inquiryId;
    $pdo->prepare("UPDATE inquiry_customer SET {$setClause} WHERE inquiry_id = ?")->execute($params);

    return true;
}
```

### ⚠️ ② `backend-express/src/features/inquiryUpdate.ts`

| 関数 | |
|---|---|
| `runInquiryUpdateRobo(body)` | マイホームロボ |
| `runInquiryUpdateBeforeSurvey(body)` | 事前アンケート |
| `runInquiryUpdateSync(body)` | 同期済み |
| `runInquiryUpdateSyncError(body)` | 同期の取り消し |
| `runInquiryUpdateNote(body)` | 備考 |
| `runInquiryUpdateDuplicate(body)` | 重複名簿 |
| `runInquiryUpdateNewCustomer(body)` | 顧客の新規作成 |

⚠️ 内部の共通関数は `inquiryExists()` と `updateInquiry()`。⚠️ ① の `inquiryUpdateColumns()` と同じ考え方。

---

## ⚠️ 確認（実施済み）

⚠️⚠️ **ローカルの ① `http://localhost:8080/` を通して、②あり・②なしの両方で確認した。**

| # | 見たこと | 結果 |
|---|---|---|
| 1 | ⚠️ `roll: robo` | ⚠️ ✅ `mhl_id` / `mhl_url` が入る |
| 2 | ⚠️⚠️ **同じ値で再送** | ⚠️ ✅ **成功のまま**（0行問題なし） |
| 3 | ⚠️ `roll: before_survey` | ⚠️ ✅ `before_survey.sync = 1` |
| 4 | ⚠️ `roll: sync` / `sync_error` | ⚠️ ✅ `sync` と `pg_id` |
| 5 | ⚠️ `roll: note` | ⚠️ ✅ 備考が入る |
| 6 | ⚠️ `roll: duplicate` 2回 | ⚠️ ✅ **2回目は「既に重複名簿です」** |
| 7 | ⚠️ `roll: new_customer` 2回 | ⚠️ ✅ 1回目 customers / master_data、⚠️ **2回目は作らない** |
| 8 | ⚠️ 存在しない `inquiry_id` | ⚠️ ✅ **404** |
| 9 | ⚠️ 不正な `roll` | ⚠️ ✅ **400** |
| 10 | ⚠️⚠️ **② を停止して同じ6件** | ⚠️ ✅ **① が同じ応答を返す**（フォールバック） |
| 11 | ⚠️ ② 起動時のルート登録 | ⚠️ ✅ **7件とも登録** |
| 12 | ⚠️ `php -l` / `tsc --noEmit` | ⚠️ ✅ エラーなし |
| 13 | ⚠️ sync の `npx tsc` | ⚠️ ✅ エラーなし |
| 14 | ⚠️ 行の重複 | ⚠️ ✅ **増えていない** |

⚠️ ⚠️ **検証データは元に戻した**（`customers` 23,009 / `master_data` 25,671、`homes3612816` と `before_survey` 2895 も復元）。

⚠️⚠️ **ブラウザ・本番での確認は未実施。**

---

## ⚠️⚠️ 明日の続き（未了）

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **コミットしていない。** ⚠️ dashboard（4ファイル）と ⚠️ **projects/sync（src 2 + dist 2）は別リポジトリ**。両方必要 |
| 2 | ⚠️⚠️ **`docs/deploy-v2.2.155.md` に今回の分を追記していない。** ⚠️ ① は `inquiry_update.php` と `core/express_proxy.php`、② は再デプロイ、⚠️ **sync も再デプロイ** |
| 3 | ⚠️⚠️ **デプロイ順序に注意。** ⚠️ ⚠️ **①②を先、sync を後**。逆にすると sync の送信先がまだ無く、⚠️ **その間の更新が失われる**（sync はエラーを握りつぶす） |
| 4 | ⚠️ ⚠️ **旧 `changeShop.php` は消さずに残すこと。** ⚠️ sync のデプロイが済むまでは旧APIが使われる |
| 5 | ⚠️⚠️ **`breakaway` と `open_myhomerobo_mail` は未対応。** ⚠️ 受け口がそもそも無く、⚠️ **現在も止まったまま**（[task-2026-09-30-05](task-2026-09-30-05-sync-legacy-api.md) 参照） |
| 6 | ⚠️ ⚠️ **本番の `customers` の設定を確認すること。** ⚠️ 厳密モードなら旧APIの `new_customer` は元々落ちていたことになる |
| 7 | ⚠️ sync の失敗は ⚠️ **`console.error` だけで通知が飛ばない。** ⚠️ `sendErrorMail` を通すかは別途判断 |
