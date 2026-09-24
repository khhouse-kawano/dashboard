# 指示（2026-09-21）　他社資料をフォルダ表示にし、他社名と種別で管理する

⚠️ 依頼（`ReadMeClaude.md`）:
> - `CompetitorMaterials.tsx` の大幅改修
>   * モーダルサイズを fullscreen に
>   * box 風の UI に変更（リスト式・フォルダ風UI式の切替機能追加）
>   * 1.カタログパンフレット / 2.見積もり・提案書 / 3.チラシ / 4.その他
>     → 他社ごとのフォルダ → PDF一覧
>   * これにともない `competitor_pdf` テーブルの要改修（案①/案②）
>   * `InformationEdit.tsx` も改修（company・category のセレクトタグ）
> - バックエンドの Express 化がまだであれば対応

⚠️ 確認事項への回答:
- テーブル構造 … ⚠️ **案② 1ファイル1行**
- 既存53件の company / category … ⚠️ **空のままにする**
  → ⚠️ **その後「PDFを読んで判断してほしい」と追加の指示**（別途 SQL を用意）

---

## 変更・追加したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend/scripts/sql/` | ⚠️ **`2026-09-21_competitor_pdf_one_row_per_file.sql`（新規）** | ⚠️ **構造変更＋移行** |
| `backend/scripts/sql/` | ⚠️ **`2026-09-21_competitor_pdf_fill_company_category.sql`（新規）** | ⚠️ **53件の分類** |
| `backend-express/src/features/` | ⚠️ **`competitorPdf.ts`（新規）** | ⚠️ 一覧の Express 化 |
| `backend-express/src/gateway/` | `registry.ts` | `competitor_pdf` の登録 |
| `backend-express/src/features/information/` | `index.ts` | ⚠️ **`PDF_SQL` が配列を返すように** |
| `backend/src/core/` | `express_proxy.php` | 許可リストに `competitor_pdf` |
| `backend/src/handlers/` | `competitor_pdf.php` | ⚠️ **新しい応答の形に**（フォールバック） |
| `backend/src/handlers/` | ⚠️ **`competitor_pdf_upload.php`** | ⚠️ **1ファイル1行で保存** |
| `backend/src/handlers/informationAction/` | `information_{order,spec,used}.php` | ⚠️ **`fetchAll` に** |
| `frontend/src/utils/` | `competitorPdfUpload.ts` | ⚠️ **`PDF_CATEGORIES` 追加・company/category を送る** |
| `frontend/src/components/information/` | ⚠️ **`TableCompetitorPdf.tsx`** | ⚠️ **他社・種別のセレクト** |
| `frontend/src/components/information/` | `InformationEdit(Kaeru/Resale).tsx` | ⚠️ 読み込みと受け渡し |
| `frontend/src/components/header/` | ⚠️ **`CompetitorMaterials.tsx`（全面書き直し）** | ⚠️ **フォルダUI** |
| `frontend/src/components/header/` | `Header.tsx` | ⚠️ `isFullscreenMenu` に `他社動向/他社資料` |

---

## ⚠️ 1. テーブル構造（案②を選んだ根拠）

⚠️ 実データ（ローカル 2026-09-21）:

| 項目 | 値 |
|---|---|
| `competitor_pdf` の行数 | ⚠️ **9,333行** |
| ⚠️ **うち PDF がある行** | ⚠️ **32行**（⚠️ **9,301行は空**） |
| ⚠️ **ファイルの総数** | ⚠️ **53ファイル** |

⚠️⚠️ **移行対象は53ファイルだけ**なので、構造を変える危険がほとんど無かった。

| | 旧 | ⚠️ 新 |
|---|---|---|
| 粒度 | 顧客1人に1行 | ⚠️ **1ファイル1行** |
| 中身 | `pdf_path` に JSON 配列 | ⚠️ **name / path / staff / company / category** |
| フォルダUI | ⚠️ **9,333行を毎回パース** | ⚠️ **`GROUP BY` だけ** |
| 1件削除 | ⚠️ **配列ごと書き直し** | ⚠️ **`DELETE WHERE no = ?`** |

