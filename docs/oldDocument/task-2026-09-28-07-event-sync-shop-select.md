# 2026-09-28 (7) イベント同期で担当店舗を選べるようにする（v2.2.151）

## 依頼（`ReadMeClaude.md`）

- ⚠️ **新たに v2.2.151 にて作業開始**（⚠️ **ローカルDBの `update_log` に1行追加するのを忘れないように**）
- ⚠️ `frontend/src/components/header/EventList.tsx` の改修
  - ⚠️ `syncStart` を発火する前に、⚠️ **`event_db` の `shop` が偽の場合は「担当店舗」を選べるようにする**
  - ⚠️ **`report_flag = 1` の `shop_list` より、以前実装したソート関数で sort したうえで**選択できるようにする
  - ⚠️ **すでに `shop` がある場合も `select` のデフォルト値として設定する**

---

## ⚠️ 着手前に気づいたこと

### ⚠️⚠️ 1. PG HOUSE の3コミットが production に入っていなかった

⚠️ `v2.2.150` はマージ済み（PR #77）だったが、⚠️⚠️ **その後に積んだ PG HOUSE 取り込みの3件は未マージ**だった。

```
31c813df take PG HOUSE catalogue requests in as inquiries
b536b4c2 do the PG HOUSE mail mapping in the dashboard, not a separate service
99d5a3a8 collapse the two mails a single PG HOUSE lead sends
```

⚠️ `production` から `v2.2.151` を切ると ⚠️ **この3件が消える**ため、⚠️ **cherry-pick で載せ直した。**
⚠️ ⚠️ **v2.2.151 のPRを出せば、PG HOUSE のぶんも一緒にマージされる。**

### ⚠️⚠️ 2. `list` は ② へ転送される

⚠️ `express_proxy.php` の許可リストに ⚠️ **`'list'`（request 名だけ）**がある。
⚠️ ⚠️ **`list:event:load` は ② の `backend-express/src/features/list/event.ts` が応答する。**
⚠️ ⚠️ **①だけ直すと、②が応答したときに店舗が出ない。** ⚠️ **両方直した。**

### ⚠️ 3. 「以前実装したソート関数」は `sortShops`

⚠️ `components/header/useAmbassadorMaster.ts` にある。⚠️ `EventBudget.tsx` が既に同じ組み合わせで使っている。

| 関数 | 役割 |
|---|---|
| `filterReportShops` | ⚠️ **`report_flag = 1`**（⚠️ 管理用の擬似店舗を外す） |
| `sortShops` | ⚠️ **事業区分 → ブランド → id** |

### ⚠️⚠️ 4. 実データの半分以上が店舗未設定だった

```
event_db: 全 203 件 / shop が空 114 件
```

⚠️ ⚠️ **今回の改修が無いと、この114件は同期できない。**

---

## 追加したファイル

### `backend/scripts/sql/2026-09-28_update_log_2.2.151.sql`（新規）

```sql
INSERT INTO update_log (version, date, note) VALUES
('2.2.151', '2026-09-28', 'イベント予約を顧客へ同期するとき、担当店舗が空でも選べるようにした。PG HOUSE九州の資料請求メールを反響として取り込むようにした。');
```

⚠️ ⚠️ **ローカルDBに実行済み**（`no = 244`）。

---

## 修正したファイル

### 1. `frontend/src/utils/version.ts`

```ts
export const newVersion = '2.2.151';
```

### 2. `backend/src/handlers/listAction/list_event.php`

```php
    // 店舗。
    //
    // ⚠️⚠️ **担当店舗を選び直すために返す**（2026-09-28 追加）。
    //   ⚠️ event_db.shop が空の予約があり、⚠️ **そのままでは同期できなかった。**
    //
    // ⚠️ 絞り込み（report_flag = 1）と並び替えは**フロントがやる**
    //   （⚠️ `filterReportShops` / `sortShops`。⚠️ **規則を2箇所に置かない**）。
    // ⚠️ ⚠️ **`id` と `division` を必ず含めること。** `sortShops` が見ている。
    $sql_shop = "SELECT id, brand, shop, section, area, division, report_flag FROM shop_list";
    $stmt_shop = $pdo->prepare($sql_shop);
    $stmt_shop->execute();
    $response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);

    // ⚠️⚠️ **キーの顔ぶれは ② の backend-express/src/features/list/event.ts と揃えること。**
    //   ⚠️ `list` は ② へ転送される。⚠️ **片方だけ足すと、②が応答したときに店舗が出ない。**
    $result = [
        "summary" => $response_summary,
        "staff" => $response_staff,
        "shop" => $response_shop
    ];
```

