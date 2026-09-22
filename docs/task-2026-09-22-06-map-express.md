# 地図のステータス絞り込みを外し、Express化する（v2.2.143）

⚠️ 指示（`ReadMeClaude.md`）:

> - C:\Users\shinji-kawano\react\dashboard\frontend\src\mapディレクトリ改修
>     * targetStatusは不要->選択タグも不要
>     * Express化

⚠️ 実際のパスは `frontend/src/components/map/`。対象は ⚠️ **`MapOrder` / `MapKaeru` / `MapResale` の3ファイル**。

---

## ⚠️ 着手して分かったこと

⚠️⚠️ **3ファイルとも `axios` で本番URLを直に叩いていた。**

```ts
const headers = { Authorization: "4081Kokubu", "Content-Type": "application/json" };
const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: "map", category }, { headers });
```

⚠️ ⚠️ **`apiClient` を通していないため、ローカルで開発していても本番DBを見ていた。**
⚠️ ⚠️ **`Token` も付いていない**（`apiClient` の interceptor が付けている）。

⚠️ Express化と同時に直した。

---

## ⚠️ 触ったファイル

| ディレクトリ | ファイル | 種別 |
|---|---|---|
| `backend-express/src/features/map/` | ⚠️ **`queries.ts`** | ⚠️ **新規** |
| 同上 | ⚠️ **`index.ts`** | ⚠️ **新規** |
| `backend-express/src/gateway/` | `registry.ts` | ⚠️ `map` を order / spec / used で登録 |
| `backend/src/core/` | `express_proxy.php` | ⚠️ 転送リストに3件追加 |
| `frontend/src/components/map/` | ⚠️ **`MapOrder.tsx`** | ⚠️ targetStatus 削除・`apiClient` 化 |
| 同上 | ⚠️ **`MapKaeru.tsx`** | ⚠️ 同上 |
| 同上 | ⚠️ **`MapResale.tsx`** | ⚠️ 同上 |

⚠️⚠️ **① の `map.php` / `mapAction/` は残してある。** ⚠️ **参照のみなのでフォールバックしてよい。**
⚠️ ⚠️ **PHP の中身は1文字も変えていない。**

---

## 1. 追加した新規ファイル（全文）

### ⚠️ 1-1. `backend-express/src/features/map/queries.ts`

```ts
/**
 * 地図（map/MapOrder.tsx / MapKaeru.tsx / MapResale.tsx）の SQL。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元: backend/src/handlers/map.php
 *            backend/src/handlers/mapAction/map_{order,spec,used}.php
 *
 * ⚠️⚠️ **列と別名は移植元のままにしてある。**
 *   ⚠️ 画面は `item.lat_lng` や `item.current_contract_type` のように
 *     ⚠️ **別名をそのまま使っている**ので、1つでも変えると地図からピンが消える。
 *
 * ⚠️⚠️ **事業ごとに使うテーブルが違う。**
 *     order → master_data        / medium_list（⚠️ `response_medium = 0` で絞る）
 *     spec  → master_data_kaeru  / medium_kaeru
 *     used  → master_data_resale / medium_resale
 *
 * ⚠️ ⚠️ **`used` は店舗と営業課を返さない。** ⚠️ 移植元がそうなっており、
 *   ⚠️ **MapResale.tsx も使っていない**（ブランド・店舗の絞り込みが無い）。
 * ─────────────────────────────────────────────
 */

export type MapCategory = 'order' | 'spec' | 'used';
```

⚠️ 顧客一覧の `WHERE` について（⚠️ **そのまま写した理由**）:

```ts
/**
 * ⚠️⚠️ **`WHERE` は移植元のまま写している。**
 *   ⚠️ ⚠️ **`or` でつないでいるため、実質的に絞り込めていない**
 *     （`lat_lng <> ''` と `lat_lng <> '取得不可'` のどちらかが真になる）。
 *   ⚠️ ⚠️ **直さないこと。** ⚠️ 画面側が
 *     `response.data.customer.filter(item => item.lat_lng)` で
 *     ⚠️ **改めて絞っている**ので、ここを直すと ① と ② で件数が変わる。
 *   ⚠️ 直すなら ① の PHP と画面を含めて同時に行うこと。
 */
```

