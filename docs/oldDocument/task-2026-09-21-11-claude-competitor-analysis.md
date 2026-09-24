# Claudeによる競合分析（v2.2.141）

⚠️ 指示（`ReadMeClaude.md`）のうち、⚠️ **今回やったのは1つ目だけ**（利用者が「①だけで」と決定）。

> - `frontend/src/header/` ディレクトリ改修
>   * 他社動向 → リストの一番下に **Claudeによる競合分析** を追加。デザインは Header.tsx と同じもの（ロゴ＋による分析）
>   * 参考は `KHG競合別勝敗分析_前期2026年5月期.html` / `シリウス競合勝敗分析_2609 (2).html`
>   * master_data を利用。集計値だけだとこのレベルの分析はできないので、個人情報以外の顧客データを渡す、もしくは個人情報の箇所をアスタリスクでマスクする
>   * 機能権限は authority === Master のみ
> - 分析API（バックエンド）の改修：master_data_kaeru、つまり建売部門での推論も可能にする

⚠️ ⚠️ **次の版に回したもの**（利用者の判断）:
⚠️ `consulting` 権限で全レスポンスをマスクする件と、Express `/analysis`（MCP用）の建売対応。

---

## ⚠️ 触ったファイル

| ディレクトリ | ファイル | 種別 |
|---|---|---|
| `backend/src/core/` | ⚠️ **`kpi.php`** | ⚠️ 追加（競合分析の節・約380行） |
| `backend/src/handlers/` | ⚠️ **`kpi_analyze.php`** | ⚠️ 追加（スキーマ・プロンプト・分岐） |
| `frontend/src/components/header/` | ⚠️ **`Header.tsx`** | ⚠️ メニュー追加 |
| 同上 | ⚠️ **`ClaudeAnalysis.tsx`** | ⚠️ competitor を有効化・`initialType` |
| 同上 | ⚠️ **`ClaudeAnalysisResult.tsx`** | ⚠️ 勝敗表を追加 |
| `frontend/src/utils/` | `version.ts` | ⚠️ 2.2.141 |
| `backend/scripts/sql/` | ⚠️ **`2026-09-21_update_log_2.2.141.sql`** | ⚠️ 新規 |

---

## ⚠️ 0. 土台はすでにあった

⚠️ ⚠️ **`ClaudeAnalysis.tsx` に `competitor`（他社動向を分析）という項目は元からあり、
グレーアウトされていた。** ⚠️ 今回それを実装した形である。

| もとからあった物 | 中身 |
|---|---|
| `Division` 型 | ⚠️ **`order` / `kaeru` が既にある** |
| `KPI_DIVISIONS`（kpi.php） | ⚠️ **`master_data_kaeru` が定義済み** |
| `kpi_analyze.php` | ⚠️ **`requireMaster()`・1日20回の上限・課金ログ** |

⚠️ したがって「Master のみ」は ⚠️ **サーバー側で既に担保されている。**
⚠️ ⚠️ **画面でメニューを隠すのは目隠しにすぎない**ので、両方でやっている。

---

## ⚠️ 1. いちばん大事な設計の変更

⚠️ `backend/src/core/kpi.php` の冒頭には ⚠️ **「生データは渡さない」と書いてある。**
⚠️ ⚠️ **競合分析だけはこれを破り、顧客1件ごとの行を渡す**（指示）。

> 集計値だけだとこのレベルの分析はできないので、個人情報以外の顧客データを渡す、
> もしくは個人情報の箇所をアスタリスクでマスクする

⚠️ 「誰にどの理由で負けたか」は ⚠️ **自由記述の失注理由と商談メモの中にしかない。**

⚠️ ⚠️ **そのかわり、個人を特定できる値は1つも渡していない。**（検証は下の「検証」節）

---

## ⚠️ 2. 実データで分かったこと（作りに影響した）

### ⚠️ 2-1. 建売分譲事業には競合の記録がほぼ無い

```
建売 競合記録あり(全体)  : 2件
建売 失注理由あり        : 0件
建売 status に「失注」   : 無い（いちばん近いのは「追客終了」3,132件）
```

⚠️ ⚠️ **建売で分析を実行すると、集められる商談は5件しかない**（実測）。

→ ⚠️ **`KPI_COMPETITOR_MIN_ROWS = 20` に満たなければ、Claude を呼ばずに断る。**
⚠️ ⚠️ **投げてしまうと、金だけかかって「データがありません」と返ってくる。**

⚠️ 指示の「建売でも推論可能に」は ⚠️ **仕組みとしては入れた**が、
⚠️ ⚠️ **記録が増えるまでは実行できない。** ⚠️ 画面には件数と理由が出る。

### ⚠️ 2-2. house_maker には自社の社名も入っている

⚠️ 最初の実装では ⚠️ **「国分ハウジング」が最大の競合として集計された**
（⚠️ 注文71件・建売163件で1位）。⚠️ **商談メモに自社名はいくらでも出てくる。**

→ `KPI_OWN_GROUP_NAMES` で ⚠️ **`own_group` という別の欄に分けた。**
⚠️ 消してはいない。⚠️ **グループ内での取り合いは、それ自体が見たい情報**だからである。
⚠️ ⚠️ **「ジャストホーム」は自社ではない**（シアーズホーム系の他社）。入れていない。

### ⚠️ 2-3. 日付順に切ると負けばかりになる

⚠️ 1本のクエリを新しい順に1,000件で切ったところ ⚠️ **勝ち112 / 負け888** になり、
⚠️ **勝敗表として成立しなかった。**

