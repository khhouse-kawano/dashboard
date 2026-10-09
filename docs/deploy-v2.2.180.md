# デプロイ手順 v2.2.180

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | HOTLEAD の紐付けで ⚠️ **送り元のブランド（hotlead_brand）を店舗名の頭に使う**（無ければ従来どおり KH） | ⚠️ **① PHP**（`handlers/hotlead.php`） |
| 2 | hotlead_2 の送信に `hotlead_brand: 'DJH'`、hotlead に `'KH'` を付ける | ⚠️ **sync**（`portalService.ts`・`runHotlead.ts`） |
| 3 | 更新履歴に1行増える | ① DB |

⚠️ **② VPS・フロントの画面・DB の列は変更なし。**（⚠️ ② に hotlead のハンドラは無い）
⚠️ フロントは version.ts だけ変わる（⚠️ 版表示のため build してアップロード）。

## 順序
```
0. GitHub で v2.2.180 を main → production へマージ
1. ① PHP（hotlead.php）
2. sync（トランスパイルして再起動）
3. ① フロント（build）
4. ① SQL（update_log）
```
- ⚠️ 1 と 2 はどちらが先でも壊れない（⚠️ 古い sync → hotlead_brand 無し → KH 扱い ／ 古い PHP → hotlead_brand を無視）。
  ⚠️ ただし両方そろうまで DJH は紐付かない。

## 手順1　【① レンタルサーバー】PHP
| ファイル | |
|---|---|
| `backend/src/handlers/hotlead.php` | ⚠️ `hotlead_brand` を受ける |

## 手順2　【sync を動かしている PC】
- `src/services/portalService.ts` / `src/services/runHotlead.ts` を反映
- ⚠️ いつもどおり `dist/` へトランスパイルしてから実行・再起動
- ⚠️ sync リポジトリへのコミットは利用者側（他の未コミット変更があるため）

## 手順3　【WSL】フロントを ① へアップロード
```bash
deploy-dashboard
```

## 手順4　【① phpMyAdmin】更新履歴
⚠️ ファイル: `backend/scripts/sql/2026-10-09_update_log_2.2.180.sql`
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

## 出したあとの確認
| # | 見ること | 期待 |
|---|---|---|
| 1 | sync で hotlead_2 を実行したログ | 「PHP APIへデータのPOST送信を開始します...（ブランド: DJH）」 |
| 2 | 同じログの各行 | DJH の店舗の顧客で「🔗 master_data紐付け: 1件」が出る（⚠️ 名前・電話・メールが一致する顧客がいる場合） |
| 3 | hotlead（1つ目）のログ | 「（ブランド: KH）」で従来どおり |

## 切り戻し
| 対象 | 方法 |
|---|---|
| ① PHP | v2.2.179 の hotlead.php に戻す |
| sync | portalService.ts / runHotlead.ts を戻す（⚠️ PHP だけ戻しても KH 扱いになるだけで壊れない） |
