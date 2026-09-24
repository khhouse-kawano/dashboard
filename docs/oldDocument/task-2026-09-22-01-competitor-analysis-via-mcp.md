# 競合分析を MCP（各自の Claude アカウント）へ移す（v2.2.141）

⚠️ 指示（会話中の設計変更）:

> では設計を変えます
> MCPサーバーからリクエストを送るAPIについてこの実装をおこなう
> そうすれば各自のアカウントから推論ができる
> 推論結果を定期的にhtmlファイルで保存して必要なときにフロントに出すという設計にしたらコストがかなりおさえられる

> レンダリングが遅くなることで推論しているかのようなUXをつくれるので

> MCP用にhtmlで出力して というプロンプトに対応できるようなバックエンド設計を
> それいがいはエージェントが提案した通りの設計で着手してよい

⚠️ 決めたこと（確認のうえ）:

| | 選んだ形 |
|---|---|
| HTML の置き場 | ⚠️ **DB に本文ごと保存** |
| 登録のしかた | ⚠️ **画面から手で上げる**（＋ MCP からの保存も可） |
| 画面内の分析（`kpi_analyze` の competitor） | ⚠️ **外す** |

⚠️ ⚠️ **`docs/task-2026-09-21-11-claude-competitor-analysis.md` は差し替えになった。**
⚠️ あちらは ⚠️ **画面から Claude を実行する設計**で、⚠️ **この版で廃止した。**
⚠️ ⚠️ **あちらのファイルには手を入れていない**（データの作り方の記録として残している）。

---

## ⚠️ なぜ作り直したか

⚠️⚠️ **1回の実行が数百円かかり、想定を大きく超えた。**

| | 1回あたりの入力 | 費用 |
|---|---|---|
| 既存の分析（反響推移・店舗別など） | 5,000〜15,000トークン | ⚠️ **$0.06〜0.14** |
| ⚠️ **競合分析（当初）** | ⚠️ **約147,000トークン** | ⚠️ **約$2.2** |

⚠️ 競合分析だけ ⚠️ **集計値ではなく顧客1件ごとの行を渡す**ため、桁が違う。

⚠️ 会話の中で ⚠️ **2段階で下げた**が、それでも高かった。

| 手当て | 結果 |
|---|---|
| ⚠️ **項目名のくり返しをやめ、タブ区切りの表にした** | 147,000 → ⚠️ **86,000** |
| ⚠️ 商談メモの出どころを ⚠️ **面談シート**に変えた | ⚠️ **74,000**（⚠️ 中身は濃くなった） |

⚠️⚠️ **そこで「誰が払うか」を変えた。**
⚠️ 推論を ⚠️ **利用者自身の Claude アカウント（Claude Desktop / MCP）**へ移し、
⚠️ ダッシュボードは ⚠️ **出来上がった HTML を保存して見るだけ**にした。

⚠️ ⚠️ **これで会社の API キーは一度も使われない。画面を開く費用はゼロ。**

---

## 全体の流れ

```
Claude Desktop（各自のアカウント）
  ↓ GET  /api/v1/analysis/competitor     ← ⚠️ 個人情報は伏字
  ↓ GET  /api/v1/analysis/report/spec    ← ⚠️ HTML の書き方
  ↓ 推論して HTML を書く
  ↓ POST /api/v1/analysis/report         ← ⚠️ 保存
                                          （⚠️ 画面から手で上げてもよい）
ダッシュボード
  他社動向 →〈ロゴ〉による競合分析 → 一覧 → 本文（⚠️ iframe の中）
```

---

## ⚠️ 触ったファイル

| ディレクトリ | ファイル | 種別 |
|---|---|---|
| `backend-express/src/features/analysis/` | ⚠️ **`competitor.ts`** | ⚠️ **新規**（MCP用のデータ） |
| 同上 | ⚠️ **`report.ts`** | ⚠️ **新規**（HTMLの保存と書き方） |
| 同上 | `index.ts` | ⚠️ ルート5本を追加 |
| `backend-express/src/gateway/` | `registry.ts` | ⚠️ 画面用の request を4本追加 |
| `backend/src/core/` | ⚠️ **`express_proxy.php`** | ⚠️ 転送リスト（⚠️ **2か所とも**） |
| 同上 | ⚠️ **`kpi.php`** | ⚠️⚠️ **競合分析の節を削除** |
| `backend/src/handlers/` | ⚠️ **`kpi_analyze.php`** | ⚠️⚠️ **competitor の分岐・スキーマ・プロンプトを削除** |
| `frontend/src/components/header/` | ⚠️ **`CompetitorAnalysisReports.tsx`** | ⚠️ **新規**（一覧と閲覧） |
| 同上 | `Header.tsx` | ⚠️ メニューの接続先を差し替え |
| 同上 | `ClaudeAnalysis.tsx` | ⚠️ competitor を選べない状態に戻した |
| `backend/scripts/sql/` | ⚠️ **`2026-09-21_analysis_report.sql`** | ⚠️ **新規**（テーブル作成） |

⚠️ ⚠️ **`ClaudeAnalysisResult.tsx` の勝敗表は残してある。**
⚠️ **既に保存済みの競合分析（`kpi_analysis_history`）を開けなくなるため。**
⚠️ ⚠️ **開くのは課金されない**ので、消す理由がない。

---

## ⚠️ 1. 個人情報の扱い（いちばん大事）

⚠️ 返すのは ⚠️ **顧客1件ごとの行**なので、ここが設計の中心である。

| やっていること | |
|---|---|
| 氏名・電話・メール・住所・物件名 | ⚠️ **列ごと外す**（SELECT はするが返さない） |
| 自由記述に紛れた同じ値 | ⚠️ **伏字にする**（`maskPii`） |
| ⚠️ **別の顧客の氏名** | ⚠️ **台帳3万件と突き合わせて伏字にする**（`maskKnownNames`） |
| 予算 | ⚠️ **金額ではなく帯**（例 4000〜4500万） |

### ⚠️ 実データで見つけて直した漏れ・壊れ

| 症状 | 原因 | 直し方 |
|---|---|---|
| ⚠️ **氏名が1件残った** | 台帳が「甲斐 彩香」、メモが「甲斐彩香」 | ⚠️ **文字の間の空白を許す形**で消す |
| ⚠️ **別の顧客の氏名が残った** | 行ごとの処理では防げない | ⚠️ **`maskKnownNames` を追加** |
| ⚠️⚠️ **日付が伏字になった** | `2026-09-14` を電話番号と誤判定 | ⚠️ **区切りに `/` を使わない＋区切り3つ以上は電話番号としない** |
| ⚠️⚠️ **他社名が壊れた**（6か所） | ⚠️ 顧客に「ヤマダ」さんがいるため `ヤマダホームズ` → `****ホームズ` | ⚠️ **他社名の一部になっている氏名は消さない** |

⚠️ ⚠️ **最後の2つは「消しすぎ」の不具合である。**
⚠️ **分析が成り立たなくなるので、漏れと同じくらい重い。**

---

## ⚠️ 2. データの作り方で効いていること

| | 中身 |
|---|---|
| ⚠️ **勝ちと負けを別のクエリで取る** | ⚠️ 日付順に切ると ⚠️ **勝ち112 / 負け888** になった。⚠️ **500件ずつの枠**を与える |
| ⚠️ **自社ブランドを競合から外す** | ⚠️ 外さないと ⚠️ **「国分ハウジング」が1位の競合**になる。⚠️ `own_group` に分離 |
| ⚠️ **商談メモは面談シートから** | ⚠️ `master_data.remarks` は ⚠️ **反響フォームの定型文**が大半だった |
| ⚠️ **他社名が出る面談を優先** | ⚠️ 古い順だと ⚠️ **初回面談の世間話で上限を使い切る** |
| ⚠️ **タブ区切りで返す** | ⚠️ オブジェクトだと ⚠️ **項目名だけで全体の7割** |

---

## ⚠️ 3. 追加した新規ファイル（全文）

### ⚠️ 3-1. `backend-express/src/features/analysis/competitor.ts`