→ ⚠️ **勝ちと負けを別のクエリで取り、それぞれ500件の枠**を与えた。
⚠️ 結果は ⚠️ **勝ち342 / 負け500**（注文・直近24ヶ月）。

⚠️ ⚠️ **枠に達した側は全件ではないので、この2つから勝率を計算してはいけない。**
⚠️ `counts.truncated` で Claude にも画面にも伝えている。

### ⚠️ 2-4. メモの先頭は反響フォームの定型文

⚠️ 頭から160文字を切ると ⚠️ **「反響経路:… 検討時期:… 希望の広さ:…」だけで終わり、
商談の中身が1文字も入らなかった。**

→ ⚠️ **他社名が出てくる場所の前後**を切り出す（`kpiMemoAround`）。

---

## ⚠️ 3. 追加した関数（`backend/src/core/kpi.php`・そのまま）

### ⚠️ 3-1. 定数

```php
/**
 * 1回の分析で渡す行数の上限。
 *
 * ⚠️⚠️ **増やすと課金が比例して増える。**
 *   ⚠️ 1行あたり約100トークン。1,000行で約10万トークンになる。
 *   ⚠️ ⚠️ **Master 権限・1日20回の上限があるとはいえ、実費が出る。**
 */
const KPI_COMPETITOR_MAX_ROWS = 1000;

/** 商談メモ・架電ログから拾う文字数。⚠️ 長くすると課金が増える */
const KPI_COMPETITOR_MEMO_CHARS = 160;

/**
 * これ未満の行数しか集まらなければ、Claude を呼ばずに断る。
 *
 * ⚠️⚠️ **建売分譲事業は競合の記録がほとんど無い**（2026-09-21 実測で2件）。
 *   ⚠️ このまま投げると ⚠️ **金だけかかって「データがありません」と言われる。**
 */
const KPI_COMPETITOR_MIN_ROWS = 20;

/**
 * 伏字にする列。
 *
 * ⚠️⚠️ **ここに挙げた列は SELECT はするが、渡す行には入れない。**
 *   ⚠️ 自由記述に紛れた同じ値を消すために値そのものは必要なため、取得はする。
 */
const KPI_COMPETITOR_PII_COLUMNS = [
    'customer_contacts_name',
    'customer_contacts_name_kana',
    'customer_contacts_name_2',
    'customer_contacts_mobile_phone_number',
    'customer_contacts_phone_number',
    'customer_contacts_email',
    'full_address',
    'planned_construction_site',
];

/**
 * 部門ごとの競合関連の列。
 *
 * ⚠️⚠️ **建売分譲事業（master_data_kaeru）には勝因・価格差・対策の列が無い。**
 *   ⚠️ 注文事業（master_data）にしか存在しない。
 *   ⚠️ ⚠️ **両方に投げると「Unknown column」で落ちる。**
 */
const KPI_COMPETITOR_EXTRA_COLUMNS = [
    'order' => [
        'competitor_win_reason'     => 'win_reason',
        'competitor_price_gap'      => 'price_gap',
        'competitor_sales_person'   => 'rival_sales_person',
        'competitor_countermeasure' => 'countermeasure',
        'competitor_campaign'       => 'rival_campaign',
    ],
    'kaeru' => [],
];

/**
 * 勝ち負けを決めるステータス。
 *
 * ⚠️⚠️ **ここに無いステータスの行は渡さない。**
 *   ⚠️ 「見込み」「会社管理」はまだ決着していない（注文の約8割がこれ）。
 *     ⚠️ ⚠️ **負けに数えると、負けが実際の5倍以上に膨らむ。**
 *   ⚠️ 「重複」は同一顧客の二重登録なので数えない。
 *
 * ⚠️⚠️ **建売分譲事業には「失注」というステータスが無い**（2026-09-21 実測）。
 *   ⚠️ いちばん近いのが「追客終了」なので、これを負けとして扱う。
 *   ⚠️ ⚠️ **追客終了は他社に負けたとは限らない**（予算・時期の都合も含む）。
 *     ⚠️ このことは Claude にも note で伝えている。
 */
const KPI_COMPETITOR_STATUSES = [
    'order' => [
        'win'  => ['契約済み', '解約', '解約済み'],
        'lost' => ['失注'],
    ],
    'kaeru' => [
        'win'  => ['契約済み', '解約', '解約済み'],
        'lost' => ['追客終了'],
    ],
];

/**
 * 自社グループの社名。
 *
 * ⚠️⚠️ **house_maker には自社の社名も登録されている。**
 *   ⚠️ 除外しないと ⚠️ **「国分ハウジング」が最大の競合として集計される**
 *     （2026-09-21 実測: 注文71件・建売163件で1位だった）。
 *   ⚠️ ⚠️ **商談メモには自社名がいくらでも出てくるため、必ず外れる。**
 *
 * ⚠️ 消すのではなく `own_group` として別の欄に出す。
 *   ⚠️ **グループ内での取り合いは、それ自体が見たい情報**だからである。
 * ⚠️ ⚠️ **「ジャストホーム」は自社ではない**（シアーズホーム系の他社）。入れないこと。
 */
const KPI_OWN_GROUP_NAMES = [
    '国分ハウジング',
    'デイジャストハウス',
    'なごみ工務店',
    'PGハウス',
    'かえるホーム',
];

/** 伏字の記号。⚠️ 画面にもこの形で出る */
const KPI_MASK = '****';
```

### ⚠️ 3-2. `kpiMaskPii()` — 個人情報を伏字にする

