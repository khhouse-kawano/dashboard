# 2026-09-30 v2.2.155 のリファクタリングと、APIの呼び出し方の棚卸し

## ⚠️ 依頼

| # | |
|---|---|
| 1 | ⚠️ v2.2.155 の作業内容を ⚠️ **リファクタリング** |
| 2 | ⚠️⚠️ **フロントが叩いているAPIのURLを全部調べ、`apiClient` を使っていないものを洗い出す** |
| 3 | ⚠️ ⚠️ **Heroku連携はそのままでよい** |

---

## ⚠️ ① リファクタリング

### ⚠️⚠️ 同じSQLを3箇所に書いていた

⚠️ `calendar.php` / `calendar_add.php` / `calendar_change.php` が、⚠️ **どれも同じ一覧を返す**のに
⚠️ **それぞれSQLを持っていた。**

⚠️ ⚠️ **「条件は calendar.php と揃えること」と3回書いていた。**
⚠️⚠️ **これは直すべきものを注記で誤魔化している状態である。**

⚠️ ⚠️ **片方だけ条件を直すと「登録した直後だけ表示が違う」という、
⚠️ 気づきにくい食い違いになる。**

### ⚠️ 新しく作ったもの

| ディレクトリ | ファイル | |
|---|---|---|
| `backend/src/core/` | ⚠️⚠️ **calendar.php**（新規） | ⚠️ 一覧の取り方と実績の書き込み |

| 関数 | |
|---|---|
| ⚠️ **`calendarEvents($pdo)`** | ⚠️ イベント一覧（⚠️ **`flag = 1`**） |
| ⚠️ **`calendarReserved($pdo)`** | ⚠️ 実績一覧 |
| ⚠️ **`calendarSaveReserved(...)`** | ⚠️⚠️ **実績を1件、無ければ追加・あれば更新** |

```php
/**
 * 実績を1件書き込む（無ければ追加、あれば更新）。
 *
 * ⚠️⚠️ **先に「その行があるか」を見ること。**
 *   ⚠️ ⚠️ **`UPDATE` の影響行数で判断してはならない。**
 *     ⚠️⚠️ **MySQL は値が変わらなかった UPDATE を「0行」と数える。**
 *     ⚠️ そのため「同じ人数をもう一度送る」と ⚠️ **行が二重に増える。**
 *   ⚠️ ⚠️ **実際にこれを踏んだ**（2026-09-30 の検証で `new=3` が2行になった）。
 *
 * ⚠️ `reserved_calendar` に一意キーが無いため、⚠️ **`ON DUPLICATE KEY` は使えない。**
 */
function calendarSaveReserved(
    PDO $pdo,
    int $eventId,
    string $shop,
    string $event,
    string $date,
    string $category,
    int $count
): void {
    $find = $pdo->prepare(
        'SELECT id FROM reserved_calendar
          WHERE shop = ? AND event = ? AND date = ? AND category = ?
          LIMIT 1'
    );
    $find->execute([$shop, $event, $date, $category]);
    $existing = $find->fetchColumn();

    if ($existing !== false) {
        $pdo->prepare('UPDATE reserved_calendar SET count = ? WHERE id = ?')
            ->execute([$count, (int)$existing]);
        return;
    }

    $pdo->prepare(
        'INSERT INTO reserved_calendar (event_id, shop, event, date, count, category)
         VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$eventId, $shop, $event, $date, $count, $category]);
}
```

### ⚠️ `calendar_change.php` の整理

| 前 | 後 |
|---|---|
| ⚠️ 関数をハンドラ内に定義 | ⚠️ **`core/calendar.php` へ** |
| ⚠️ 区分・許可列を処理の中に直書き | ⚠️ **`const CALENDAR_CATEGORIES` / `CALENDAR_EDITABLE`** |
| ⚠️ エラー応答を毎回書いていた | ⚠️ **`calendarFail()` に集約** |
| ⚠️ 行数 | ⚠️ **約160行 → 約120行** |

⚠️ ⚠️ **挙動は変えていない**（⚠️ 下の再検証を参照）。

---

## ⚠️ ② APIの呼び出し方の棚卸し

⚠️ ⚠️ **`axios` / `fetch` / `XMLHttpRequest` を全文検索して確認した。**

### ⚠️⚠️ apiClient に直した（⚠️ **6ファイル / 7箇所**）

⚠️ ⚠️ **いずれも本番のURLを直書きしていた。**
⚠️⚠️ **開発環境から実行しても本番へ飛ぶ**状態で、⚠️ **合い言葉もソースに露出**していた。

| ファイル | 箇所 | `request` |
|---|---|---|
| `components/CallStatusList.tsx` | 1 | `callStatusList` |
| `components/CancelList.tsx` | 2 | `cancelList` ほか |
| `components/database/PastCustomer.tsx` | 1 | `past_customer` |
| `components/Estate.tsx` | 2 | `estate` ほか |
| `components/EstateInfo.tsx` | 1 | `estateInfo` |
| `components/Survey.tsx` | 1 | `survey` |

⚠️ ⚠️ **`Estate.tsx` の `timeout: 20000` は残してある**（⚠️ 消すと重い同期が途中で切れる）。
⚠️ 併せて ⚠️ **使われなくなった `headers` の import も削除。**

