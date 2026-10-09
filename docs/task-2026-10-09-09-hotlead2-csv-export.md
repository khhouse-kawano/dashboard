# 2026-10-09 sync：hotlead_2 の追客情報を CSV でダウンロードフォルダへ（1回限り）

## 依頼
`projects/sync/src/services/portalService.ts` の actionMap が `hotlead_2` のときに取得できる情報を CSV にしてダウンロードディレクトリに残す。
- 回答: **今すぐ1回だけ取得** ／ **CSV だけ（Dashboard へは送らない）**

## 方針
- `.env`（HOTLEAD_ID_2 / HOTLEAD_PASS_2）は CLAUDE.md のルールで読めないため、**実行は利用者の PC で**行う手動スクリプトを用意した
- `runHotlead.ts` / `portalService.ts` は変更なし（定期実行の hotlead_2 は従来どおり）

## 追加ファイル（リポジトリ外: C:\Users\shinji-kawano\projects\sync）
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| src/scripts | **exportHotlead2Csv.ts**（新規） | トークン取得 → `/public/api/tickets?updated_from=` → CSV を `~/Downloads/hotlead_2_tickets_YYYYMMDD_HHMM.csv` に保存 |

### 関数
- `getAccessToken(id, pass)`（runHotlead.ts と同じ処理の写し）
- `fetchTickets(token, updatedFrom)`（同じ API。ファイル保存・POST はしない）
- `csvCell(value)` / `toCsv(rows)`（列は全件の項目を出現順に合わせる。BOM 付き UTF-8・CRLF）
- `main()`

## 実行
```powershell
cd C:\Users\shinji-kawano\projects\sync
npx ts-node src/scripts/exportHotlead2Csv.ts            # 2020-01-01 以降に更新（実質すべて）
npx ts-node src/scripts/exportHotlead2Csv.ts 2026-10-01 # 指定日以降
```

## 確認
- `npx tsc --noEmit -p .` 成功
- API への実行は未実施（認証情報が必要なため）
- ⚠️ API にページングの指定があるかは不明（runHotlead.ts も `data` 1回分だけ読んでいる）。件数が少なすぎる場合は要確認
- ⚠️ CSV は個人情報を含む

## 全コード
```ts
/**
 * Hotlead 2つ目のアカウント（hotlead_2）の追客情報を CSV にしてダウンロードフォルダへ保存する。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **手で叩くもの（1回限りの書き出し）。** portalService には登録していない。
 * ⚠️⚠️ **Dashboard（gateway）へは送らない。** CSV を書くだけ（2026-10-09 の指示）。
 * ⚠️ 認証情報は .env の HOTLEAD_ID_2 / HOTLEAD_PASS_2（⚠️ portalService の hotlead_2 と同じ）。
 * ⚠️ トークン取得・取得 API は runHotlead.ts と同じ（⚠️ runHotlead.ts は触っていない）。
 * ─────────────────────────────────────────────
 *
 * 使い方（あなたのPC / PowerShell）:
 *
 *   cd C:\Users\shinji-kawano\projects\sync
 *
 *   # 既定: 2020-01-01 以降に更新された追客情報（⚠️ 実質すべて）
 *   npx ts-node src/scripts/exportHotlead2Csv.ts
 *
 *   # 日付を指定（YYYY-MM-DD 以降に更新されたもの）
 *   npx ts-node src/scripts/exportHotlead2Csv.ts 2026-10-01
 *
 * 出力: C:\Users\<you>\Downloads\hotlead_2_tickets_YYYYMMDD_HHMM.csv
 *   ⚠️ UTF-8（BOM 付き）。Excel でそのまま開ける。
 *   ⚠️ 列は API が返す項目そのまま（⚠️ 全件の項目を合わせた列。無い項目は空）。
 *   ⚠️ 個人情報（氏名・電話・メール・住所など）を含む。⚠️ 取り扱いに注意。
 */
import dotenv from 'dotenv';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

dotenv.config();

const API_BASE_URL = 'https://public-api.hotlead.jp';
const TOKEN_URL = 'https://prd-hotlead.auth.ap-northeast-1.amazoncognito.com/oauth2/token';
const DEFAULT_FROM = '2020-01-01';

const pad = (n: number): string => String(n).padStart(2, '0');

/** runHotlead.ts の getAccessToken と同じ */
const getAccessToken = async (id: string, pass: string): Promise<string> => {
    const credentials = Buffer.from(`${id}:${pass}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', id);

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
    });
    if (!response.ok) throw new Error(`トークン取得失敗: ${await response.text()}`);
    const data = await response.json() as { access_token?: string };
    if (!data.access_token) throw new Error('トークン取得失敗: access_token がありません');
    return data.access_token;
};

/** runHotlead.ts の findTickets と同じ API（⚠️ updated_from だけ指定できる。⚠️ ファイル保存・POST はしない） */
const fetchTickets = async (token: string, updatedFrom: string): Promise<Record<string, unknown>[]> => {
    const url = `${API_BASE_URL}/public/api/tickets?updated_from=${encodeURIComponent(updatedFrom)}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    if (!response.ok) throw new Error(`追客情報取得エラー: ${await response.text()}`);
    const data = await response.json() as { data?: unknown };
    return Array.isArray(data.data) ? data.data as Record<string, unknown>[] : [];
};

/** CSV の1マス。⚠️ null / undefined は空。⚠️ オブジェクト・配列は JSON。⚠️ `"` `,` 改行を含むときは囲む */
const csvCell = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (rows: Record<string, unknown>[]): string => {
    // ⚠️ 列は「最初に出てきた順」で全件の項目を合わせる（⚠️ 行によって項目が欠けても列がずれない）
    const columns: string[] = [];
    const seen = new Set<string>();
    rows.forEach(row => Object.keys(row).forEach(key => {
        if (seen.has(key)) return;
        seen.add(key);
        columns.push(key);
    }));
    const lines = [columns.map(csvCell).join(',')];
    rows.forEach(row => lines.push(columns.map(c => csvCell(row[c])).join(',')));
    return lines.join('\r\n') + '\r\n';
};

const main = async (): Promise<void> => {
    const updatedFrom = process.argv[2] ?? DEFAULT_FROM;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(updatedFrom)) {
        throw new Error(`日付は YYYY-MM-DD で指定してください（指定値: ${updatedFrom}）`);
    }

    const id = process.env.HOTLEAD_ID_2 ?? '';
    const pass = process.env.HOTLEAD_PASS_2 ?? '';
    if (!id || !pass) throw new Error('HOTLEAD_ID_2 / HOTLEAD_PASS_2 が .env にありません');

    console.log('認証トークンを取得中（hotlead_2）...');
    const token = await getAccessToken(id, pass);

    console.log(`追客情報を取得中（${updatedFrom} 以降に更新）...`);
    const rows = await fetchTickets(token, updatedFrom);
    console.log(`取得件数: ${rows.length} 件`);

    const now = new Date();
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filePath = path.join(os.homedir(), 'Downloads', `hotlead_2_tickets_${stamp}.csv`);

    // ⚠️ BOM 付き UTF-8（⚠️ 付けないと Excel で日本語が化ける）
    await fs.writeFile(filePath, '\uFEFF' + toCsv(rows), 'utf-8');
    console.log(`✅ 保存しました: ${filePath}`);
};

main().catch((error: unknown) => {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
```