```php
/**
 * 個人情報を伏字にする。
 *
 * ⚠️⚠️ **自由記述（商談メモ・架電ログ・失注理由）に対して必ず通すこと。**
 *   ⚠️ 顧客名や電話番号が本文に書かれていることが実際にある。
 *
 * ⚠️ 消すもの:
 *   ⚠️ その顧客自身の氏名・カナ・電話・メール・住所・物件名（$secrets）
 *   ⚠️ メールアドレスの形をしたもの
 *   ⚠️ 数字が9桁以上つながっているもの（電話番号・口座番号）
 *
 * @param string[] $secrets その行の個人情報の値
 */
function kpiMaskPii(string $text, array $secrets): string
{
    if ($text === '') {
        return '';
    }

    foreach ($secrets as $secret) {
        $secret = trim((string)$secret);
        // ⚠️ 1〜2文字を消すと日本語の本文が虫食いになる。氏名は2文字以上ある
        if (mb_strlen($secret) < 3) {
            continue;
        }

        // まず書かれたとおりの形で消す
        $text = str_replace($secret, KPI_MASK, $text);

        /**
         * ⚠️⚠️ **文字の間に空白が入っていても消すこと。**
         *   ⚠️ 台帳が「甲斐 彩香」でも、メモには「甲斐彩香」「甲斐　彩香」と
         *     書かれていることがある。
         *   ⚠️ ⚠️ **str_replace だけでは素通りする**（2026-09-21 に実データで1件漏れた）。
         *
         * ⚠️ ⚠️ **空白を除いて3文字未満のものには、この処理をかけない。**
         *   ⚠️ 「吉 田」のような名前で `吉田` を全部伏字にすると、
         *     ⚠️ **本文中の地名・他社名まで虫食いになる。**
         */
        $flat = (string)preg_replace('/[\s　]+/u', '', $secret);
        if (mb_strlen($flat) < 3) {
            continue;
        }

        $chars = preg_split('//u', $flat, -1, PREG_SPLIT_NO_EMPTY);
        if ($chars === false || $chars === []) {
            continue;
        }
        $pattern = '/' . implode(
            '[\s　]*',
            array_map(static fn(string $c): string => preg_quote($c, '/'), $chars)
        ) . '/u';
        $text = (string)preg_replace($pattern, KPI_MASK, $text);
    }

    $text = (string)preg_replace('/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u', KPI_MASK, $text);
    // ⚠️ ハイフン・空白をまたいだ数字の並びも電話番号として扱う
    $text = (string)preg_replace('/[0-9０-９][0-9０-９\-－ 　]{7,}[0-9０-９]/u', KPI_MASK, $text);

    return $text;
}
```

### ⚠️ 3-3. `kpiMaskKnownNames()` — 他の顧客の氏名も消す

⚠️⚠️ **これが無いと、実データで氏名が漏れる。** ⚠️ 実際に1件漏れた。

```php
/**
 * 台帳にある氏名を、渡す文章から一括で消す。
 *
 * ⚠️⚠️ **kpiMaskPii() は「その行自身の」氏名しか消せない。**
 *   ⚠️ 商談メモには ⚠️ **別の顧客の名前**（紹介者・同行者・過去の担当案件）が
 *     書かれていることが実際にある。
 *   ⚠️ ⚠️ **2026-09-21 の実データで1件漏れた。** ⚠️ 行ごとの処理では防げない。
 *
 * ⚠️ 手順（総当たりを避けるため2段階にしている）:
 *   ⚠️ 1. 渡す文章を全部つないで、空白を除いた1本の文字列にする
 *   ⚠️ 2. 台帳の氏名をその文字列で探し、⚠️ **実際に出てくるものだけ**を置換する
 *   ⚠️ 台帳は3万件あるが、1 の文字列は数十KBなので探すのは速い。
 *
 * ⚠️ ⚠️ **自社の営業担当の名前も、顧客として登録があれば一緒に消える。**
 *   ⚠️ 競合分析に担当者名は要らないため、消えて困らない。
 *
 * @param string[] $textKeys 伏字をかける項目名
 */
function kpiMaskKnownNames(PDO $pdo, array $rows, array $textKeys): array
{
    $blob = '';
    foreach ($rows as $r) {
        foreach ($textKeys as $key) {
            $blob .= ' ' . (string)($r[$key] ?? '');
        }
    }

    $flatBlob = (string)preg_replace('/[\s　]+/u', '', $blob);
    if ($flatBlob === '') {
        return $rows;
    }

    // ⚠️ 3事業ぶん見る。⚠️ **注文のメモに建売の顧客名が出ることがある**
    $names = $pdo->query(
        'SELECT customer_contacts_name FROM master_data'
        . ' UNION SELECT customer_contacts_name FROM master_data_kaeru'
        . ' UNION SELECT customer_contacts_name FROM master_data_resale'
    )->fetchAll(PDO::FETCH_COLUMN);

    $hits = [];
    foreach ($names as $name) {
        $flat = (string)preg_replace('/[\s　]+/u', '', trim((string)$name));
        // ⚠️ 2文字以下は本文の普通の語と当たる。消すと虫食いになる
        if (mb_strlen($flat) < 3) {
            continue;
        }
        if (mb_strpos($flatBlob, $flat) !== false) {
            $hits[] = $flat;
        }
    }

    if ($hits === []) {
        return $rows;
    }

    $hits = array_values(array_unique($hits));
    foreach ($rows as $i => $r) {
        foreach ($textKeys as $key) {
            $value = (string)($r[$key] ?? '');
            if ($value !== '') {
                $rows[$i][$key] = kpiMaskPii($value, $hits);
            }
        }
    }

    return $rows;
}
```

