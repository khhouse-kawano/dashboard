<?php

/**
 * KPIをClaudeで分析する。**このハンドラの実行には課金が発生する。**
 *
 * リクエスト例:
 *   { "request": "kpi_analyze", "months": 6 }
 *   ヘッダ: Token: <staff.api_token>
 *
 * 処理の流れ:
 *   認証 → 回数制限 → 使用するAPIキーを決定 → KPI集計
 *   → Claude へ送信 → コスト算出 → ai_usage_log に記録 → 結果を返す
 */

require_once __DIR__ . '/../core/authz.php';
require_once __DIR__ . '/../core/crypto.php';
require_once __DIR__ . '/../core/anthropic.php';
require_once __DIR__ . '/../core/kpi.php';

/** 1人あたり1日の実行上限。連打による課金の暴走を防ぐ */
const KPI_DAILY_LIMIT = 20;

/** 使用するモデルと思考の深さ。コストを下げたい場合は effort を 'low' にする */
const KPI_MODEL     = 'claude-opus-5';
const KPI_EFFORT    = 'medium';
const KPI_MAX_TOKENS = 8000;

/**
 * 構造化出力のスキーマ。
 *
 * 数値そのものはフロントがDBの値から描画するため、ここでは「解釈」だけを受け取る。
 * basis を必須にすることで、事実と推測を必ず区別させている。
 *
 * ※ API の制約: すべてのオブジェクトに additionalProperties:false と required が必要。
 *   minLength / maxItems などの制約は使えないため、件数の上限は指示文で伝える。
 */
const KPI_ANALYSIS_SCHEMA = [
    'type'                 => 'object',
    'additionalProperties' => false,
    'required'             => ['headline', 'highlights', 'insights', 'actions'],
    'properties'           => [
        'headline' => [
            'type'        => 'string',
            'description' => '全体像を1〜2文で。数値の羅列ではなく、何が起きているかを述べる。',
        ],
        'highlights' => [
            'type'        => 'array',
            'description' => '注目すべき指標。3件以内。',
            'items' => [
                'type'                 => 'object',
                'additionalProperties' => false,
                'required'             => ['metric', 'observation', 'assessment'],
                'properties'           => [
                    'metric'      => ['type' => 'string', 'description' => '指標名。例: 月別反響数'],
                    'observation' => ['type' => 'string', 'description' => '何がどう変化したか'],
                    'assessment'  => [
                        'type' => 'string',
                        'enum' => ['positive', 'negative', 'neutral'],
                    ],
                ],
            ],
        ],
        'insights' => [
            'type'        => 'array',
            'description' => '要因の分析。4件以内。',
            'items' => [
                'type'                 => 'object',
                'additionalProperties' => false,
                'required'             => ['title', 'detail', 'basis'],
                'properties'           => [
                    'title'  => ['type' => 'string'],
                    'detail' => ['type' => 'string'],
                    'basis'  => [
                        'type' => 'string',
                        'enum' => ['data', 'hypothesis'],
                        'description' => 'data=渡された数値から確認できる事実 / hypothesis=推測',
                    ],
                ],
            ],
        ],
        'actions' => [
            'type'        => 'array',
            'description' => '打ち手。3件以内。実行可能なものに限る。',
            'items' => [
                'type'                 => 'object',
                'additionalProperties' => false,
                'required'             => ['title', 'detail'],
                'properties'           => [
                    'title'  => ['type' => 'string'],
                    'detail' => ['type' => 'string'],
                ],
            ],
        ],
    ],
];

const KPI_INQUIRY_TREND_PROMPT = <<<'PROMPT'
あなたは不動産・インサイドセールス領域のデータアナリストです。
反響を「取得月ごとのコホート」として捉えたデータを渡すので、経営会議で使える粒度で分析してください。

# データについて
monthly は反響取得月ごとの集計です。単なる件数の推移ではなく、
**その月に獲得した顧客が、その後どこまで進んだか**を表しています。

- count              … その月に取得した反響数
- interviewed        … そのうち面談まで進んだ件数
- contracted         … そのうち契約に至った件数
- interview_rate_pct … 面談化率。初期対応・アポ獲得の指標
- contract_rate_pct  … 契約率
- high_rank_pct      … S/Aランクの割合。獲得した見込みの質を示す参考値

