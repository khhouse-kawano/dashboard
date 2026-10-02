# 2026-09-29 SatBaseサマリー：画面入力値を別表に分ける（v2.2.152）

## ⚠️ 何のためか

⚠️ `satbase_property` の元データは ⚠️ **Googleスプレッドシートの帳票**である。
⚠️ 最新にするには ⚠️ **CSVで入れ替える**のが自然だが、⚠️⚠️ **同じ表に画面から入れた値が同居していた。**

| 列 | 持ち主 |
|---|---|
| `ad_posted` / `instagram_posted` / `updated` / `updated_by` | ⚠️⚠️ **Dashboard（画面のトグル）** |
| ⚠️ 残り36列 | ⚠️ SatBase（スプレッドシート）が正 |

⚠️ ⚠️ **このため CSV を入れ直すたびにトグルがゼロに戻っていた。**

⚠️⚠️ **表を2つに分け、取り込み側が画面の値に触れない形にした。**

| 表 | 役割 |
|---|---|
| ⚠️ `satbase_property` | ⚠️⚠️ **SatBaseの写し。丸ごと入れ替えてよい** |
| ⚠️⚠️ **`satbase_property_flag`（新規）** | ⚠️⚠️ **Dashboardが持つ。取り込みで触らない** |

---

## ⚠️ 変えたもの

| ディレクトリ | ファイル | |
|---|---|---|
| `frontend/src/utils/` | **version.ts** | ⚠️ `2.2.151` → ⚠️ **`2.2.152`** |
| `backend-express/src/features/` | **satbase.ts** | ⚠️⚠️ **`runSatbaseList` / `runSatbaseUpdate` を書き換え** |
| `backend/scripts/sql/` | ⚠️⚠️ **2026-09-29_satbase_property_flag.sql**（新規） | ⚠️ 表を作って値を移す |
| `backend/scripts/sql/` | ⚠️⚠️ **2026-09-29_satbase_property_reload.sql**（新規） | ⚠️ CSV入れ替えの手順 |
| `backend/scripts/sql/` | ⚠️⚠️ **2026-09-29_update_log_2.2.152.sql**（新規） | ⚠️ 更新履歴の1行 |

⚠️⚠️ **変えていないもの**

| | 理由 |
|---|---|
| ⚠️ `frontend/src/components/header/SatBaseDatabase.tsx` | ⚠️⚠️ **返す形を分割前とまったく同じにした**ため |
| ⚠️ `backend-express/src/gateway/registry.ts` | ⚠️ `satbase_list` / `satbase_update` の登録は変わらない |
| ⚠️ `backend/src/core/express_proxy.php` | ⚠️ 同上 |
| ⚠️ ① の PHP | ⚠️⚠️ **もともと存在しない**（この機能は最初から ② だけにある） |

---

## ⚠️ 新しい表

⚠️ ファイル: `backend/scripts/sql/2026-09-29_satbase_property_flag.sql`

```sql
CREATE TABLE IF NOT EXISTS satbase_property_flag (
  property_id      INT(11)      NOT NULL COMMENT '物件ID。⚠️ satbase_property.property_id と対応する',
  ad_posted        TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '広告出稿状況。⚠️ 画面のトグル（0=未出稿 / 1=出稿済み）',
  instagram_posted TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Instagram投稿状況。⚠️ 画面のトグル（0=未投稿 / 1=投稿済み）',
  updated          DATETIME     DEFAULT NULL COMMENT '画面から最後に更新した日時',
  updated_by       VARCHAR(128) DEFAULT NULL COMMENT '画面から最後に更新したスタッフ名',
  PRIMARY KEY (property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='SatBaseサマリーの画面入力値。⚠️ CSV取り込みで触らないこと';
```

⚠️ 値の移送（⚠️⚠️ **列を落とす前に流すこと**）:

```sql
INSERT INTO satbase_property_flag
  (property_id, ad_posted, instagram_posted, updated, updated_by)
SELECT property_id, ad_posted, instagram_posted, updated, updated_by
  FROM satbase_property
 WHERE ad_posted = 1
    OR instagram_posted = 1
    OR updated IS NOT NULL
ON DUPLICATE KEY UPDATE
  ad_posted        = VALUES(ad_posted),
  instagram_posted = VALUES(instagram_posted),
  updated          = VALUES(updated),
  updated_by       = VALUES(updated_by);
```

⚠️ 元の4列を落とす:

```sql
ALTER TABLE satbase_property
  DROP COLUMN ad_posted,
  DROP COLUMN instagram_posted,
  DROP COLUMN updated,
  DROP COLUMN updated_by;
```

