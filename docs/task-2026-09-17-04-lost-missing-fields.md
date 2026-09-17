# 指示（2026-09-17）　失注の「未入力箇所」を勝因・敗因の改修に合わせる

⚠️ 依頼: 「`LostStatusList.tsx` についても今回の修正に応じた改修を。⚠️ **つまり価格差などの必須項目も未入力箇所に反映させる。**
また `DatabaseOrder.tsx` の `loseLength` のカウント方法も今回の改修に対応する」

⚠️ ひとつ前の指示（[task-2026-09-17-03](task-2026-09-17-03-win-lose-reason.md)）の続きである。

---

## ⚠️ 調査で分かったこと

### ⚠️ 同じ判定が4か所に写されていた

| # | 場所 | 用途 | 指示書 |
|---|---|---|---|
| 1 | `frontend/src/components/database/DatabaseOrder.tsx` の `loseLength` | 「要回答 n件」バッジ | ⚠️ **対象** |
| 2 | `frontend/src/components/LostStatusList.tsx` | 未入力箇所の一覧（⚠️ **同じ条件が3回**） | ⚠️ **対象** |
| 3 | ⚠️ `backend-express/src/features/menu.ts` の SQL | メニューの失注バッジ | ⚠️ **指示書に無い** |
| 4 | ⚠️ `backend/src/handlers/menu.php` の SQL | 同上（① フォールバック） | ⚠️ **指示書に無い** |

⚠️⚠️ **3・4 も直さないと、メニューのバッジと失注一覧の件数が合わなくなる。**
⚠️ 利用者に確認して ⚠️ **「進めてよい」と承認を得た**うえで直した。

### ⚠️⚠️ 既存の不具合を見つけた（利用者の承認を得て修正）

⚠️ `LostStatusList.tsx` の「**失注顧客一覧**」（入力が済んだ側）の判定に、次の条件が入っていた。

```tsx
item.customized_input_01JSE7H4MQES619NBWX6PQDFRH !== 'null' || String(item.customized_input_01JSE7H4MQES619NBWX6PQDFRH).trim() === ''
```

⚠️⚠️ **`||` の向きが逆で「空なら入力済み」と読める。**
⚠️ そのため ⚠️ **敗因が空の顧客が「入力が済んだ側」に出ていた。**

---

## ⚠️ 影響（ローカルDBの実測・2026-09-17）

⚠️ `menu.ts` の SQL とまったく同じ条件（`show_dashboard = 1` ／ 失注 ／ 反響日が 2026-06-01 〜 今日）で数えた。

| | 件数 |
|---|---|
| 対象の失注 | 283件 |
| 改修前の「要回答」 | 39件 |
| ⚠️ **改修後の「要回答」** | ⚠️ **108件**（⚠️ **+69件**） |

⚠️⚠️ **増えた69件は「価格差」「今後の対策」が空の競合負け案件である。**
⚠️ **新しい列なので既存は全件が空。** ⚠️ **不具合ではない。**

⚠️ ⚠️ **計画時に「27件 → 70件」と伝えたのは誤り。**
⚠️ 私の検算が `STR_TO_DATE(..., '%Y/%m/%d')` の1形式しか見ておらず、
⚠️ 実装（2形式を `COALESCE` で拾う）より対象が少なかった。⚠️ **正しくは 39件 → 108件。**