### 3-4. `kpiMemoAround()` — 他社名の前後を切り出す

```php
/**
 * 他社名の前後を切り出す。
 *
 * ⚠️⚠️ **メモの先頭は反響フォームの定型文である。**
 *   ⚠️ 「反響経路:… 検討時期:… 希望の広さ:…」が数百文字続き、
 *     ⚠️ ⚠️ **頭から切ると、肝心の商談の中身が1文字も入らない。**
 *   ⚠️ そこで ⚠️ **他社名が出てくる場所の前後**を取る。
 *
 * ⚠️ 他社名が見つからなければ、従来どおり先頭から切る。
 *
 * @param string[] $makers 見つかった他社名
 */
function kpiMemoAround(string $text, array $makers, int $limit = KPI_COMPETITOR_MEMO_CHARS): string
{
    $text = trim((string)preg_replace('/\s+/u', ' ', $text));
    if ($text === '' || $text === 'null' || $text === '0') {
        return '';
    }
    if ($makers === [] || mb_strlen($text) <= $limit) {
        return kpiTrimMemo($text, $limit);
    }

    $at = false;
    foreach ($makers as $maker) {
        $found = mb_strpos($text, $maker);
        if ($found !== false && ($at === false || $found < $at)) {
            $at = $found;
        }
    }
    if ($at === false) {
        return kpiTrimMemo($text, $limit);
    }

    // ⚠️ 社名の少し手前から取る。⚠️ **理由は社名の前に書かれていることが多い**
    $start = max(0, $at - (int)floor($limit / 3));
    $cut   = mb_substr($text, $start, $limit);

    return ($start > 0 ? '…' : '') . $cut . (mb_strlen($text) > $start + $limit ? '…' : '');
}
```

### ⚠️ 3-5. その他の小さな関数

```php
/** 自由記述を分析に載る長さへ詰める */
function kpiTrimMemo(string $text, int $limit = KPI_COMPETITOR_MEMO_CHARS): string
{
    $text = trim((string)preg_replace('/\s+/u', ' ', $text));
    // ⚠️ remarks には 'null' や '0' が入っている行がある。⚠️ **本文ではない**
    if ($text === '' || $text === 'null' || $text === '0') {
        return '';
    }
    return mb_strlen($text) > $limit ? mb_substr($text, 0, $limit) . '…' : $text;
}

/**
 * 他社名の一覧（house_maker.label）。
 * ⚠️ 2文字以下の社名は本文の別の語に当たるため使わない。
 */
function kpiCompetitorMakers(PDO $pdo): array
{
    $labels = $pdo->query('SELECT label FROM house_maker')->fetchAll(PDO::FETCH_COLUMN);

    $makers = [];
    foreach ($labels as $label) {
        $label = trim((string)$label);
        if (mb_strlen($label) >= 3) {
            $makers[] = $label;
        }
    }

    return array_values(array_unique($makers));
}

/** 文字列から他社名を拾う */
function kpiFindMakers(string $text, array $makers): array
{
    if ($text === '') {
        return [];
    }

    $found = [];
    foreach ($makers as $maker) {
        if (mb_strpos($text, $maker) !== false) {
            $found[] = $maker;
        }
    }

    return $found;
}

/** 競合欄（カンマ・読点区切り）を配列にする */
function kpiSplitCompetitors(string $text): array
{
    $text  = str_replace('、', ',', $text);
    $parts = array_map('trim', explode(',', $text));

    return array_values(array_filter($parts, static fn(string $v): bool => $v !== '' && $v !== 'null'));
}

/** 失注日（テキスト）から 'YYYY-MM' を取り出す。取れなければ null */
function kpiCompetitorLostMonth(string $value): ?string
{
    $value = str_replace('/', '-', trim($value));
    return preg_match('/^(\d{4}-\d{2})/', $value, $m) === 1 ? $m[1] : null;
}

/**
 * 土地の有無。
 * ⚠️ 入力が「有」「無」「1」「0」と揺れているため、文字で判定する。
 */
function kpiCompetitorHasLand(string $value): string
{
    $value = trim($value);
    if ($value === '' || $value === 'null') {
        return '未入力';
    }
    if (mb_strpos($value, '無') !== false || $value === '0') {
        return 'なし';
    }
    return 'あり';
}

/**
 * 予算を帯にまとめる。
 *
 * ⚠️⚠️ **金額そのものは渡さない。**
 *   ⚠️ 帯にすれば傾向は読めるうえ、⚠️ **個人の特定に近づかない。**
 * ⚠️ 入力は「4000万」「40,000,000」などと揺れるため、数字だけを取り出して判定する。
 */
function kpiCompetitorBudgetBand(string $value): string
{
    $digits = preg_replace('/[^0-9]/', '', $value);
    if ($digits === '' || $digits === null) {
        return '未入力';
    }

    $number = (int)$digits;
    // ⚠️ 「4000」のような万円単位の入力を円に直す
    if ($number < 100000) {
        $number *= 10000;
    }

    if ($number < 25000000) {
        return '2500万未満';
    }
    if ($number < 30000000) {
        return '2500〜3000万';
    }
    if ($number < 35000000) {
        return '3000〜3500万';
    }
    if ($number < 40000000) {
        return '3500〜4000万';
    }
    if ($number < 45000000) {
        return '4000〜4500万';
    }
    if ($number < 50000000) {
        return '4500〜5000万';
    }
    return '5000万以上';
}
```

### ⚠️ 3-6. `buildCompetitorSnapshot()` — 本体

