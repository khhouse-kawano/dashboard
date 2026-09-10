import { thisYear } from "./thisYear";

/**
 * 店舗別動向の「(N名)」に出す担当営業を絞り込む。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **課の一覧は DB（section_list）から渡すこと。** 直書きしないこと。
 *
 *   2026-09-09 まで、この中に
 *     order: ['鹿児島営業1課','鹿児島営業2課','鹿児島営業3課',
 *             '宮崎営業課','熊本営業課','大分・佐賀営業課']
 *     spec : ['不動産営業1課','不動産営業2課']
 *   を直書きしていた。
 *
 *   ⚠️ その結果、**実データとずれて人数が過少になっていた**。
 *     直書きのみ … 大分・佐賀営業課（section_list に存在しない）
 *     DBのみ     … 大分営業課 / 佐賀・久留米営業課
 *   `includes` で弾かれるため、この2課の担当営業が**全員除外**されていた。
 *
 *   課の分割・統合は運用側で起こる。直書きすると必ず腐る。
 *
 * ⚠️ 呼び出し側（ShopTrendOrder.tsx / ShopTrendKaeru.tsx）は
 *   `response.data.section`（= section_list を division で絞ったもの）を
 *   `.map(s => s.name)` して渡している。
 *   サーバ側の絞り込みは shopTrendAction/shopTrend_{category}.php:20。
 *   ⚠️ **追加のDBアクセスは発生しない。** そのクエリは元々毎回実行されており、
 *     フロントが結果を受け取っていなかっただけである。
 * ─────────────────────────────────────────────
 *
 * @param object    staff_list の配列
 * @param targetSection 画面で選択中の課（'' なら未選択、'all' なら全課）
 * @param section   その行の課名
 * @param shop      その行の店舗名
 * @param index     0 は合計行。1以降が明細
 * @param sectionNames 対象事業の課名の一覧（section_list 由来）
 */
export const setStaffLength = (
    object: any,
    targetSection: string,
    section: string,
    shop: string,
    index: number,
    sectionNames: string[]
) => {
    /**
     * ⚠️⚠️ **課の一覧が空のときは課で絞らない。**
     *   API の取得前（初回描画）は空配列になる。ここで `includes` を通すと
     *   常に false になり **0名** と表示され、一瞬「担当なし」に見える。
     *   絞らなければ従来より多く出るだけで済むので、そちらに倒す。
     */
    const base = object.filter((o: any) =>
        o.period === String(thisYear) &&
        (sectionNames.length === 0 || sectionNames.includes(o.section))
    );

    let value;
    if (!targetSection) {
        value = base.filter((item: any) => (index >= 1 ? item.shop === shop : true));
    } else if (targetSection === 'all') {
        value = base.filter((item: any) => (index >= 1 ? item.section === section : true));
    } else {
        value = base.filter((item: any) => (index >= 1 ? item.shop === shop : item.section === targetSection));
    }
    return value;
};
