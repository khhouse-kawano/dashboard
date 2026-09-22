# デプロイ手順 v2.2.143

⚠️ 中身: ⚠️ **競合サマリーの営業課の一覧を、画面の直書きから `section_list` に切り替えた。**

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 営業課の選択肢が ⚠️ **6 → 7** になる（⚠️ **大分営業課・佐賀・久留米営業課が選べる**） | ① フロント |
| 2 | `competitor` の応答に ⚠️ `section[].no` が増える | ⚠️ **①② 両方** |
| 3 | 更新履歴に1行増える | ① DB |

⚠️⚠️ **v2.2.142（MCPの道具・レポート画面の502修正）を先に通しておくこと。**

⚠️ ⚠️ **DB のテーブル変更は無い**（`section_list` は既存）。

---

## ⚠️ 順序

```
1. ① SQL（update_log）
2. ② Express の再ビルド
3. ① PHP（competitor.php）
4. ① フロント
```

⚠️ ⚠️ **2 と 3 はどちらが先でもよい**（⚠️ **`no` が増えるだけで、片方が古くても画面は壊れない**）。
⚠️ 画面側は ⚠️ **`section` が無くても落ちない**ようにしてある（`?? []`）。

---

## 手順1　【① レンタルサーバーで実行】SQL（phpMyAdmin）

```sql
INSERT INTO update_log (version, date, note) VALUES
('2.2.143', '2026-09-22', '競合サマリーの営業課の一覧を、画面の直書きから section_list に切り替えた。');
```

⚠️ ファイル: `backend/scripts/sql/2026-09-22_update_log_2.2.143.sql`

---

## 手順2　【② VPS で実行】

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
grep -n "SELECT no, division, name FROM section_list" backend-express/src/features/competitor.ts
dcp build express-api
dcp up -d --force-recreate express-api
```

⚠️⚠️ **`git pull` は使わないこと。** ⚠️ **この環境は detached HEAD が正しい状態**で、必ず分岐エラーになる。

---

## 手順3　【① レンタルサーバーで実行】PHP のアップロード

| ファイル | 置き場所 |
|---|---|
| ⚠️ **`backend/src/handlers/competitor.php`** | `handlers/` |

⚠️ ⚠️ **1ファイルだけ。**

---

## 手順4　【あなたのPC（PowerShell）】フロントのビルド → ① へアップロード

```powershell
cd C:\Users\shinji-kawano\react\dashboard\frontend
npm run build
```

| 何 | 備考 |
|---|---|
| `index.html` | ⚠️ **必ず差し替える** |
| `static/js/` | 新しい `main.*.js` |
| `static/css/` | 新しい `main.*.css` |

---

## ⚠️ 手順5　動作確認

| # | 確認 | 期待 |
|---|---|---|
| 1 | 他社動向 → 競合サマリー | ⚠️ **営業課が7つ** |
| 2 | ⚠️ **並び** | ⚠️ **鹿児島1 → 鹿児島2 → 鹿児島3 → 宮崎 → 大分 → 熊本 → 佐賀・久留米** |
| 3 | ⚠️⚠️ **大分営業課を選ぶ** | ⚠️⚠️ **件数が出る**（⚠️ 前は選択肢自体が無かった） |
| 4 | 「大分・佐賀営業課」 | ⚠️ **選択肢から消えている**（⚠️ **実在しない課だった**） |
| 5 | 「全課を表示」 | 元に戻る |
| 6 | 店舗の絞り込み | ⚠️ **今までどおり** |
| 7 | バージョン表示 | ⚠️ **2.2.143** |

⚠️ ⚠️ **3 が今回の眼目。** ⚠️ **大分・佐賀のデータは、これまでどの選択肢でも絞り込めていなかった。**

---

## ⚠️ 戻し方

| 何 | どう戻すか |
|---|---|
| フロント | 1つ前の `main.*.js` と `index.html` |
| ① PHP | 1つ前の `competitor.php` |
| ② Express | 1つ前のコミットを checkout して `dcp build` |
| `update_log` の行 | ⚠️ 残しておいてよい |

⚠️ ⚠️ **フロントだけ戻しても画面は動く**（⚠️ `no` が増えているだけのため）。

---

## ⚠️ この版で入っていないもの

| 何 | なぜ |
|---|---|
| ⚠️ 他の画面の営業課の直書き | ⚠️ **今回の指示は競合サマリーのみ**。⚠️ 他にも直書きが残っている可能性がある |
| ⚠️ `order_flag` による絞り込み | ⚠️ 指示どおり `division = '注文事業'` のみ（⚠️ **現データでは結果が同じ**） |
| ⚠️ `consulting` 権限の伏字 | ⚠️ 次の版 |