```sql
CREATE TABLE competitor_pdf_v2 (
  no       INT(11)      NOT NULL AUTO_INCREMENT,
  id       VARCHAR(64)  NOT NULL                COMMENT 'master_data.id',
  name     TEXT         DEFAULT NULL            COMMENT '画面に出す表示名',
  path     TEXT         DEFAULT NULL            COMMENT '/uploads/competitors/xxx.pdf',
  staff    TEXT         DEFAULT NULL            COMMENT '登録した営業',
  company  TEXT         DEFAULT NULL            COMMENT '他社名。master_data.competitors_text から選ぶ',
  category TEXT         DEFAULT NULL            COMMENT 'カタログパンフレット/見積もり・提案書/チラシ/その他',
  created  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (no),
  KEY idx_id (id),
  KEY idx_path (path(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

⚠️ 移行は ⚠️ **MariaDB の SEQUENCE エンジン**で JSON 配列をほどいた。

```sql
INSERT INTO competitor_pdf_v2 (id, name, path, staff, company, category)
SELECT p.id,
       JSON_UNQUOTE(JSON_EXTRACT(p.pdf_path, CONCAT('$[', s.seq, '].name'))),
       JSON_UNQUOTE(JSON_EXTRACT(p.pdf_path, CONCAT('$[', s.seq, '].path'))),
       JSON_UNQUOTE(JSON_EXTRACT(p.pdf_path, CONCAT('$[', s.seq, '].staff'))),
       '', ''
