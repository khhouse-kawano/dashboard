# 指示（2026-09-21）　EditBlackList を SaaS 風にし Express へ移す

⚠️ 依頼（`ReadMeClaude.md`）:
> `EditBlackList.tsx` の UI を Saas 風デザインへ改修 => `GoogleReview.tsx` や
> `InquiryIntroductory.tsx` 参照
> Express 化がまだであれば移行作業

⚠️ ⚠️ **Express 化はまだだった**（① の PHP 3本だけ）。

---

## 変更・追加したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend-express/src/features/` | ⚠️ **`blacklist.ts`（新規）** | ⚠️ PHP 3本の移植 |
| `backend-express/src/gateway/` | `registry.ts` | ⚠️ **`register()` 3件と import** |
| `backend/src/core/` | `express_proxy.php` | ⚠️ **許可リストに3件** |
| `frontend/src/components/header/` | ⚠️ **`EditBlackList.tsx`（全面書き直し）** | SaaS 風 UI |
| `frontend/src/components/header/` | `Header.tsx` | ⚠️ **`isFullscreenMenu` に1行** |

⚠️ ⚠️ **PHP ハンドラ3本は消していない**（`header_blacklist_edit` / `_insert` / `_update`）。
⚠️ フォールバック先として残す。

---

## ⚠️ 移植の方針

### ⚠️ `expressProxyExclusive` には入れない

⚠️⚠️ **`insert` と `update` は書き込みだが、あえてフォールバックを許している。**

⚠️ ① に PHP ハンドラが3本とも実在するため、⚠️ **② が落ちても ① で動く。**
⚠️ ⚠️ **二重に書かれることはない**（⚠️ 転送が成功した時点で ① 側は実行しない）。

⚠️ ⚠️ **PHP を消すなら、同時に `expressProxyExclusive()` へ移すこと。**
⚠️ 消しただけだと、② が落ちたときに ⚠️ **「成功したように見えて保存されない」** 状態になる。

### ⚠️ 主キーは `no`

⚠️⚠️ **`black_list` の主キーは `no`（AUTO_INCREMENT）。`id` ではない。**
⚠️ `id` は text 列で、移植元が `uniqid('bl_')` を入れているだけの飾りである。
⚠️ ⚠️ **画面も `no` で更新している。**

### ⚠️ `note` は NOT NULL

⚠️ ⚠️ **DEFAULT が無い。** ⚠️ 空文字を必ず入れる（⚠️ 省くと INSERT が落ちる）。

---

## ⚠️ 列の許可リスト

⚠️⚠️ **列名をそのまま SQL に埋めるため、ここが唯一の防御である。**
⚠️ ⚠️ **移植元（`header_blacklist_update.php`）と1語も違えないこと。**

| PHP | TS |
|---|---|
| `['name', 'brand', 'mail', 'mobile', 'zip', 'full_address', 'note', 'show_key']` | ⚠️ **同じ8つ** |

⚠️ `no` / `id` / `date` は ⚠️ **入れない**（主キー・採番・登録日）。

---

## ⚠️ UI の作り直し

⚠️ `GoogleReview.tsx` に合わせ、⚠️ **`ebl_` 接頭辞の専用 `<style>`** を持たせた。

| 要素 | 内容 |
|---|---|
| 見出し | タイトル＋一行の説明 |
| ⚠️ **KPIカード** | ⚠️ **登録件数 / 有効 / 解除済み / 表示中** |
| 絞り込みバー | ブランド／⚠️ **状態**／顧客名／「対象者を追加」 |
| 表 | ⚠️ **見出し固定・顧客名/ブランド/登録日で並べ替え** |
| 状態 | ⚠️ スイッチ → ⚠️ **バッジ（有効／解除済み）** |

### ⚠️ ついでに直した既存の不具合

| # | 内容 |
|---|---|
| 1 | ⚠️ **`targetStatus` の state だけあって選ぶ UI が無かった** → ⚠️ 「状態」の select を追加 |
| 2 | ⚠️ **`blacklist` と `originalBlacklist` を二重に持っていた** → ⚠️ `useMemo` に変更（⚠️ 1文字打つたびに再レンダリングが2回走っていた） |
| 3 | ⚠️ **`blacklist.sort()` が state の配列を破壊していた** → ⚠️ `[...filtered].sort()` |
| 4 | ⚠️ **`o.name.includes()` が `name` null で落ちる** → ⚠️ `(o.name ?? '')` |
| 5 | ⚠️ **ブランドの選択肢に `全社` が無く、既存行が空欄に見えた** → ⚠️ 選択肢に追加 |
| 6 | ⚠️ **`date.replace(/\/g, '-')` がスラッシュを置換していなかった** → ⚠️ `/[/\]/g` |

### ⚠️ 全画面メニューに追加した

⚠️⚠️ **これは指示に無い変更である。**
⚠️ 列が10あり、⚠️ **xl のモーダルでは入力欄が潰れて読めない**ため。

