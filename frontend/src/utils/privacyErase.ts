import apiClient from './apiClient';

/**
 * 個人情報削除（v2.2.227）。顧客DB（InformationEditKaeru / Resale）と反響一覧（ListOrder / Kaeru / Resale）で共通。
 *
 * ⚠️⚠️ 元に戻せない。必ず confirmPrivacyErase で確かめてから送る。
 * ⚠️ 処理は ② の features/privacy.ts（privacy_erase:master / privacy_erase:inquiry）。
 *   氏名・ふりがな・電話番号・メールアドレス・住所（郵便番号を含む）を ******** にする。
 *   顧客DB は delete_dashboard = 1（v2.2.229〜。顧客DB・顧客詳細から消え、集計には「削除済み顧客」として残る。utils/deletedCustomer.tsx）、
 *   反響は sync = 1（取込済み）。
 */

export const PRIVACY_MASK = '********';

/** 確認（キャンセルなら false） */
export const confirmPrivacyErase = (name: string, after: string): boolean =>
    window.confirm(
        `${name ? `${name} 様の` : ''}個人情報を削除します。\n\n`
        + `氏名・ふりがな・電話番号・メールアドレス・住所を「${PRIVACY_MASK}」に置き換え、${after}。\n`
        + '⚠️ 元に戻せません。よろしいですか？'
    );

type Body = { status?: string; message?: string; row?: Record<string, unknown> };

/** 送る。失敗は ② のメッセージで投げる */
export const postPrivacyErase = async (roll: 'master' | 'inquiry', category: string, key: Record<string, string>): Promise<Body> => {
    try {
        const res = await apiClient.post<Body>('', { request: 'privacy_erase', roll, category, ...key });
        if (res.data?.status !== 'success') throw new Error(res.data?.message || '個人情報を削除できませんでした');
        return res.data;
    } catch (e: unknown) {
        const message = (e as { response?: { data?: Body } })?.response?.data?.message;
        throw new Error(message || (e instanceof Error ? e.message : '通信エラーが発生しました'));
    }
};