# 解釈上の注意（必ず守ること）
- **is_partial = true の月**は取得件数がまだ増えます。前月比の判断に使わないでください。
- **is_maturing = true の月**は取得件数こそ確定していますが、契約まで平均約2ヶ月かかるため
  interviewed / contracted がまだ出揃っていません。
  **直近月の契約率が低いことを「成績の悪化」と解釈しないでください。**
  時間が経てば増える性質のものです。
- totals.mom_change_pct は、締まった直近2ヶ月の取得件数の増減率です。
- medium_monthly は上位5媒体の月次推移です。構成比の変化を読むために使ってください。

# 厳守事項
- 渡されたデータに存在しない数値を作らないこと。
- 数値はフロントエンド側でグラフとして別途表示されます。
  **数値の羅列ではなく「その数値が何を意味するか」を書いてください。**
- insights の basis は必ず正しく設定すること。
  data = 渡された数値から直接確認できる事実
  hypothesis = データだけでは確認できない推測
- 判断材料が足りない場合は、その旨を hypothesis として明記すること。
- highlights は4件以内、insights は5件以内、actions は3件以内に収めること。
PROMPT;

/**
 * 課・店舗・スタッフで絞り込んだときに追加する前提説明。
 *
 * 絞り込むと母数が一桁二桁減る。それを伝えずに渡すと
 * 「契約率が0%だから壊滅的」といった、件数を無視した結論が返ってくる。
 */
const KPI_SCOPED_PROMPT = <<<'PROMPT'

# 対象範囲が絞り込まれている場合（重要）
- scope_label が示す範囲だけを集計した数値です。全社の数値ではありません。
- benchmark が付いている場合、それは**部門全体の値**です。
  絞り込んだ対象を評価する基準として使ってください。
  例:「この店舗の面談化率は部門平均を8ポイント下回る」
- **母数が小さくなっている点に必ず注意してください。**
  数十件規模では、率の差は偶然でも簡単に生じます。
  件数が少ない指標について断定的な評価をしないこと。
  そのような場合は「母数が小さく判断には追加期間が必要」と明記してください。
- 担当者1名まで絞り込まれている場合、それは個人の評価に直結します。
  数値から確認できる事実と推測を、通常以上に厳密に区別してください。
PROMPT;

/** 店舗別・媒体別で共通の前提説明 */
const KPI_FUNNEL_COMMON = <<<'PROMPT'

# 指標の定義（重要）
- interview_rate_pct = 面談まで進んだ割合（反響のうち）
- close_rate_pct     = 面談した人のうち契約した割合
  **この2つを必ず区別してください。**
  面談化率が低い＝初期対応・アポ獲得の問題
  クロージング率が低い＝商談内容・提案力の問題
  どちらの段階でつまずいているかを特定することが、この分析の核心です。
- avg_days_to_interview / avg_days_to_contract = 反響取得日からの平均日数

# データの限界（必ず考慮すること）
- overall.input_coverage_pct は各項目の入力率です。
  入力率が低い項目（要望13.2%、年収6.9%など）を根拠に全体を語らないでください。
- 契約日の入力率は2.7%しかありません。契約数の絶対値が小さい対象は、
  率の差が偶然の可能性があります。母数が小さい場合はその旨を明記してください。
- high_rank_pct は S/Aランクの割合で、見込みの質を示す参考値です。

# 厳守事項
- 渡されたデータに存在しない数値を作らないこと。
- 数値とグラフはフロントエンド側で別途表示されます。
  **数値の羅列ではなく「その数値が何を意味するか」を書いてください。**
- insights の basis は必ず正しく設定すること。
  data = 渡された数値から直接確認できる事実
  hypothesis = データだけでは確認できない推測
- highlights は4件以内、insights は5件以内、actions は3件以内に収めること。
PROMPT;

const KPI_SHOP_PROMPT = 'あなたは不動産・インサイドセールス領域のデータアナリストです。
店舗別・エリア別の営業ファネル（反響→面談→契約）データを渡すので、
経営会議で使える粒度で分析してください。

# データの構成
- shops  … 担当店舗ごとの集計
- areas  … 顧客の居住地（都道府県）ごとの集計
- cities … 顧客の居住地（市区町村）ごとの集計。件数上位のみ

**areas / cities は「店舗の所在地」ではなく「顧客の居住地」です。**
混同しないでください。