⚠️ 販促媒体・店舗・営業課:

```ts
const MEDIUM_SQL: Record<MapCategory, string> = {
  order: `SELECT medium, list_medium FROM medium_list WHERE response_medium = 0`,
  spec: `SELECT * FROM medium_kaeru`,
  used: `SELECT * FROM medium_resale`,
};

export const MAP_DIVISION: Record<MapCategory, string | null> = {
  order: '注文事業',
  spec: '建売分譲事業',
  used: null,
};

const SHOP_SQL = `SELECT shop, section, division FROM shop_list WHERE division = ?`;
const SECTION_SQL = `SELECT name FROM section_list WHERE division = ?`;

export const mapSql = (category: MapCategory) => ({
  customer: CUSTOMER_SQL[category],
  medium: MEDIUM_SQL[category],
  shop: SHOP_SQL,
  section: SECTION_SQL,
  division: MAP_DIVISION[category],
});
```

### ⚠️ 1-2. `backend-express/src/features/map/index.ts`

```ts
export const runMap = async (category: MapCategory): Promise<MapResult> => {
  const sql = mapSql(category);

  // ⚠️ 互いに独立しているので並列で投げる
  const [customer, medium] = await Promise.all([
    query<DynamicRow>(sql.customer),
    query<DynamicRow>(sql.medium),
  ]);

  // ⚠️ 中古リノベは店舗・営業課の絞り込みが無い（移植元と同じ）
  if (sql.division === null) {
    return { httpStatus: 200, body: { customer, medium } };
  }

  const [shop, section] = await Promise.all([
    query<DynamicRow>(sql.shop, [sql.division]),
    query<DynamicRow>(sql.section, [sql.division]),
  ]);

  // ⚠️ キーの順序も ① の PHP と揃えてある
  return {
    httpStatus: 200,
    body: { shop, section, customer, medium },
  };
};
```

---

## 2. 登録（`registry.ts`）

```ts
const mapCategories: MapCategory[] = ['order', 'spec', 'used'];

for (const category of mapCategories) {
  register({
    request: 'map',
    category,
    summary: `地図の初期データ（${category}）`,
    phpSource: `backend/src/handlers/mapAction/map_${category}.php`,
    auth: 'staff',
    handler: async (ctx) => {
      const result = await runMap(category);
      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
      return result.body;
    },
  });
}
```

## 3. 転送リスト（`express_proxy.php`）

```php
        // -----------------------------------------------------------------
        // 2026-09-22 移植。地図
        // （map/MapOrder.tsx / MapKaeru.tsx / MapResale.tsx）。
        //
        // ⚠️ 参照のみ。① に map.php が実在するのでフォールバックしてよい。
        //
        // ⚠️⚠️ **3事業とも ② に登録済み**（order / spec / used）。
        //   ⚠️ それでも category まで書いておく。
        //   ⚠️ ⚠️ **将来 ① の map.php に category を足したときに、
        //     ② へ送られて「ループ検知」になるのを防ぐため。**
        // -----------------------------------------------------------------
        'map::order',
        'map::spec',
        'map::used',
```

⚠️ ⚠️ **`expressProxyExclusive()` には入れない**（⚠️ **① に PHP が実在するため**）。

---

## 4. 画面（3ファイル共通の差分）

