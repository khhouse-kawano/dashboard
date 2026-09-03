/// <reference types="vite/client" />

/**
 * このプロジェクトで使う環境変数。
 *
 * ⚠️ Vite は `VITE_` で始まるものだけをクライアントに渡す。
 *   接頭辞を付け忘れると undefined になり、src/config.ts の既定値が使われる
 *   （エラーにならないので気づきにくい）。
 */
interface ImportMetaEnv {
    /** APIの向き先。未設定なら開発=localhost:8080、本番=dashboard/api/gateway/ */
    readonly VITE_API_BASE?: string;
    /** 画像の参照元。未設定なら dashboard/api/images */
    readonly VITE_KSNAP_IMAGE_BASE?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