# 着眼点
- どの店舗が、ファネルの「どの段階」でつまずいているか。
- リードタイム（初動の速さ、契約までの長さ）に大きな差がある店舗。
- staff_count（担当者数）に対して成果が見合っているか。
- 失注（lost）の計上件数は、営業力だけでなく「失注を登録する運用habitの差」も表します。
  失注が極端に少ない店舗は、放置されている案件がある可能性を検討してください。
- エリアと店舗の対応：反響は多いのに契約が少ないエリアは、
  商圏に対して店舗の体制が足りていない可能性があります。
  逆に、件数は少ないが契約率が高いエリアは、投資余地があるかもしれません。
- エリアの「判定不可」は住所の書式が不揃いなだけで、実在しないエリアではありません。
  件数が多い場合は入力ルールの課題として扱ってください。' . KPI_FUNNEL_COMMON;

const KPI_MEDIUM_PROMPT = 'あなたは不動産・インサイドセールス領域のデータアナリストです。
販促媒体別の営業ファネル（反響→面談→契約）データを渡すので、広告投資の判断材料として分析してください。

# 着眼点
- 「量は取れるが質が低い媒体」と「量は少ないが質が高い媒体」の切り分け。
- 面談化率が低いのか、クロージング率が低いのかで対策が変わります。
  面談化率だけが低い媒体は、初動対応の改善で伸びる余地があります。
- avg_days_to_interview が長い媒体は、初回接触が遅れている可能性があります。
- high_rank_pct が低い媒体は、そもそも見込みの質が低い可能性があります。
- 広告費のデータは含まれていません。獲得単価には言及せず、
  「単価と併せて判断すべき」という形にとどめてください。' . KPI_FUNNEL_COMMON;