```tsx
        // ⚠️ ブラックリスト設定は住所・備考まで10列あり、xl では入力欄が潰れる。
        //   ⚠️ 2026-09-19 の SaaS 化に合わせて全画面にした。
        //   ⚠️ **この1行で「左上の閉じるボタン」も一緒に出る。**
        '反響管理/ブラックリスト設定',
```

⚠️ ⚠️ **不要なら1行消すだけで戻る。**

---

## ⚠️ 保存の仕組み（変えていない）

⚠️⚠️ **保存ボタンは無い。⚠️ `onBlur` のたびに「1列だけ」送る。**

⚠️ バックエンドも ⚠️ **「`no` と `request` 以外のキーが1つだけ」** を前提にしている。
⚠️ ⚠️ **まとめて送る形に変えるならバックエンドも直すこと。**

---

## ⚠️ 追加したファイル（全文）

### `backend-express/src/features/blacklist.ts`

```ts
import type { RowDataPacket } from 'mysql2/promise';
import { query, execute } from '../db/pool';

/**
 * ブラックリスト名簿の編集（header/EditBlackList.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元:
 *     backend/src/handlers/header_blacklist_edit.php    （一覧）
 *     backend/src/handlers/header_blacklist_insert.php  （追加）
 *     backend/src/handlers/header_blacklist_update.php  （1列だけ更新）
 *
 * ⚠️⚠️ **`black_list` テーブル（名簿）と、反響の `black` タグはまったくの別物。**
 *   ⚠️ タグ側は `inquiry_customer*` のフラグ列で、features/list/ が扱う。
 *   ⚠️ ここは**名簿そのもの**で、反響一覧の突合に使われる元データである。
 *
 * ⚠️⚠️ **書き込みがある（insert / update）ので `expressProxyExclusive` には入れない。**
 *   ⚠️ ① に PHP ハンドラが3本とも実在するため、② が落ちても ① へ
 *     フォールバックして動く。⚠️ **二重に書かれることはない**
 *     （転送が成功した時点で ① 側は実行しない）。
 *
 * ⚠️⚠️ **主キーは `no`（AUTO_INCREMENT）。`id` ではない。**
 *   ⚠️ `id` は text 列で、移植元が `uniqid('bl_')` を入れているだけの飾りである。
 *   ⚠️ 画面も `no` で更新している。⚠️ **`id` を WHERE に使わないこと。**
 *
 * ⚠️ `note` は **NOT NULL で DEFAULT が無い。** ⚠️ 空文字を必ず入れること。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface BlacklistResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

/**
 * 1列だけ更新できる列の許可リスト。
 *
 * ⚠️⚠️ **移植元（header_blacklist_update.php）と1語も違えないこと。**
 *   ⚠️ 列名をそのまま SQL に埋めるため、⚠️ **ここが唯一の防御**である。
 * ⚠️ `no` と `id` と `date` は入れない（主キーと採番、登録日は変えない）。
 */
const ALLOWED_COLUMNS = [
  'name',
  'brand',
  'mail',
  'mobile',
  'zip',
  'full_address',
  'note',
  'show_key',
] as const;

type AllowedColumn = (typeof ALLOWED_COLUMNS)[number];

const isAllowedColumn = (value: string): value is AllowedColumn =>
  (ALLOWED_COLUMNS as readonly string[]).includes(value);

/** 文字列として受け取る。⚠️ null / undefined は空文字（列が NOT NULL のものがある） */
const toText = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

/**
 * `id` 列のダミー値。
 * ⚠️ 移植元の PHP `uniqid('bl_')` に合わせた形。⚠️ **一意性に依存していない。**
 *   ⚠️ 画面も検索もこの値を使わない。⚠️ 列が NULL 可なので本来は不要だが、
 *     ⚠️ ① の挙動と揃えるために入れている。
 */
const newDummyId = (): string =>
  `bl_${Date.now().toString(16)}${Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')}`;

// ---------------------------------------------------------------------------
// 一覧
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **`show_key = 0`（解除済み）も返す。**
 *   ⚠️ 画面に「有効/解除」のスイッチがあり、解除したものを戻せる必要がある。
 *   ⚠️ 反響一覧の突合（features/list/queries.ts の BLACK_SQL）は
 *     `show_key = 1` で絞っている。⚠️ **あちらと同じにしないこと。**
 */
export const runBlacklistEdit = async (): Promise<BlacklistResult> => {
  const blacklist = await query<DynamicRow>('SELECT * FROM `black_list`');
  return { httpStatus: 200, body: { blacklist } };
};

// ---------------------------------------------------------------------------
// 追加
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **採番された `no` を必ず返すこと。**
 *   ⚠️ 画面は返ってきた `no` をそのまま行のキーにして、
 *     ⚠️ **続けて編集した内容を同じ行へ送る。**
 *   ⚠️ 返さないと画面が `Date.now()` を仮のキーにするため、
 *     ⚠️ **その直後の編集が DB の別の行を更新しようとする。**
 */
export const runBlacklistInsert = async (
  body: Record<string, unknown>
): Promise<BlacklistResult> => {
  const name = toText(body.name).trim();
  if (name === '') {
    return { httpStatus: 400, body: { status: 'error', message: '顧客名を入力してください。' } };
  }

  // ⚠️ 画面が送ってくるが、無いときは今日（移植元と同じ `Y/m/d`）
  const today = new Date();
  const fallbackDate =
    `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

  const result = await execute(
    `INSERT INTO black_list (id, name, brand, date, mail, mobile, zip, full_address, note, show_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      toText(body.id) === '' ? newDummyId() : toText(body.id),
      name,
      toText(body.brand) === '' ? '全社' : toText(body.brand),
      toText(body.date) === '' ? fallbackDate : toText(body.date),
      toText(body.mail),
      toText(body.mobile),
      toText(body.zip),
      toText(body.full_address),
      // ⚠️ `note` は NOT NULL で DEFAULT が無い
      toText(body.note),
      body.show_key === undefined ? 1 : Number(body.show_key) === 1 ? 1 : 0,
    ]
  );

  return { httpStatus: 200, body: { status: 'success', no: String(result.insertId) } };
};

