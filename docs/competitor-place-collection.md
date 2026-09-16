# 競合他社 Place ID 収集 — 要件定義

作成: 2026-09-15
対象: Places API (New) を用いた競合他社マスタの初期構築

---

## 1. 目的

自社31店舗の Google クチコミ定点観測（`projects/sync/src/services/runGoogleReview.ts`）と
同じ仕組みを他社にも広げるため、**商圏内の競合他社の Place ID を網羅的に収集する。**

このドキュメントのスコープは **Place ID の収集まで**。
評価・クチコミの取得は後段の別工程（→ 6章）。

### 既存手段が不足している理由

`customer` テーブルの `competitor_name`（失注時の競合先）は既に存在するが、
**「当たって、かつ負けた相手」しか入らない**ため母集団として偏っている。
未接触・新規参入の事業者が構造的に漏れるため、これ単独では網羅リストにならない。

---

## 2. 未確定事項（着手前に確認すること）

| # | 項目 | 備考 |
|---|---|---|
| 1 | APIキー | `projects/sync` の `API_KEY` と同一想定。Places API (New) が有効化済みであること |
| 2 | 商圏の範囲 | 鹿児島・宮崎・大分の3県を想定。福岡・熊本を含めるかは未定 |
| 3 | 出力先 | 第一段階は CSV。DB（新規テーブル）への投入は別途 |

---

## 3. 課金制約（最重要）

### 無料枠

| SKU | 無料枠/月 | 超過単価 |
|---|---|---|
| Nearby Search **Pro** | 5,000回 | $32 / 1,000 |
| Text Search **Pro** | 5,000回 | $32 / 1,000 |
| Nearby / Text Search **Enterprise** | 1,000回 | $35 / 1,000 |

Nearby Search と Text Search は**別プール**。さらに Place Details とも別勘定。

### ⚠️ fieldMask を Pro 以下に固定すること

**`places.rating` / `places.userRatingCount` を走査の fieldMask に入れてはいけない。**

これらは Enterprise SKU のフィールドであり、1つでも含めると
リクエスト全体が Enterprise 扱いになり **無料枠が 5,000 → 1,000 に激減する。**
2,000回走査した場合、超過1,000回 × $35 = 約 $35 の課金が発生する。

走査で取得してよいフィールドは以下のみ:

```
places.id
places.displayName
places.formattedAddress
places.primaryType
places.types
places.businessStatus
places.googleMapsUri
places.websiteUri
```

（`nextPageToken` は Text Search のページング用に別途受け取る）

### 想定リクエスト数

| 系統 | 概算 | 無料枠 |
|---|---|---|
| A: Nearby Search グリッド走査 | 約1,000回 | 5,000 に収まる |
| B: Text Search キーワード走査 | 約1,300回 | 5,000 に収まる |

**初回走査のコストは $0 の見込み。**

---

## 4. 処理フロー

### 系統A: Nearby Search によるグリッド走査

タイプで機械的に拾う。網羅性を担保する主系統。

```http
POST https://places.googleapis.com/v1/places:searchNearby
X-Goog-Api-Key: {API_KEY}
X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.primaryType,places.types,places.businessStatus,places.googleMapsUri,places.websiteUri
Content-Type: application/json

{
  "includedPrimaryTypes": ["general_contractor", "real_estate_agency"],
  "locationRestriction": {
    "circle": { "center": { "latitude": 31.5966, "longitude": 130.5571 }, "radius": 3000.0 }
  },
  "maxResultCount": 20,
  "languageCode": "ja",
  "regionCode": "JP"
}
```

手順:

1. 対象県の**可住地**に半径3kmの円をグリッド配置する
   - 海上・山林に円を置いても0件が返るだけでリクエストの無駄になる
   - 市区町村役場の座標を起点に広げる等、人が住むエリアに寄せること
2. 各円に対して1リクエスト
3. **20件返ってきた円は取りこぼしている**（Nearby Search はページング不可で最大20件）
   → 半径1.5kmに分割して再走査する（**適応分割**）。分割後も20件なら更に分割
4. 結果を `places.id` で重複排除しながら蓄積

制約:

- `maxResultCount` の上限は 20、**`pageToken` は存在しない**
- `locationRestriction.circle.radius` の上限は 50,000m
- 連続実行はレート制限に当たるため、既存実装に倣い **300ms のスリープ**を挟む

### 系統B: Text Search によるキーワード走査

Google のタイプ体系は日本の「工務店」を表現できないため、
系統Aから漏れる事業者をキーワードで拾う。

