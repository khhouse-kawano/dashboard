import { logger } from '../../utils/logger';
import { runCampaignFormEntry, type EntryResult } from '../campaignForm/entry';
import { clean } from '../campaignForm/text';

/**
 * 簡単見積もり（2L・JH）の反響受付。（v2.2.216）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送り元:
 *   - 2L … 2lhome.net/mitsumori/result_api.php（サーバー）
 *   - JH … 簡単見積もりの画面（react/estimate。proposal も同じ）
 *   ⚠️ 以前は Heroku の中継（polar-journey…/update）→ ① khg-marketing.info/api/（Authorization: registration,
 *     request: homepage）へ送っていた。⚠️ その php が誤って消え、2026-09 上旬から反響が入っていなかった。
 * ⚠️ 中身は公開フォームの受付（campaign_form:entry）と同じ。⚠️ そのまま呼ぶ:
 *   inquiry_customer（url_params・landing_params も）・pgcloud・form_cv・メール2通（通知先・お礼の可否は form_table から）
 * ⚠️⚠️ **受け付けるのは下の3キャンペーンだけ。**（ほかのキャンペーンは campaign_form を使う）
 *   ⚠️ 2L の「簡単見積もりからの来場予約」（20250000_2l_mitsumori_reserve）は別の古い仕組み（khg-marketing.info/confirm/）から
 *     送っており、ここへは来ない。⚠️ ここへ送るように変えたら下に足すこと
 * ⚠️ ② に届かないとき、送り元は ① の handlers/estimate_entry.php へ送り直す（① の campaign_form.php を使う。同じ処理）。
 * ─────────────────────────────────────────────
 */

/** brand（form_table のキー）＋ campaign_id。⚠️ ① の estimate_entry.php と同じにすること */
const ESTIMATE_CAMPAIGNS = new Set([
    '2l:20250000_2l_mitsumori',
    'jh:20250000_jhkyotsu_estimate',
    'jh:20250000_jhkyotsu_reserveestimate',
]);

export const runEstimateEntry = async (body: Record<string, unknown>): Promise<EntryResult> => {
    const brand = clean(body.brand, 30);
    const campaignId = clean(body.campaign_id, 120);
    if (!ESTIMATE_CAMPAIGNS.has(`${brand}:${campaignId}`)) {
        logger.warn(`estimate_entry: 見積もりのキャンペーンではありません brand="${brand}" campaign_id="${campaignId}"`);
        return { httpStatus: 400, body: { status: 'error', message: '登録に失敗しました。' } };
    }
    return runCampaignFormEntry(body);
};