```diff
-import axios from "axios";
+import apiClient from "../../utils/apiClient";

-    const [targetStatus, setTargetStatus] = useState<string>("");

-                const headers = { Authorization: "4081Kokubu", "Content-Type": "application/json" };
-                const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: "map", category }, { headers });
+                /**
+                 * ⚠️⚠️ **2026-09-22 に `axios` の直叩きをやめた。**
+                 *   ⚠️ 以前は本番URL（khg-marketing.info）を直に書いていたため、
+                 *     ⚠️ ⚠️ **ローカルで開発していても本番DBを見ていた。**
+                 *   ⚠️ `apiClient` は接続先を環境変数から決め、Token も自動で付ける。
+                 */
+                const response = await apiClient.post("", { request: "map", category });

-                (!targetStatus || item.status === targetStatus) &&

-        targetMedium, targetBrand, targetStatus, targetShop,
+        targetMedium, targetBrand, targetShop,

-                            <Col xs={12} sm={6} md={2}>
-                                <Form.Select size="sm" value={targetStatus} onChange={(e) => setTargetStatus(e.target.value)} style={{ fontSize: '12px' }}>
-                                    <option value="">ステータスを選択</option>
-                                    ...
-                                </Form.Select>
-                            </Col>
```

⚠️ ⚠️ **`<Col>` ごと消している。** ⚠️ **`<Form.Select>` だけ消すと空の枠が残る。**

⚠️ 消した選択肢（事業ごとに中身が違った）

| 画面 | 選択肢 |
|---|---|
| MapOrder / MapResale | 見込み / 契約済み / 会社管理 / 失注 |
| ⚠️ MapKaeru | 見込み / 追客中 / 接触（通話・返信）/ 来店あり / 申込み済み / 事前取得（現金確認含む）/ 契約済み / アポイント確定 |

⚠️ ⚠️ **`item.status` 自体は残している**（⚠️ 一覧表やピンの色で使っている）。

---

## 確認（2026-09-22・ローカル）

| 確認 | 結果 |
|---|---|
| `npx tsc --noEmit`（backend-express） | ⚠️ **エラー0件** |
| `php -l express_proxy.php` | ⚠️ **エラー0件** |
| `npm run build`（frontend） | ⚠️ **成功**（⚠️ **今回の変更による新しい警告は無し**） |
| ⚠️ **`map::order` / `map::spec` / `map::used`** | ⚠️ **すべて 401**（＝ ⚠️ **② に登録できている**） |

⚠️⚠️ **未登録なら `X-Forwarded-By` 付きで 502（ループ検知）になる。**
⚠️ ⚠️ **401 は「登録されていて認証で弾かれた」という意味であり、これが正しい。**

⚠️ SQL は実データで全て通ることを確認した。

| クエリ | 件数 |
|---|---|
| 注文/顧客 | 24,515 |
| 建売/顧客 | 8,384 |
| 中古/顧客 | 2,414 |
| 注文/媒体 | 44 |
| 建売/媒体 | 17 |
| 中古/媒体 | 17 |
| 注文/店舗 | 49 |
| 建売/店舗 | 12 |
| 注文/営業課 | 7 |
| 建売/営業課 | 2 |

---

## ⚠️ ブラウザでの確認（未実施）

- [ ] 地図（注文 / 建売 / 中古）が ⚠️ **今までどおり開く**
- [ ] ⚠️⚠️ **「ステータスを選択」が消えている**（3事業とも）
- [ ] ⚠️ 残りの絞り込み（販促媒体・ブランド・店舗・年収・契約種別）が効く
- [ ] ⚠️ ピンの数・クラスタ・エリア別の一覧が ⚠️ **移植前と同じ**
- [ ] ⚠️ 中古で ⚠️ **ブランド・店舗の枠が無いまま**（元からそう）
- [ ] ⚠️⚠️ **② を止めると ① にフォールバックして開ける**（参照のみのため）

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **顧客一覧の `WHERE` が実質的に効いていない**（`or` でつながっている）。⚠️ 画面側で絞っているので害は無いが、⚠️ **転送量は無駄になっている**（注文24,515件） |
| 2 | ⚠️⚠️ **他にも10ファイルが本番URLを直叩きしている**（実測。`BudgetAccounting` / `BudgetKaeru` / `Calendar` / `CallStatusList` など）。⚠️ **ローカルで開発しても本番DBを見る**ので、順次 `apiClient` へ寄せたい |
| 3 | ⚠️ `medium_kaeru` / `medium_resale` は `SELECT *`。⚠️ **列が増えるとそのまま転送量が増える** |