```php
/**
 * 「競合分析」用のスナップショット。
 *
 * ⚠️⚠️ **集計値ではなく、契約と失注の行そのものを渡す**（2026-09-21 の指示）。
 *   ⚠️ 勝敗表・敗因の構成は Claude 側で作らせる。
 *
 * ⚠️ 渡す行の条件:
 *   ⚠️ 競合欄・他決先・失注理由のどれかが入っている、または
 *   ⚠️ **商談メモ・架電ログに他社名が見つかった**行。
 *   ⚠️ ⚠️ **どちらも無い行は渡さない**（競合戦ではないため）。
 *
 * @param int $months 何ヶ月分さかのぼるか
 */
function buildCompetitorSnapshot(
    PDO $pdo,
    string $division = KPI_DEFAULT_DIVISION,
    array $scope = [],
    int $months = 12
): array {
    $table  = kpiResolveTable($division);
    $extra  = KPI_COMPETITOR_EXTRA_COLUMNS[$division] ?? [];
    $makers = kpiCompetitorMakers($pdo);

    [$scopeSql, $scopeParams] = kpiScopeWhere($scope);

    // ⚠️ 契約日・反響日・失注日のどれかが期間内にあるものを拾う。
    //   ⚠️ **契約日だけで絞ると、失注（契約日が無い）が1件も入らない。**
    $from = date('Y-m-d', strtotime('-' . $months . ' months'));

    $select = [
        'status',
        'in_charge_store',
        'brand',
        'sales_promotion_name',
        'has_owned_land',
        'budget',
        KPI_MD_RANK . ' AS rank_value',
        'competitors_text',
        'competitor_name',
        'competitor',
        'competitor_lost_contract_reason',
        'competitor_lost_contract_date',
        'remarks',
        'call_log',
        'DATE_FORMAT(' . KPI_MD_CONTRACT . ", '%Y-%m') AS contract_month",
        'DATE_FORMAT(' . KPI_MD_REGISTERED . ", '%Y-%m') AS registered_month",
    ];
    foreach (array_keys($extra) as $column) {
        $select[] = $column;
    }
    foreach (KPI_COMPETITOR_PII_COLUMNS as $column) {
        $select[] = $column;
    }

    /**
     * ⚠️⚠️ **勝ちと負けを別々に取る。**
     *   ⚠️ 1本のクエリを日付順に切ると、⚠️ **件数の多い負けばかりが残る。**
     *     ⚠️ 実測では 勝ち112 / 負け888 になり、勝敗表として成立しなかった。
     *   ⚠️ ⚠️ **半分ずつの枠を与えること。**
     */
    $statuses = KPI_COMPETITOR_STATUSES[$division] ?? KPI_COMPETITOR_STATUSES['order'];
    $quota    = (int)floor(KPI_COMPETITOR_MAX_ROWS / 2);

    $fetchByStatus = static function (array $wanted, int $limit) use (
        $pdo, $select, $table, $scopeSql, $scopeParams, $from
    ): array {
        $sql = 'SELECT ' . implode(', ', $select) . ' FROM ' . $table
            . ' WHERE show_dashboard = 1'
            . $scopeSql
            . ' AND status IN (' . implode(',', array_fill(0, count($wanted), '?')) . ')'
            . ' AND ('
            . KPI_MD_CONTRACT . ' >= ?'
            . ' OR ' . KPI_MD_REGISTERED . ' >= ?'
            . " OR REPLACE(COALESCE(competitor_lost_contract_date, ''), '/', '-') >= ?"
            . ')'
            // ⚠️ 競合の手がかりがまったく無い行は最初から取らない
            . ' AND ('
            . " COALESCE(competitors_text, '') NOT IN ('', 'null')"
            . " OR COALESCE(competitor_name, '') NOT IN ('', 'null')"
            . " OR COALESCE(competitor, '') NOT IN ('', 'null')"
            . " OR COALESCE(competitor_lost_contract_reason, '') NOT IN ('', 'null')"
            . " OR COALESCE(remarks, '') NOT IN ('', 'null')"
            . ')'
            . ' ORDER BY COALESCE(' . KPI_MD_CONTRACT . ', ' . KPI_MD_REGISTERED . ') DESC'
            // ⚠️ メモから社名を拾えない行が多いため、多めに取って PHP 側で絞る
            . ' LIMIT ' . ($limit * 4);

        $params = array_merge($scopeParams, $wanted, [$from, $from, $from]);

        return kpiFetch($pdo, $sql, $params);
    };

    $wonRaw  = $fetchByStatus($statuses['win'], $quota);
    $lostRaw = $fetchByStatus($statuses['lost'], $quota);

    $rows          = [];
    $fromMemoCount = 0;
    $candidates    = count($wonRaw) + count($lostRaw);
    $kept          = ['win' => 0, 'lost' => 0];

    foreach (array_merge($wonRaw, $lostRaw) as $r) {
        $secrets = [];
        foreach (KPI_COMPETITOR_PII_COLUMNS as $column) {
            $secrets[] = (string)($r[$column] ?? '');
        }

        $memo = kpiMaskPii(
            (string)($r['remarks'] ?? '') . ' ' . (string)($r['call_log'] ?? ''),
            $secrets
        );

        // 競合欄からの社名
        $named = array_merge(
            kpiSplitCompetitors((string)($r['competitors_text'] ?? '')),
            kpiSplitCompetitors((string)($r['competitor_name'] ?? '')),
            kpiSplitCompetitors((string)($r['competitor'] ?? ''))
        );
        // ⚠️ メモからの社名。⚠️ **競合欄が空の行を救うのはここだけ**
        $inMemo = kpiFindMakers($memo, $makers);
        if ($named === [] && $inMemo !== []) {
            $fromMemoCount++;
        }

        $all = array_values(array_unique(array_merge($named, $inMemo)));

        /**
         * ⚠️⚠️ **自社グループの社名を競合から外す。**
         *   ⚠️ 外さないと「国分ハウジング」が最大の競合として並ぶ。
         *   ⚠️ **捨てずに own_group として別に持つ**（社内での取り合いも見たいため）。
         */
        $ownGroup    = array_values(array_intersect($all, KPI_OWN_GROUP_NAMES));
        $competitors = array_values(array_diff($all, KPI_OWN_GROUP_NAMES));

        $lostReason = trim((string)($r['competitor_lost_contract_reason'] ?? ''));
        if ($lostReason === 'null') {
            $lostReason = '';
        }

        // ⚠️ 他社名も失注理由も無い行は競合戦の証拠が無い。渡さない
        //   ⚠️ **自社名しか出てこない行もここで落ちる**（競合戦ではない）
        if ($competitors === [] && $lostReason === '') {
            continue;
        }

        $status = (string)($r['status'] ?? '');
        $won    = in_array($status, $statuses['win'], true);

        // ⚠️ 片方だけで枠を使い切らないようにする
        $bucket = $won ? 'win' : 'lost';
        if ($kept[$bucket] >= $quota) {
            continue;
        }
        $kept[$bucket]++;

        $row = [
            'outcome' => $won ? 'win' : 'lost',
            'status'  => $status,
            'month'   => $won
                ? ($r['contract_month'] ?? $r['registered_month'])
                : (kpiCompetitorLostMonth((string)($r['competitor_lost_contract_date'] ?? ''))
                    ?? $r['registered_month']),
            'shop'        => (string)($r['in_charge_store'] ?? ''),
            'brand'       => (string)($r['brand'] ?? ''),
            'medium'      => (string)($r['sales_promotion_name'] ?? ''),
            'has_land'    => kpiCompetitorHasLand((string)($r['has_owned_land'] ?? '')),
            'budget'      => kpiCompetitorBudgetBand((string)($r['budget'] ?? '')),
            'rank'        => trim((string)($r['rank_value'] ?? '')),
            'competitors' => $competitors,
            'own_group'   => $ownGroup,
            'lost_reason' => $lostReason,
            // ⚠️ 他社名の前後を取る。⚠️ **頭から切るとフォームの定型文で埋まる**
            'memo'        => kpiMemoAround($memo, $all),
        ];

        foreach ($extra as $column => $key) {
            $value = trim((string)($r[$column] ?? ''));
            $row[$key] = ($value === 'null' || $value === '') ? '' : kpiMaskPii($value, $secrets);
        }

        $rows[] = $row;
        if (count($rows) >= KPI_COMPETITOR_MAX_ROWS) {
            break;
        }
    }

    /**
     * ⚠️⚠️ **最後にもう一度、台帳の氏名を消す。**
     *   ⚠️ 上の kpiMaskPii() は行ごとの氏名しか見ていない。
     *   ⚠️ ⚠️ **ここを外すと、他の顧客の氏名がメモに残ったまま送られる。**
     */
    $rows = kpiMaskKnownNames($pdo, $rows, array_merge(
        ['memo', 'lost_reason'],
        array_values($extra)
    ));

    $wins = $kept['win'];

    return [
        'generated_at'  => date('Y-m-d H:i'),
        'division'      => kpiDivisionLabel($division),
        'scope_label'   => $scope['label'] ?? kpiDivisionLabel($division),
        'scope'         => kpiScopeDescription($division, $scope),
        'period_months' => $months,
        'note'          => '1行が顧客1件。個人情報（氏名・電話・メール・住所・物件名）は列ごと外し、'
            . '商談メモに紛れているものは ' . KPI_MASK . ' に置き換えてある。'
            . 'competitors は競合欄と商談メモの両方から拾った他社名。'
            . 'own_group は国分ハウジンググループ自身の社名で、競合ではなくグループ内での取り合いを表す。'
            . 'outcome = win は ' . implode('・', $statuses['win']) . '、'
            . 'lost は ' . implode('・', $statuses['lost']) . '。決着していない案件と重複は含めていない。'
            . ($division === 'kaeru'
                ? '建売分譲事業には「失注」というステータスが無いため「追客終了」を負けとして扱っている。'
                . 'これは他社に負けたとは限らず、予算・時期の都合も含む。'
                : '')
            . 'wins と losses の上限はそれぞれ ' . (int)floor(KPI_COMPETITOR_MAX_ROWS / 2) . ' 件で、'
            . 'この数に達している側は全件ではない。勝率をこの2つの数から計算してはならない。'
            . 'lost_reason が空の行が多いのは入力されていないためで、理由が無いという意味ではない。'
            . 'memo は他社名の前後を切り出したもので、先頭に … があるのは途中からという意味。',
        'counts' => [
            'rows'            => count($rows),
            'wins'            => $wins,
            'losses'          => count($rows) - $wins,
            'quota_per_side'  => $quota,
            'candidates'      => $candidates,
            'found_from_memo' => $fromMemoCount,
            'max_rows'        => KPI_COMPETITOR_MAX_ROWS,
            // ⚠️ どちらかが枠いっぱいなら「全件ではない」。勝率の計算に使わせない
            'truncated'       => $wins >= $quota || (count($rows) - $wins) >= $quota,
        ],
        'rows' => $rows,
    ];
}
```