```ts
import type { RowDataPacket } from 'mysql2/promise';
import { asDate, PHASES } from './columns';
import { query } from '../../db/pool';
import type { SqlParam } from '../../db/pool';

/**
 * 競合分析用のデータ（注文事業 / 建売分譲事業）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **このファイルだけ、集計値ではなく「顧客1件ごとの行」を返す。**
 *
 *   ⚠️ 他の /analysis は集計値しか返さない。⚠️ **ここは例外である。**
 *   ⚠️ 「誰にどの理由で負けたか」は ⚠️ **自由記述（競合欄・失注理由・面談シート）
 *     の中にしかなく**、集計値では読み取れない（2026-09-21 の指示）。
 *
 *   ⚠️⚠️ **そのかわり、個人を特定できる値は1つも返さない。**
 *     ⚠️ 氏名・電話・メール・住所・物件名は列ごと外し、
 *       ⚠️ **自由記述に紛れているものは伏字に置き換える**（maskPii / maskKnownNames）。
 *     ⚠️ ⚠️ **列を足すときは必ず PII_COLUMNS を見直すこと。**
 *
 * ⚠️ 移植元: backend/src/core/kpi.php の buildCompetitorSnapshot()
 *   ⚠️ ⚠️ **PHP 側（画面からの実行）は廃止する。** ⚠️ 課金の発生源だったため。
 *   ⚠️ こちらは ⚠️ **利用者自身の Claude アカウント**から MCP 経由で呼ばれる。
 *     ⚠️ ⚠️ **社内の API キーは使わない＝会社に課金が発生しない。**
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export type CompetitorDivision = 'order' | 'kaeru';

/** 伏字の記号 */
const MASK = '****';

/**
 * 部門ごとの対象テーブル。
 *
 * ⚠️⚠️ **テーブル名はプレースホルダに渡せない。必ずこの表で解決すること。**
 *   ⚠️ リクエストの値をそのまま SQL に連結すると SQL インジェクションになる。
 */
const DIVISIONS: Record<CompetitorDivision, { table: string; label: string }> = {
  order: { table: 'master_data', label: '注文事業' },
  kaeru: { table: 'master_data_kaeru', label: '建売分譲事業' },
};

/** 1回に返す行数の上限。⚠️ 勝ち・負けで半分ずつ使う */
const MAX_ROWS = 1000;

/** 1顧客ぶんの商談メモの文字数 */
const MEMO_CHARS = 220;

/** 面談1件ぶんの note の上限。⚠️ 1件だけで全部使い切らないようにする */
const NOTE_CHARS = 90;

/**
 * 伏字にする列。
 *
 * ⚠️⚠️ **SELECT はするが、返す行には入れない。**
 *   ⚠️ 自由記述に紛れた同じ値を消すために、値そのものは必要なため取得する。
 */
const PII_COLUMNS = [
  'customer_contacts_name',
  'customer_contacts_name_kana',
  'customer_contacts_name_2',
  'customer_contacts_mobile_phone_number',
  'customer_contacts_phone_number',
  'customer_contacts_email',
  'full_address',
  'planned_construction_site',
] as const;

/**
 * 部門ごとの競合関連の列。
 *
 * ⚠️⚠️ **建売分譲事業（master_data_kaeru）には勝因・価格差・対策の列が無い。**
 *   ⚠️ ⚠️ **両方に投げると「Unknown column」で落ちる。**
 */
const EXTRA_COLUMNS: Record<CompetitorDivision, Record<string, string>> = {
  order: {
    competitor_win_reason: 'win_reason',
    competitor_price_gap: 'price_gap',
    competitor_sales_person: 'rival_sales_person',
    competitor_countermeasure: 'countermeasure',
    competitor_campaign: 'rival_campaign',
  },
  kaeru: {},
};

/**
 * 勝ち負けを決めるステータス。
 *
 * ⚠️⚠️ **ここに無いステータスの行は返さない。**
 *   ⚠️ 「見込み」「会社管理」はまだ決着していない（注文の約8割がこれ）。
 *     ⚠️ ⚠️ **負けに数えると、負けが実際の5倍以上に膨らむ。**
 *   ⚠️ 「重複」は同一顧客の二重登録なので数えない。
 *
 * ⚠️⚠️ **建売分譲事業には「失注」というステータスが無い**（2026-09-21 実測）。
 *   ⚠️ いちばん近いのが「追客終了」なので、これを負けとして扱う。
 *   ⚠️ ⚠️ **追客終了は他社に負けたとは限らない**（予算・時期の都合も含む）。
 */
const STATUSES: Record<CompetitorDivision, { win: string[]; lost: string[] }> = {
  order: { win: ['契約済み', '解約', '解約済み'], lost: ['失注'] },
  kaeru: { win: ['契約済み', '解約', '解約済み'], lost: ['追客終了'] },
};

/**
 * 自社グループの社名。
 *
 * ⚠️⚠️ **house_maker には自社の社名も登録されている。**
 *   ⚠️ 除外しないと ⚠️ **「国分ハウジング」が最大の競合として集計される**
 *     （2026-09-21 実測: 注文71件・建売163件で1位だった）。
 *   ⚠️ ⚠️ **商談メモには自社名がいくらでも出てくるため、必ず外れる。**
 *
 * ⚠️ 消すのではなく own_group として別の欄に出す。
 *   ⚠️ **グループ内での取り合いは、それ自体が見たい情報**だからである。
 * ⚠️ ⚠️ **「ジャストホーム」は自社ではない**（シアーズホーム系の他社）。入れないこと。
 */
const OWN_GROUP_NAMES = [
  '国分ハウジング',
  'デイジャストハウス',
  'なごみ工務店',
  'PGハウス',
  'かえるホーム',
];

/** 空白を全部落とす */
const flatten = (value: string): string => value.replace(/[\s　]+/gu, '');

/** 正規表現に使えるよう escape する */
const escapeRe = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/**
 * 個人情報を伏字にする。
 *
 * ⚠️ 消すもの:
 *   ⚠️ 渡された値（その行の氏名・電話・住所など、または台帳にある氏名）
 *   ⚠️ メールアドレスの形をしたもの
 *   ⚠️ 電話番号らしい数字の並び
 *
 * ⚠️⚠️ **日付は消さないこと。**
 *   ⚠️ `2026-09-14` は区切り込みで10文字あるため、
 *     ⚠️ ⚠️ **単純な「数字が続いたら伏字」では日付が全部消える**
 *       （2026-09-21 に実際に「**** 契約: 契約」になった）。
 *   ⚠️ 商談メモの日付は ⚠️ **いつ商談が動いたかを示す大事な情報**である。
 */
export const maskPii = (text: string, secrets: readonly string[]): string => {
  if (text === '') return '';

  let out = text;

  for (const raw of secrets) {
    const secret = raw.trim();
    // ⚠️ 1〜2文字を消すと日本語の本文が虫食いになる
    if (secret.length < 3) continue;

    out = out.split(secret).join(MASK);

    /**
     * ⚠️⚠️ **文字の間に空白が入っていても消すこと。**
     *   ⚠️ 台帳が「甲斐 彩香」でも、メモには「甲斐彩香」「甲斐　彩香」と
     *     書かれていることがある。
     *   ⚠️ ⚠️ **単純な置換だけでは素通りする**（2026-09-21 に実データで1件漏れた）。
     *
     * ⚠️ ⚠️ **空白を除いて3文字未満のものにはかけない。**
     *   ⚠️ 「吉 田」のような名前で `吉田` を全部伏字にすると、
     *     ⚠️ **本文中の地名・他社名まで虫食いになる。**
     */
    const flat = flatten(secret);
    if (flat.length < 3) continue;

    const pattern = [...flat].map(escapeRe).join('[\\s\\u3000]*');
    out = out.replace(new RegExp(pattern, 'gu'), MASK);
  }

  out = out.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, MASK);

  /**
   * ⚠️⚠️ **区切り文字に `/` を入れないこと。**
   *   ⚠️ 面談シートの記録は ` / ` でつないでいるため、
   *     ⚠️ ⚠️ **「18:00 / 2026-08-25」がひとつながりの数字と見なされて伏字になった**
   *       （2026-09-21 に実データで発生）。
   *   ⚠️ 日本の電話番号はハイフン区切りなので、`/` は要らない。
   */
  out = out.replace(/[0-9０-９][0-9０-９\-－ 　]{5,}[0-9０-９]/gu, (hit) => {
    const digits = hit.replace(/[^0-9０-９]/gu, '');
    /**
     * ⚠️⚠️ **区切りが3つ以上あるものは電話番号ではない。**
     *   ⚠️ `2026-09-14 2026-08-25` のように日付が2つ並ぶと
     *     ⚠️ ⚠️ **数字が16桁つながって見え、本文が丸ごと消える。**
     *   ⚠️ 電話番号の区切りは多くても2つ（090-1234-5678 / 0995-45-8886）。
     */
    const separators = hit.length - digits.length;
    if (separators > 2) return hit;
    return digits.length >= 9 && digits.length <= 11 ? MASK : hit;
  });

  return out;
};

/**
 * 台帳にある氏名を、返す文章から一括で消す。
 *
 * ⚠️⚠️ **maskPii() は「その行自身の」氏名しか消せない。**
 *   ⚠️ 商談メモには ⚠️ **別の顧客の名前**（紹介者・同行者・過去の担当案件）が
 *     書かれていることが実際にある。
 *   ⚠️ ⚠️ **2026-09-21 の実データで1件漏れた。** ⚠️ 行ごとの処理では防げない。
 *
 * ⚠️ 手順（総当たりを避けるため2段階）:
 *   ⚠️ 1. 返す文章を全部つないで、空白を除いた1本の文字列にする
 *   ⚠️ 2. 台帳の氏名をその文字列で探し、⚠️ **実際に出てくるものだけ**を置換する
 *   ⚠️ 台帳は3万件あるが、1 の文字列は数十KBなので探すのは速い。
 *
 * ⚠️ ⚠️ **自社の営業担当の名前も、顧客として登録があれば一緒に消える。**
 *   ⚠️ 競合分析に担当者名は要らないため、消えて困らない。
 */
export const maskKnownNames = async (
  rows: Record<string, string>[],
  textKeys: readonly string[],
  makers: readonly string[] = []
): Promise<Record<string, string>[]> => {
  const blob = rows.map((row) => textKeys.map((key) => row[key] ?? '').join(' ')).join(' ');
  const flatBlob = flatten(blob);
  if (flatBlob === '') return rows;

  // ⚠️ 3事業ぶん見る。⚠️ **注文のメモに建売の顧客名が出ることがある**
  const names = await query<DynamicRow>(
    'SELECT customer_contacts_name AS name FROM master_data' +
      ' UNION SELECT customer_contacts_name FROM master_data_kaeru' +
      ' UNION SELECT customer_contacts_name FROM master_data_resale'
  );

  /**
   * ⚠️⚠️ **他社名の一部になっている氏名は消さないこと。**
   *   ⚠️ 「ヤマダ」という顧客がいるため、⚠️ **`ヤマダホームズ` が `****ホームズ` になった**
   *     （2026-09-21 に実データで6か所）。
   *   ⚠️ ⚠️ **競合分析で他社名が壊れると、分析そのものが成り立たない。**
   *   ⚠️ 他社名の中にしか出てこない語は、人名としては扱わない。
   */
  const flatMakers = makers.map(flatten);

  const hits: string[] = [];
  for (const row of names) {
    const flat = flatten(String(row.name ?? '').trim());
    // ⚠️ 2文字以下は本文の普通の語と当たる。消すと虫食いになる
    if (flat.length < 3) continue;
    if (!flatBlob.includes(flat)) continue;
    if (flatMakers.some((maker) => maker !== flat && maker.includes(flat))) continue;
    hits.push(flat);
  }
  if (hits.length === 0) return rows;

  const unique = [...new Set(hits)];
  return rows.map((row) => {
    const next = { ...row };
    for (const key of textKeys) {
      if (next[key] !== undefined && next[key] !== '') {
        next[key] = maskPii(next[key], unique);
      }
    }
    return next;
  });
};

/** 他社名を拾う */
const findMakers = (text: string, makers: readonly string[]): string[] =>
  text === '' ? [] : makers.filter((maker) => text.includes(maker));

/** 競合欄（カンマ・読点区切り）を配列にする */
const splitCompetitors = (text: string): string[] =>
  text
    .replace(/、/gu, ',')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '' && part !== 'null');

/**
 * 面談シートの interview_log から商談メモを組み立てる。
 *
 * ⚠️⚠️ **interview_log は `[{day, action, note}, ...]` の JSON である。**
 *   ⚠️ note が担当者の書いた文章で、⚠️ **勝ち負けの理由はここにしかない。**
 *
 * ⚠️ ⚠️ **master_data.remarks は使わない。**
 *   ⚠️ 中身の大半が反響フォームの定型文（「反響経路:… 検討時期:…」）で、
 *     ⚠️ **トークンを食うだけで勝敗の理由が1文字も入らなかった。**
 *
 * ⚠️ 入れる順番（無駄を出さないため）:
 *   ⚠️ 1. ⚠️ **他社名が出てくる面談を先に入れる**
 *   ⚠️ 2. 残りを新しい順に入れる
 *   ⚠️ ⚠️ **古い順に入れると、初回面談の世間話で上限を使い切る。**
 */
export const notesFromInterviewLog = (json: string, makers: readonly string[]): string => {
  let log: unknown;
  try {
    log = JSON.parse(json);
  } catch {
    return '';
  }
  if (!Array.isArray(log)) return '';

  const entries: { text: string; day: string; hit: boolean }[] = [];
  for (const item of log) {
    if (item === null || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;

    let note = String(record.note ?? '')
      .replace(/\s+/gu, ' ')
      .trim();
    if (note === '' || note === 'null') continue;
    if (note.length > NOTE_CHARS) note = `${note.slice(0, NOTE_CHARS)}…`;

    // ⚠️ アクション名には物件名が付くことがある。⚠️ **先頭だけ使う**
    const action = String(record.action ?? '').trim().split(',')[0] ?? '';
    const day = String(record.day ?? '').trim();

    entries.push({
      text: `${day} ${action}: ${note}`.trim(),
      day,
      hit: findMakers(note, makers).length > 0,
    });
  }
  if (entries.length === 0) return '';

  entries.sort((a, b) => {
    // ⚠️ 他社名のある面談を先に。同じなら新しい順
    if (a.hit !== b.hit) return a.hit ? -1 : 1;
    return b.day.localeCompare(a.day);
  });

  let out = '';
  for (const entry of entries) {
    const next = out === '' ? entry.text : `${out} / ${entry.text}`;
    if (next.length > MEMO_CHARS) break;
    out = next;
  }

  // ⚠️ 1件目だけで上限を超える場合は、その1件を切って入れる
  return out === '' ? `${entries[0].text.slice(0, MEMO_CHARS)}…` : out;
};

/**
 * 土地の有無。
 * ⚠️ 入力が「有」「無」「1」「0」と揺れているため、文字で判定する。
 */
const hasLandLabel = (value: string): string => {
  const text = value.trim();
  if (text === '' || text === 'null') return '未入力';
  if (text.includes('無') || text === '0') return 'なし';
  return 'あり';
};

/**
 * 予算を帯にまとめる。
 *
 * ⚠️⚠️ **金額そのものは返さない。**
 *   ⚠️ 帯にすれば傾向は読めるうえ、⚠️ **個人の特定に近づかない。**
 * ⚠️ 入力は「4000万」「40,000,000」などと揺れるため、数字だけを取り出して判定する。
 */
const budgetBand = (value: string): string => {
  const digits = value.replace(/[^0-9]/gu, '');
  if (digits === '') return '未入力';

  let amount = Number(digits);
  // ⚠️ 「4000」のような万円単位の入力を円に直す
  if (amount < 100000) amount *= 10000;

  if (amount < 25000000) return '2500万未満';
  if (amount < 30000000) return '2500〜3000万';
  if (amount < 35000000) return '3000〜3500万';
  if (amount < 40000000) return '3500〜4000万';
  if (amount < 45000000) return '4000〜4500万';
  if (amount < 50000000) return '4500〜5000万';
  return '5000万以上';
};

/** 失注日（テキスト）から 'YYYY-MM' を取り出す */
const lostMonth = (value: string): string => {
  const matched = /^([12][0-9]{3}-[0-9]{2})/u.exec(value.replace(/\//gu, '-').trim());
  return matched === null ? '' : matched[1];
};

export interface CompetitorOptions {
  division: CompetitorDivision;
  /** 何ヶ月分さかのぼるか */
  months: number;
}

export interface CompetitorResult {
  division: string;
  months: number;
  counts: Record<string, number | boolean>;
  columns: string[];
  /** ⚠️ タブ区切りの1行 */
  rows: string[];
}

/**
 * 競合の記録がある商談を集めて返す。
 *
 * ⚠️⚠️ **返すのはタブ区切りの表である。オブジェクトの配列ではない。**
 *   ⚠️ 1行18項目あるため、⚠️ **オブジェクトだと項目名だけで全体の7割**になる。
 *     ⚠️ 実測（注文842行）: JSON 440KB のうち ⚠️ **商談メモは28%だけ。**
 *   ⚠️ ⚠️ **情報は1つも減っていない。** 項目名を先頭で1回だけ伝える形である。
 */
export const runCompetitor = async (options: CompetitorOptions): Promise<CompetitorResult> => {
  const { table, label } = DIVISIONS[options.division];
  const extra = EXTRA_COLUMNS[options.division];
  const statuses = STATUSES[options.division];

  const makerRows = await query<DynamicRow>('SELECT label FROM house_maker');
  const makers = [
    ...new Set(
      makerRows
        .map((row) => String(row.label ?? '').trim())
        // ⚠️ 2文字以下の社名は本文の別の語に当たるため使わない
        .filter((name) => name.length >= 3)
    ),
  ];

  const contractDate = asDate(`m.${PHASES.contract.column}`);
  const reactionDate = asDate(`m.${PHASES.reaction.column}`);
  const rankColumn = 'm.customized_input_01J82Z5F366ZQ897PXWF6H5ZAM';

  const select = [
    'm.status',
    'm.in_charge_store',
    'm.brand',
    'm.sales_promotion_name',
    'm.has_owned_land',
    'm.budget',
    `${rankColumn} AS rank_value`,
    'm.competitors_text',
    'm.competitor_name',
    'm.competitor',
    'm.competitor_lost_contract_reason',
    'm.competitor_lost_contract_date',
    /**
     * ⚠️⚠️ **商談メモは面談シートから取る。**
     *   ⚠️ ⚠️ **LEFT JOIN にすること。** 面談シートが無い顧客でも、
     *     競合欄と失注理由は手がかりになるので落とさない。
     */
    'i.interview_log',
    `DATE_FORMAT(${contractDate}, '%Y-%m') AS contract_month`,
    `DATE_FORMAT(${reactionDate}, '%Y-%m') AS registered_month`,
    ...Object.keys(extra).map((column) => `m.${column}`),
    ...PII_COLUMNS.map((column) => `m.${column}`),
  ];

  const since = new Date();
  since.setMonth(since.getMonth() - options.months);
  const from = since.toISOString().slice(0, 10);

  /**
   * ⚠️⚠️ **勝ちと負けを別々に取る。**
   *   ⚠️ 1本のクエリを日付順に切ると、⚠️ **件数の多い負けばかりが残る。**
   *     ⚠️ 実測では 勝ち112 / 負け888 になり、勝敗表として成立しなかった。
   *   ⚠️ ⚠️ **半分ずつの枠を与えること。**
   */
  const quota = Math.floor(MAX_ROWS / 2);

  const fetchByStatus = async (wanted: string[]): Promise<DynamicRow[]> => {
    const sql =
      `SELECT ${select.join(', ')} FROM ${table} m` +
      // ⚠️ 面談シートは1顧客1行（実測 18,161行 / 18,160人）
      ' LEFT JOIN interview_sheet i ON i.id = m.id' +
      ' WHERE m.show_dashboard = 1' +
      ` AND m.status IN (${wanted.map(() => '?').join(',')})` +
      ` AND (${contractDate} >= ? OR ${reactionDate} >= ?` +
      " OR REPLACE(COALESCE(m.competitor_lost_contract_date, ''), '/', '-') >= ?)" +
      // ⚠️ 競合の手がかりがまったく無い行は最初から取らない
      ' AND (' +
      " COALESCE(m.competitors_text, '') NOT IN ('', 'null')" +
      " OR COALESCE(m.competitor_name, '') NOT IN ('', 'null')" +
      " OR COALESCE(m.competitor, '') NOT IN ('', 'null')" +
      " OR COALESCE(m.competitor_lost_contract_reason, '') NOT IN ('', 'null')" +
      " OR COALESCE(i.interview_log, '') NOT IN ('', 'null', '[]')" +
      ')' +
      ` ORDER BY COALESCE(${contractDate}, ${reactionDate}) DESC` +
      // ⚠️ 自社名しか出てこない行が落ちるため、多めに取ってから絞る
      ` LIMIT ${quota * 4}`;

    const params: SqlParam[] = [...wanted, from, from, from];
    return query<DynamicRow>(sql, params);
  };

  const [wonRaw, lostRaw] = await Promise.all([
    fetchByStatus(statuses.win),
    fetchByStatus(statuses.lost),
  ]);

  const kept = { win: 0, lost: 0 };
  let foundFromMemo = 0;
  let rows: Record<string, string>[] = [];

  for (const r of [...wonRaw, ...lostRaw]) {
    const secrets = PII_COLUMNS.map((column) => String(r[column] ?? ''));

    // ⚠️ 面談シートの note だけを使う。⚠️ **反響フォームの定型文は入らない**
    const memo = maskPii(notesFromInterviewLog(String(r.interview_log ?? ''), makers), secrets);

    const named = [
      ...splitCompetitors(String(r.competitors_text ?? '')),
      ...splitCompetitors(String(r.competitor_name ?? '')),
      ...splitCompetitors(String(r.competitor ?? '')),
    ];
    // ⚠️ メモからの社名。⚠️ **競合欄が空の行を救うのはここだけ**
    const inMemo = findMakers(memo, makers);
    if (named.length === 0 && inMemo.length > 0) foundFromMemo += 1;

    const all = [...new Set([...named, ...inMemo])];
    /**
     * ⚠️⚠️ **自社グループの社名を競合から外す。**
     *   ⚠️ 外さないと「国分ハウジング」が最大の競合として並ぶ。
     *   ⚠️ **捨てずに own_group として別に持つ**（社内での取り合いも見たいため）。
     */
    const ownGroup = all.filter((name) => OWN_GROUP_NAMES.includes(name));
    const competitors = all.filter((name) => !OWN_GROUP_NAMES.includes(name));

    let lostReason = String(r.competitor_lost_contract_reason ?? '').trim();
    if (lostReason === 'null') lostReason = '';

    // ⚠️ 他社名も失注理由も無い行は競合戦の証拠が無い。返さない
    //   ⚠️ **自社名しか出てこない行もここで落ちる**
    if (competitors.length === 0 && lostReason === '') continue;

    const won = statuses.win.includes(String(r.status ?? ''));
    const bucket = won ? 'win' : 'lost';
    // ⚠️ 片方だけで枠を使い切らないようにする
    if (kept[bucket] >= quota) continue;
    kept[bucket] += 1;

    const row: Record<string, string> = {
      outcome: won ? 'win' : 'lost',
      status: String(r.status ?? ''),
      month: won
        ? String(r.contract_month ?? r.registered_month ?? '')
        : lostMonth(String(r.competitor_lost_contract_date ?? '')) ||
          String(r.registered_month ?? ''),
      shop: String(r.in_charge_store ?? ''),
      brand: String(r.brand ?? ''),
      medium: String(r.sales_promotion_name ?? ''),
      has_land: hasLandLabel(String(r.has_owned_land ?? '')),
      budget: budgetBand(String(r.budget ?? '')),
      rank: String(r.rank_value ?? '').trim(),
      competitors: competitors.join('|'),
      own_group: ownGroup.join('|'),
      lost_reason: lostReason,
      // ⚠️ 面談シートで既に長さを整えてある。⚠️ **ここで切り直さないこと**
      memo,
    };

    for (const [column, key] of Object.entries(extra)) {
      const value = String(r[column] ?? '').trim();
      row[key] = value === '' || value === 'null' ? '' : maskPii(value, secrets);
    }

    rows.push(row);
    if (rows.length >= MAX_ROWS) break;
  }

  /**
   * ⚠️⚠️ **最後にもう一度、台帳の氏名を消す。**
   *   ⚠️ 上の maskPii() は行ごとの氏名しか見ていない。
   *   ⚠️ ⚠️ **ここを外すと、他の顧客の氏名がメモに残ったまま返る。**
   */
  rows = await maskKnownNames(rows, ['memo', 'lost_reason', ...Object.values(extra)], makers);

  const columns = rows.length === 0 ? [] : Object.keys(rows[0]);
  const tsv = rows.map((row) =>
    columns
      .map((column) => String(row[column] ?? '').replace(/[\t\r\n]+/gu, ' '))
      .join('\t')
  );

  return {
    division: label,
    months: options.months,
    counts: {
      rows: rows.length,
      wins: kept.win,
      losses: rows.length - kept.win,
      quotaPerSide: quota,
      candidates: wonRaw.length + lostRaw.length,
      foundFromMemo,
      // ⚠️ どちらかが枠いっぱいなら「全件ではない」。勝率の計算に使わせない
      truncated: kept.win >= quota || rows.length - kept.win >= quota,
    },
    columns,
    rows: tsv,
  };
};
```

### ⚠️ 3-2. `backend-express/src/features/analysis/report.ts`

```ts
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';

/**
 * Claude が書いた分析レポート（HTML）の保存と取り出し。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **なぜ HTML をそのまま保存するのか**
 *
 *   ⚠️ 推論は ⚠️ **利用者自身の Claude アカウント**（Claude Desktop / MCP）で行う。
 *     ⚠️ ⚠️ **社内の API キーを使わない＝会社に課金が発生しない。**
 *   ⚠️ 画面は ⚠️ **出来上がった HTML を出すだけ**なので、開くたびの費用はゼロ。
 *
 * ⚠️⚠️ **この HTML は「こちらが書いたコード」ではない。**
 *   ⚠️ 画面では ⚠️ **iframe の中に `sandbox="allow-scripts"` で出す。**
 *   ⚠️ ⚠️ **`allow-same-origin` を付けないこと。**
 *     ⚠️ 付けると、レポートの中のスクリプトから
 *       ⚠️ **ダッシュボードのログイン情報を読めてしまう。**
 *   ⚠️ サーバー側では中身を検査しない。⚠️ **検査で防ぐ設計にしない**
 *     （すり抜けを前提に、置き場所の側で閉じ込める）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** 1件あたりの HTML の上限。⚠️ 参考資料は60KB前後。余裕を見て2MB */
export const MAX_HTML_BYTES = 2 * 1024 * 1024;

export interface ReportInput {
  title: string;
  category: string;
  division: string;
  period: string;
  html: string;
  staff: string;
  dataAsOf?: string;
}

/**
 * レポートを保存する。
 *
 * ⚠️ 同じ分析を何度も作り直すため、⚠️ **上書きではなく毎回1件足す。**
 *   ⚠️ ⚠️ **過去の分析と読み比べられること自体に価値がある**
 *     （参考資料も「前期 vs 今期」で比較していた）。
 */
export const saveReport = async (input: ReportInput): Promise<number> => {
  const result = await execute(
    'INSERT INTO analysis_report (title, category, division, period, html, staff, data_as_of)' +
      ' VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      input.title.slice(0, 255),
      input.category.slice(0, 64),
      input.division.slice(0, 32),
      input.period.slice(0, 64),
      input.html,
      input.staff.slice(0, 128),
      input.dataAsOf ?? null,
    ]
  );

  return result.insertId;
};

/**
 * 一覧。
 *
 * ⚠️⚠️ **`html` を含めないこと。**
 *   ⚠️ 1件60KB あるため、一覧で返すと ⚠️ **数MBの応答になる。**
 */
export const listReports = async (category?: string): Promise<DynamicRow[]> =>
  query<DynamicRow>(
    'SELECT no, title, category, division, period, staff, data_as_of, created,' +
      ' CHAR_LENGTH(html) AS html_length' +
      ' FROM analysis_report' +
      (category === undefined || category === '' ? '' : ' WHERE category = ?') +
      ' ORDER BY created DESC, no DESC',
    category === undefined || category === '' ? [] : [category]
  );

/** 本文を1件だけ取り出す */
export const getReport = async (no: number): Promise<DynamicRow | null> => {
  const rows = await query<DynamicRow>(
    'SELECT no, title, category, division, period, staff, data_as_of, created, html' +
      ' FROM analysis_report WHERE no = ?',
    [no]
  );

  return rows[0] ?? null;
};

/** 削除。⚠️ 取り消せないので、呼ぶ側で確認すること */
export const deleteReport = async (no: number): Promise<void> => {
  await execute('DELETE FROM analysis_report WHERE no = ?', [no]);
};

/**
 * 「HTML で出力して」と言われた Claude に渡す書き方の指示。
 *
 * ⚠️⚠️ **Claude Desktop には画面の文脈が無い。**
 *   ⚠️ 何も指示しないと、⚠️ **毎回ばらばらの体裁のレポートが出来上がる。**
 *   ⚠️ ⚠️ **ここで形をそろえておくと、過去の分析と読み比べられる。**
 *
 * ⚠️ ⚠️ **1つのファイルで完結させること。**
 *   ⚠️ 画面は iframe の中に本文を流し込むだけで、外部ファイルは読めない。
 */
export const reportSpec = (): Record<string, unknown> => ({
  目的:
    'GET /analysis/competitor で取得したデータをもとに、社内で共有できる分析レポートを' +
    '1枚の HTML として書き、POST /analysis/report で保存する。',

  書き方: [
    '⚠️ HTML・CSS・JavaScript をすべて1つのファイルに収めること。' +
      '外部ファイルは読み込めない（画面は iframe に本文を流し込むだけ）。',
    '⚠️ <script src="..."> による外部の読み込みは使わないこと。' +
      'グラフが必要なら SVG か、インラインの JavaScript で描くこと。',
    '⚠️ 画像は使わないこと。使う場合は data: URI で埋め込むこと。',
    '⚠️ 文字コードは UTF-8。<meta charset="utf-8"> を必ず入れること。',
    '⚠️ 幅は 100% で、横スクロールが出ないようにすること（画面の中に埋め込まれるため）。',
    '⚠️ 印刷されることがある。@media print で背景色が飛んでも読めるようにすること。',
  ],

  構成の目安: [
    '1. 見出しと、分析の対象期間・データの時点',
    '2. 結論（何が起きているか。1〜2段落）',
    '3. 他社別の勝敗表（勝ち / 負け / 敗因の構成 / 負けが出ている店舗）',
    '4. 敗因の構造（価格・土地・性能などの内訳）',
    '5. 勝ちパターン（勝った商談のメモに共通する型）',
    '6. 次の一手（実行できるものに限る）',
  ],

  必ず書くこと: [
    '⚠️ データの時点（いつ取得したデータか）。読む人が最新だと誤解しないようにするため。',
    '⚠️ counts.truncated が true のときは「渡されたデータは全件ではない」と明記すること。' +
      '⚠️ その場合、勝率を全社の実力値として書いてはならない。',
    '⚠️ 失注理由の記録率。⚠️ 空欄が多いのは入力されていないためで、理由が無いという意味ではない。',
    '⚠️ 推測は推測と分かるように書くこと。データから数えられる事実と混ぜないこと。',
  ],

  書いてはいけないこと: [
    '⚠️⚠️ 個人を特定できる情報。データには氏名・電話・メール・住所・物件名は含まれておらず、' +
      'memo の中の **** は伏字である。⚠️ 伏字の中身を推測して書かないこと。',
    '⚠️ 渡されたデータに無い数値。',
  ],

  保存のしかた: {
    endpoint: 'POST /api/v1/analysis/report',
    body: {
      title: '一覧に出す見出し。例: 競合別 勝因・敗因分析（2026年5月期）',
      category: "いまは 'competitor' のみ",
      division: "'order'（注文事業）または 'kaeru'（建売分譲事業）",
      period: '分析の対象期間。例: 2025/06〜2026/05',
      dataAsOf: 'データの時点。YYYY-MM-DD',
      html: '書き上げた HTML の全文',
    },
  },
});
```

### ⚠️ 3-3. `frontend/src/components/header/CompetitorAnalysisReports.tsx`

```tsx
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../../utils/apiClient';
import AuthContext from '../../context/AuthContext';
import ClaudeIcon, { CLAUDE_ORANGE } from './ClaudeIcon';

/**
 * Claudeによる競合分析（ヘッダー → 他社動向 → Claudeによる競合分析）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **この画面は Claude を呼ばない。課金は一切発生しない。**
 *
 *   ⚠️ 推論は ⚠️ **利用者自身の Claude アカウント**（Claude Desktop / MCP）で行い、
 *     ⚠️ 出来上がった HTML を ⚠️ **保存しておいて、ここで見るだけ**である。
 *   ⚠️ ⚠️ **以前は画面から Claude を実行していたが、1回あたり数百円かかったため
 *     2026-09-21 にこの形へ変えた。**
 *
 *   ⚠️ データの口: ② の `GET /api/v1/analysis/competitor`（MCP用・個人情報は伏字）
 *   ⚠️ 書き方の指示: ② の `GET /api/v1/analysis/report/spec`
 *   ⚠️ 保存: ② の `POST /api/v1/analysis/report`、または ⚠️ **この画面からのアップロード**
 *
 * ⚠️⚠️ **レポートの HTML は「こちらが書いたコード」ではない。**
 *   ⚠️ ⚠️ **必ず iframe の `sandbox="allow-scripts"` の中に出すこと。**
 *   ⚠️ ⚠️ **`allow-same-origin` を足さないこと。**
 *     ⚠️ 足すと、レポートの中のスクリプトから
 *       ⚠️ **ダッシュボードのログイン情報を読めてしまう。**
 *
 * ⚠️ 表が広いので Header.tsx の `isFullscreenMenu` に入れてある。
 *   ⚠️ ⚠️ **閉じるボタンは Header.tsx 側が出す。ここに実装しないこと。**
 * ─────────────────────────────────────────────
 */

type ReportRow = {
    no: number;
    title: string;
    category: string;
    division: string;
    period: string;
    staff: string;
    data_as_of: string | null;
    created: string;
    html_length: number;
};

type ReportBody = ReportRow & { html: string };

const DIVISION_LABEL: Record<string, string> = {
    order: '注文事業',
    kaeru: '建売分譲事業',
    '': '全社',
};

/**
 * 開くときに出す経過。
 *
 * ⚠️⚠️ **本当に推論しているわけではない。** ⚠️ 保存済みの HTML を出しているだけである。
 *   ⚠️ 利用者の要望で、⚠️ **読み込みを段階的に見せて分析らしくしている**（2026-09-21）。
 *   ⚠️ ⚠️ **そのぶん「いつ時点のデータか」を必ず外に出すこと**（下の `dataNote`）。
 *     ⚠️ 演出のせいで ⚠️ **今まさに集計した最新の数字だと誤解される**のを防ぐため。
 */
const STEPS: string[] = [
    '商談データを読み込んでいます',
    '競合欄と面談シートから他社名を拾っています',
    '他社別に勝敗を集計しています',
    '敗因の構成を整理しています',
    'レポートを組み立てています',
];

/** 1段あたりの待ち時間（ミリ秒） */
const STEP_MS = 420;

const CompetitorAnalysisReports = () => {
    const { authority, userName } = useContext(AuthContext);
    const isMaster = authority === 'Master';

    const [reports, setReports] = useState<ReportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    /** 開いているレポート */
    const [opened, setOpened] = useState<ReportBody | null>(null);
    const [openingNo, setOpeningNo] = useState<number | null>(null);
    /** いま何段目まで進んだか。⚠️ STEPS.length に達したら本文を出す */
    const [step, setStep] = useState(0);
    /**
     * 一度開いたレポート。
     * ⚠️⚠️ **2回目以降は演出を飛ばす。** ⚠️ 見返すたびに待たされると資料として使えない。
     */
    const seen = useRef<Set<number>>(new Set());

    /* 登録パネル */
    const [uploadOpen, setUploadOpen] = useState(false);
    const [form, setForm] = useState({ title: '', division: 'order', period: '', dataAsOf: '' });
    const [html, setHtml] = useState('');
    const [fileName, setFileName] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveDone, setSaveDone] = useState('');

    const fetchList = useCallback(async () => {
        try {
            const res = await apiClient.post('', { request: 'analysis_report_list', category: 'competitor' });
            setReports((res.data?.reports ?? []) as ReportRow[]);
            setError('');
        } catch (err) {
            console.error(err);
            setError('分析レポートを取得できませんでした。時間をおいて再度お試しください。');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchList();
    }, [fetchList]);

    /**
     * 段階表示。
     * ⚠️ `opened` が入ってから進める。⚠️ **取得より先に終わると空白が出る。**
     */
    useEffect(() => {
        if (opened === null || step >= STEPS.length) return;
        const timer = window.setTimeout(() => setStep((n) => n + 1), STEP_MS);
        return () => window.clearTimeout(timer);
    }, [opened, step]);

    const openReport = async (row: ReportRow) => {
        setOpeningNo(row.no);
        setOpened(null);
        // ⚠️ 2回目以降は演出を飛ばす
        setStep(seen.current.has(row.no) ? STEPS.length : 0);

        try {
            const res = await apiClient.post('', { request: 'analysis_report_get', no: row.no });
            const report = res.data?.report as ReportBody | undefined;
            if (report === undefined) {
                setError(res.data?.message ?? 'レポートを開けませんでした。');
                return;
            }
            seen.current.add(row.no);
            setOpened(report);
        } catch (err) {
            console.error(err);
            setError('レポートを開けませんでした。');
        } finally {
            setOpeningNo(null);
        }
    };

    const pickFile = (file: File | null | undefined) => {
        setSaveError('');
        setSaveDone('');
        if (!file) return;

        if (!/\.html?$/i.test(file.name)) {
            setSaveError('HTMLファイルを選んでください。');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setHtml(String(reader.result ?? ''));
            setFileName(file.name);
            // ⚠️ 見出しが空ならファイル名から補う（拡張子は落とす）
            setForm((prev) => prev.title === ''
                ? { ...prev, title: file.name.replace(/\.html?$/i, '') }
                : prev);
        };
        reader.onerror = () => setSaveError('ファイルを読み込めませんでした。');
        // ⚠️ 文字化けを防ぐため UTF-8 を明示する
        reader.readAsText(file, 'utf-8');
    };

    const handleUpload = async () => {
        if (form.title.trim() === '') {
            setSaveError('見出しを入力してください。');
            return;
        }
        if (html.trim() === '') {
            setSaveError('HTMLファイルを選んでください。');
            return;
        }

        setSaving(true);
        setSaveError('');
        try {
            const res = await apiClient.post('', {
                request: 'analysis_report_upload',
                title: form.title.trim(),
                category: 'competitor',
                division: form.division,
                period: form.period.trim(),
                dataAsOf: form.dataAsOf,
                html,
            });

            if (res.data?.status !== 'ok') {
                setSaveError(res.data?.message ?? '登録に失敗しました。');
                return;
            }

            setSaveDone('分析レポートを登録しました。');
            setHtml('');
            setFileName('');
            setForm({ title: '', division: 'order', period: '', dataAsOf: '' });
            setUploadOpen(false);
            await fetchList();
        } catch (err) {
            console.error(err);
            setSaveError('登録に失敗しました。');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (row: ReportRow) => {
        if (!window.confirm(`「${row.title}」を削除します。よろしいですか。`)) return;

        try {
            await apiClient.post('', { request: 'analysis_report_delete', no: row.no });
            if (opened?.no === row.no) setOpened(null);
            await fetchList();
        } catch (err) {
            console.error(err);
            setError('削除に失敗しました。');
        }
    };

    /** ⚠️ 演出の外に常時出す。⚠️ **最新の数字だと誤解させないため** */
    const dataNote = useMemo(() => {
        if (opened === null) return '';
        const asOf = String(opened.data_as_of ?? '').slice(0, 10);
        const period = opened.period === '' ? '' : `対象期間 ${opened.period}`;
        const stamp = asOf === '' ? `登録 ${String(opened.created).slice(0, 10)}` : `${asOf} 時点のデータ`;
        return [period, stamp].filter((v) => v !== '').join(' ／ ');
    }, [opened]);

    const showBody = opened !== null && step >= STEPS.length;

    return (
        <div className="car_wrap">
            <style>{`
                /**
                 * ⚠️⚠️ 全画面モーダルの Modal.Body は **p-0 かつ overflow: hidden** である
                 *   （header/Header.tsx）。⚠️ 余白はこちらで持ち、
                 *   高さを使い切って**中だけがスクロールする**形にする。
                 */
                .car_wrap { font-size: 13px; color: #1f2937;
                            height: 100%; display: flex; flex-direction: column;
                            padding: 16px 32px 20px; box-sizing: border-box; }
                .car_inner { width: 100%; max-width: 1500px; margin: 0 auto;
                             display: flex; flex-direction: column; min-height: 0; flex: 1; gap: 12px; }

                .car_head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
                .car_title { font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 3px; }
                .car_note { font-size: 11px; color: #6b7280; line-height: 1.6; }

                .car_bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
                           background: #faf9f5; border: 1px solid #e8e6dc; border-radius: 10px;
                           padding: 10px 12px; }
                .car_add { border: 0; border-radius: 8px; background: ${CLAUDE_ORANGE}; color: #fff;
                           font-size: 12px; font-weight: 700; padding: 6px 14px; cursor: pointer;
                           white-space: nowrap; margin-left: auto; }
                .car_add.is_off { background: #fff; color: #4b5563; border: 1px solid #d1d5db; }

                /* 左に一覧、右に本文 */
                .car_body { display: flex; gap: 12px; flex: 1 1 auto; min-height: 0; }
                .car_list { width: 300px; flex: none; overflow: auto; display: flex;
                            flex-direction: column; gap: 8px; }
                .car_item { border: 1px solid #e8e6dc; border-radius: 10px; background: #fff;
                            padding: 10px 12px; cursor: pointer; text-align: left; width: 100%; }
                .car_item:hover { border-color: ${CLAUDE_ORANGE}; }
                .car_item.is_on { border-color: ${CLAUDE_ORANGE}; background: #fdf8f6; }
                .car_item_title { font-weight: 700; font-size: 12px; line-height: 1.4; }
                .car_item_meta { font-size: 10px; color: #6b7280; margin-top: 4px;
                                 display: flex; gap: 6px; flex-wrap: wrap; }
                .car_tag { background: #f3f4f6; border-radius: 999px; padding: 1px 8px; white-space: nowrap; }

                .car_view { flex: 1 1 auto; min-width: 0; border: 1px solid #e8e6dc;
                            border-radius: 10px; background: #fff; display: flex;
                            flex-direction: column; overflow: hidden; }
                .car_view_head { border-bottom: 1px solid #e8e6dc; padding: 8px 12px;
                                 display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
                /* ⚠️ データの時点。⚠️ **演出の外に常時出す** */
                .car_asof { font-size: 11px; color: #8a6d3b; background: #fdf8e7;
                            border: 1px solid #f0e2b6; border-radius: 6px; padding: 3px 8px; }
                .car_frame { flex: 1 1 auto; width: 100%; border: 0; }

                /* 段階表示 */
                .car_steps { padding: 28px 24px; display: flex; flex-direction: column; gap: 10px; }
                .car_step { font-size: 12px; color: #6b7280; display: flex; align-items: center; gap: 8px; }
                .car_step.is_done { color: #1f2937; }
                .car_dot { width: 6px; height: 6px; border-radius: 50%; background: ${CLAUDE_ORANGE}; flex: none; }

                .car_empty { padding: 40px 12px; text-align: center; color: #9ca3af; font-size: 12px; }
                .car_error { font-size: 12px; color: #b91c1c; background: #fef2f2;
                             border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px; }
                .car_done { font-size: 12px; color: #166534; background: #f0fdf4;
                            border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 12px; }

                .car_panel { background: #fff; border: 1px solid #f0d9cc; border-radius: 10px;
                             padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
                .car_row { display: flex; gap: 10px; flex-wrap: wrap; }
                .car_field { display: flex; flex-direction: column; gap: 4px; flex: 1 1 180px; }
                .car_label { font-size: 11px; color: #6b7280; }
                .car_input { border: 1px solid #d1d5db; border-radius: 6px; padding: 5px 8px;
                             font-size: 12px; background: #fff; color: #1f2937; outline: none; }
                .car_input:focus { border-color: ${CLAUDE_ORANGE}; }
                .car_save { border: 0; border-radius: 8px; background: #16a34a; color: #fff;
                            font-size: 12px; font-weight: 700; padding: 7px 18px; cursor: pointer; }
                .car_save:disabled { background: #d1d5db; cursor: not-allowed; }
                .car_del { border: 0; background: none; color: #9ca3af; cursor: pointer;
                           font-size: 11px; padding: 0; }
                .car_del:hover { color: #dc2626; }
            `}</style>

            <div className="car_inner">
                <div className="car_head">
                    <span className="car_title">
                        <ClaudeIcon height={16} />
                        による競合分析
                    </span>
                    <span className="car_note">
                        Claude Desktop で作成した分析レポートを保存して閲覧します。
                        {/* ⚠️ 課金が発生しないことを明記する。以前は画面から実行していた */}
                        この画面を開いても分析は実行されません。
                    </span>
                </div>

                {error !== '' && <div className="car_error">{error}</div>}
                {saveDone !== '' && <div className="car_done">{saveDone}</div>}

                {isMaster && (
                    <div className="car_bar">
                        <span className="car_note">
                            ⚠️ 分析するデータは MCP（Claude Desktop）から取得します。
                            書き方は <code>GET /analysis/report/spec</code> にあります。
                        </span>
                        <button
                            type="button"
                            className={`car_add${uploadOpen ? ' is_off' : ''}`}
                            onClick={() => { setUploadOpen(!uploadOpen); setSaveError(''); }}
                        >
                            <i className={`fa-solid ${uploadOpen ? 'fa-xmark' : 'fa-plus'} me-1`} aria-hidden="true" />
                            {uploadOpen ? '閉じる' : 'レポートを登録'}
                        </button>
                    </div>
                )}

                {uploadOpen && isMaster && (
                    <div className="car_panel">
                        <div className="car_row">
                            <span className="car_field" style={{ flex: '2 1 280px' }}>
                                <span className="car_label">見出し</span>
                                <input
                                    type="text"
                                    className="car_input"
                                    placeholder="例: 競合別 勝因・敗因分析（2026年5月期）"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                />
                            </span>
                            <span className="car_field" style={{ flex: '0 1 160px' }}>
                                <span className="car_label">事業</span>
                                <select
                                    className="car_input"
                                    value={form.division}
                                    onChange={(e) => setForm({ ...form, division: e.target.value })}
                                >
                                    <option value="order">注文事業</option>
                                    <option value="kaeru">建売分譲事業</option>
                                    <option value="">全社</option>
                                </select>
                            </span>
                            <span className="car_field" style={{ flex: '0 1 200px' }}>
                                <span className="car_label">対象期間</span>
                                <input
                                    type="text"
                                    className="car_input"
                                    placeholder="例: 2025/06〜2026/05"
                                    value={form.period}
                                    onChange={(e) => setForm({ ...form, period: e.target.value })}
                                />
                            </span>
                            <span className="car_field" style={{ flex: '0 1 160px' }}>
                                {/* ⚠️ 画面に常時出す。⚠️ **最新だと誤解させないため** */}
                                <span className="car_label">データの時点</span>
                                <input
                                    type="date"
                                    className="car_input"
                                    value={form.dataAsOf}
                                    onChange={(e) => setForm({ ...form, dataAsOf: e.target.value })}
                                />
                            </span>
                        </div>

                        <div className="car_row align-items-center">
                            <input
                                type="file"
                                accept=".html,.htm,text/html"
                                style={{ fontSize: '12px' }}
                                onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }}
                            />
                            {fileName !== '' && (
                                <span className="car_note">
                                    {fileName}（{Math.ceil(html.length / 1024).toLocaleString()}KB）
                                </span>
                            )}
                        </div>

                        {saveError !== '' && <div className="car_error">{saveError}</div>}

                        <div className="car_row align-items-center">
                            <button
                                type="button"
                                className="car_save"
                                disabled={saving || html === ''}
                                onClick={() => { void handleUpload(); }}
                            >
                                {saving ? '登録中…' : '登録'}
                            </button>
                            <span className="car_note">登録者: {userName || '－'}</span>
                        </div>
                    </div>
                )}

                <div className="car_body">
                    <div className="car_list">
                        {loading && <div className="car_empty">読み込み中です…</div>}
                        {!loading && reports.length === 0 && (
                            <div className="car_empty">
                                まだレポートがありません。
                                {isMaster && <><br />Claude Desktop で作成して登録してください。</>}
                            </div>
                        )}
                        {reports.map((row) => (
                            <div key={row.no} className={`car_item${opened?.no === row.no ? ' is_on' : ''}`}>
                                <button
                                    type="button"
                                    className="border-0 bg-transparent p-0 text-start w-100"
                                    onClick={() => { void openReport(row); }}
                                >
                                    <span className="car_item_title d-block">{row.title}</span>
                                    <span className="car_item_meta">
                                        <span className="car_tag">{DIVISION_LABEL[row.division] ?? row.division}</span>
                                        {row.period !== '' && <span className="car_tag">{row.period}</span>}
                                        <span className="car_tag">{String(row.created).slice(0, 10)}</span>
                                        <span className="car_tag">{row.staff || '－'}</span>
                                    </span>
                                </button>
                                {isMaster && (
                                    <button
                                        type="button"
                                        className="car_del mt-1"
                                        onClick={() => { void handleDelete(row); }}
                                    >
                                        削除
                                    </button>
                                )}
                                {openingNo === row.no && <span className="car_note d-block mt-1">開いています…</span>}
                            </div>
                        ))}
                    </div>

                    <div className="car_view">
                        {opened === null ? (
                            <div className="car_empty">左の一覧からレポートを選んでください。</div>
                        ) : (
                            <>
                                <div className="car_view_head">
                                    <span className="fw-bold" style={{ fontSize: '13px' }}>{opened.title}</span>
                                    {/* ⚠️ 演出の外。⚠️ **常に出す** */}
                                    {dataNote !== '' && <span className="car_asof">{dataNote}</span>}
                                </div>

                                {showBody ? (
                                    /**
                                     * ⚠️⚠️ **sandbox は allow-scripts だけにすること。**
                                     *   ⚠️ グラフを描くスクリプトは動かす必要がある。
                                     *   ⚠️ ⚠️ **allow-same-origin を足すと、レポートの中から
                                     *     ダッシュボードのログイン情報を読めてしまう。**
                                     */
                                    <iframe
                                        className="car_frame"
                                        title={opened.title}
                                        sandbox="allow-scripts"
                                        srcDoc={opened.html}
                                    />
                                ) : (
                                    <div className="car_steps">
                                        {STEPS.map((text, index) => (
                                            <span
                                                key={text}
                                                className={`car_step${index < step ? ' is_done' : ''}`}
                                                style={{ opacity: index <= step ? 1 : 0.25 }}
                                            >
                                                <span className="car_dot" />
                                                {text}
                                                {index < step && <i className="fa-solid fa-check ms-1" aria-hidden="true" />}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompetitorAnalysisReports;
```

### ⚠️ 3-4. `backend/scripts/sql/2026-09-21_analysis_report.sql`

```sql
-- =====================================================================
-- analysis_report: Claude が書いた分析レポート（HTML）を保存する
--
-- ⚠️⚠️ **本文（HTML）をこの表に丸ごと入れる**（2026-09-21 の指示）。
--   ⚠️ ファイルとして ① に置く案もあったが、利用者が DB を選んだ。
--   ⚠️ ⚠️ **1件60KB前後になる。** ⚠️ 溜まってきたら古い版の整理を検討すること。
--
-- ⚠️ 入り口は2つある:
--   ⚠️ 1. ② の `POST /api/v1/analysis/report`（MCP から。⚠️ analysisKey 認証）
--   ⚠️ 2. 画面からの手動アップロード（他社動向 → Claudeによる競合分析）
--
-- ⚠️⚠️ **この HTML は画面で iframe の中に出す。**
--   ⚠️ ⚠️ **`sandbox="allow-scripts"` を必ず付け、`allow-same-origin` は付けないこと。**
--     ⚠️ 付けると、レポートの中のスクリプトから
--       ⚠️ **ダッシュボードのログイン情報を読めてしまう。**
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================

CREATE TABLE IF NOT EXISTS analysis_report (
  no          INT(11)      NOT NULL AUTO_INCREMENT,
  -- 画面の一覧に出す見出し。例: 競合別 勝因・敗因分析（前期）
  title       VARCHAR(255) NOT NULL,
  -- 分析の種類。いまは 'competitor' のみ。増えたら足す
  category    VARCHAR(64)  NOT NULL DEFAULT 'competitor',
  -- 'order'（注文事業）/ 'kaeru'（建売分譲事業）/ ''（全社）
  division    VARCHAR(32)  NOT NULL DEFAULT '',
  -- 分析の対象期間。⚠️ 自由記述（例: 2025/06〜2026/05）
  period      VARCHAR(64)  NOT NULL DEFAULT '',
  -- ⚠️⚠️ **HTML の本文そのもの**
  html        LONGTEXT     NOT NULL,
  -- 登録者（スタッフ名、または 'MCP'）
  staff       VARCHAR(128) NOT NULL DEFAULT '',
  -- ⚠️ 分析に使ったデータの時点。⚠️ **画面に必ず出す**（最新だと誤解させないため）
  data_as_of  DATE         DEFAULT NULL,
  created     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (no),
  KEY idx_category (category),
  KEY idx_created (created)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## ⚠️ 4. 足したルート

### ⚠️ 4-1. ② の `/api/v1/analysis/*`（⚠️ **MCP 用。`analysisKey` 認証**）

| メソッド | パス | 何をするか |
|---|---|---|
| GET | ⚠️ **`/analysis/competitor`** | ⚠️ 競合の記録がある商談（⚠️ **伏字済み・タブ区切り**） |
| GET | ⚠️ **`/analysis/report/spec`** | ⚠️ **HTML の書き方と保存のしかた** |
| GET | `/analysis/report` | 保存済みの一覧（⚠️ 本文なし） |
| GET | `/analysis/report/:no` | 1件（本文つき） |
| POST | ⚠️ **`/analysis/report`** | ⚠️ **HTML を保存する** |

⚠️ `GET /analysis/competitor` の `meta` には ⚠️ **データ品質の注意点**を必ず添えている。
⚠️ ⚠️ **Claude Desktop には画面の文脈が無い。**
⚠️ **「勝率をこの数から計算するな」などは書いておかないと必ず誤読される。**

### 4-2. 画面用の request（gateway）

| request | 権限 | 何をするか |
|---|---|---|
| `analysis_report_list` | staff | 一覧（⚠️ 本文なし） |
| `analysis_report_get` | staff | 1件（本文つき） |
| ⚠️ `analysis_report_upload` | ⚠️ **master** | ⚠️ 画面から HTML を登録 |
| ⚠️ `analysis_report_delete` | ⚠️ **master** | 削除 |

⚠️⚠️ **① に PHP ハンドラは無い。Express 専用である。**
⚠️ そのため `express_proxy.php` の ⚠️ **`expressProxyRequests()` と
`expressProxyExclusive()` の両方**に入れてある。

```php
        // -----------------------------------------------------------------
        // 2026-09-21 追加。分析レポート（Claude が書いた HTML）。
        //
        // ⚠️⚠️ **① に PHP ハンドラは無い。最初から Express だけにある。**
        //   ⚠️ そのため ⚠️ **expressProxyExclusive() にも入れてある。**
        //   ⚠️ ⚠️ **片方だけだと、② が落ちたときに ① が404を返して画面が壊れる。**
        //     ⚠️ 両方に入れておけば、502 が返って「接続できません」と出る。
        // -----------------------------------------------------------------
        'analysis_report_list',
        'analysis_report_get',
        'analysis_report_upload',
        'analysis_report_delete',
```

---

## ⚠️ 5. 画面の作り

### ⚠️ 5-1. 段階表示（⚠️ **推論しているように見せる**）

⚠️ 利用者の指示:

> レンダリングが遅くなることで推論しているかのようなUXをつくれるので

⚠️ 開くと5段の経過を順に出し、そのあと本文を出す。

```
商談データを読み込んでいます
競合欄と面談シートから他社名を拾っています
他社別に勝敗を集計しています
敗因の構成を整理しています
レポートを組み立てています
```

⚠️⚠️ **実際には保存済みの HTML を出しているだけで、通信も課金も発生しない。**

⚠️ ⚠️ **2回目以降は演出を飛ばす**（`seen` の `useRef`）。
⚠️ **見返すたびに待たされると資料として使えないため。**

### ⚠️ 5-2. 「いつ時点のデータか」を必ず出す

⚠️⚠️ **演出で「いま推論した」ように見えると、中身が最新だと誤解される。**

⚠️ そのため ⚠️ **演出の外側に、対象期間とデータの時点を常時出している**（`car_asof`）。

### ⚠️ 5-3. iframe の閉じ込め

⚠️⚠️ **レポートの HTML は「こちらが書いたコード」ではない。**

```tsx
<iframe
    className="car_frame"
    title={opened.title}
    sandbox="allow-scripts"
    srcDoc={opened.html}
/>
```

⚠️ ⚠️ **`allow-same-origin` を足さないこと。**
⚠️ 足すと、⚠️ **レポートの中のスクリプトからダッシュボードのログイン情報を読める。**

⚠️ グラフを描くスクリプトは動かす必要があるので `allow-scripts` は要る。
⚠️ サーバー側では ⚠️ **中身を検査していない**。⚠️ **検査で防ぐ設計にしない**（必ず抜け道が残る）。

---

## ⚠️ 6. 消したもの（課金の発生源）

| ファイル | 消したもの |
|---|---|
| ⚠️ `backend/src/handlers/kpi_analyze.php` | ⚠️ `case 'competitor'` / `KPI_COMPETITOR_SCHEMA` / `KPI_COMPETITOR_PROMPT` |
| ⚠️ `backend/src/core/kpi.php` | ⚠️ **競合分析の節まるごと**（定数・伏字・スナップショット） |
| ⚠️ `frontend/.../ClaudeAnalysis.tsx` | ⚠️ `AVAILABLE` / `IMPLEMENTED` から `'competitor'`、`initialType`、枠の強調 |

⚠️ ⚠️ **`ClaudeAnalysisResult.tsx` の勝敗表は残した**（保存済みの分析を開くため）。

---

## ⚠️ 検証（2026-09-21 にローカルで実施）

### ⚠️ 個人情報

⚠️ ⚠️ **台帳の氏名3万件と突き合わせた。**

| | 結果 |
|---|---|
| ⚠️ **氏名の残り** | ⚠️ **0件** |
| ⚠️ メールの残り | ⚠️ **0件** |
| ⚠️ 9桁以上つながった数字 | ⚠️ **0件** |
| ⚠️ **他社名が壊れた形（`****ホームズ` 等）** | ⚠️ **0件** |

### API

| 確認 | 結果 |
|---|---|
| `GET /analysis/competitor?division=order&months=12` | ⚠️ **HTTP 200 / 614件 / 約74,000トークン** |
| `GET /analysis/report/spec` | ⚠️ **HTTP 200**（6節） |
| `POST /analysis/report` | ⚠️ **HTTP 200・`{"no":1}`** |
| `GET /analysis/report` / `/report/1` | ⚠️ **一覧・本文とも取得できた** |
| ⚠️ **認証なしで叩く** | ⚠️ **401** |
| ⚠️ ① 経由（`analysis_report_list`） | ⚠️ **401**（＝ ② まで届いている） |

⚠️ 検証に使った API キーは ⚠️ **一時的に作り、確認後に削除した**。⚠️ **値はどこにも書き出していない。**

### その他

| 確認 | 結果 |
|---|---|
| `npx tsc --noEmit`（backend-express） | ⚠️ **エラー0件** |
| `php -l`（kpi.php / kpi_analyze.php / express_proxy.php） | ⚠️ **エラー0件** |
| `npm run build` | ⚠️ **成功** |

⚠️ ⚠️ **Claude は一度も呼んでいない**（課金なし）。

---

## ⚠️ 未実施（ブラウザでの確認）

- [ ] 他社動向 →〈ロゴ〉による競合分析 が ⚠️ **Master にだけ**出るか
- [ ] ⚠️ **全画面で開くか**（左に一覧・右に本文）
- [ ] ⚠️ **レポートを登録**（HTMLを選ぶ → 見出しが自動で入る → 登録）
- [ ] ⚠️ 一覧に出るか。⚠️ **事業・期間・登録者の札**が正しいか
- [ ] ⚠️⚠️ **開いたときに5段の経過が出て、そのあと本文が出るか**
- [ ] ⚠️ **2回目は演出が飛ぶか**
- [ ] ⚠️ **「〇〇時点のデータ」が本文の外に常時出ているか**
- [ ] ⚠️ **参考資料の HTML（グラフ入り）を登録して、中で動くか**
- [ ] ⚠️ 削除できるか（⚠️ 確認ダイアログが出るか）
- [ ] ⚠️ Master 以外で登録・削除が出ないか
- [ ] ⚠️ **Claudeによる分析（ヘッダー）から competitor が選べなくなっているか**
- [ ] ⚠️ **保存済みの競合分析（履歴）が今までどおり開けるか**（⚠️ 課金なし）

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **MCP サーバー側に、この2つの口を使う道具を足す必要がある**（`/analysis/competitor` と `/analysis/report`） |
| 2 | ⚠️ 建売分譲事業は ⚠️ **競合の記録が実質ゼロ**（実測5件）。⚠️ 入力運用から |
| 3 | ⚠️ `consulting` 権限で全レスポンスを伏字にする件（⚠️ **次の版**） |
| 4 | ⚠️ 1件60KB を DB に積む。⚠️ **溜まってきたら古い版の整理を検討** |
| 5 | ⚠️ ⚠️ **`analysis_report` テーブルを ① に作らないと画面が動かない** |