FROM competitor_pdf p
JOIN seq_0_to_99 s ON s.seq < JSON_LENGTH(p.pdf_path)
WHERE p.pdf_path IS NOT NULL AND p.pdf_path NOT IN ('', '[]')
ORDER BY p.id, s.seq;
```

⚠️⚠️ **旧テーブルは `competitor_pdf_old_20260921` として残す。** ⚠️ 戻すときはこれを rename する。

⚠️ ⚠️ **移行の結果: 53ファイル → 53行。欠損0。**

---

## ⚠️ 2. 既存53件の分類（⚠️ **PDFを1件ずつ読んだ**）

⚠️ 別途「ローカルに全PDFを配置するので読んで判断してほしい」との指示があり、
⚠️ `C:\Users\shinji-kawano\Downloads\competitors\` の53件を読んだ。

⚠️⚠️ **53件中49件が画像のみ（スキャン・写真）だった。**
⚠️ テキスト抽出では読めないため、⚠️ **PyMuPDF でページを画像にして目視で読んだ。**

| 例 | 読み取った内容 |
|---|---|
| `20260712100551.pdf` | ⚠️ **資金計画書／株式会社シアーズホーム ジャストホームカンパニー** |
| `S__143048728_0.pdf` | ⚠️ **TamaHome マイホーム資金計画書** |
| `S__143048729_0.pdf` | ⚠️ **TOTAL HOUSING 資金計画書** |
| `S__143048730_0.pdf` | ⚠️ **NEO Design Home 資金計画書** |
| `20250218_再来場CP DM.pdf` | ⚠️⚠️ **国分ハウジングのカムバック祭DM（自社！）** |

### 結果

| | 件数 |
|---|---|
| ⚠️ **`category` を埋められた** | ⚠️ **53 / 53** |
| ⚠️ **`company` を埋められた** | ⚠️ **46 / 53** |

⚠️⚠️ **`company` は原則「その顧客の `competitors_text` に載っている名前」を入れている。**
⚠️ 画面の選択タグはそこから作られるため。⚠️ **42件はそのまま一致することを機械的に検証した。**

⚠️⚠️ **残りを読み直し、4件を追加で埋めた**（2026-09-21 追記）。
⚠️ `TableCompetitorPdf.tsx` が ⚠️ **候補に無い値を「（登録外）」として選択肢に出す**ので、
⚠️ ⚠️ **台帳に無い名前を入れても画面で選び直せる。** だから台帳外でも入れてよいと判断した。

| no | ファイル | 入れた名前 | 根拠 |
|---|---|---|---|
| 13 | `ｼﾞｬｽﾄﾎｰﾑ・ﾀﾏﾎｰﾑ図面・見積.pdf` | ジャストホーム | ⚠️ **6ページ中4ページがジャストホームの平面図・パース**、残り2ページがタマホームの資金計画書。⚠️ 1ファイル1行なので ⚠️ **多いほう**を採った |
| 45 | `資金計画書　森建築合せ.pdf` | 森建築 | ⚠️ 支払先が「弊社」＝ ⚠️ **国分ハウジングの資金計画書**だが、備考に ⚠️ **「森建築さんと同仕様」**。⚠️ 台帳は空 |
| 52 | `202606タマホームシフクノ家資金計画.pdf` | タマホーム_大安心の家 | ⚠️ 表紙に TamaHome ロゴと「Customer Planning 吉村様邸 宮崎店」。⚠️ 台帳は空なので ⚠️ **既存の選択肢の表記に寄せた** |
| 53 | `七呂仕様書.pdf` | 七呂建設 | ⚠️ **「＜ ZEROENE± ＞ 基本共通仕様書」＝七呂建設の商品名。** ⚠️ 台帳の競合は NEOデザインホームのみ |

⚠️ 空のままにした7件の理由:

| no | 理由 |
|---|---|
| 32〜36 | ⚠️ **PDF に社名の表記がまったく無い**（平面図・パース）。⚠️ **同じ顧客で台帳の競合が6社**あり絞り込めない |
| 48 | ⚠️ 顧客が書いた要望書。⚠️ **宛先が「貴社」とだけ**あり、競合2社のどちらか不明 |
| 20 | ⚠️⚠️ **国分ハウジングの自社DM**（他社資料ではない） |

⚠️ ⚠️ **更新は `no` ではなく `path` で行う。** ⚠️ `no` は移行時の採番なので ⚠️ **① とローカルで一致しない。**

---

## ⚠️ 3. バックエンドの Express 化

### ⚠️ 何を移し、何を残したか

| request | 置き場所 | 理由 |
|---|---|---|
| ⚠️ **`competitor_pdf`（一覧）** | ⚠️ **② へ移植**（＋① にフォールバック） | 参照のみ |
| ⚠️ **`competitor_pdf_upload`** | ⚠️ **① に残す** | ⚠️ **ファイルの実体が ① にある。② から書けない** |

⚠️⚠️ **`competitor_pdf_upload` を許可リストに入れてはいけない。**
⚠️ multipart は `shouldProxyToExpress()` が転送しないが、⚠️ **書かないこと自体が防御**である。

### ⚠️ 応答の形を変えた

⚠️ 移植元は ⚠️ **「PDF」「店舗」「顧客（master_data 全件）」を丸ごと返し**、画面で突き合わせていた。
⚠️ ⚠️ **顧客は24,000件あり、PDF がある32件のために全件送るのは無駄。**

⚠️ SQL で結合して返す形に変えた。

```sql
  FROM competitor_pdf p
  LEFT JOIN (
    SELECT id, customer_contacts_name, in_charge_store, in_charge_user, status FROM master_data
    UNION ALL
    SELECT id, customer_contacts_name, in_charge_store, in_charge_user, status FROM master_data_kaeru
    UNION ALL
    SELECT id, customer_contacts_name, in_charge_store, in_charge_user, status FROM master_data_resale
  ) c ON c.id = p.id
  LEFT JOIN shop_list s ON s.shop = c.in_charge_store
```

⚠️⚠️ **顧客は3事業ぶんある。** ⚠️ 注文だけを見ると ⚠️ **建売・中古の資料が「顧客名なし」になる。**
⚠️ ⚠️ **`LEFT JOIN` にすること。** ⚠️ 顧客が消えていても資料は一覧に出す（ローカルで1件該当）。

### ⚠️ 顧客詳細の読み出しも配列に変わった

⚠️ `information_{order,spec,used}.php` と Express の `PDF_SQL` を
⚠️ **`fetch` → `fetchAll` / 1オブジェクト → 配列**に変えた。

```php
    $sql_pdf = "SELECT `no`, `id`, `name`, `path`, `staff`, `company`, `category`
                  FROM competitor_pdf WHERE id = ? ORDER BY `no`";
    $stmt_pdf->execute([$id]);
    // ⚠️ 1件も無ければ空配列。⚠️ new stdClass() に戻さないこと（画面が配列を期待する）
    $response_pdf = $stmt_pdf->fetchAll(PDO::FETCH_ASSOC) ?: [];