---

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/utils/` | `informationUtils.ts` | ⚠️ **`missingLostFields()` を新設**（判定を集約） |
| `frontend/src/components/` | `LostStatusList.tsx` | ⚠️ 判定3か所を置換／⚠️ **未入力ラベルを動的表示** |
| `frontend/src/components/database/` | `DatabaseOrder.tsx` | ⚠️ `loseLength` を置換 |
| `backend-express/src/features/` | `lostList.ts` | ⚠️ 2列を SELECT に追加 |
| `backend-express/src/features/database/` | `queries.ts` | ⚠️ `order` のみ2列を追加 |
| `backend-express/src/features/` | `menu.ts` | ⚠️ SQL に条件④を追加 |
| `backend/src/handlers/` | `lostList.php` | ⚠️ ② と同じ2列 |
| `backend/src/handlers/databaseAction/` | `database_order.php` | ⚠️ ② と同じ2列 |
| `backend/src/handlers/` | `menu.php` | ⚠️ ② と同じ条件④ |

## 追加した定数・関数

| 名前 | ファイル |
|---|---|
| `LOST_DETAIL_KEY` | `informationUtils.ts` |
| `isBlank()`（⚠️ 非公開） | `informationUtils.ts` |
| ⚠️ `missingLostFields()` | `informationUtils.ts` |

---

## ⚠️ 未入力として出す項目

| ラベル | 条件 | いつから |
|---|---|---|
| 失注理由 | 失注理由が空 | 従来 |
| 失注先 | 競合負け かつ `competitor_name` が空 | 従来 |
| 他決理由 | 競合負け かつ `customized_input_01JRF9CZSW65A151WR30NA4PB3` が空 | 従来 |
| ⚠️ **敗因** | 競合負け かつ `customized_input_01JSE7H4MQES619NBWX6PQDFRH` が空 | ⚠️ **分離**（従来は「他決理由」に混ざっていた） |
| ⚠️ **価格差** | 競合負け かつ `competitor_price_gap` が空 | ⚠️ **新規** |
| ⚠️ **今後の対策** | 競合負け かつ `competitor_countermeasure` が空 | ⚠️ **新規** |

⚠️⚠️ **`statusRequiredError()`（保存時の必須）と同じ条件にしてある。**
⚠️ 食い違うと「一覧に出ないのに保存できない」「直したのに件数が減らない」が起きる。

⚠️ ⚠️ **競合負け以外は、失注理由さえ入っていれば未入力なし**（従来どおり）。

---

## `frontend/src/utils/informationUtils.ts`（追加分・全文）

```ts
/** 詳細な他決・失注理由（複数選択）の列 */
export const LOST_DETAIL_KEY = 'customized_input_01JRF9CZSW65A151WR30NA4PB3';

/**
 * 未入力とみなす値。
 *
 * ⚠️⚠️ **文字列の `'null'` も未入力である。**
 *   ⚠️ 一覧系の SQL は `COALESCE(..., '')` を通すが、
 *     ⚠️ **DB に文字列として `null` が入っている行が実在する。**
 *   ⚠️ `!value` だけでは拾えない。
 * ⚠️ 空白だけの入力も未入力として扱う（`statusRequiredError()` と同じ）。
 */
const isBlank = (value: unknown): boolean => {
    const text = String(value ?? '').trim();
    return text === '' || text === 'null';
};

/**
 * 失注の「未入力箇所」。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **失注の要回答判定は、以前この4か所に写されていた。**
 *     frontend/src/components/database/DatabaseOrder.tsx（loseLength）
 *     frontend/src/components/LostStatusList.tsx（一覧の絞り込み・表示で計3回）
 *   ⚠️ **2026-09-17 にここへ集約した。** ⚠️ 判定を足すときはここだけ直す。
 *
 * ⚠️⚠️ **`statusRequiredError()` と同じ条件にすること。**
 *   ⚠️ 食い違うと「一覧に出ないのに保存できない」「直したのに件数が減らない」
 *     という、利用者から見て**理由の分からない状態**になる。
 *
 * ⚠️⚠️ **以前は「他決理由」と「敗因」を1つの判定にまとめていた。**
 *   ⚠️ 2026-09-17 に**別の項目として分けた**（敗因が必須になったため）。
 *
 * ⚠️⚠️ **`競合負け` 以外では、失注理由さえ入っていれば未入力なし。**
 *   ⚠️ 計画中止・音信不通などで競合の情報を求めない。
 *
 * ⚠️ 返すのは**画面に出すラベルの配列**。⚠️ **空配列なら未入力なし。**
 * ─────────────────────────────────────────────
 */