// ---------------------------------------------------------------------------
// 更新（1列だけ）
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **画面は「変えた1列だけ」を送ってくる**（`onBlur` ごとに1回）。
 *   ⚠️ `no` と `request` 以外のキーが**ちょうど1つ**入っている前提である。
 *   ⚠️ 移植元は `array_key_first()` で先頭を取っていた。ここでも同じく
 *     **許可リストに載っている最初のキー**を採用する。
 *
 * ⚠️ 該当が無ければ `invalid_request` を返す（移植元と同じ文字列）。
 *   ⚠️ 画面はこの値をコンソールに出すだけなので、⚠️ **黙って失敗して見える。**
 */
export const runBlacklistUpdate = async (
  body: Record<string, unknown>
): Promise<BlacklistResult> => {
  const no = Number(toText(body.no));
  if (!Number.isInteger(no) || no <= 0) {
    return { httpStatus: 200, body: { status: 'invalid_request' } };
  }

  const column = Object.keys(body).find(key => isAllowedColumn(key));
  if (column === undefined) {
    return { httpStatus: 200, body: { status: 'invalid_request' } };
  }

  /**
   * ⚠️ `show_key` だけは数値。⚠️ 文字列 `"0"` を入れると tinyint に 0 が入るので
   *   実害は無いが、⚠️ **型を揃えておく**（画面は `"0"` / `"1"` を送ってくる）。
   */
  const value =
    column === 'show_key' ? (Number(toText(body[column])) === 1 ? 1 : 0) : toText(body[column]);

  // ⚠️ 列名は許可リストを通ったものだけ。⚠️ **値は必ずプレースホルダで渡す。**
  const result = await execute(`UPDATE black_list SET \`${column}\` = ? WHERE \`no\` = ?`, [value, no]);

  return { httpStatus: 200, body: { status: result.affectedRows >= 0 ? 'success' : 'error' } };
};
```

### `frontend/src/components/header/EditBlackList.tsx`

```tsx
import React, { useState, useEffect, useContext, useMemo } from 'react';
import apiClient from '../../utils/apiClient';
import AuthContext from '../../context/AuthContext';

/**
 * ブラックリスト名簿の編集（ヘッダー → 反響管理 → ブラックリスト設定）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **`black_list` テーブル（名簿）と、反響の `black` タグはまったくの別物。**
 *   ⚠️ タグ側は `inquiry_customer*` のフラグ列で、list/ListOrder.tsx などが扱う。
 *   ⚠️ ここは**名簿そのもの**で、反響一覧の赤い行はこの名簿との突合で決まる
 *     （list/listUtils.ts の `isValidMobile()` と各画面の `isBlack()`）。
 *
 * ⚠️⚠️ **主キーは `no`（AUTO_INCREMENT）。`id` ではない。**
 *   ⚠️ `id` は text 列で、バックエンドが `bl_xxxx` を入れているだけの飾りである。
 *   ⚠️ 更新も削除も `no` で行う。⚠️ **`id` を使わないこと。**
 *
 * ⚠️⚠️ **保存は「1列ずつ・`onBlur` のたび」である。**
 *   ⚠️ 保存ボタンは無い。⚠️ 入力欄から離れた瞬間に送られる。
 *   ⚠️ バックエンドも「`no` と `request` 以外のキーが1つだけ」を前提にしている。
 *     ⚠️ **まとめて送る形に変えるならバックエンドも直すこと。**
 *
 * ⚠️ 2026-09-19 に Express へ移した（`features/blacklist.ts`）。
 *   ⚠️ ① に PHP ハンドラも残っているのでフォールバックが効く。
 *
 * ⚠️ 2026-09-19 に SaaS 風の見た目へ作り直した（GoogleReview.tsx に合わせた）。
 *   ⚠️ 表が横に広いので Header.tsx の `isFullscreenMenu` に入れてある。
 *     ⚠️ **外すと列が潰れて読めなくなる。**
 *   ⚠️ 閉じるボタンは Header.tsx 側が出す。⚠️ **ここに実装しないこと（二重になる）。**
 * ─────────────────────────────────────────────
 */