---

## ⚠️ 4. `kpi_analyze.php` に足した分岐（そのまま）

```php
        case 'competitor':
            $snapshot = buildCompetitorSnapshot($pdo, $division, $scope, $months);

            /**
             * ⚠️⚠️ **行が少なすぎるときは Claude を呼ばずに断る。**
             *   ⚠️ 建売分譲事業は競合の記録がほとんど無い（2026-09-21 実測で5件）。
             *   ⚠️ ⚠️ **このまま投げると、金だけかかって「データがありません」と返る。**
             *   ⚠️ 何件あったかを画面に出し、記録を増やすべきことが分かるようにする。
             */
            if ($snapshot['counts']['rows'] < KPI_COMPETITOR_MIN_ROWS) {
                http_response_code(400);
                echo json_encode([
                    'status'  => 'error',
                    'message' => $scopeIntro . 'で競合の記録がある商談は '
                        . $snapshot['counts']['rows'] . ' 件しかなく、分析できません（'
                        . KPI_COMPETITOR_MIN_ROWS . ' 件以上必要）。'
                        . '顧客詳細の競合欄・失注理由が入力されていない可能性があります。'
                        . '期間を広げるか、絞り込みを外してお試しください。',
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            $systemText = KPI_COMPETITOR_PROMPT . $scopeRule;
            $schema     = KPI_COMPETITOR_SCHEMA;
            $typeLabel  = '競合分析';
            $intro      = '以下は' . $scopeIntro . 'の、競合の記録がある商談'
                . $snapshot['counts']['rows'] . '件です。';
            break;
```