### ⚠️ 未使用の `axios` import を削除（⚠️ **4ファイル**）

```
components/header/EditShop.tsx
components/market/MarketDetailModal.tsx
components/shopTrend/ShopTrendKaeru.tsx
components/shopTrend/ShopTrendOrder.tsx
```

⚠️ ⚠️ **`axios.` の呼び出しが1つも無いことを確かめてから消した。**

### ⚠️ そのままにしたもの（⚠️ **理由あり**）

| ファイル | 行き先 | なぜそのままか |
|---|---|---|
| ⚠️ `header/SyncEstate.tsx` | ⚠️ **herokuapp.com** | ⚠️⚠️ **Heroku連携**（指示どおり） |
| ⚠️ `shopTrend/ShopTrendResale.tsx` | ⚠️ **herokuapp.com** | ⚠️ 同上 |
| ⚠️ `information/InformationEdit.tsx` | ⚠️ `${baseURL}/api/add_event` | ⚠️ **同期サービス側**（`REACT_APP_API_BASE_URL`） |
| ⚠️ `utils/competitorPdfUpload.ts` | ダッシュボードAPI | ⚠️⚠️ **FormData のため。** ⚠️ apiClient は `Content-Type: application/json` を付けてしまい、⚠️ **boundary が入らずファイルが届かない**（ファイル内に注記あり） |
| ⚠️ `photo/Form.tsx` | ダッシュボードAPI | ⚠️ 同じく **FormData** |
| ⚠️ `campaign/formBuilderUtils.ts` | `api.khg-marketing.info` | ⚠️⚠️ **生成するフォームHTMLに埋め込む文字列。** ⚠️ 外部の公開フォームが叩くので apiClient は使えない |
| ⚠️ `header/CompetitorMaterials.tsx` / `information/TableCompetitorPdf.tsx` | `.../handlers/...` | ⚠️⚠️ **PDFのリンク（href）。** ⚠️ API呼び出しではない |
| ⚠️ `utils/ksnapImage.ts` | `.../api/images` | ⚠️ 画像の置き場。⚠️ **環境変数で差し替えられる** |
| ⚠️ `header/RegisterBrokerageListings.tsx` | `/api/listings/create.php` | ⚠️⚠️ **コメントアウトされていて動いていない** |

### ⚠️⚠️ 残った問題（⚠️ **未対応**）

| ファイル | |
|---|---|
| ⚠️⚠️ **`components/BudgetKaeru.tsx`** | ⚠️ **消えた旧API**（`kaeru_report` / `customer_budget_kaeru`）を向いたまま。⚠️ **画面ごと動かない**（⚠️ 利用者の判断で対象外） |

---

## ⚠️ 確認（実施済み）

### ⚠️ リファクタ後の再検証（⚠️ **挙動が変わっていないこと**）

| # | 見たこと | 結果 |
|---|---|---|
| 1 | ⚠️ `calendar` の読み出し | ⚠️ ✅ event 938 / reserved 9,409（⚠️ **前と同じ**） |
| 2 | ⚠️ 内容の変更 | ⚠️ ✅ title だけ変わり、⚠️ **shop・url は不変** |
| 3 | ⚠️ 実績の登録 | ⚠️ ✅ 2行 |
| 4 | ⚠️⚠️ **同じ値で2回再送** | ⚠️ ✅ **2行のまま** |
| 5 | ⚠️ 削除 | ⚠️ ✅ 一覧から消える |
| 6 | ⚠️ 4ファイルの `php -l` | ⚠️ ✅ エラーなし |

⚠️ ⚠️ **検証行は削除済み**（⚠️ 1,066件 / 9,409件に復帰）。

### ⚠️ フロント

| # | 見たこと | 結果 |
|---|---|---|
| 7 | ⚠️ ビルド | ⚠️ ✅ `main.a6d884b9.js`（⚠️ **−164B**） |
| 8 | ⚠️ `Module not found` | ⚠️ ✅ なし |
| 9 | ⚠️ gateway の直書き | ⚠️ ✅ **PDFリンク2箇所だけ**（⚠️ API呼び出しは0） |

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **`utils/headers.ts` はまだ残っている。** ⚠️ Heroku連携と FormData 送信が使っているため |
| 2 | ⚠️⚠️ **合い言葉（`4081Kokubu`）はソースに残る。** ⚠️ `apiClient` 自身が持っており、⚠️ **ブラウザに露出する前提の値である** |
| 3 | ⚠️ ⚠️ **FormData の2箇所は apiClient にしてはいけない**（⚠️ ファイルが届かなくなる）。⚠️ 注記を残してある |
| 4 | ⚠️ ⚠️ **PDFリンクは本番URL直書きのまま。** ⚠️ 開発環境では本番のファイルを見ることになる（⚠️ 実害は小さい） |
| 5 | ⚠️⚠️ **BudgetKaeru は動かないまま**（⚠️ 対象外の判断） |
| 6 | ⚠️ ブラウザでの表示は ⚠️⚠️ **未確認**（⚠️ APIは実データで確認済み） |
