# 2026-09-30 旧API（`demand` 形式）の移植（v2.2.155）

## ⚠️ 経緯

⚠️⚠️ **誤って強制アップロードを行い、① から `dashboard/api/` が消えた。**
⚠️ ⚠️ **この旧APIのPHPは repo に入っていなかったため、git から復元できない。**

⚠️ ① には ⚠️ **APIが2つ**あった。

| パス | 形式 | repo |
|---|---|---|
| `dashboard/api/gateway/` | `request` | ⚠️ `backend/src/`（復元済み） |
| ⚠️⚠️ **`dashboard/api/`** | ⚠️ `demand` | ⚠️⚠️ **無い（失われた）** |
| ⚠️ `dashboard/api/khf/` | `demand` | ⚠️⚠️ **無い（失われた）** |

⚠️⚠️ **画面の使い方から仕様を起こし直して、現行のAPIへ移した。**

---

## ⚠️ 移植した一覧

| 旧 `demand` | ⚠️ 新 `request` | 画面 | |
|---|---|---|---|
| `shop_list_accounting` | ⚠️ **`budget_accounting`** | 予算（経理） | ⚠️⚠️ **4つを1つにまとめた** |
| `medium_list_accounting` | ⚠️ 〃 | 〃 | |
| `budget_accounting` | ⚠️ 〃 | 〃 | |
| `staff_count` | ⚠️ 〃 | 〃 | |
| `event_calendar` | ⚠️ **`calendar`** | カレンダー | ⚠️⚠️ **2つを1つにまとめた** |
| `calendar_list` | ⚠️ 〃 | 〃 | |
| `calendar_add` | ⚠️ **`calendar_add`** | 〃 | ⚠️ 書き込み |
| `calendar_change` | ⚠️ **`calendar_change`** | 〃 | ⚠️ 書き込み（⚠️ `roll` で3通り） |
| ⚠️ `update_iceWorld` | ⚠️⚠️ **`ice_world`** | アイスワールド | ⚠️⚠️ **受け口は元からあった** |
| ⚠️ `contract_ex_update` | ⚠️⚠️ **`contract_ex_update`** | ランク（建売・中古） | ⚠️⚠️ **受け口は元からあった** |

⚠️⚠️ **`update_iceWorld` と `contract_ex_update` は、受け口が既に新API側にあり、
フロントだけが旧APIを向いていた。** ⚠️ 向け先を変えるだけで済んだ。

### ⚠️ 移植しなかったもの（⚠️ **利用者の判断で対象外**）

| `demand` | 画面 | |
|---|---|---|
| ⚠️ `kaeru_report` | BudgetKaeru | ⚠️⚠️ **使っていないとのこと** |
| ⚠️ `customer_budget_kaeru` | BudgetKaeru | ⚠️ 同画面のため見送り |
| ⚠️ `customer_list` | Calendar | ⚠️⚠️ **使っていないとのこと** |

⚠️ ⚠️ **この3箇所は旧APIを向いたまま残っている**（⚠️ **呼ぶと失敗する**）。⚠️ 下の申し送りを参照。

---

## ⚠️ 変えたもの

| ディレクトリ | ファイル | |
|---|---|---|
| `backend/src/handlers/` | ⚠️ **budget_accounting.php**（新規） | ⚠️ 予算（経理）の初期データ |
| `backend/src/handlers/` | ⚠️ **calendar.php**（新規） | ⚠️ カレンダーの初期データ |
| `backend/src/handlers/` | ⚠️ **calendar_add.php**（新規） | ⚠️ イベントの登録 |
| `backend/src/handlers/` | ⚠️ **calendar_change.php**（新規） | ⚠️ 変更・削除・実績 |
| `frontend/src/components/` | **BudgetAccounting.tsx** | ⚠️ 4回 → 1回 |
| `frontend/src/components/calendar/` | **Calendar.tsx** | ⚠️ 読み2回→1回、書き5箇所 |
| `frontend/src/components/` | **IceWorld.tsx** | ⚠️ 読み書きとも apiClient へ |
| `frontend/src/components/rank/` | **RankKaeru.tsx** / **RankResale.tsx** | ⚠️ `demand` → `request` |
| `frontend/src/utils/` | **version.ts** | ⚠️ `2.2.155` |
| `backend/scripts/sql/` | ⚠️ **2026-09-30_update_log_2.2.155.sql**（新規） | |