export const missingLostFields = (item: Record<string, unknown>): string[] => {
    const missing: string[] = [];

    if (isBlank(item.competitor_lost_contract_reason)) missing.push('失注理由');

    if (item.competitor_lost_contract_reason !== '競合負け') return missing;

    if (isBlank(item.competitor_name)) missing.push('失注先');
    if (isBlank(item[LOST_DETAIL_KEY])) missing.push('他決理由');
    if (isBlank(item[LOSE_REASON_KEY])) missing.push('敗因');
    /**
     * ⚠️⚠️ **2026-09-17 に足した2つ。** ⚠️ 新しい列なので**既存は全件が空**である。
     *   ⚠️ ローカルの実測（対象283件）で要回答が **39件 → 108件**（+69件）になった。
     *   ⚠️ 件数が急に増えても**不具合ではない。**
     */
    if (isBlank(item[PRICE_GAP_KEY])) missing.push('価格差');
    if (isBlank(item[COUNTERMEASURE_KEY])) missing.push('今後の対策');

    return missing;
};
```

---

## `frontend/src/components/database/DatabaseOrder.tsx`

⚠️ `import { missingLostFields } from '../../utils/informationUtils';` を追加。

```tsx
                    const lTarget = new Date(dateFormate(item.register)).getTime();
                    if (lTarget < nowTime && loseBase < lTarget && item.status === '失注') {
                        /**
                         * ⚠️⚠️ **判定は informationUtils の `missingLostFields()` に集約した**
                         *   （2026-09-17）。⚠️ 以前はここに条件が写されており、
                         *   ⚠️ **LostStatusList.tsx と食い違うと件数が合わなかった。**
                         * ⚠️ **ここで条件を書き足さないこと。** 向こうだけ直すと必ずずれる。
                         */
                        if (missingLostFields(item).length > 0) lCount++;
                    }
```

---

## `backend-express/src/features/menu.ts`（追加した条件）

```sql
       OR (competitor_lost_contract_reason = '競合負け'
           AND (COALESCE(competitor_price_gap, '') IN ('', 'null')
             OR TRIM(COALESCE(competitor_price_gap, '')) = ''
             OR COALESCE(competitor_countermeasure, '') IN ('', 'null')
             OR TRIM(COALESCE(competitor_countermeasure, '')) = ''))
```

⚠️ `backend/src/handlers/menu.php` にも ⚠️ **同じ条件**を入れてある。

## 一覧の SELECT に足した2列

⚠️ `lostList.ts` ／ `lostList.php` ／ `database/queries.ts`（⚠️ **`order` のみ**）／ `database_order.php`

```sql
  COALESCE(competitor_price_gap, '') AS competitor_price_gap,
  COALESCE(competitor_countermeasure, '') AS competitor_countermeasure,
```

⚠️⚠️ **返さないと画面側で `undefined` になり、失注が全件「要回答」になる。**
⚠️ ⚠️ **建売・中古の SQL には足さないこと。** あちらのテーブルにこの列は無い。

### ⚠️⚠️ ここで一度踏んだ失敗

⚠️ SQL はテンプレートリテラル（バッククォート）の中にある。
⚠️ 私が説明コメントに `` `undefined` `` と**バッククォート付きで書いたため文字列が途中で終わり**、
⚠️ `TS1005` が8件出た。⚠️ **SQL の中にバッククォートを書かないこと**（コメントを `/* */` に変え、記号を外した）。

---

## ⚠️ `frontend/src/components/LostStatusList.tsx`（⚠️ **全文**）

| # | 変更 |
|---|---|
| 1 | ⚠️ 「失注顧客一覧」の絞り込み → `missingLostFields(item).length === 0`（⚠️ **`\|\|` の向きの不具合も解消**） |
| 2 | ⚠️ 「失注登録」の絞り込み → `missingLostFields(item).length > 0` |
| 3 | ⚠️ 未入力ラベルを ⚠️ **配列から動的に描く**（⚠️ 手書きの3種類をやめた） |
| 4 | ⚠️ 項目が6つに増えたので ⚠️ **横にも折り返す**（`flex-wrap`） |
| 5 | ⚠️ 他決理由のバッジで ⚠️ **ULID の直書きをやめ `LOST_DETAIL_KEY` を使う**。⚠️ 空文字で空バッジが出ないよう `filter(Boolean)` |

```tsx
import React, { useState, useEffect, useContext } from 'react'
import { Table, Modal, Button, Form, Badge, ButtonGroup } from "react-bootstrap";
import apiClient from '../utils/apiClient';
import InformationEdit from './information/InformationEdit';
import AuthContext from '../context/AuthContext';
import { LOST_DETAIL_KEY, missingLostFields } from '../utils/informationUtils';

