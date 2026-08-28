<?php

// ============================================================================
// brokerage_listings.id の採番
//
//   アプリ（フロント）が採番している id と同じ書式で作る。
//   既存1,259件の実データから読み取った構成は3ブロック:
//
//     x  msh5mr0p  69sck  125
//     │  │         │      └─ 連番（数値。一括生成時のループ添字）
//     │  │         └──────── ランダム5桁（36進）
//     │  └────────────────── Date.now().toString(36)（8桁のミリ秒）
//     └───────────────────── リテラルの 'x'
//
//   JS 側の実装に相当:
//     'x' + Date.now().toString(36)
//         + Math.random().toString(36).slice(2, 7)
//         + index
//
//   検証: 'xmsy81ht4xngda2' の 'msy81ht4' を36進デコードすると
//         1787030872168ms = 2026-08-18。該当リードの反響日・架電日と一致する。
// ============================================================================

if (!function_exists('brokerageListingId')) {

    /**
     * brokerage_listings.id を1件分採番する。
     *
     * 一意性は「ミリ秒タイムスタンプ + ランダム5桁（36^5 ≒ 6,000万通り）」で
     * 担保している。連番はアプリ側が一括生成のループ添字に使っている枠で、
     * ポータル同期は1リクエスト1件のため既定で 1 を入れる。
     *
     * @param int $sequence 連番ブロックに入れる値
     * @return string 例: 'xmt5abcd1w9k3z1'
     */
    function brokerageListingId($sequence = 1)
    {
        $digits = '0123456789abcdefghijklmnopqrstuvwxyz';

        // JS の Date.now().toString(36) と同じ表現を作る。
        // base_convert() は 2^53 を超えると精度が落ちるため自前で割っていく
        // （ミリ秒は当面 2^53 未満だが、桁落ちの原因を残さない）。
        $milliseconds = (int) round(microtime(true) * 1000);
        $timestamp = '';
        while ($milliseconds > 0) {
            $timestamp = $digits[$milliseconds % 36] . $timestamp;
            $milliseconds = intdiv($milliseconds, 36);
        }

        // ランダム5桁。乱数の質が id の衝突耐性そのものなので random_int を使う
        $random = '';
        for ($i = 0; $i < 5; $i++) {
            $random .= $digits[random_int(0, 35)];
        }

        return 'x' . $timestamp . $random . (string) (int) $sequence;
    }
}