### 3. `backend-express/src/features/list/event.ts`

```ts
  const [summary, staff, shop] = await Promise.all([
    query<DynamicRow>('SELECT * FROM event_db'),
    query<DynamicRow>('SELECT * FROM staff_list'),
    /**
     * ⚠️⚠️ **担当店舗を選び直すために返す**（2026-09-28 追加）。
     *   ⚠️ event_db.shop が空の予約があり、⚠️ **そのままでは同期できなかった。**
     *
     * ⚠️ 絞り込み（report_flag = 1）と並び替えは**フロントがやる**
     *   （⚠️ `filterReportShops` / `sortShops`。⚠️ **規則を2箇所に置かない**）。
     * ⚠️ ⚠️ **`id` と `division` を必ず含めること。** `sortShops` が見ている。
     */
    query<DynamicRow>('SELECT id, brand, shop, section, area, division, report_flag FROM shop_list'),
  ]);

  // ⚠️ キー名は PHP と同じ。フロントは response.data.summary / .staff / .shop で読む
  //   ⚠️⚠️ **① の list_event.php と揃えること。** 片方だけ足すと、
  //     ⚠️ **どちらが応答したかで店舗が出たり出なかったりする。**
  return { httpStatus: 200, body: { summary, staff, shop } };
```

### 4. `frontend/src/components/header/EventList.tsx`

**(a) import**

```tsx
import { filterReportShops, sortShops, MasterShop } from './useAmbassadorMaster';
```

**(b) 状態**

```tsx
    /**
     * ⚠️⚠️ **同期先の担当店舗**（2026-09-28 追加）。
     *   ⚠️ `event_db.shop` が空の予約があり、⚠️ **そのままでは同期できなかった。**
     *   ⚠️ ⚠️ **入っている場合もここに入れて、選び直せるようにする**（指示）。
     */
    const [syncShop, setSyncShop] = useState('');
    const [shopList, setShopList] = useState<MasterShop[]>([]);
```

**(c) 取得**

```tsx
            setStaffArray(responseStaff);
            // ⚠️ 並び替えは下の shopOptions で行う。ここでは受け取るだけ
            setShopList(response.data.shop ?? []);
```

**(d) 選択肢（⚠️ 新規）**

```tsx
    /**
     * 担当店舗の選択肢。
     *
     * ⚠️⚠️ **既存の `filterReportShops` / `sortShops` をそのまま使う**
     *   （`components/header/useAmbassadorMaster.ts`）。
     *   ⚠️ 絞り込み: `report_flag = 1`（⚠️ **管理用の擬似店舗を外す**）
     *   ⚠️ 並び替え: 事業区分 → ブランド → id
     *   ⚠️ ⚠️ **規則を写さないこと。** 片方だけ直すと画面ごとに順が変わる。
     *
     * ⚠️ 事業区分では絞っていない（指示）。⚠️ イベントには複数ブランドの来場者が混ざる。
     */
    const shopOptions = useMemo(() => {
        const sorted = sortShops(filterReportShops(shopList));
        const seen = new Set<string>();
        const names: string[] = [];
        sorted.forEach(s => {
            const name = (s.shop ?? '').trim();
            if (name === '' || seen.has(name)) return;
            seen.add(name);
            names.push(name);
        });
        return names;
    }, [shopList]);
```

**(e) スタッフの候補（⚠️ **参照先を変えた**）**

```tsx
    /**
     * 選んだ店舗に紐づくスタッフ ＋ 「〇〇店 管理」。
     *
     * ⚠️⚠️ **`syncTarget.shop` ではなく `syncShop` を見る**（2026-09-28 に変更）。
     *   ⚠️ 店舗を選び直したとき、⚠️ **担当者の候補も入れ替わらないと辻褄が合わない。**
     */
    const staffOptions = useMemo(() => {
        if (syncShop === '') return [];
        return [...staffArray.filter(s => s.shop === syncShop).map(s => s.name), `${syncShop} 管理`];
    }, [staffArray, syncShop]);

    const handleSync = (item: CustomerData) => {
        setSyncTarget(item);
        setTargetStaff('');
        // ⚠️ 既に入っていればそれを既定にする（指示）。⚠️ 空なら選んでもらう
        setSyncShop((item.shop ?? '').trim());
        setSyncShow(true);
    };
```