type BlacklistData = Record<string, string>;

const BRAND_OPTIONS = ['KH', 'DJH', 'なごみ', '2L', 'PG HOUSE', 'JH', 'かえる'];

/** 新規行の初期値。⚠️ `no` はサーバーが採番するので空のまま */
const EMPTY_ENTRY: BlacklistData = {
    no: '',
    name: '',
    brand: '全社',
    date: '',
    mail: '',
    mobile: '',
    zip: '',
    full_address: '',
    note: '',
    show_key: '1',
};

/**
 * 並べ替えできる列。
 * ⚠️ 既定は登録日の新しい順（作り直す前と同じ）。
 */
type SortKey = 'date' | 'name' | 'brand';
type SortOrder = 'asc' | 'desc';

const EditBlackList = () => {
    const [originalBlacklist, setOriginalBlacklist] = useState<BlacklistData[]>([]);
    const [targetBrand, setTargetBrand] = useState('');
    const [targetStatus, setTargetStatus] = useState('');
    const [searchName, setSearchName] = useState('');
    const [newEntry, setNewEntry] = useState(false);
    const [newEntryData, setNewEntryData] = useState<BlacklistData>(EMPTY_ENTRY);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    const { authority } = useContext(AuthContext);
    const isOrdinary = authority === 'ordinary';

    const safeFormat = (value: string) => value ?? '';

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'header_blacklist_edit' });
                setOriginalBlacklist(response.data.blacklist || []);
            } catch (err) {
                console.error(err);
                setError('ブラックリストを取得できませんでした。時間をおいて再度お試しください。');
            } finally {
                setLoading(false);
            }
        };

        void fetchData();
    }, []);

    /**
     * 表に出す行。
     *
     * ⚠️⚠️ **`useState` で絞り込み結果を持たないこと。**
     *   ⚠️ 作り直す前は `useEffect` で `setBlacklist(filtered)` としており、
     *     ⚠️ **1文字打つたびに再レンダリングが2回走っていた。**
     *   ⚠️ さらに元配列と絞り込み後の配列を**両方 setState** していたため、
     *     ⚠️ 片方だけ更新して食い違う事故が起きやすかった。
     *
     * ⚠️ `name` が null の行が実データにある。⚠️ **`?? ''` を外さないこと。**
     */
    const visible = useMemo(() => {
        const filtered = originalBlacklist.filter(o =>
            (targetBrand ? o.brand === targetBrand : true) &&
            (targetStatus ? String(o.show_key) === targetStatus : true) &&
            (searchName ? (o.name ?? '').includes(searchName) : true)
        );

        /** 登録日。⚠️ 実データに `2025/01/02` と `2025-01-02` が混在する */
        const timeOf = (value: string): number => {
            const text = (value ?? '').replace(/[/\\]/g, '-');
            const time = new Date(text).getTime();
            // ⚠️ 読めない日付は常に最後尾へ回すため 0 にする
            return Number.isNaN(time) ? 0 : time;
        };

        const keyOf = (item: BlacklistData): string | number => {
            switch (sortKey) {
                case 'name': return item.name ?? '';
                case 'brand': return item.brand ?? '';
                case 'date':
                default: return timeOf(item.date);
            }
        };

        // ⚠️ `sort` は破壊的。⚠️ **元の配列を直接並べ替えないこと**（state が壊れる）
        return [...filtered].sort((a, b) => {
            const av = keyOf(a);
            const bv = keyOf(b);
            const diff = typeof av === 'string' || typeof bv === 'string'
                ? String(av).localeCompare(String(bv), 'ja')
                : Number(av) - Number(bv);
            return sortOrder === 'asc' ? diff : -diff;
        });
    }, [originalBlacklist, targetBrand, targetStatus, searchName, sortKey, sortOrder]);

    const activeCount = useMemo(
        () => originalBlacklist.filter(o => Number(o.show_key) === 1).length,
        [originalBlacklist]
    );

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortKey(key);
        // ⚠️ 日付だけ既定を降順にする（新しいものを先に見たい）
        setSortOrder(key === 'date' ? 'desc' : 'asc');
    };

    /** 画面の値だけ先に差し替える。⚠️ 送信は `handleChange` が別に行う */
    const updateLocalState = (no: string, key: string, value: string) => {
        setOriginalBlacklist(prev =>
            prev.map(p => (String(p.no) === String(no) ? { ...p, [key]: value } : p))
        );
    };

    /**
     * 1列だけ保存する。
     * ⚠️⚠️ **`no` と `request` 以外のキーを2つ以上入れないこと。**
     *   ⚠️ バックエンドは先頭の1つしか見ない（許可リストで弾いている）。
     */
    const handleChange = (no: string, key: string, value: string) => {
        const updateData = async () => {
            try {
                const response = await apiClient.post('', {
                    no,
                    [key]: value,
                    request: 'header_blacklist_update',
                });
                if (response.data.status !== 'success') {
                    console.error('blacklist update failed', response.data);
                }
            } catch (err) {
                console.error(err);
            }
        };

        void updateData();
    };

    const handleSaveNewEntry = async () => {
        if (!newEntryData.name.trim()) {
            alert('顧客名を入力してください。');
            return;
        }

        try {
            const today = new Date();
            const currentDate = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

            const postData = {
                ...newEntryData,
                date: currentDate,
                request: 'header_blacklist_insert',
            };

            const response = await apiClient.post('', postData);

            if (response.data.status === 'success') {
                /**
                 * ⚠️⚠️ **採番された `no` を必ず使うこと。**
                 *   ⚠️ 続けてこの行を編集すると `no` を鍵に更新するため、
                 *     ⚠️ 仮の値のままだと**別の行を書き換えてしまう。**
                 */
                const newNo = response.data.no ?? String(Date.now());
                setOriginalBlacklist(prev => [{ ...postData, no: String(newNo) }, ...prev]);
                setNewEntry(false);
                setNewEntryData(EMPTY_ENTRY);
            } else {
                alert('登録に失敗しました: ' + response.data.message);
            }
        } catch (err) {
            console.error(err);
            alert('通信エラーが発生しました。');
        }
    };

    /** ⚠️ 絞り込みのセレクトは `PGH` を `PG HOUSE` に直してから使う */
    const formattedBrand = (brand: string) => brand.replace('PGH', 'PG HOUSE') ?? '';

    const sortIcon = (key: SortKey) => (
        <i
            className={`fa-solid ${sortKey === key && sortOrder === 'asc' ? 'fa-arrow-up-short-wide' : 'fa-arrow-down-wide-short'} ebl_sort_icon${sortKey === key ? ' is_active' : ''}`}
            aria-hidden="true"
        />
    );

    const sortableTh = (key: SortKey, label: string, width: string) => (
        <th className="ebl_th ebl_th_sort" style={{ width }} onClick={() => handleSort(key)}>
            {label}{sortIcon(key)}
        </th>
    );

    /** 入力欄。⚠️ 権限が ordinary のときは触らせない */
    const cell = (item: BlacklistData, key: string, placeholder = '') => (
        <input
            type="text"
            className="ebl_input"
            value={safeFormat(item[key])}
            placeholder={placeholder}
            disabled={isOrdinary}
            onChange={(e) => updateLocalState(item.no, key, e.target.value)}
            onBlur={(e) => handleChange(item.no, key, e.target.value)}
        />
    );

    const newCell = (key: string, placeholder = '') => (
        <input
            type="text"
            className="ebl_input"
            value={newEntryData[key]}
            placeholder={placeholder}
            onChange={(e) => setNewEntryData(prev => ({ ...prev, [key]: e.target.value }))}
        />
    );

    return (
        <div className="ebl_wrap">
            <style>{`
                /**
                 * ⚠️⚠️ 全画面モーダルの Modal.Body は **p-0 かつ overflow: hidden** である
                 *   （header/Header.tsx）。⚠️ そのため
                 *     ・余白はこちらで持つ
                 *     ・高さを使い切り、**表だけがスクロールする**形にする
                 *   ⚠️ height:100% と min-height:0 を外すと、表が画面外へ出て見えなくなる。
                 */
                .ebl_wrap { font-size: 13px; color: #1f2937;
                            height: 100%; display: flex; flex-direction: column;
                            padding: 16px 40px 20px; box-sizing: border-box; }
                .ebl_inner { width: 100%; max-width: 1500px; margin: 0 auto;
                             display: flex; flex-direction: column; min-height: 0; flex: 1; gap: 12px; }

                .ebl_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .ebl_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .ebl_note { font-size: 11px; color: #6b7280; }

                .ebl_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
                .ebl_kpi_card { flex: 1 1 160px; background: #fff; border: 1px solid #e5e7eb;
                                border-radius: 10px; padding: 10px 14px; }
                .ebl_kpi_label { font-size: 11px; color: #6b7280; }
                .ebl_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2;
                                 font-variant-numeric: tabular-nums; }

                .ebl_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap;
                           background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px;
                           padding: 10px 12px; }
                .ebl_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .ebl_select, .ebl_search { border: 1px solid #d1d5db; border-radius: 8px;
                                           padding: 6px 10px; font-size: 12px; background: #fff;
                                           color: #1f2937; outline: none; }
                .ebl_search { width: 200px; }
                .ebl_spacer { margin-left: auto; }

                .ebl_btn { border-radius: 8px; padding: 7px 14px; font-size: 12px;
                           font-weight: 700; cursor: pointer; border: 1px solid transparent;
                           white-space: nowrap; }
                .ebl_btn_primary { background: #2563eb; color: #fff; }
                .ebl_btn_primary:hover { background: #1d4ed8; }
                .ebl_btn_ghost { background: #fff; color: #4b5563; border-color: #d1d5db; }
                .ebl_btn_ghost:hover { background: #f3f4f6; }
                .ebl_btn:disabled { opacity: .5; cursor: not-allowed; }

                /* ⚠️ 表。⚠️ 見出しは固定する（件数が多いと見出しが流れるため）
                   ⚠️ flex:1 と min-height:0 で「残りの高さを使い切って中だけスクロール」 */
                .ebl_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto;
                                  background: #fff; flex: 1 1 auto; min-height: 0; }
                .ebl_table { width: 100%; min-width: 1500px; border-collapse: separate;
                             border-spacing: 0; font-size: 12px; }
                .ebl_th { position: sticky; top: 0; z-index: 2; background: #f8fafc;
                          border-bottom: 1px solid #e5e7eb; padding: 9px 12px; text-align: left;
                          font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
                .ebl_th_sort { cursor: pointer; user-select: none; }
                .ebl_th_sort:hover { background: #eef2f7; }
                .ebl_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .ebl_sort_icon.is_active { color: #2563eb; }
                .ebl_td { border-bottom: 1px solid #f1f5f9; padding: 6px 12px; vertical-align: middle; }
                .ebl_row:hover > .ebl_td { background: #f8fafc; }
                /* ⚠️ 解除済みの行。⚠️ 薄くするだけで**隠さない**（戻せる必要がある） */
                .ebl_row_off > .ebl_td { background: #fafafa; color: #9ca3af; }
                .ebl_new_row > .ebl_td { background: #eff6ff; }

                .ebl_no { font-variant-numeric: tabular-nums; color: #9ca3af; font-size: 11px; }
                .ebl_input { width: 100%; border: 1px solid transparent; border-radius: 6px;
                             padding: 5px 8px; font-size: 12px; background: transparent;
                             color: inherit; outline: none; }
                .ebl_input:hover:not(:disabled) { border-color: #e5e7eb; background: #fff; }
                .ebl_input:focus { border-color: #2563eb; background: #fff; }
                .ebl_input:disabled { cursor: default; }
                .ebl_name .ebl_input { font-weight: 700; }
                .ebl_date { font-size: 11px; color: #6b7280; white-space: nowrap; }

                .ebl_badge { font-size: 10px; font-weight: 700; border-radius: 999px;
                             padding: 3px 10px; white-space: nowrap; cursor: pointer;
                             border: 1px solid transparent; }
                .ebl_badge_on { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }
                .ebl_badge_off { background: #f3f4f6; color: #6b7280; border-color: #e5e7eb; }
                .ebl_badge:disabled { cursor: not-allowed; opacity: .6; }

                .ebl_empty { padding: 28px 12px; text-align: center; color: #9ca3af; font-size: 12px; }
                .ebl_error { font-size: 12px; color: #b91c1c; background: #fef2f2;
                             border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px; }
            `}</style>

            <div className="ebl_inner">
                <div className="ebl_head">
                    <div className="ebl_title">ブラックリスト設定</div>
                    <div className="ebl_note">
                        ここに登録した電話番号・メールアドレスと一致した反響は、反響一覧で赤く表示されます。
                    </div>
                </div>

                {error !== '' && <div className="ebl_error">{error}</div>}

                <div className="ebl_kpi">
                    <div className="ebl_kpi_card">
                        <div className="ebl_kpi_label">登録件数</div>
                        <div className="ebl_kpi_value">{originalBlacklist.length}</div>
                    </div>
                    <div className="ebl_kpi_card">
                        <div className="ebl_kpi_label">有効</div>
                        <div className="ebl_kpi_value">{activeCount}</div>
                    </div>
                    <div className="ebl_kpi_card">
                        <div className="ebl_kpi_label">解除済み</div>
                        <div className="ebl_kpi_value">{originalBlacklist.length - activeCount}</div>
                    </div>
                    <div className="ebl_kpi_card">
                        <div className="ebl_kpi_label">表示中</div>
                        <div className="ebl_kpi_value">{visible.length}</div>
                    </div>
                </div>

                <div className="ebl_bar">
                    <div>
                        <div className="ebl_label">ブランド</div>
                        <select
                            className="ebl_select"
                            value={targetBrand}
                            onChange={(e) => setTargetBrand(formattedBrand(e.target.value))}
                        >
                            <option value="">すべて</option>
                            {BRAND_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div>
                        {/* ⚠️ 作り直す前は `targetStatus` の state だけあって**選択する UI が無かった。** */}
                        <div className="ebl_label">状態</div>
                        <select
                            className="ebl_select"
                            value={targetStatus}
                            onChange={(e) => setTargetStatus(e.target.value)}
                        >
                            <option value="">すべて</option>
                            <option value="1">有効</option>
                            <option value="0">解除済み</option>
                        </select>
                    </div>
                    <div>
                        <div className="ebl_label">顧客名</div>
                        <input
                            type="text"
                            className="ebl_search"
                            placeholder="顧客名で検索"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                        />
                    </div>

                    <div className="ebl_spacer">
                        {newEntry ? (
                            <div className="d-flex gap-2">
                                <button type="button" className="ebl_btn ebl_btn_primary" onClick={handleSaveNewEntry}>
                                    <i className="fa-solid fa-check me-1" aria-hidden="true" />登録する
                                </button>
                                <button
                                    type="button"
                                    className="ebl_btn ebl_btn_ghost"
                                    onClick={() => { setNewEntry(false); setNewEntryData(EMPTY_ENTRY); }}
                                >
                                    キャンセル
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="ebl_btn ebl_btn_primary"
                                disabled={isOrdinary}
                                onClick={() => setNewEntry(true)}
                            >
                                <i className="fa-solid fa-user-slash me-1" aria-hidden="true" />対象者を追加
                            </button>
                        )}
                    </div>
                </div>

                <div className="ebl_table_wrap">
                    <table className="ebl_table">
                        <thead>
                            <tr>
                                <th className="ebl_th" style={{ width: '60px' }}>No</th>
                                {sortableTh('name', '顧客名', '170px')}
                                {sortableTh('brand', 'ブランド', '130px')}
                                {sortableTh('date', '登録日', '110px')}
                                <th className="ebl_th" style={{ width: '220px' }}>メールアドレス</th>
                                <th className="ebl_th" style={{ width: '150px' }}>電話番号</th>
                                <th className="ebl_th" style={{ width: '110px' }}>郵便番号</th>
                                <th className="ebl_th" style={{ width: '280px' }}>住所</th>
                                <th className="ebl_th" style={{ width: '260px' }}>備考</th>
                                <th className="ebl_th" style={{ width: '110px' }}>状態</th>
                            </tr>
                        </thead>
                        <tbody>
                            {newEntry && (
                                <tr className="ebl_new_row">
                                    <td className="ebl_td ebl_no">自動</td>
                                    <td className="ebl_td ebl_name">{newCell('name', '顧客名')}</td>
                                    <td className="ebl_td">
                                        <select
                                            className="ebl_select"
                                            style={{ width: '100%' }}
                                            value={newEntryData.brand}
                                            disabled={isOrdinary}
                                            onChange={(e) => setNewEntryData(prev => ({ ...prev, brand: e.target.value }))}
                                        >
                                            {BRAND_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </td>
                                    <td className="ebl_td ebl_date">自動</td>
                                    <td className="ebl_td">{newCell('mail', 'info@example.com')}</td>
                                    <td className="ebl_td">{newCell('mobile', '090-0000-0000')}</td>
                                    <td className="ebl_td">{newCell('zip', '000-0000')}</td>
                                    <td className="ebl_td">{newCell('full_address', '都道府県市区町村 番地')}</td>
                                    <td className="ebl_td">{newCell('note', '備考')}</td>
                                    <td className="ebl_td">
                                        <button
                                            type="button"
                                            className={`ebl_badge ${newEntryData.show_key === '1' ? 'ebl_badge_on' : 'ebl_badge_off'}`}
                                            disabled={isOrdinary}
                                            onClick={() => setNewEntryData(prev => ({
                                                ...prev,
                                                show_key: prev.show_key === '1' ? '0' : '1',
                                            }))}
                                        >
                                            {newEntryData.show_key === '1' ? '有効' : '解除済み'}
                                        </button>
                                    </td>
                                </tr>
                            )}

                            {visible.map((item, index) => {
                                const isOn = Number(item.show_key) === 1;
                                return (
                                    <tr key={item.no ?? index} className={`ebl_row${isOn ? '' : ' ebl_row_off'}`}>
                                        <td className="ebl_td ebl_no">{item.no ?? '-'}</td>
                                        <td className="ebl_td ebl_name">{cell(item, 'name')}</td>
                                        <td className="ebl_td">
                                            <select
                                                className="ebl_select"
                                                style={{ width: '100%' }}
                                                value={item.brand || '全社'}
                                                disabled={isOrdinary}
                                                onChange={(e) => {
                                                    updateLocalState(item.no, 'brand', e.target.value);
                                                    handleChange(item.no, 'brand', e.target.value);
                                                }}
                                            >
                                                {/* ⚠️ 実データに `全社` が入っている行がある。⚠️ 選択肢に無いと空欄になる */}
                                                <option value="全社">全社</option>
                                                {BRAND_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                        </td>
                                        <td className="ebl_td ebl_date">{safeFormat(item.date)}</td>
                                        <td className="ebl_td">{cell(item, 'mail')}</td>
                                        <td className="ebl_td">{cell(item, 'mobile')}</td>
                                        <td className="ebl_td">{cell(item, 'zip')}</td>
                                        <td className="ebl_td">{cell(item, 'full_address')}</td>
                                        <td className="ebl_td">{cell(item, 'note')}</td>
                                        <td className="ebl_td">
                                            <button
                                                type="button"
                                                className={`ebl_badge ${isOn ? 'ebl_badge_on' : 'ebl_badge_off'}`}
                                                disabled={isOrdinary}
                                                onClick={() => {
                                                    const next = isOn ? '0' : '1';
                                                    updateLocalState(item.no, 'show_key', next);
                                                    handleChange(item.no, 'show_key', next);
                                                }}
                                            >
                                                {isOn ? '有効' : '解除済み'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {!loading && visible.length === 0 && (
                                <tr>
                                    <td className="ebl_empty" colSpan={10}>
                                        該当する登録はありません。
                                    </td>
                                </tr>
                            )}
                            {loading && (
                                <tr>
                                    <td className="ebl_empty" colSpan={10}>読み込み中です…</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default EditBlackList;
```

---

## ⚠️ registry.ts に足した登録

```ts
register({
  request: 'header_blacklist_edit',
  summary: 'ブラックリスト名簿の一覧（解除済みも含む）',
  phpSource: 'backend/src/handlers/header_blacklist_edit.php',
  auth: 'staff',
  handler: async () => runBlacklistEdit(),
});

register({
  request: 'header_blacklist_insert',
  summary: '【書き込み】ブラックリスト名簿へ1件追加（採番された no を返す）',
  phpSource: 'backend/src/handlers/header_blacklist_insert.php',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runBlacklistInsert(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

register({
  request: 'header_blacklist_update',
  summary: '【書き込み】ブラックリスト名簿の1列だけ更新（許可リストあり）',
  phpSource: 'backend/src/handlers/header_blacklist_update.php',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runBlacklistUpdate(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});
```

⚠️ `auth` は ⚠️ **`'staff'`**（⚠️ 画面からしか呼ばれない。sync は呼ばない）。

---

## ⚠️ express_proxy.php に足した許可

```php
        // -----------------------------------------------------------------
        // 2026-09-19 移植。ブラックリスト名簿の編集。
        //
        // ⚠️⚠️ **insert / update は書き込みだが expressProxyExclusive() には入れない。**
        //   ⚠️ ① に PHP ハンドラが3本とも実在する（header_blacklist_*.php）。
        //   ⚠️ ② が落ちても ① へフォールバックして動く。
        //   ⚠️ 転送が成功した時点で ① 側は実行しないので二重書き込みにはならない。
        // -----------------------------------------------------------------
        'header_blacklist_edit',
        'header_blacklist_insert',
        'header_blacklist_update',
```

---

## ⚠️ やっていないこと

| # | 内容 | 理由 |
|---|---|---|
| 1 | ⚠️ PHP ハンドラ3本の削除 | ⚠️ **フォールバック先として残す** |
| 2 | ⚠️ 行の削除機能 | ⚠️ **元から無い。** 解除（`show_key = 0`）で運用している |
| 3 | ⚠️ 電話番号の入力チェック（9桁以下を弾く） | ⚠️ **指示に無い**（⚠️ `isValidMobile` と揃えるかは要相談） |
| 4 | ⚠️ まとめて保存 | ⚠️ **バックエンドの前提が変わる** |
| 5 | ⚠️ `InquiryIntroductory.tsx` 側の変更 | ⚠️ **参照しただけ** |

---

## 検証

| 確認 | 結果 |
|---|---|
| `npx tsc --noEmit`（backend-express） | ⚠️ **エラー0件** |
| `npm run build`（frontend） | ⚠️ **成功** |
| ⚠️ `EditBlackList.tsx` の警告 | ⚠️ **0件** |
| ⚠️ `Header.tsx` の新規警告 | ⚠️ **0件** |
| ⚠️ 許可リストの列（PHP ↔ TS） | ⚠️ **8列とも一致** |

### ⚠️ 未実施

⚠️⚠️ **Docker Desktop が起動していないため、② のローカル実行で確かめていない。**

| # | 確認 | 期待 |
|---|---|---|
| 1 | ヘッダー → 反響管理 → ブラックリスト設定 | ⚠️ **全画面で開く。左上に閉じるボタン** |
| 2 | KPIカード | ⚠️ **登録件数＝有効＋解除済み** |
| 3 | 「状態」で「解除済み」を選ぶ | ⚠️ **薄い行だけが残る** |
| 4 | 顧客名を編集して欄の外をクリック | ⚠️ **保存される**（⚠️ 再読み込みで残る） |
| 5 | ⚠️ 「対象者を追加」→ 登録 → ⚠️ **続けてその行を編集** | ⚠️ **同じ行が更新される**（⚠️ `no` が返っている） |
| 6 | 状態バッジを押す | ⚠️ **有効 ⇄ 解除済みが切り替わり保存される** |
| 7 | ⚠️ 一般権限（ordinary）で開く | ⚠️ **すべて編集できない** |
| 8 | ⚠️ 反響一覧（注文） | ⚠️ **赤い行が 183 → 141 に減る**（⚠️ 別の指示ぶん） |