⚠️ スキーマ（`KPI_COMPETITOR_SCHEMA`）とプロンプト（`KPI_COMPETITOR_PROMPT`）は
⚠️ **`kpi_analyze.php` の上部に追加してある**（長いのでファイルを参照）。
⚠️ ⚠️ **スキーマは KPI_ANALYSIS_SCHEMA に `competitors` を足しただけの形**にしてある。
⚠️ 画面の他の部分を作り直さずに済むようにするため。

---

## ⚠️ 5. フロントの変更

### 5-1. `Header.tsx`

```tsx
/**
 * 他社動向メニューの最後に出す項目。
 *
 * ⚠️⚠️ **他の項目と違い、共通モーダル（editMapping）を使わない。**
 *   ⚠️ 押すと ⚠️ **Claudeによる分析のモーダル**が開く。
 *   ⚠️ ⚠️ **editMapping に足さないこと。** 足すと「準備中です」の画面が出る。
 *
 * ⚠️ 画面にはロゴ＋「による競合分析」で出す（ヘッダーの「による分析」と同じ形）。
 *   ⚠️ **この文字列そのものは画面に出さない。** 中で見分けるための鍵である。
 */
const CLAUDE_COMPETITOR_ITEM = 'Claudeによる競合分析';
```

```tsx
        // ⚠️ 最後の1つは Claude による競合分析。⚠️ **Master のみ**（課金が発生するため）
        '他社動向': authority === 'Master'
            ? ['他社広告ライブラリ', '他社資料', '競合サマリー', CLAUDE_COMPETITOR_ITEM]
            : ['他社広告ライブラリ', '他社資料', '競合サマリー'],
```

```tsx
    /**
     * モーダルを開いたときに目立たせる分析。
     *
     * ⚠️ 他社動向 →「競合分析」から開いたときだけ `'competitor'` を入れる。
     * ⚠️⚠️ **開いても分析は自動実行しない**（ClaudeAnalysis.tsx の initialType を参照）。
     */
    const [claudeInitial, setClaudeInitial] = useState<AnalysisType | undefined>(undefined);

    const openClaude = (initial?: AnalysisType): void => {
        if (authority !== 'Master') {
            alert('権限がありません');
            return;
        }
        setClaudeInitial(initial);
        setClaudeModal(true);
    };
```

```tsx
                                        // ⚠️ 競合分析だけは Claude のモーダルを開く。
                                        //   ⚠️ **共通モーダルに入れないこと**（editMapping に無いため「準備中」になる）
                                        if (item === CLAUDE_COMPETITOR_ITEM) {
                                            openClaude('competitor');
                                            return;
                                        }
```

```tsx
                                    {/* ⚠️ 競合分析はロゴ＋文言で出す（ヘッダーの「による分析」と同じ形） */}
                                    {item === CLAUDE_COMPETITOR_ITEM
                                        ? <span className="d-flex align-items-center" style={{ gap: '2px' }}>
                                            <ClaudeIcon height={14} />
                                            による競合分析
                                        </span>
                                        : item}
```

### ⚠️ 5-2. `ClaudeAnalysis.tsx` — ⚠️ **自動実行しない**

```tsx
type Props = {
    /**
     * 最初から目立たせておく分析。
     *
     * ⚠️ 他社動向 →「Claudeによる競合分析」から開いたときに `'competitor'` が来る。
     *
     * ⚠️⚠️ **これを受け取っても分析は自動では実行しない。**
     *   ⚠️ 実行は1回ごとに課金される。
     *   ⚠️ ⚠️ **開いた瞬間に走ると、部門・課・店舗を選ぶ前の範囲で課金される。**
     *     ⚠️ メニューの押し間違いでも金がかかる。
     *   ⚠️ 枠を目立たせるだけにして、⚠️ **実行は利用者のクリックに任せる。**
     */
    initialType?: AnalysisType;
};
```

```tsx
                        // ⚠️ 他社動向から開いたときだけ、その枠を目立たせる（実行はしない）
                        const spotlight = available && menu.type === initialType;
```

⚠️ あわせて `AVAILABLE` / `IMPLEMENTED` に `'competitor'` を追加し、
メニューの文言を ⚠️ **「競合分析 / 他社別の勝敗と、負けている理由」** に変えた。