⚠️⚠️ **落とす理由**: 残したままだと `SELECT p.*, f.ad_posted ...` で ⚠️ **同じ名前の列が2つ返り、
どちらが採られるか分からなくなる。**

---

## ⚠️ 書き換えた関数（そのまま）

### ⚠️ `runSatbaseList`（backend-express/src/features/satbase.ts）

```ts
/**
 * 一覧。
 *
 * ⚠️ 並べ替えは ⚠️ **`property_id` の降順**（新しい物件が上）。
 *   ⚠️ ⚠️ **文字列ではなく数値で並べる**。⚠️ 列が INT なので SQL 側で正しく並ぶ。
 *
 * ⚠️⚠️ **LEFT JOIN であること。**
 *   ⚠️ ⚠️ **flag 表には「一度でも触られた物件」しか行が無い。**
 *     ⚠️ 内部結合にすると ⚠️ **未操作の物件が一覧から消える。**
 *
 * ⚠️⚠️ **`COALESCE` で 0 に落とすこと。**
 *   ⚠️ 画面は `Number(p.ad_posted ?? 0)` で見ているので NULL でも動くが、
 *     ⚠️ ⚠️ **絞り込み（未出稿）が NULL と 0 で割れる**ため揃えておく。
 *
 * ⚠️ ⚠️ **返す形は分割前と同じ。** ⚠️ 画面側（SatBaseDatabase.tsx）は変えていない。
 */
export const runSatbaseList = async (): Promise<unknown> => {
  const rows = await query<DynamicRow>(
    `SELECT p.*,
            COALESCE(f.ad_posted, 0)        AS ad_posted,
            COALESCE(f.instagram_posted, 0) AS instagram_posted,
            f.updated                       AS updated,
            f.updated_by                    AS updated_by
       FROM satbase_property p
       LEFT JOIN satbase_property_flag f ON f.property_id = p.property_id
      ORDER BY p.property_id DESC`
  );

  return { properties: rows };
};
```

### ⚠️ `runSatbaseUpdate`（同ファイル）

