<?php

/**
 * 簡単見積もり（2L・JH）の反響受付。（v2.2.216）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **② の features/estimate/entry.ts の予備である。** ⚠️ ふだんは ① の express_proxy.php が ② へ転送し、ここは動かない。
 * ⚠️ 中身は公開フォームの受付と同じなので、v2.2.213 の handlers/campaign_form.php（roll: entry）をそのまま使う。
 *   （inquiry_customer・pgcloud・form_cv・メール2通。② が10分以内に保存した同じ人は飛ばす）
 * ⚠️⚠️ **受け付けるのは見積もりの3キャンペーンだけ。** ⚠️ ② の ESTIMATE_CAMPAIGNS と同じにすること。
 * ─────────────────────────────────────────────
 */

$estimateCampaigns = [
    '2l:20250000_2l_mitsumori',
    'jh:20250000_jhkyotsu_estimate',
    'jh:20250000_jhkyotsu_reserveestimate',
];

$estimateKey = trim((string)($data['brand'] ?? '')) . ':' . trim((string)($data['campaign_id'] ?? ''));
if (!is_array($data) || !in_array($estimateKey, $estimateCampaigns, true)) {
    error_log("estimate_entry: 見積もりのキャンペーンではありません key=\"{$estimateKey}\"");
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => '登録に失敗しました。'], JSON_UNESCAPED_UNICODE);
    exit;
}

// ⚠️ campaign_form.php は $data['roll'] で振り分ける。⚠️ 見積もりは必ず entry（送られた roll は使わない）
$data['roll'] = 'entry';
require __DIR__ . '/campaign_form.php';
