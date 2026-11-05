# デプロイ手順 v2.2.250　不動産企画係：連動トリガー仕様書の ② のうち媒介物件

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 新しい表 `realty_properties`（媒介物件）と、`brokerage_listings.propertyId` の列 | ① DB `2026-11-05_realty_properties_1_schema.sql` |
| 2 | 媒介紐付で、媒介物件を探す・作る・紐づける（同じトランザクション） | ② VPS（backend-express） |
| 3 | 今ある台帳（有効なもの）から媒介物件を作って紐づける。その台帳の売り反響にも | ① DB `2026-11-05_realty_properties_2_migrate.sql` |
| 4 | 媒介紐付の画面の物件の項目、登録後の知らせ、台帳の一覧の「同じ物件の台帳」、版の番号 | ① フロント |
| 5 | 更新履歴・業務ガイド「反響から商談案件へのつながり（不動産企画係）」（上書き） | ① DB `2026-11-05_update_log_2.2.250.sql` |

- ⚠️ **① の PHP は、この版では変わりません**（新しい request はありません）。
- ⚠️ **順番を守ってください**。表と列が無いうちに ② を上げると、媒介紐付の「登録」が失敗します（何も保存されずに戻ります）。
- ⚠️ v2.2.249 までのマージが先です。

## 順序
```
0. GitHub で v2.2.250 を production へマージ（PR）
1. ① SQL：2026-11-05_realty_properties_1_schema.sql（表と列）     ← 何回流しても同じ
2. ② VPS（backend-express）を更新して再起動
3. ① SQL：2026-11-05_realty_properties_2_migrate.sql（今ある台帳） ← 何回流しても同じ
4. ① フロント（v2.2.250 のブランチでビルドしたもの）
5. ① SQL：2026-11-05_update_log_2.2.250.sql（更新履歴・業務ガイド） ← ⚠️ 1回だけ
```

### 手順1　【① SQL】表と列
phpMyAdmin で `2026-11-05_realty_properties_1_schema.sql` を流します。
- 最後の2つの確認（`SHOW CREATE TABLE realty_properties` と `SHOW COLUMNS … propertyId`）の結果が返ればよいです。
- エラーになったら、そこで止めて知らせてください（② を上げないでください）。

### 手順2　【② VPS】backend-express を更新
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```
確認：
```bash
dcp logs express-api | grep "planner:ledger_link" | tail -1
```
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"planner","roll":"ledger_link"}'
```
- 1つ目は、先頭の時刻が今 `up -d` した時刻（UTC）ならよいです（`--tail` は付けない）。
- 2つ目は `認証が必要です。`（401）ならよいです。

### 手順3　【① SQL】今ある台帳から媒介物件を作る
phpMyAdmin で `2026-11-05_realty_properties_2_migrate.sql` を流します。最後に4つの確認が出ます。
- 「物件の数」は、有効な台帳の数と同じか、少し少ない数です。同じ住所の台帳は1つにまとまります。ローカル（本番の写し）では、台帳196件から194件になりました。
- 「物件につながった台帳」は、「有効な台帳」と同じ数です。
- 「物件につながった売り反響」は、売り反響から作った台帳の数です（ローカルでは32件）。
- 最後の表には、同じ物件に台帳が2件以上ある物件が出ます。ローカルでは2件で、住所が同じものでした。
- ⚠️ 番地の無い住所（「鹿児島市」だけなど）の台帳は、ほかとまとめず、その台帳だけの物件になります。

### 手順4　【① フロント】いつもの手順
⚠️ v2.2.250 のブランチで `npm run build` をし直してから上げてください。

### 手順5　【① SQL】
phpMyAdmin で `2026-11-05_update_log_2.2.250.sql` を **1回だけ**流します。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```
一番上が 2.2.250 で、1行だけならよいです。

## 終わったら（動作確認）
1. 「売り反響」の「🔗 媒介紐付」を開くと、下に「媒介物件」の欄（地番・建物名・部屋番号・面積・築年・間取り）がある。**キャンセルで閉じる**
2. 「媒介獲得台帳」で、同じ住所の台帳がある物件に「同じ物件の台帳 2件」と出る
3. 版の表示が ver2.2.250

⚠️ 本番で試すときは、実際の売り反響で「登録」を押さないでください。

## 注意
- 種別がマンションの媒介紐付では、建物名が必須になりました。
- 住所の書き方の揺れは、空白・全角半角・「丁目・番地・番・号」と「-」の違い・県名の有無（鹿児島・宮崎・熊本）だけをそろえます。それ以外の違い（漢数字の番地、「の」書き、建物名の表記違い）は、別の物件になります。

## 切り戻し
- ① フロントを v2.2.249 に戻す（物件の欄と「同じ物件の台帳」が消えます）
- ② を v2.2.249 に戻す（媒介紐付で物件を作らなくなります）
- 表 `realty_properties` と列 `propertyId` は、残しておいて問題ありません（前の版は使わないだけです）