```ts
/**
 * トグルの更新。
 *
 * ⚠️⚠️ **列名は許可リストと突き合わせてから SQL に入れる。**
 *   ⚠️ ⚠️ **プレースホルダは列名には使えない**ので、ここを通さないと
 *     ⚠️ **任意の列を書き換えられる穴になる。**
 *
 * ⚠️ 値は 0 か 1 に丸める。⚠️ **画面がトグルなので、それ以外は来ない前提にしない。**
 *
 * ⚠️⚠️ **書き込み先は `satbase_property_flag`。**
 *   ⚠️ ⚠️ **初回は行が無いので UPDATE では入らない。** ⚠️ 追加と更新を兼ねる形にする。
 *   ⚠️ ⚠️ **触っていない方の列は 0 で入る**（⚠️ 既定値と同じなので問題ない）。
 *
 * ⚠️⚠️ **物件の存在は台帳側で確かめる。**
 *   ⚠️ ⚠️ **追加と更新を兼ねる書き方では、存在しない物件IDでも黙って1行増える。**
 *     ⚠️ 台帳に無い物件の行が溜まるのを防ぐため、先に見に行く。
 */
export const runSatbaseUpdate = async (
  input: SatbaseUpdateInput
): Promise<{ status: string; message?: string }> => {
  if (!Number.isInteger(input.propertyId) || input.propertyId <= 0) {
    return { status: 'error', message: '物件が指定されていません。' };
  }

  if (!isEditableColumn(input.column)) {
    // ⚠️ 列名はそのまま返さない（何が書ける列かを外へ知らせない）
    return { status: 'error', message: 'この項目は画面から変更できません。' };
  }

  const exists = await query<DynamicRow>(
    'SELECT property_id FROM satbase_property WHERE property_id = ? LIMIT 1',
    [input.propertyId]
  );

  if (exists.length === 0) {
    return { status: 'error', message: '物件が見つかりませんでした。' };
  }

  const value = input.value === 1 ? 1 : 0;
  const adPosted = input.column === 'ad_posted' ? value : 0;
  const instagramPosted = input.column === 'instagram_posted' ? value : 0;

  // ⚠️ 列名は許可リストを通っているので、ここで埋め込んでよい
  await execute(
    `INSERT INTO satbase_property_flag
       (property_id, ad_posted, instagram_posted, updated, updated_by)
     VALUES (?, ?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       ${input.column} = VALUES(${input.column}),
       updated         = NOW(),
       updated_by      = VALUES(updated_by)`,
    [input.propertyId, adPosted, instagramPosted, input.staff.slice(0, 128)]
  );

  return { status: 'ok' };
};
```

⚠️ ⚠️ **`EDITABLE_COLUMNS` の許可リストはそのまま残してある。**
⚠️ 書き込み先が flag 表だけになったので台帳へは届かないが、
⚠️ ⚠️ **列名を SQL に埋め込む箇所が残っている**ため、外してはならない。

---

## ⚠️ CSV入れ替えの手順（新設）

⚠️ ファイル: `backend/scripts/sql/2026-09-29_satbase_property_reload.sql`

```sql
DROP TABLE IF EXISTS satbase_property_new;
CREATE TABLE satbase_property_new LIKE satbase_property;

-- ⚠️ CSV を satbase_property_new に取り込む（phpMyAdmin のインポート）
-- ⚠️ 件数を確認: SELECT COUNT(*) FROM satbase_property_new;

RENAME TABLE
  satbase_property     TO satbase_property_old,
  satbase_property_new TO satbase_property;

-- ⚠️ 画面を見てから: DROP TABLE satbase_property_old;
```

⚠️⚠️ **いきなり本番の表を消さない形にした。**
⚠️ ⚠️ **取り込みが途中で失敗しても画面が空にならない**ため。
⚠️ `RENAME TABLE` は ⚠️ **一瞬で終わり、途中で片方だけになることがない。**

---

## ⚠️ ローカルでの確認（実施済み）

| # | 見たこと | 結果 |
|---|---|---|
| 1 | ⚠️ 移送前に1件へトグルを立てて SQL を流す | ⚠️⚠️ **flag 表に移った**（`1949 / 1 / 1 / 移行テスト`） |
| 2 | ⚠️ `satbase_property` の4列 | ⚠️⚠️ **消えている**（`portal_posted_date` 等は残る） |
| 3 | ⚠️ `runSatbaseList` の件数 | ⚠️⚠️ **1,910行**（⚠️ 分割前と同じ。LEFT JOIN で欠けない） |
| 4 | ⚠️ 未操作の物件 | ⚠️⚠️ **`ad_posted = 0` / `updated = null`** |
| 5 | ⚠️ 返り値に `ad_posted` が2つ無いか | ⚠️⚠️ **1つだけ** |
| 6 | ⚠️ 初回のトグル（行が無い物件） | ⚠️ **`{ status: 'ok' }` で1行増える** |
| 7 | ⚠️ 2回目のトグル（別の列） | ⚠️⚠️ **もう片方の列が 0 に戻らない** |
| 8 | ⚠️ 存在しない物件ID | ⚠️ **「物件が見つかりませんでした。」** |
| 9 | ⚠️ `sales_price` を指定 | ⚠️ **「この項目は画面から変更できません。」** |
| 10 | ⚠️⚠️ **台帳を丸ごと入れ替える**（RENAME） | ⚠️⚠️ **トグルが消えなかった** |
| 11 | ⚠️ `npx tsc --noEmit` | ⚠️ **エラーなし** |
| 12 | ⚠️ 更新履歴 | ⚠️ **no.245 / 2.2.152** |

⚠️ ⚠️ **検証で入れた flag 2行は消してある**（⚠️ 残 0 件）。

---

## ⚠️ 申し送り

| # | |
|---|---|
| 1 | ⚠️⚠️ **本番①では手順2（値の移送）を必ず先に流すこと。** ⚠️ 手順3の `DROP COLUMN` は戻せない |
| 2 | ⚠️⚠️ **② の再ビルドが必要。** ⚠️ 旧コードのまま列を落とすと ⚠️ **一覧が `Unknown column` で落ちる** |
| 3 | ⚠️ ⚠️ **①②の順序が今回は逆**（⚠️ **② を先に上げてから SQL を流す**）。⚠️ 理由は 2 |
| 4 | ⚠️ ⚠️ **GAS による自動取り込みは入れていない**（⚠️ 今回は表の分割まで）。⚠️ 取り込みは引き続き手でCSV |
| 5 | ⚠️ 台帳から消えた物件の flag 行は ⚠️ **残る**。⚠️ 害は無い（⚠️ LEFT JOIN なので出てこない）が、⚠️ 気になれば掃除できる |
| 6 | ⚠️ ブラウザでの表示は ⚠️⚠️ **未確認**（ヘッドレスブラウザが無い） |
| 7 | ⚠️⚠️ **MCP の説明文「既定の reaction」が古いまま**（持ち越し） |
