/**
 * 反響一覧の顧客タグ。
 *
 * ⚠️ 以前は inquiry_customer* の black_list カラムに空白区切りで
 *   タグ名を「追記」し、出現回数の偶奇で ON/OFF を判定していた。
 *
 *     bl.split('duplicate').length % 2 === 0   // ← ONの意味
 *
 *   split().length は「出現回数 + 1」なので %2===0 がONという直感に反する形になり、
 *   さらに OFF にしても文字列が伸び続け、連打で偶奇が反転する問題があった。
 *
 *   現在は TINYINT(1) のフラグカラムを見る。判定はこのファイルに集約し、
 *   ListOrder / ListKaeru / ListResale / Menu で同じ関数を使う。
 *
 *   移行SQL: backend/scripts/sql/2026-09-02_inquiry_tag_flags.sql
 */

/** タグの識別子。APIに送る値でもある（list_tag.php の $columnMap のキー） */
export type TagKey = 'duplicate' | 'gift' | 'support' | 'black';

/** タグに対応する、APIが返すフィールド名 */
export const TAG_FIELD = {
    duplicate: 'duplicate_flag',
    gift: 'gift_flag',
    support: 'support_flag',
    black: 'black_flag',
} as const satisfies Record<TagKey, string>;

/** タグを持つレコードが満たすべき最小の形。各画面の型はこれを含んでいればよい */
export interface TaggedInquiry {
    duplicate_flag?: number | string | null;
    gift_flag?: number | string | null;
    support_flag?: number | string | null;
    black_flag?: number | string | null;
}

/**
 * タグが立っているか。
 *
 * ⚠️ PDO は数値カラムを文字列で返すことがあるため Number() を通す。
 *   `item.black_flag === 1` と書くと "1" のときに false になる。
 */
export const isTagOn = (item: TaggedInquiry, tag: TagKey): boolean =>
    Number(item[TAG_FIELD[tag]] ?? 0) === 1;

/**
 * 追客の対象外か（重複クリック・業者・ブラックリストのいずれか）。
 *
 * ギフト券進呈済みは「進呈の記録」であって追客可否とは無関係なので含めない。
 * これは旧 isDup() と同じ扱い。
 */
export const isExcluded = (item: TaggedInquiry): boolean =>
    isTagOn(item, 'duplicate') || isTagOn(item, 'support') || isTagOn(item, 'black');

/** 同期が不要か（既に同期済み、または追客対象外） */
export const notNeedSync = (item: TaggedInquiry & { sync?: number | string }): boolean =>
    Number(item.sync ?? 0) === 1 || isExcluded(item);

/** 未同期として数えるべきか（未同期 かつ 追客対象） */
export const isPendingSync = (item: TaggedInquiry & { sync?: number | string }): boolean =>
    Number(item.sync ?? 0) === 0 && !isExcluded(item);

/** 画面に並べるタグの定義。表示順もこの配列の順 */
export interface TagDefinition {
    key: TagKey;
    label: string;
    /** Bootstrap の背景色クラス */
    className: string;
}

export const TAG_DEFINITIONS: TagDefinition[] = [
    { key: 'duplicate', label: '重複', className: 'bg-primary' },
    { key: 'gift', label: 'ギフト券進呈済み', className: 'bg-danger' },
    { key: 'support', label: '業者', className: 'bg-warning' },
    { key: 'black', label: 'ブラックリスト', className: 'bg-dark' },
];