```http
POST https://places.googleapis.com/v1/places:searchText
X-Goog-FieldMask: {系統Aと同じ},nextPageToken

{
  "textQuery": "鹿児島市 工務店",
  "languageCode": "ja",
  "regionCode": "JP",
  "pageSize": 20
}
```

- キーワード: `工務店` / `注文住宅` / `ハウスメーカー` / `住宅展示場` / `建築設計事務所` / `分譲住宅`
- 対象: 3県の全市町村（87自治体）
- `nextPageToken` を使い最大60件まで取得する

### 後処理

1. `places.id` で重複排除（**系統A・B間で重複が多く出る**）
2. `businessStatus` が `CLOSED_PERMANENTLY` のものを除外
3. 一次仕分け（機械的に落とす）
   - `types` / 社名から、リフォーム専業・外構・解体・電気工事などを除外
   - 判定に使ったルールはログに残し、後から見直せるようにすること
4. CSV 出力 → **採否の最終判断は人が行う**

---

## 5. 出力仕様

CSV（UTF-8 BOM付き / Excel で開くため）。人が目視で採否判断できる形にする。

| 列 | 内容 | 出典 |
|---|---|---|
| `place_id` | Place ID | `places.id` |
| `name` | 事業者名 | `places.displayName.text` |
| `address` | 住所 | `places.formattedAddress` |
| `primary_type` | 主要タイプ | `places.primaryType` |
| `types` | 全タイプ（`;` 区切り） | `places.types` |
| `status` | 営業状態 | `places.businessStatus` |
| `website` | 公式サイト | `places.websiteUri` |
| `maps_url` | Maps ページ | `places.googleMapsUri` |
| `source` | `nearby` / `text` / `both` | 走査系統 |
| `query` | ヒットしたクエリ・座標 | デバッグ用 |
| `judgement` | 空欄（人が記入する列） | — |

---

## 6. スコープ外（後続工程）

採否確定後、競合の評価・クチコミを取得する工程は別途実装する。

- `GET /v1/places/{PLACE_ID}` に `fields=rating,userRatingCount` を指定
- **Place Details Enterprise SKU / 無料枠 月1,000回**
- 自社31店舗の既存バッチ（Enterprise + Atmosphere / 月1,000回）とは別プール

### 参考: 無料枠内で回せる社数

| 構成 | 上限 |
|---|---|
| 他社を評価・件数のみ 月1回 | 約1,000社 |
| 他社もクチコミ本文込み 月1回 | 約876社（自社31店舗×週1=124回を差し引いた残り） |

テスト実行分のバッファを見て、実運用は **800社程度**を上限の目安とする。

### 参考: クチコミ本文の制約

Places API はクチコミを**最大5件**しか返さない（パラメータでは増やせない）。
過去に遡った全件取得は不可能で、定期実行して差分を溜める方式になる。
詳細は `projects/sync/src/services/runGoogleReview.ts` の冒頭コメントを参照。

---

## 7. やってはいけないこと

- **Google Maps のスクレイピング** — 利用規約で明確に禁止されている。API 以外で取得しない
- **走査の fieldMask に `rating` / `userRatingCount` を追加すること**（→ 3章）
- **全域走査をいきなり実行すること**（→ 8章）

---

## 8. 進め方と完了条件

### 段階的に進める

1. **鹿児島市のみで試走**し、取れるデータの質を確認する
2. 一次フィルタのルールを試走結果から調整する
3. 問題なければ3県全域へ拡大する

全域走査は数千リクエスト・数十分かかるため、いきなり回さないこと。

### 完了条件

- [ ] 鹿児島市の試走結果CSVが出力され、内容を確認済み
- [ ] 重複排除が `place_id` 基準で機能している
- [ ] 適応分割が動作している（20件ヒット時に再分割されるログが確認できる）
- [ ] fieldMask に Enterprise フィールドが含まれていない
- [ ] 実行後、GCP コンソールで想定どおりの SKU・回数が計上されていること

---

## 9. 既知の限界

「全競合他社」のリストは原理的に作れない。以下は必ず漏れる。

- Google ビジネスプロフィールを登録していない事業者
- 本社が県外で、商圏内の営業所を登録していない大手
- モデルハウス単位でしか登録がなく、社名が判別できないケース

収集できるのは「**Google に登録があり、商圏内に拠点がある事業者**」である。
ただしクチコミ比較が目的である以上、Google 未登録の会社はそもそも比較対象に
なり得ないため、実用上はこの範囲で足りる。