### 5-3. `ClaudeAnalysisResult.tsx`

⚠️ `AnalysisKind` に `'competitor'` を足し、`CompetitorSnapshot` 型と
⚠️ **`CompetitorTable`（勝敗表）** を追加。
⚠️ `StructuredAnalysis` に ⚠️ **`competitors?`（省略可）** を足した。

```tsx
/**
 * 競合分析の見出しと勝敗表。
 *
 * ⚠️⚠️ **件数は Claude が数えた値である**（他の分析と違い、DBの集計値ではない）。
 *   ⚠️ 渡しているのが顧客1件ごとの行なので、⚠️ **社名の数え上げは Claude 側でしかできない。**
 *   ⚠️ ⚠️ **そのことを画面にも書くこと。** 集計値と同じ精度だと思われると困る。
 */
```

⚠️ 勝敗表は ⚠️ **負け越している相手が上**に来るように並べている。

---

## ⚠️ 検証

### ⚠️ 個人情報（いちばん大事）

⚠️ ⚠️ **台帳の氏名3万件と突き合わせて、1件も残っていないことを確認した。**

| 確認 | 注文事業 | 建売分譲事業 |
|---|---|---|
| ⚠️ **氏名の残り** | ⚠️ **0件** | ⚠️ **0件** |
| ⚠️ メールの残り | ⚠️ **0件** | ⚠️ **0件** |
| ⚠️ 9桁以上の数字 | ⚠️ **0件** | ⚠️ **0件** |

⚠️ ⚠️ **途中で2回、実際に漏れを見つけて直した。**

| 漏れ方 | 直し方 |
|---|---|
| ⚠️ 台帳が「甲斐 彩香」、メモが「甲斐彩香」 | ⚠️ **文字の間の空白を許す形で消す** |
| ⚠️ **別の顧客の氏名**がメモに書かれていた | ⚠️ **`kpiMaskKnownNames()` を追加** |

### 集めた行

| | 注文事業 | 建売分譲事業 |
|---|---|---|
| 行数 | ⚠️ **842件** | ⚠️⚠️ **5件**（分析できない） |
| 勝ち / 負け | 342 / 500 | 1 / 4 |
| ⚠️ **商談メモから発見** | ⚠️ **291件** | 122件（⚠️ ほぼ自社名で除外） |
| JSON | 442KB（⚠️ **約147,000トークン**） | 4.8KB |
| 処理時間 | ⚠️ **約6秒** | 約6秒 |

⚠️ 他社の上位（注文・直近24ヶ月）: 七呂建設53 / 一条工務店39 / アイ工務店37 /
タマホーム29 / NEOデザインホーム28 ⚠️ **— 参考資料の顔ぶれと一致している。**

### ⚠️ 課金の見込み

⚠️⚠️ **注文事業を1回分析すると、入力が約147,000トークンになる。**
⚠️ ⚠️ **1回あたり数百円規模。** ⚠️ 1日20回の上限があるとはいえ、実費が出る。
⚠️ 減らしたいときは ⚠️ **`KPI_COMPETITOR_MAX_ROWS` と `KPI_COMPETITOR_MEMO_CHARS`** を下げる。

### その他

| 確認 | 結果 |
|---|---|
| `php -l`（kpi.php / kpi_analyze.php） | ⚠️ **エラー0件** |
| `npm run build` | ⚠️ **成功** |
| ⚠️ 変更した3コンポーネントの警告 | ⚠️ **0件**（Header.tsx の既存1件を除く） |
| ⚠️ **サーバーサイドでの描画**（3パターン） | ⚠️ **成功**（勝敗表あり6,779文字 / 無し3,482文字 / 全件6,543文字） |

⚠️ ⚠️ **Claude は一度も呼んでいない**（課金なし）。⚠️ スナップショットまでの検証である。

---

## ⚠️ 未実施（ブラウザでの確認）

- [ ] ⚠️ Master で 他社動向 に ⚠️ **ロゴ＋「による競合分析」** が最下部に出るか
- [ ] ⚠️ **Master 以外では出ないこと**
- [ ] 押すと Claude のモーダルが開き、⚠️ **「競合分析」の枠がオレンジで目立つ**か
- [ ] ⚠️⚠️ **開いただけでは実行されない**こと（⚠️ **課金されないこと**）
- [ ] 注文事業で実行 → ⚠️ **勝敗表が出るか**（⚠️ 1回で数百円かかる）
- [ ] ⚠️ 打ち切りの札「勝率は計算できません」が出るか
- [ ] ⚠️⚠️ **建売分譲事業で実行 → 課金されずにメッセージが出る**か
- [ ] ⚠️ **結果に伏字（****）以外の個人情報が出ていないこと**
- [ ] 保存済みの分析から開き直せるか（⚠️ 課金なし）
- [ ] 印刷プレビューが崩れないか

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **建売分譲事業は競合の記録が実質ゼロ。** ⚠️ 競合欄・失注理由の入力運用から始める必要がある |
| 2 | ⚠️ 建売の「負け」は ⚠️ **「追客終了」で代用**している。⚠️ 専用のステータスを作るか要検討 |
| 3 | ⚠️ ⚠️ **`consulting` 権限の全レスポンスマスク**（次の版） |
| 4 | ⚠️ Express `/analysis`（MCP用）の ⚠️ **建売対応とマスク済み行データ**（次の版） |
| 5 | ⚠️ 1回あたりの課金が大きい。⚠️ **上限の見直しは利用者の判断** |
