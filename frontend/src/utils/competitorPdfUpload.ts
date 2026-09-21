import axios from 'axios';

/**
 * 競合資料（PDF）のアップロード。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **顧客情報の保存とは別リクエストである。**
 *
 *   以前は customer_info（顧客情報の保存）と同じ multipart リクエストで
 *   PDF も一緒に送っていた。顧客情報の保存を ② VPS の Express へ移すために
 *   分離した。
 *
 *   PDF の実体は ① レンタルサーバーの `uploads/competitors/` に置き、
 *   ① の URL で配信している。② から ① のファイルシステムへは書けない。
 *   また multipart は core/express_proxy.php が転送しない設計になっている。
 *
 *   送信先: ① の `request: 'competitor_pdf_upload'`
 *           （backend/src/handlers/competitor_pdf_upload.php）
 *
 * ⚠️ **顧客情報を保存してから呼ぶこと。** 新規顧客のときに master_data の
 *   行が無い状態で PDF だけ登録されるのを避けるため。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **2026-09-21 に competitor_pdf を「1ファイル1行」に作り替えた。**
 *   ⚠️ `company`（他社名）と `category`（種別）が増えている。
 *   ⚠️ ⚠️ **完全上書き方式は変えていない。**
 *     `existing_pdfs`（残すもの）＋ 新規アップロード ＝ 最終状態。
 */

/**
 * 資料の種別。
 *
 * ⚠️⚠️ **`backend/src/handlers/competitor_pdf_upload.php` の
 *   `$allowed_categories` と同じ内容にすること。**
 *   ⚠️ 食い違うと、選べるのに保存されない種別ができる（⚠️ 空文字になる）。
 *
 * ⚠️ 一覧画面（header/CompetitorMaterials.tsx）のフォルダもこの並びで出す。
 *   ⚠️ ⚠️ **並び順にも意味がある**ので、勝手に並べ替えないこと。
 */
export const PDF_CATEGORIES = [
    'カタログパンフレット',
    '見積もり・提案書',
    'チラシ',
    'その他',
] as const;

export type PdfCategory = (typeof PDF_CATEGORIES)[number];

/** 種別が空のものをまとめるフォルダの名前。⚠️ 実在の種別と重ならないこと */
export const UNSORTED_CATEGORY = '未分類';

/** 他社名が空のものをまとめるフォルダの名前。⚠️ 実在の他社名と重ならないこと */
export const UNSORTED_COMPANY = '他社未設定';

export type CompetitorPdfItem = {
    name: string;
    file: File | null;
    path?: string;
    staff?: string;
    /** ⚠️ 2026-09-21 追加。`master_data.competitors_text` から選ぶ */
    company?: string;
    /** ⚠️ 2026-09-21 追加。PDF_CATEGORIES のいずれか */
    category?: string;
};

/**
 * @param id master_data.id
 * @param items 画面上の一覧そのまま。`file` があるものが新規、`path` があるものが既存。
 * @param token ログイン中スタッフのトークン
 * @throws 通信エラー、または ① が status:'error' を返した場合
 */
export const uploadCompetitorPdf = async (
    id: string,
    items: CompetitorPdfItem[] | null | undefined,
    token: string
): Promise<void> => {
    const list = items ?? [];

    const formData = new FormData();
    formData.append('request', 'competitor_pdf_upload');
    formData.append('id', id);

    // ⚠️⚠️ **`existing_pdfs` はファイルが無くても必ず送る。**
    //   ① は「existing_pdfs ＋ 新規アップロード＝最終状態」の完全上書き方式。
    //   送らないと「画面で削除したのに消えない」状態になる。
    //
    // ⚠️ ⚠️ **既存ファイルの company / category もここで送る。**
    //   ⚠️ 一覧や顧客詳細で後から直した分は、この経路でしか保存されない。
    const existingFiles = list
        .filter(item => !item.file && item.path)
        .map(item => ({
            name: item.name,
            path: item.path,
            staff: item.staff,
            company: item.company ?? '',
            category: item.category ?? '',
        }));
    formData.append('existing_pdfs', JSON.stringify(existingFiles));

    for (const item of list) {
        if (!item.file) continue;
        formData.append('competitor_pdf_files[]', item.file);
        formData.append('competitor_pdf_names[]', item.name);
        formData.append('competitor_pdf_staff[]', item.staff ?? '');
        // ⚠️ 空でも必ず送る。⚠️ **添字がずれると別のファイルの値になる。**
        formData.append('competitor_pdf_company[]', item.company ?? '');
        formData.append('competitor_pdf_category[]', item.category ?? '');
    }

    // ⚠️⚠️ **apiClient を使わないこと。**
    //   apiClient は既定で `Content-Type: application/json` を付ける。
    //   FormData に付けると boundary が入らず、PHP 側で $_POST / $_FILES が
    //   空になる（＝ファイルが1つも届かない）。
    //   ここでは Content-Type を指定せず、axios に FormData 用の
    //   ヘッダを組ませる。
    const response = await axios.post(
        process.env.REACT_APP_XSERVER_API as string,
        formData,
        {
            headers: {
                Authorization: '4081Kokubu',
                Token: token || ''
            }
        }
    );

    // ⚠️ ① は失敗しても HTTP 200 で status:'error' を返す。
    //   ステータスコードだけ見ていると失敗に気づけない。
    const status = (response.data as { status?: string } | null)?.status;
    if (status !== undefined && status !== 'success') {
        const message = (response.data as { message?: string } | null)?.message;
        throw new Error(message ?? '競合資料の保存に失敗しました。');
    }
};