try {
    // -----------------------------------------------------------------
    // 1. 認証と認可
    //    課金が発生する処理のため、Master権限を必須とする。
    //    フロントでボタンを隠すだけでは、APIを直接叩かれると防げない。
    // -----------------------------------------------------------------
    $staff = requireMaster($pdo, $headers);

    // -----------------------------------------------------------------
    // 2. 回数制限（課金の暴走を防ぐ最後の砦）
    // -----------------------------------------------------------------
    // feature には 'kpi_analyze:order' のように部門を付けて記録しているため、
    // 上限判定は前方一致で数える（部門をまたいだ合計で1日20回）
    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS c FROM ai_usage_log
         WHERE staff_id = ? AND feature LIKE 'kpi_analyze%' AND created_at >= CURDATE()
    ");
    $stmt->execute([$staff['id']]);
    $usedToday = (int)($stmt->fetch(PDO::FETCH_ASSOC)['c'] ?? 0);

    if ($usedToday >= KPI_DAILY_LIMIT) {
        http_response_code(429);
        echo json_encode([
            'status'  => 'error',
            'message' => '本日の実行上限（' . KPI_DAILY_LIMIT . '回）に達しました。',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // -----------------------------------------------------------------
    // 3. 使用するAPIキーを決定
    //    自分のキーを優先し、無ければ組織内の有効なキーを使う（共有利用）。
    //    誰のキーに課金されたかは ai_usage_log.credential_id に残る。
    // -----------------------------------------------------------------
    $stmt = $pdo->prepare("
        SELECT id, label, key_ciphertext, key_iv, key_tag, key_version
          FROM api_credential
         WHERE provider = 'anthropic' AND status = 'active'
         ORDER BY (staff_id = ?) DESC, id ASC
         LIMIT 1
    ");
    $stmt->execute([$staff['id']]);
    $credential = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$credential) {
        http_response_code(409);
        echo json_encode([
            'status'  => 'error',
            'message' => '利用可能なAPIキーが登録されていません。',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // -----------------------------------------------------------------
    // 4. 分析タイプごとに、集計内容とプロンプトを切り替える
    //    生データではなく集計値を渡すことでトークンを抑える
    // -----------------------------------------------------------------
    $type     = (string)($data['type'] ?? 'inquiry_trend');
    // 部門。未知の値は kpiResolveTable() が既定（注文営業）へ丸める
    $division = (string)($data['division'] ?? KPI_DEFAULT_DIVISION);
    if (!isset(KPI_DIVISIONS[$division])) {
        $division = KPI_DEFAULT_DIVISION;
    }
    $months = (int)($data['months'] ?? 12);
    $months = max(1, min(24, $months));

    // -----------------------------------------------------------------
    // 4-a. 絞り込み（課 → 店舗 → スタッフ）
    //      クライアントの値をそのまま信用せず、DBで実在と所属を検証する。
    // -----------------------------------------------------------------
    try {
        $scope = kpiResolveScope(
            $pdo,
            $division,
            isset($data['section']) ? trim((string)$data['section']) : null,
            isset($data['shop'])    ? trim((string)$data['shop'])    : null,
            isset($data['staff'])   ? trim((string)$data['staff'])   : null
        );
    } catch (KpiScopeException $e) {
        http_response_code(400);
        echo json_encode(
            ['status' => 'error', 'message' => $e->getMessage()],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    // 店舗を1つに絞ると「店舗別サマリー」は棒グラフが1本になり意味を失う。
    // 画面側でもメニューを押せなくしているが、APIを直接叩かれた場合に備える。
    if ($type === 'shop' && $scope['shop'] !== null) {
        http_response_code(400);
        echo json_encode([
            'status'  => 'error',
            'message' => '店舗・スタッフを絞り込んだ状態では「店舗別サマリー」は実行できません。',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $scopeIntro = $scope['active'] ? '「' . $scope['label'] . '」' : kpiDivisionLabel($division);
    // 絞り込み時のみ、母数と benchmark の読み方を system プロンプトに足す
    $scopeRule  = $scope['active'] ? KPI_SCOPED_PROMPT : '';

    switch ($type) {
        case 'inquiry_trend':
            $snapshot   = buildInquiryTrendSnapshot($pdo, $months, $division, $scope);
            $systemText = KPI_INQUIRY_TREND_PROMPT . $scopeRule;
            $schema     = KPI_ANALYSIS_SCHEMA;
            $typeLabel  = '反響推移の分析';
            $intro      = '以下は' . $scopeIntro . 'の反響推移データです。';
            break;

        case 'shop':
            $snapshot   = buildShopSummarySnapshot($pdo, $division, $scope);
            $systemText = KPI_SHOP_PROMPT . $scopeRule;
            $schema     = KPI_ANALYSIS_SCHEMA;
            $typeLabel  = '店舗別サマリーの分析';
            $intro      = '以下は' . $scopeIntro . 'の店舗別・エリア別の営業ファネルデータです。';
            break;

        case 'medium':
            $snapshot   = buildMediumSummarySnapshot($pdo, $division, $scope);
            $systemText = KPI_MEDIUM_PROMPT . $scopeRule;
            $schema     = KPI_ANALYSIS_SCHEMA;
            $typeLabel  = '販促媒体別サマリーの分析';
            $intro      = '以下は' . $scopeIntro . 'の販促媒体別の営業ファネルデータです。';
            break;

        default:
            http_response_code(400);
            echo json_encode([
                'status'  => 'error',
                'message' => 'この分析はまだ実装されていません（type: ' . $type . '）。',
            ], JSON_UNESCAPED_UNICODE);
            exit;
    }

    $userText = $intro . "\n\n```json\n"
        . json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
        . "\n```";

    // -----------------------------------------------------------------
    // 5. Claude へ送信（ここから課金）
    // -----------------------------------------------------------------
    $apiKey = decryptSecret(
        $credential['key_ciphertext'],
        $credential['key_iv'],
        $credential['key_tag'],
        (int)$credential['key_version']
    );

    $result = anthropicCreateMessage(
        $apiKey,
        $systemText,
        $userText,
        KPI_MODEL,
        KPI_MAX_TOKENS,
        KPI_EFFORT,
        $schema
    );
    unset($apiKey);

    // -----------------------------------------------------------------
    // 6. 使用量とコストを記録
    // -----------------------------------------------------------------
    $usage        = $result['data']['usage'] ?? [];
    $inputTokens  = (int)($usage['input_tokens'] ?? 0);
    $outputTokens = (int)($usage['output_tokens'] ?? 0);
    $costUsd      = anthropicEstimateCost(KPI_MODEL, $inputTokens, $outputTokens);

    $usageStmt = $pdo->prepare('
        INSERT INTO ai_usage_log
            (credential_id, staff_id, feature, model,
             input_tokens, output_tokens, cost_usd, duration_ms, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $usageStmt->execute([
        (int)$credential['id'],
        $staff['id'],
        'kpi_analyze:' . $division,
        KPI_MODEL,
        $inputTokens  ?: null,
        $outputTokens ?: null,
        $costUsd,
        $result['duration_ms'],
        $result['ok'] ? 'ok' : ($result['status'] === 429 ? 'rate_limited' : 'error'),
        $result['error'],
    ]);
    $usageLogId = (int)$pdo->lastInsertId();

    // -----------------------------------------------------------------
    // 7. レスポンス
    // -----------------------------------------------------------------
    if (!$result['ok']) {
        http_response_code(502);
        echo json_encode([
            'status'  => 'error',
            'message' => $result['error'],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 構造化出力を指定した場合はJSONとして取り出す
    if ($schema !== null) {
        $analysis = anthropicExtractJson($result['data']);
        $format   = 'structured';
    } else {
        $analysis = anthropicExtractText($result['data']);
        $format   = 'markdown';
    }

    if ($analysis === null || $analysis === '') {
        http_response_code(502);
        echo json_encode([
            'status'  => 'error',
            'message' => '分析結果を取得できませんでした。stop_reason: ' . ($result['data']['stop_reason'] ?? '不明'),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // -----------------------------------------------------------------
    // 8. 結果を保存する
    //
    //    1回40〜60秒・十数円かかる結果を、画面を閉じただけで失うのは無駄。
    //    analysis（Claudeの解釈）と kpi（グラフの元データ）をJSONのまま
    //    残しておけば、後から課金なしで同じ画面を復元できる。
    //
    //    ⚠️ 保存に失敗しても分析結果の返却は妨げない。
    //      課金は既に発生しており、ここで500を返すと利用者は
    //      「金だけ取られて何も出ない」ことになる。
    // -----------------------------------------------------------------
    $historyId    = null;
    $historyTitle = null;

    if ($format === 'structured' && is_array($analysis)) {
        // 例: 2026年8月27日 注文事業_鹿児島営業1課 反響推移の分析
        $titleScope = implode('_', array_filter([
            kpiDivisionLabel($division),
            $scope['section'],
            $scope['shop'],
            $scope['staff'],
        ], static fn(?string $v): bool => $v !== null && $v !== ''));

        $historyTitle = kpiFormatJpDate() . ' ' . $titleScope . ' ' . $typeLabel;

        try {
            $pdo->prepare('
                INSERT INTO kpi_analysis_history
                    (staff_id, usage_log_id, title, headline, analysis_type, division,
                     scope_section, scope_shop, scope_staff, scope_label,
                     analysis_json, kpi_json, model)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ')->execute([
                $staff['id'],
                $usageLogId ?: null,
                mb_substr($historyTitle, 0, 255),
                (string)($analysis['headline'] ?? ''),
                $type,
                $division,
                $scope['section'],
                $scope['shop'],
                $scope['staff'],
                mb_substr((string)$scope['label'], 0, 255),
                json_encode($analysis, JSON_UNESCAPED_UNICODE),
                json_encode($snapshot, JSON_UNESCAPED_UNICODE),
                KPI_MODEL,
            ]);
            $historyId = (int)$pdo->lastInsertId();
        } catch (Throwable $e) {
            error_log('kpi_analyze: history save failed: ' . $e->getMessage());
        }
    }

    echo json_encode([
        'status'     => 'ok',
        'format'     => $format,
        'type'       => $type,
        'division'   => $division,
        'analysis'   => $analysis,
        'history_id' => $historyId,
        'title'      => $historyTitle,
        'meta'     => [
            'model'          => KPI_MODEL,
            'period_months'  => $months,
            'division'       => kpiDivisionLabel($division),
            'scope'          => $scope['label'],
            'input_tokens'   => $inputTokens,
            'output_tokens'  => $outputTokens,
            'cost_usd'       => $costUsd,
            'duration_ms'    => $result['duration_ms'],
            'stop_reason'    => $result['data']['stop_reason'] ?? null,
            'used_today'     => $usedToday + 1,
            'daily_limit'    => KPI_DAILY_LIMIT,
        ],
        'kpi'      => $snapshot,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    http_response_code(500);
    error_log('kpi_analyze failed: ' . $e->getMessage());
    echo json_encode(
        ['status' => 'error', 'message' => '分析処理に失敗しました。'],
        JSON_UNESCAPED_UNICODE
    );
}