```

### ⚠️ アップロードは「全消し → 入れ直し」

```php
        $pdo->beginTransaction();
        $deleteStmt = $pdo->prepare('DELETE FROM competitor_pdf WHERE id = :id');
        $deleteStmt->execute(['id' => $id]);
        // … $final_pdfs を1行ずつ INSERT …
        $pdo->commit();
```

⚠️⚠️ **1件ずつ差分を取ると、名前だけ変えた行を消す事故が起きる。**
⚠️ ⚠️ **トランザクションで囲むこと。** ⚠️ 途中で落ちると資料が全部消える。

⚠️ ⚠️ **ファイルの実体は消さない**（削除された PDF は残るが URL を知らなければ辿れない。旧方式も同じ）。

---

## ⚠️ 4. 顧客詳細（他社・種別のセレクト）

⚠️ `TableCompetitorPdf.tsx` に2つのセレクトを足した。

### ⚠️ 他社の候補は `competitors_text` から

```tsx
const competitorOptions = (text: string | undefined): string[] =>
    [...new Set(
        (text ?? '')
            .replace(/、/g, ',')
            .split(',')
            .map(c => c.trim())
            .filter(c => c !== '' && c !== 'null')
    )];
```

⚠️⚠️ **全角読点（、）でも切ること。**
⚠️ 実データに `シアーズホーム、昭和建設` のように全角で入った行がある。
⚠️ ⚠️ **半角だけで切ると2社が1つの候補になる。**

⚠️⚠️ **候補に無い値が入っていても消さない。**
⚠️ 移行時に PDF を読んで入れた値や、競合の登録を後から消した場合がある。
⚠️ ⚠️ **選択肢の先頭に「（登録外）」として出す。** ⚠️ 出さないと ⚠️ **保存し直した瞬間に消える。**

```tsx
const current = (item.company ?? '').trim();
const isUnlisted = current !== '' && !options.includes(current);
...
{isUnlisted && <option value={current}>{current}（登録外）</option>}
```

### ⚠️ 種別は4つ

```ts
export const PDF_CATEGORIES = [
    'カタログパンフレット',
    '見積もり・提案書',
    'チラシ',
    'その他',
] as const;
```

⚠️⚠️ **① の `competitor_pdf_upload.php` の `$allowed_categories` と同じ内容にすること。**
⚠️ 食い違うと ⚠️ **選べるのに保存されない種別**ができる（⚠️ 空文字になる）。

⚠️ ⚠️ **① は許可リストに無い値を弾いてエラーにはしない。** ⚠️ 空文字（未分類）にする。
⚠️ 面談中に保存できなくなるほうが困るため。

### ⚠️ 新規アップロード時の初期値

```tsx
// ⚠️ 他社が1社だけなら初期値にする。⚠️ 複数あるときは選ばせる
company: options.length === 1 ? options[0] : '',
```

---

## ⚠️ 5. 一覧画面（フォルダUI）

### 階層

```
種別（4つ＋未分類） → 他社ごとのフォルダ（＋他社未設定） → PDF一覧
```

⚠️ **フォルダ / リスト**を切り替えられる（⚠️ 既定はフォルダ）。

### ⚠️ 決めたこと

| # | 内容 | 理由 |
|---|---|---|
| 1 | ⚠️ **種別は `PDF_CATEGORIES` の順。「未分類」は必ず最後** | ⚠️ 件数順だと ⚠️ **登録のたびに位置が動いて探しにくい** |
| 2 | ⚠️ **0件の種別も出す**（薄く表示） | ⚠️ **どこに入れればよいかが分かる** |
| 3 | ⚠️ **他社は件数順。「他社未設定」は最後** | ⚠️ 片付け待ちなので |
| 4 | ⚠️⚠️ **検索中はフォルダを無視して全件から探す** | ⚠️ 「どのフォルダか忘れた」が一番多い探し方。⚠️ **フォルダ内で絞ると見つからない** |
| 5 | ⚠️ リスト表示では ⚠️ **種別・他社を札で出す** | ⚠️ どのフォルダの資料か分からなくなるため |
| 6 | ⚠️ KPIに ⚠️ **「未分類・他社未設定」** を出す | ⚠️ **片付けが要る件数が一目で分かる** |

⚠️ `cm_` 接頭辞の専用 `<style>`。⚠️ `Header.tsx` の `isFullscreenMenu` に入れてある。
⚠️ ⚠️ **閉じるボタンは Header.tsx 側が出す。コンポーネントに実装しないこと。**

---

## ⚠️ やっていないこと

| # | 内容 | 理由 |
|---|---|---|
| 1 | ⚠️ **一覧から他社・種別を直す機能** | ⚠️ **顧客詳細から直せる。** 一覧からの編集は次の指示で |
| 2 | ⚠️ 削除された PDF の実体の掃除 | ⚠️ **旧方式でも残っていた。** 別途 |
| 3 | ⚠️ `customer_info.php` と `information_*_add/update.php` の PDF ブロック | ⚠️ **現行のフロントは通らない**（`competitor_pdf_upload` に分離済み）。⚠️ **宿題に記載** |
| 4 | ⚠️ 9,301件の空行の再発防止 | ⚠️ **新方式では空行が作られない**（ファイルがあるときだけ INSERT） |

---

## ⚠️ 検証

| 確認 | 結果 |
|---|---|
| ⚠️ 移行（53ファイル → 53行） | ⚠️ **欠損0** |
| ⚠️ 分類の適用 | ⚠️ **category 53件 / company 46件** |
| ⚠️ `company` が台帳の候補と一致するか | ⚠️ **42件は一致**（機械的に検証）。⚠️ **残り4件は台帳外だが画面で選び直せる** |
| ⚠️ `category` の内訳 | ⚠️ **見積もり・提案書 52件 / チラシ 1件**（⚠️ その他は0件） |
| ⚠️ 結合した応答 | ⚠️ **顧客名・店舗・ブランドが入る**（引けないのは1件のみ） |
| ⚠️ PHP の構文（6本） | ⚠️ **エラー0件**（`php -l`） |
| `npx tsc --noEmit`（backend-express） | ⚠️ **エラー0件** |
| `npm run build` | ⚠️ **成功** |
| ⚠️ 変更したコンポーネントの警告 | ⚠️ **0件** |
| ⚠️ **サーバーサイドでの描画** | ⚠️ **成功**（CompetitorMaterials 6,819文字） |

### ⚠️ 未実施

⚠️⚠️ **ブラウザでの動作は確認していない。**

| # | 確認 | 期待 |
|---|---|---|
| 1 | ヘッダー → 他社動向 → 他社資料 | ⚠️ **全画面でフォルダが並ぶ** |
| 2 | 「見積もり・提案書」を開く | ⚠️ **他社のフォルダが件数順に並ぶ**（18件） |
| 3 | 他社を開く | ⚠️ **PDF一覧。クリックで開く** |
| 4 | パンくずで戻る | ⚠️ **1つずつ戻れる** |
| 5 | リストに切り替える | ⚠️ **全件が1枚の表。札で種別・他社が分かる** |
| 6 | ⚠️ 検索する | ⚠️ **フォルダを開かずに全件から探す** |
| 7 | 顧客詳細 → 他社資料 | ⚠️ **既存ファイルに他社・種別のセレクトが出る** |
| 8 | ⚠️ **種別を変えて保存 → 開き直す** | ⚠️ **残っている** |
| 9 | ⚠️ **PDFを1件削除して保存** | ⚠️ **その1件だけ消える**（⚠️ 他が巻き添えにならない） |
| 10 | ⚠️ 競合が1社だけの顧客に新規アップロード | ⚠️ **他社が自動で入る** |
| 11 | ⚠️ 建売・中古の顧客詳細 | ⚠️ **同じように動く** |
| 12 | ⚠️ ② を止める | ⚠️ **① にフォールバックして一覧が出る** |