type shopList = { brand: string, shop: string, section: string };
type Props = {
    loseListShow: boolean,
    setLoseListShow: React.Dispatch<React.SetStateAction<boolean>>,
    onReload: () => void,
    shopArray: shopList[]
};
type FormType = { brand: string, shop: string, age: string, mobile: string };
type Survey = { brand: string, annualIncome: string, emailAddress: string, totalBudget: string, expectedResidents: string, priorityItem: string, futurePlan: string, thingsToDo: string, housingType: string };
type MasterDataList = Record<string, string>;

const LostStatusList = ({ loseListShow, setLoseListShow, onReload, shopArray }: Props) => {
    const [total, setTotal] = useState(false);
    const [originalMasterDataList, setOriginalMasterDataList] = useState<MasterDataList[]>([]);
    const [masterDataList, setMasterDataList] = useState<MasterDataList[]>([]);

    const [editId, setEditId] = useState('');
    const { token, authority } = useContext(AuthContext);
    const [targetShop, setTargetShop] = useState('');
    const [targetReason, setTargetReason] = useState('');

    useEffect(() => {
        if (!loseListShow) return;
        const fetchData = async () => {
            try {
                /**
                 * ⚠️⚠️ **`apiClient` を使う。URL を直接書かない。**
                 *   ⚠️ 以前は本番のURLが直書きで、**Token を送っていなかった**
                 *     （`headers` は Authorization だけ）。
                 *   ⚠️ `apiClient` なら Token が自動で付き、② 側の認証が効く。
                 */
                const response = await apiClient.post('', { request: 'lostList' });
                const filteredLoseLength = response.data.customer.filter(item => {
                    const now = new Date();
                    const today = now.getTime();
                    const target = new Date(dateFormate(item.register)).getTime();
                    const start = new Date('2026-06-01');
                    const base = start.getTime();
                    return item.status === '失注' && target < today && base < target
                });
                setOriginalMasterDataList(filteredLoseLength);
            } catch (e) {
                console.error(e);
                alert('データの取得に失敗');
            }
        };

        fetchData();
    }, [loseListShow]);

    useEffect(() => {
        const filtered = originalMasterDataList.filter(o =>
            targetShop ? o.shop === targetShop : true
                && targetReason ? o.competitor_lost_contract_reason === targetReason : true
        );
        setMasterDataList(filtered);
    }, [targetShop, originalMasterDataList, targetReason]);

    const formate = (value: string) => value ? value.replace(/-/g, '/') : '';
    const dateFormate = (value: string) => value ? value.replace(/\//g, '-') : '';

    const closeInformationEdit = async () => {
        setEditId('');
        onReload();
    };

    return (
        <>
            <Modal show={loseListShow} onHide={() => setLoseListShow(false)} size='xl'>
                <Modal.Header closeButton className="bg-light py-2">
                    <Modal.Title className="fs-6 fw-bold text-secondary">
                        <i className="fa-solid fa-folder-minus me-2"></i>失注リスト
                    </Modal.Title>
                </Modal.Header>

                <Modal.Body className="p-3 bg-light" style={{ fontSize: '0.8rem' }}>

                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3 gap-3">
                        <ButtonGroup className="shadow-sm">
                            <Button
                                variant={!total ? "primary" : "white"}
                                size="sm"
                                onClick={() => setTotal(false)}
                                className={!total ? "fw-bold" : "text-secondary border"}
                                style={{ width: '140px', fontSize: '0.8rem' }}
                            >
                                <i className="fa-solid fa-pen-to-square me-1"></i>失注登録
                            </Button>
                            <Button
                                variant={total ? "primary" : "white"}
                                size="sm"
                                onClick={() => setTotal(true)}
                                className={total ? "fw-bold" : "text-secondary border"}
                                style={{ width: '140px', fontSize: '0.8rem' }}
                            >
                                <i className="fa-solid fa-list me-1"></i>失注顧客一覧
                            </Button>
                        </ButtonGroup>

                        <ButtonGroup className="shadow-sm">
                            <Form.Select
                                size="sm"
                                value={targetShop}
                                onChange={(e) => setTargetShop(e.target.value)}
                                className="shadow-sm border-0 me-2"
                                style={{ fontSize: '0.8rem' }}
                            >
                                <option value="">全店舗を表示</option>
                                {shopArray.filter(s => !s.shop.includes('全店舗')).map((shop, index) =>
                                    <option value={shop.shop} key={index}>{shop.shop}</option>
                                )}
                            </Form.Select>
                            <Form.Select
                                size="sm"
                                value={targetReason}
                                onChange={(e) => setTargetReason(e.target.value)}
                                className="shadow-sm border-0"
                                style={{ fontSize: '0.8rem' }}
                            >
                                <option value="">失注理由を選択</option>
                                {['計画中止', '競合負け', '身内の反対', '音信普通', '建築エリア外', 'その他'].map(reason =>
                                    <option value={reason} key={reason}>{reason}</option>
                                )}
                            </Form.Select>
                        </ButtonGroup>


                    </div>

                    <div className="table-responsive shadow-sm rounded bg-white">
                        {total ? (
                            <Table hover className="align-middle mb-0 text-nowrap" style={{ fontSize: '0.8rem' }}>
                                <thead className="table-light text-secondary">
                                    <tr>
                                        <th style={{ width: '5%' }} className="fw-normal py-2">No</th>
                                        <th style={{ width: '10%' }} className="fw-normal py-2">店舗</th>
                                        <th style={{ width: '15%' }} className="fw-normal py-2">顧客名</th>
                                        <th style={{ width: '10%' }} className="fw-normal py-2">反響取得日</th>
                                        <th style={{ width: '10%' }} className="fw-normal py-2">失注理由</th>
                                        <th style={{ width: '10%' }} className="fw-normal py-2">失注先</th>
                                        <th className="fw-normal py-2">他決理由</th>
                                        <th style={{ width: '5%' }} className="fw-normal py-2">詳細</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {masterDataList.filter(item => {
                                        const now = new Date();
                                        const today = now.getTime();
                                        const target = new Date(dateFormate(item.register)).getTime();
                                        const start = new Date('2026-01-01');
                                        const base = start.getTime();
                                        /**
                                         * ⚠️⚠️ **こちらは「入力が済んだ顧客」の一覧である。**
                                         *   ⚠️ 未入力が1つも無いものだけを出す。
                                         *
                                         * ⚠️⚠️ **2026-09-17 に判定を `missingLostFields()` へ集約した。**
                                         *   ⚠️ 以前はここに条件が写されており、しかも
                                         *     `… !== 'null' || String(…).trim() === ''` と
                                         *     ⚠️ **「空なら入力済み」と読める向きになっていた**（`||` の向きが逆）。
                                         *   ⚠️ そのため**敗因が空の顧客がこちらに出ていた。**
                                         */
                                        return target < today && base < target && item.status === '失注' && missingLostFields(item).length === 0 && Number(item.trash) === 1;
                                    }).sort((a, b) => new Date(dateFormate(b.register)).getTime() - new Date(dateFormate(a.register)).getTime())
                                        .map((item, index) => {
                                            return (
                                                <tr key={index}>
                                                    <td className="py-2"><span className="text-muted">{index + 1}</span></td>
                                                    <td className="py-2"><Badge bg="secondary" className="fw-normal">{item.shop}</Badge></td>
                                                    <td className="py-2 fw-bold text-dark">{item.customer}</td>
                                                    <td className="py-2">{formate(item.register)}</td>
                                                    <td className="py-2 text-truncate" style={{ maxWidth: '120px' }}><Badge bg={`${item.competitor_lost_contract_reason === '競合負け' ? 'warning' : 'info'}`} className="fw-normal text-dark">{item.competitor_lost_contract_reason || '-'}</Badge></td>
                                                    <td className="py-2">{item.competitor_name ? <Badge bg="secondary" className="fw-normal text-white">{item.competitor_name}</Badge> : '-'}</td>
                                                    {/* ⚠️ 列名は informationUtils の定数を使う。⚠️ ULID を直書きしない */}
                                                    <td className="py-2">{(item[LOST_DETAIL_KEY] ?? '').split(',').filter(Boolean).map(reason => <Badge bg="danger" className="text-white fw-normal text-dark me-2" key={reason}>{reason}</Badge>)}</td>
                                                    <td className="py-2">
                                                        <div className="d-flex justify-content-center">
                                                            <Button
                                                                variant="outline-primary"
                                                                size="sm"
                                                                className="px-4 shadow-sm bg-white fw-bold"
                                                                onClick={() => setEditId(item.id)}
                                                                style={{ fontSize: '0.75rem' }}
                                                            >
                                                                詳細
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                </tbody>
                            </Table>
                        ) : (
                            <Table hover className="align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                                <thead className="table-light text-secondary text-nowrap">
                                    <tr>
                                        <th style={{ width: '5%' }} className="fw-normal py-2">No</th>
                                        <th style={{ width: '15%' }} className="fw-normal py-2">店舗</th>
                                        <th style={{ width: '20%' }} className="fw-normal py-2">担当営業</th>
                                        <th style={{ width: '20%' }} className="fw-normal py-2">顧客名</th>
                                        <th style={{ width: '10%' }} className="fw-normal py-2">ステータス</th>
                                        <th>未入力箇所</th>
                                        <th style={{ width: '15%' }} className="fw-normal text-center py-2">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {masterDataList.filter(item => {
                                        const now = new Date();
                                        const today = now.getTime();
                                        const target = new Date(dateFormate(item.register)).getTime();
                                        const start = new Date('2026-01-01');
                                        const base = start.getTime();
                                        // ⚠️ こちらは「未入力が1つでもある顧客」の一覧（上の裏返し）
                                        return target < today && base < target && item.status === '失注' && missingLostFields(item).length > 0 && Number(item.trash) === 1;
                                    })
                                        .sort((a, b) => new Date(dateFormate(b.reserved_interview)).getTime() - new Date(dateFormate(a.reserved_interview)).getTime())
                                        .map((item, index) => {
                                            /**
                                             * ⚠️⚠️ **未入力の項目名をそのまま並べる**（2026-09-17）。
                                             *   ⚠️ 以前は3種類を手書きしており、
                                             *     ⚠️ **項目を足しても表示が増えなかった。**
                                             *   ⚠️ ここに項目名を書き足さないこと。
                                             *     ⚠️ 増やすのは `missingLostFields()` の側である。
                                             */
                                            const missing = missingLostFields(item);

                                            return (
                                                <tr key={item.id}>
                                                    <td className="py-2"><span className="text-muted">{index + 1}</span></td>
                                                    <td className="py-2"><Badge bg="secondary" className="fw-normal">{item.shop}</Badge></td>
                                                    <td className="py-2">{item.staff}</td>
                                                    <td className="py-2 fw-bold text-dark">{item.customer}</td>
                                                    <td className="py-2">
                                                        <Badge bg="info" className="fw-normal text-dark px-3 py-1">
                                                            {item.status || '未設定'}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-2">
                                                        {/* ⚠️ 項目が6つに増えたので横にも折り返す。
                                                               ⚠️ 縦一列のままだと1行がとても高くなる */}
                                                        <div className="d-flex flex-wrap gap-2">
                                                            {missing.map(label => (
                                                                <div className="text-danger fw-bold" style={{ fontSize: '11px' }} key={label}>
                                                                    <i className="fa-solid fa-triangle-exclamation me-1"></i>
                                                                    {label}未入力
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="py-2">
                                                        <div className="d-flex justify-content-center">
                                                            <Button
                                                                variant="outline-primary"
                                                                size="sm"
                                                                className="px-4 shadow-sm bg-white fw-bold"
                                                                onClick={() => setEditId(item.id)}
                                                                style={{ fontSize: '0.75rem' }}
                                                            >
                                                                編集
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </Table>
                        )}
                    </div>
                </Modal.Body>
            </Modal>
            <InformationEdit id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
        </>
    )
}

export default LostStatusList;
```

---

## 検証

### ⚠️ 実データでの件数（ローカルDB）

⚠️ `menu.ts` の SQL とまったく同じ日付条件で、改修前・改修後を1本のクエリで並べて数えた。

| | 件数 |
|---|---|
| 対象の失注 | 283件 |
| 改修前 | 39件 |
| ⚠️ **改修後** | ⚠️ **108件** |

### ⚠️ 稼働中の ② が同じ値を返すこと

```
POST /api/gateway {"request":"menu"}
→ {"sync":94,"cancel":36,"lost":108,"estate":0}
```

⚠️⚠️ **直接SQLの 108件と一致。** ⚠️ 判定が実際に効いていることを確認した。

### ビルド・型

| 確認 | 結果 |
|---|---|
| `npx tsc --noEmit`（② Express） | ⚠️ **エラー0** |
| `npm run build`（フロント） | ⚠️ **成功**（`Compiled with warnings.`） |
| ⚠️ 追加した警告 | ⚠️ **無し**（`LostStatusList.tsx` の `FormType` / `Survey` 未使用は**改修前からある**） |
| `php -l`（① の3ファイル） | ⚠️ **構文エラーなし** |

### ⚠️ 未実施

⚠️⚠️ **画面を開いての確認は未実施。**

| # | 確認 | 期待 |
|---|---|---|
| 1 | 反響一覧（注文）の「⚠️ **要回答 n件**」 | ⚠️ **件数が増える**（⚠️ 本番の数字は未確認） |
| 2 | 失注リスト → **失注登録** | ⚠️ 「価格差未入力」「今後の対策未入力」「敗因未入力」が**出る** |
| 3 | 未入力ラベルの並び | ⚠️ **横に折り返す**（縦一列で行が伸びない） |
| 4 | 失注リスト → **失注顧客一覧** | ⚠️ **敗因が空の顧客が出てこない**（⚠️ 既存不具合の解消） |
| 5 | メニューの失注バッジ | ⚠️ **反響一覧のバッジと同じ件数** |
| 6 | 1件を実際に埋めて保存 | ⚠️ **どちらの件数も1件減る** |
| 7 | 競合負け**以外**の失注（計画中止など） | ⚠️ **要回答に出ない**（従来どおり） |

---

## ⚠️ 残作業

| # | 内容 |
|---|---|
| 1 | ⚠️ 上の**画面での確認** |
| 2 | ⚠️ ① の phpMyAdmin で **`2026-09-17_master_data_win_lose.sql`** を実行（⚠️ **前の指示と同じもの。1回でよい**） |
| 3 | ⚠️ `v2.2.136` を push → PR → `production` へマージ |
| 4 | ⚠️ **② VPS で Express を再ビルド** |
| 5 | ⚠️ ① へフロント **と PHP 3ファイル**をアップロード |

⚠️⚠️ **5 で PHP を忘れないこと。** ⚠️ 今回は ⚠️ **① の `menu.php` / `lostList.php` / `database_order.php` も変えている。**
⚠️ 忘れると ⚠️ **② が落ちて ① へフォールバックしたときだけ件数が変わる**という、再現しにくい食い違いになる。

⚠️⚠️ **2（SQL）を先に流すこと。** ⚠️ 列が無いまま PHP を上げると ⚠️ **`Unknown column` で一覧が開かなくなる。**