⚠️⚠️ **DBは1行も変えていない**（⚠️ **表も列も既にあった**）。

---

## ⚠️ 対応するテーブル

| `request` | 読む表 |
|---|---|
| `budget_accounting` | ⚠️ `shop_list_accounting` / `medium_list` / `budget` / `staff_count` |
| `calendar` | ⚠️ `event_calendar`（⚠️ **`flag = 1`**） / `reserved_calendar` |
| `calendar_add` | ⚠️ `event_calendar` へ追加 |
| `calendar_change` | ⚠️ `event_calendar` / `reserved_calendar` |

⚠️ ⚠️ **`shop_list` ではなく `shop_list_accounting`**（⚠️ 経理用の別表）。
⚠️ ⚠️ **列名は `resister_goal`**（⚠️ DB側の綴り）。⚠️ **画面の型は `register_goal` だが読んでいない**ので直していない。

---

## ⚠️⚠️ 判断したこと

### ⚠️ ① 削除は `flag = 0`（行は消さない）

⚠️ `event_calendar` に ⚠️⚠️ **`flag = 0` の行が129行あった。**
⚠️ ⚠️ **元からそういう運用**とみて、⚠️ **削除は `flag = 0`、読み出しは `flag = 1`** に揃えた。

⚠️ ⚠️ **行を消す実装にすると、過去の削除分が戻せなくなる。**

### ⚠️ ② 枝分かれは `request` ではなく `roll`

⚠️ 旧APIは `demand: 'calendar_change'` ＋ `request: 'response_change'` という形だった。
⚠️⚠️ **新しいAPIでは `request` が振り分けそのもの**なので、⚠️ **`roll` に変えた**（⚠️ `daily_action` と同じ形）。

### ⚠️ ③ 認証を付けた

⚠️ ⚠️ **旧APIは合い言葉（`Authorization: 4081Kokubu`）だけで誰でも叩けた。**
⚠️ 新しい4つは ⚠️⚠️ **`requireStaff()` でログイン中の利用者だけ**にした。
⚠️ ⚠️ **`apiClient` が `Token` を送っているので、画面側の変更は要らない。**

⚠️ ついでに ⚠️ **合い言葉の直書きも画面から消えた。**

---

## ⚠️⚠️ つまずいた点（⚠️ **重要**）

### ⚠️ 値が変わらない `UPDATE` は「0行」と数えられる

⚠️ 実績の登録を ⚠️ **「更新してみて0行なら追加」**と書いたところ、
⚠️⚠️ **同じ件数をもう一度送ると行が二重に増えた**（⚠️ 検証で `new=3` が2行になった）。

⚠️ ⚠️ **MySQL は値が変わらなかった `UPDATE` を「影響0行」と返す。**

⚠️ ⚠️ **先に `SELECT` して、あれば id で更新、無ければ追加**に直した。

```php
        /**
         * ⚠️⚠️ **先に「その行があるか」を見る。**
         *
         * ⚠️ ⚠️ **`UPDATE` の影響行数で判断してはならない。**
         *   ⚠️⚠️ **MySQL は値が変わらなかった UPDATE を「0行」と数える。**
         *     ⚠️ そのため「同じ件数をもう一度送る」と ⚠️ **行が二重に増える。**
         *   ⚠️ ⚠️ **実際にこれを踏んだ**（2026-09-30 の検証で `new=3` が2行になった）。
         */
        $find = $pdo->prepare(
            'SELECT id FROM reserved_calendar
              WHERE shop = ? AND event = ? AND date = ? AND category = ?
              LIMIT 1'
        );
        $update = $pdo->prepare('UPDATE reserved_calendar SET count = ? WHERE id = ?');
        $insert = $pdo->prepare(
            'INSERT INTO reserved_calendar (event_id, shop, event, date, count, category)
             VALUES (?, ?, ?, ?, ?, ?)'
        );

        foreach ($categories as $category) {
            if (!in_array($category, $targets, true)) continue;

            $count = (int)($data[$category] ?? 0);

            $find->execute([$shop, $event, $date, $category]);
            $existing = $find->fetchColumn();

            if ($existing !== false) {
                $update->execute([$count, (int)$existing]);
            } else {
                $insert->execute([$id, $shop, $event, $date, $count, $category]);
            }
        }
```