**(f) `syncStart`**

```tsx
    const syncStart = async () => {
        /**
         * ⚠️⚠️ **店舗が空のまま同期させない**（2026-09-28 追加）。
         *   ⚠️ 空で入れると ⚠️ **担当者の画面に出てこない顧客**ができる。
         */
        if (!syncTarget || syncShop === '') {
            alert('担当店舗を選択してください');
            return;
        }
        if (targetStaff === '') {
            alert('スタッフを選択してください');
            return;
        }

        const postData: Record<string, string> = {
            ...createSyncPayload(syncTarget),
            in_charge_user: targetStaff,
            // ⚠️⚠️ **選び直した店舗を使う。** ⚠️ `syncTarget.shop` は空のことがある
            in_charge_store: syncShop,
```

**(g) モーダル**

```tsx
                    <div className="mb-2" style={{ fontSize: '11px', color: '#8898aa' }}>
                        {syncTarget ? `${syncTarget.name} 様` : ''}
                    </div>

                    {/*
                      ⚠️⚠️ **担当店舗（2026-09-28 追加）。**
                        ⚠️ `event_db.shop` が空の予約があり、⚠️ **同期できなかった。**
                        ⚠️ ⚠️ **入っている場合も選び直せる**（指示）。
                        ⚠️ 店舗を変えたら**担当者は選び直してもらう**（候補が入れ替わるため）。
                    */}
                    <select className='mb-2'
                        style={{ ...compactInputStyle, height: '28px', fontSize: '12px' }}
                        value={syncShop}
                        onChange={(e) => { setSyncShop(e.target.value); setTargetStaff(''); }}>
                        <option value="">担当店舗を選択</option>
                        {shopOptions.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
```

⚠️ 見出しの `${syncTarget.shop} / ${syncTarget.name} 様` から ⚠️ **店舗を外した**
（⚠️ **すぐ下の select に出るため。空のときに「 / 山田 様」と出るのも避ける**）。

⚠️ 同期成功後に `setSyncShop('')` も加えてある。

---

## 確認したこと（ローカル）

| | |
|---|---|
| `npx tsc --noEmit`（②） | ⚠️ **エラーなし** |
| ⚠️ 型チェック（①・⚠️ include を直した使い捨て設定） | ⚠️ **エラーなし** |
| `react-scripts build` | ⚠️ **成功** → ⚠️ **`main.c882a9fe.js`** |
| ⚠️ ブラウザでの表示 | ⚠️⚠️ **未確認**（ヘッドレスブラウザが無い） |

### ⚠️ ① と ② の突き合わせ（⚠️ **完全一致**）

```
HTTP 200 / keys: summary,staff,shop
summary=203 staff=756 shop=68
shop の列: id,brand,shop,section,area,division,report_flag
report_flag=1 の店舗: 44 件
event_db: 全 203 件 / shop が空 114 件
```

⚠️ ⚠️ **選択肢に出るのは 44 店舗**（⚠️ 68件のうち擬似店舗24件が外れる）。

---

## 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **`list` は ② へ転送される。** ⚠️ 応答の形を変えるときは **①② 両方**を直すこと |
| 2 | ⚠️⚠️ **`id` と `division` を SELECT から外さないこと。** ⚠️ `sortShops` がこの2つを見ている |
| 3 | ⚠️ 絞り込みと並び替えは ⚠️ **`filterReportShops` / `sortShops` を使う**。⚠️ **規則を写さない** |
| 4 | ⚠️ 事業区分では絞っていない（指示）。⚠️ 絞るなら `shopOptionsForDivision` の考え方に合わせること |
| 5 | ⚠️⚠️ **店舗が空のままでは同期できない**ようにした。⚠️ 空で入れると **担当者の画面に出ない顧客**ができる |
| 6 | ⚠️ 店舗を変えると ⚠️ **担当者の選択は空に戻る**（⚠️ 候補が入れ替わるため） |
| 7 | ⚠️⚠️ **PG HOUSE の3コミットをこの版に載せてある**（⚠️ production に未マージだったため） |
