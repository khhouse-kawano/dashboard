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
 */

export type CompetitorPdfItem = {
    name: string;
    file: File | null;
    path?: string;
    staff?: string;
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
    const existingFiles = list
        .filter(item => !item.file && item.path)
        .map(item => ({ name: item.name, path: item.path, staff: item.staff }));
    formData.append('existing_pdfs', JSON.stringify(existingFiles));

    for (const item of list) {
        if (!item.file) continue;
        formData.append('competitor_pdf_files[]', item.file);
        formData.append('competitor_pdf_names[]', item.name);
        formData.append('competitor_pdf_staff[]', item.staff ?? '');
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