### ⚠️ Git Bash の引数に日本語を書くと化ける

⚠️ 検証の POST が壊れた。⚠️⚠️ **UTF-8のファイルに書いて `--data-binary @file` で送る**必要がある。

---

## ⚠️ 更新する列は許可リストで決めている

```php
        /**
         * ⚠️⚠️ **変えてよい列。**
         *   ⚠️ ⚠️ **ここに無い名前が来ても無視する。** ⚠️ `flag` や `shop` は変えさせない。
         */
        $allowed = ['title', 'startDate', 'endDate', 'note', 'url'];
        $targets = is_array($data['requestArray'] ?? null) ? $data['requestArray'] : [];

        $sets   = [];
        $params = [];
        foreach ($allowed as $column) {
            if (!in_array($column, $targets, true)) continue;
            // ⚠️ 列名は許可リスト由来。⚠️ **値だけプレースホルダで渡す**
            $sets[]   = "`{$column}` = ?";
            $params[] = (string)($data[$column] ?? '');
        }
```

⚠️ ⚠️ **`requestArray` はリクエストの値**なので、⚠️⚠️ **そのままSQLに入れてはならない。**

---

## ⚠️ ローカルでの確認（実施済み）

| # | 見たこと | 結果 |
|---|---|---|
| 1 | ⚠️ 認証なしで呼ぶ | ⚠️ ✅ **「認証が必要です。」** |
| 2 | ⚠️ `budget_accounting` | ⚠️ ✅ `shop` / `medium` / `budget` / `staff` の4つが返る |
| 3 | ⚠️ `calendar` | ⚠️ ✅ `event` **938件** / `reserved` が返る |
| 4 | ⚠️ `calendar_add` | ⚠️ ✅ 追加され、⚠️ **一覧がそのまま返る** |
| 5 | ⚠️ `roll: calendar_change` | ⚠️ ✅ title と note だけ変わり、⚠️⚠️ **shop と url は変わらない** |
| 6 | ⚠️ `roll: response_change` | ⚠️ ✅ 2行（`reserved=5` / `new=3`） |
| 7 | ⚠️⚠️ **同じ値で再送** | ⚠️ ✅ **2行のまま**（⚠️ 修正前は3行になった） |
| 8 | ⚠️ さらに再送 | ⚠️ ✅ **2行のまま** |
| 9 | ⚠️ `roll: delete_calendar` | ⚠️ ✅ 一覧から消える（⚠️ 行は残る） |
| 10 | ⚠️ 4ファイルの `php -l` | ⚠️ ✅ エラーなし |
| 11 | ⚠️ フロントのビルド | ⚠️ ✅ `main.9dde660b.js` に `2.2.155` |
| 12 | ⚠️ ビルドに残る旧APIの参照 | ⚠️ ✅ **3箇所だけ**（⚠️ 対象外の3つと一致） |

⚠️ ⚠️ **検証で入れた行は削除済み**（⚠️ `event_calendar` 1,066件 / `reserved_calendar` 9,409件に復帰）。

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **② には登録していない。** ⚠️ ① だけで動く（⚠️ **`express_proxy` に足していないので転送されない**）。⚠️ 負荷が問題になったら足せばよい |
| 2 | ⚠️⚠️ **対象外の3箇所は旧APIを向いたまま。** ⚠️ `BudgetKaeru` は ⚠️ **画面ごと動かない**（⚠️ `Promise.all` が失敗するため）。⚠️ 使うなら指示をください |
| 3 | ⚠️ ⚠️ **`Calendar.tsx` の `customer_list` も失敗する**が、⚠️ **別の `useEffect` なので他の表示は動く** |
| 4 | ⚠️⚠️ **`dashboard/api/` と `dashboard/api/khf/` は、もう作らなくてよい**（⚠️ 上の3つを使わないなら） |
| 5 | ⚠️ ⚠️ **旧APIの仕様は画面から起こしたもの**であり、⚠️ **元のPHPと完全に同じとは限らない。** ⚠️ 画面での確認をお願いします |
| 6 | ⚠️ ブラウザでの表示は ⚠️⚠️ **未確認**（⚠️ APIは実データで確認済み） |
