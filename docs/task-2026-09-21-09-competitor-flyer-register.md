# 他社資料の画面からチラシを登録できるようにする（v2.2.140）

⚠️ 指示（`ReadMeClaude.md`）:

> - `CompetitorMaterials.tsx` の改修
>   * チラシの登録をこのコンポネントからできるようにする
>   * 社名の選択 → InformationEdit.tsx のようにサジェスト機能にて
>   * ID は顧客と紐づく必要がないのでなんでもよい administrator とか master とか marketing とか
>     なんでもいいので不都合のない範囲で付与する

⚠️ 確認のうえ決めたこと:

| 決めたこと | 選んだ形 |
|---|---|
| 種別 | ⚠️ **チラシ固定**（セレクトを出さない） |
| 削除・編集 | ⚠️ **今回は付けない**（登録のみ） |

---

## ⚠️ 触ったファイル

| ディレクトリ | ファイル | 種別 |
|---|---|---|
| `frontend/src/components/header/` | ⚠️ **`CompetitorMaterials.tsx`** | ⚠️ 改修 |

⚠️⚠️ **バックエンドと `utils/competitorPdfUpload.ts` は一切変更していない。**
⚠️ 既存の `uploadCompetitorPdf()` と ① の `competitor_pdf_upload.php` をそのまま使う。

---

## ⚠️ 1. いちばん重要な落とし穴

⚠️⚠️ **① の `competitor_pdf_upload.php` は「その id の行をいったん全部消してから入れ直す」方式である。**

```php
$deleteStmt = $pdo->prepare('DELETE FROM competitor_pdf WHERE id = :id');
$deleteStmt->execute(['id' => $id]);
```

⚠️ 指示にあった `marketing` のような ⚠️ **固定の id をそのまま使うと、
2回目の登録で1回目のチラシが黙って消える。**
⚠️ ⚠️ **エラーにならない。** 応答も `status: success` のままである。

→ ⚠️ **登録1回ごとに新しい id を作る**形にした。⚠️ 既存行に一切触らない。

⚠️ ローカルで ⚠️ **3回続けて登録し、3件とも残ることを実データで確認した**（下の「検証」）。

---

## ⚠️ 2. 追加した型・定数・関数（そのまま）

```ts
/** 他社名の候補。⚠️ `letter` は読み仮名で、絞り込みにだけ使う */
type Maker = {
    label: string;
    letter: string;
};

/** 登録パネルの1行。⚠️ `file` が無い行は送らない */
type NewEntry = {
    file: File;
    name: string;
    company: string;
};

/**
 * この画面から登録するときの種別。
 *
 * ⚠️⚠️ **チラシ固定である。** ⚠️ 画面にセレクトを出さないこと（指示）。
 *   ⚠️ `PDF_CATEGORIES` の綴りと ⚠️ **1文字でも違うと ① が空文字にする**ので、
 *     ⚠️ **直に書かず定数から取る。**
 */
const FLYER_CATEGORY: PdfCategory = PDF_CATEGORIES[2];

/**
 * 顧客に紐づかない資料の id の接頭辞。
 *
 * ⚠️⚠️ **`competitor_pdf.id` は本来 master_data*.id だが、
 *   チラシは顧客に紐づかないので独自の値を振る**（指示）。
 *   ⚠️ 一覧 SQL は `LEFT JOIN` なので、⚠️ **顧客が引けなくても行は出る。**
 */
const STANDALONE_ID_PREFIX = 'marketing_';

/**
 * 登録1回ぶんの id を作る。
 *
 * ⚠️⚠️ **登録のたびに必ず新しい値にすること。**
 *   ⚠️ ① の `competitor_pdf_upload.php` は
 *     ⚠️ **`DELETE FROM competitor_pdf WHERE id = :id` で全部消してから入れ直す。**
 *   ⚠️ ⚠️ **固定の id（'marketing' など）にすると、2回目の登録で
 *     1回目のチラシが黙って消える。** ⚠️ エラーにもならない。
 *
 * ⚠️ 列は VARCHAR(64)。⚠️ この形で 30 文字ほどなので収まる。
 */
const makeStandaloneId = (): string => {
    const d = new Date();
    const p = (n: number): string => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
        + `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    // ⚠️ 同じ秒に2人が登録しても衝突しないように乱数を足す
    const rand = Math.random().toString(36).slice(2, 8);
    return `${STANDALONE_ID_PREFIX}${stamp}_${rand}`;
};

/** 顧客に紐づかない資料か。⚠️ 一覧で札を出すのに使う */
const isStandalone = (m: { id: string }): boolean =>
    String(m.id ?? '').startsWith(STANDALONE_ID_PREFIX);

/** 拡張子を落とした名前。⚠️ 表示名の既定値 */
const baseName = (fileName: string): string => fileName.replace(/\.pdf$/i, '');
```

---

## ⚠️ 3. コンポーネント内に追加した関数（そのまま）

### ⚠️ 3-1. `fetchData`（既存の `useEffect` から切り出し）

⚠️ 登録のあとに呼び直すため `useCallback` にした。
⚠️⚠️ **他社名の候補（`maker`）は同じ応答に既に入っている。** ⚠️ **API を足していない。**

```ts
const fetchData = useCallback(async () => {
    try {
        const res = await apiClient.post('', { request: 'competitor_pdf' });
        setMaterials((res.data?.pdf ?? []) as Material[]);
        setMakers((res.data?.maker ?? []) as Maker[]);
        setError('');
    } catch (err) {
        console.error(err);
        setError('他社資料を取得できませんでした。時間をおいて再度お試しください。');
    } finally {
        setLoading(false);
    }
}, []);

useEffect(() => {
    void fetchData();
}, [fetchData]);
```

### 3-2. 入力欄の出し入れ

```ts
const addFiles = (fileList: FileList | null) => {
    const picked = [...(fileList ?? [])];
    if (picked.length === 0) return;
    setSaveDone('');

    /**
     * ⚠️⚠️ **PDF 以外はここで止める。**
     *   ⚠️ ① の `competitor_pdf_upload.php` は PDF でないファイルを
     *     ⚠️ **黙って捨てる**（エラーにしない）。
     *   ⚠️ ⚠️ **`status: success` が返るのに1件も登録されない**ので、
     *     ⚠️ 画面で気づけるようにしておく。
     */
    const pdfs = picked.filter(f => /\.pdf$/i.test(f.name));
    const dropped = picked.length - pdfs.length;
    setSaveError(dropped === 0 ? '' : `PDF以外の ${dropped} 件は登録できないため外しました。`);
    if (pdfs.length === 0) return;

    setEntries(prev => [
        ...prev,
        ...pdfs.map(file => ({ file, name: baseName(file.name), company: '' })),
    ]);
};

const updateEntry = (index: number, patch: Partial<NewEntry>) => {
    setEntries(prev => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
};

const removeEntry = (index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
    setSuggestRow(-1);
};

const closeRegister = () => {
    setRegisterOpen(false);
    setEntries([]);
    setSuggestRow(-1);
    setSaveError('');
};
```

### ⚠️ 3-3. `handleRegister`（登録）

```ts
/**
 * 登録。
 *
 * ⚠️⚠️ **1回の登録につき id は1つだけ作り、ファイルはまとめて送る。**
 *   ⚠️ ① は `existing_pdfs` ＋ 新規 ＝ 最終状態の完全上書き方式だが、
 *     ⚠️ **新しい id なので消える既存行が無い。**
 *   ⚠️ ⚠️ **既に登録済みのチラシには一切触らない。**
 */
const handleRegister = async () => {
    if (entries.length === 0) {
        setSaveError('PDFを選んでください。');
        return;
    }
    setSaving(true);
    setSaveError('');
    setSaveDone('');
    try {
        await uploadCompetitorPdf(
            makeStandaloneId(),
            entries.map(e => ({
                // ⚠️ 表示名を消されたらファイル名に戻す（名前なしの行を作らない）
                name: e.name.trim() === '' ? baseName(e.file.name) : e.name.trim(),
                file: e.file,
                staff: userName,
                company: e.company.trim(),
                category: FLYER_CATEGORY,
            })),
            token
        );
        setSaveDone(`${entries.length} 件のチラシを登録しました。`);
        setEntries([]);
        setSuggestRow(-1);
        await fetchData();
    } catch (err) {
        console.error(err);
        setSaveError(err instanceof Error ? err.message : 'チラシの登録に失敗しました。');
    } finally {
        setSaving(false);
    }
};
```

### ⚠️ 3-4. `suggestFor`（社名のサジェスト）

⚠️ `information/TableCompetitor.tsx` と ⚠️ **同じ絞り込み**にしてある。

```ts
/**
 * 社名のサジェスト。
 * ⚠️ information/TableCompetitor.tsx と同じ絞り込み（`letter` は読み仮名）。
 */
const suggestFor = (text: string): Maker[] => {
    const word = text.trim();
    if (word === '') return [];
    return makers.filter(m => m.letter.includes(word) || m.label.includes(word)).slice(0, 50);
};
```

⚠️ 元の `InformationEdit.tsx` は `useEffect` で `makerList` を state に持っているが、
⚠️ ここは ⚠️ **行ごとに入力欄がある**ので、行ごとに計算する形にした。
⚠️ 候補は 379件なので毎回絞っても軽い。⚠️ **50件で打ち切っている**（画面に収まらないため）。

---

## ⚠️ 4. 追加した state

```ts
const { token, userName } = useContext(AuthContext);

/** チラシの登録パネル */
const [registerOpen, setRegisterOpen] = useState(false);
const [entries, setEntries] = useState<NewEntry[]>([]);
/** サジェストを出している行。⚠️ -1 なら出さない */
const [suggestRow, setSuggestRow] = useState(-1);
const [saving, setSaving] = useState(false);
const [saveError, setSaveError] = useState('');
const [saveDone, setSaveDone] = useState('');

const [makers, setMakers] = useState<Maker[]>([]);
```

---

## ⚠️ 5. 追加した JSX（そのまま）

### 5-1. 「チラシを登録」ボタン（検索バーの右）

```tsx
<div className="cm_spacer d-flex align-items-center gap-2">
    <button
        type="button"
        className={`cm_add${registerOpen ? ' is_off' : ''}`}
        onClick={() => (registerOpen ? closeRegister() : setRegisterOpen(true))}
    >
        <i className={`fa-solid ${registerOpen ? 'fa-xmark' : 'fa-plus'} me-1`} aria-hidden="true" />
        {registerOpen ? '閉じる' : 'チラシを登録'}
    </button>
    <div className="cm_toggle">
```

### 5-2. 登録パネル

```tsx
{saveDone !== '' && <div className="cm_done">{saveDone}</div>}

{registerOpen && (
    <div className="cm_panel">
        <div className="cm_panel_head">
            <span className="cm_panel_title">
                <i className="fa-solid fa-rectangle-ad me-2" aria-hidden="true" />チラシを登録
            </span>
            <span className="cm_panel_note">
                ⚠️ 種別は「チラシ」で登録されます。お客様には紐づきません。
                その他の資料はお客様の詳細画面から登録してください。
            </span>
        </div>

        <div className="cm_drop">
            PDF を選んでください（複数選べます）
            <input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
        </div>

        {entries.length > 0 && (
            <div className="cm_entries">
                {entries.map((entry, index) => (
                    <div className="cm_entry" key={`${entry.file.name}_${index}`}>
                        <span className="cm_entry_file" title={entry.file.name}>
                            <i className="fa-solid fa-file-pdf text-danger me-1" aria-hidden="true" />
                            {entry.file.name}
                        </span>

                        <span className="cm_entry_name">
                            <input
                                type="text"
                                className="cm_input"
                                placeholder="表示名"
                                value={entry.name}
                                onChange={(e) => updateEntry(index, { name: e.target.value })}
                            />
                        </span>

                        <span className="cm_entry_company">
                            <input
                                type="text"
                                className="cm_input"
                                placeholder="他社名（任意）"
                                value={entry.company}
                                onFocus={() => setSuggestRow(index)}
                                onBlur={() => setSuggestRow(-1)}
                                onChange={(e) => {
                                    updateEntry(index, { company: e.target.value });
                                    setSuggestRow(index);
                                }}
                            />
                            {suggestRow === index && suggestFor(entry.company).length > 0 && (
                                <div className="cm_sug">
                                    {suggestFor(entry.company).map(m => (
                                        <div
                                            key={m.label}
                                            className="cm_sug_item"
                                            /* ⚠️ onClick だと先に onBlur で閉じてしまい選べない */
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                updateEntry(index, { company: m.label });
                                                setSuggestRow(-1);
                                            }}
                                        >
                                            {m.label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </span>

                        <button
                            type="button"
                            className="cm_entry_del"
                            title="この行を外す"
                            onClick={() => removeEntry(index)}
                        >
                            <i className="fa-solid fa-xmark" aria-hidden="true" />
                        </button>
                    </div>
                ))}
            </div>
        )}

        {saveError !== '' && <div className="cm_error">{saveError}</div>}

        <div className="cm_panel_foot">
            <button
                type="button"
                className="cm_save"
                disabled={saving || entries.length === 0}
                onClick={() => { void handleRegister(); }}
            >
                {saving ? '登録中…' : `${entries.length} 件を登録`}
            </button>
            <button type="button" className="cm_cancel" onClick={closeRegister}>
                やめる
            </button>
            <span className="cm_panel_note">登録者: {userName || '－'}</span>
        </div>
    </div>
)}
```

⚠️⚠️ **`onMouseDown` で `preventDefault()` しているのが要点。**
⚠️ `onClick` にすると ⚠️ **先に `onBlur` が走ってサジェストが閉じ、候補を選べない。**

### 5-3. 一覧の「社内登録」の札

```tsx
<td className="cm_td">
    {/* ⚠️ この画面から登録したチラシは顧客に紐づかない。⚠️ 空欄との区別を付ける */}
    {isStandalone(m)
        ? <span className="cm_tag is_house">社内登録</span>
        : (m.customer_name ? `${m.customer_name} 様` : '－')}
</td>
```

---

## ⚠️ 6. 追加した CSS（`cm_` 接頭辞・そのまま）

```css
.cm_done { font-size: 12px; color: #166534; background: #f0fdf4;
           border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 12px; }

/* チラシの登録。⚠️ 一覧の上に開く（別画面にしない＝登録結果がすぐ見える） */
.cm_add { border: 0; border-radius: 8px; background: #2563eb; color: #fff;
          font-size: 12px; font-weight: 700; padding: 6px 14px; cursor: pointer;
          white-space: nowrap; }
.cm_add:hover { background: #1d4ed8; }
.cm_add.is_off { background: #fff; color: #4b5563; border: 1px solid #d1d5db; }

.cm_panel { background: #fff; border: 1px solid #bfdbfe; border-radius: 10px;
            padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.cm_panel_head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cm_panel_title { font-weight: 700; font-size: 13px; }
.cm_panel_note { font-size: 11px; color: #6b7280; }
.cm_drop { border: 1px dashed #93c5fd; border-radius: 8px; background: #f8fafc;
           padding: 14px; text-align: center; font-size: 12px; color: #4b5563; }
.cm_drop input { display: block; margin: 8px auto 0; font-size: 12px; }

.cm_entries { display: flex; flex-direction: column; gap: 8px;
              max-height: 260px; overflow: auto; }
.cm_entry { display: flex; align-items: flex-start; gap: 8px;
            border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; }
.cm_entry_file { font-size: 11px; color: #6b7280; width: 160px; flex: none;
                 overflow-wrap: anywhere; }
.cm_input { border: 1px solid #d1d5db; border-radius: 6px; padding: 5px 8px;
            font-size: 12px; background: #fff; color: #1f2937; outline: none; width: 100%; }
.cm_input:focus { border-color: #2563eb; }
.cm_entry_name { flex: 1 1 240px; }
/* ⚠️ サジェストを絶対配置で乗せるので position: relative が要る */
.cm_entry_company { flex: 1 1 200px; position: relative; }
.cm_sug { position: absolute; top: 100%; left: 0; width: 100%; margin-top: 2px;
          background: #fff; border: 1px solid #e5e7eb; border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,.08);
          max-height: 200px; overflow-y: auto; z-index: 1050; }
.cm_sug_item { padding: 5px 8px; font-size: 12px; cursor: pointer; }
.cm_sug_item:hover { background: #eff6ff; }
.cm_entry_del { border: 0; background: none; color: #9ca3af; cursor: pointer;
                font-size: 14px; padding: 4px 6px; }
.cm_entry_del:hover { color: #dc2626; }
.cm_panel_foot { display: flex; align-items: center; gap: 10px; }
.cm_save { border: 0; border-radius: 8px; background: #16a34a; color: #fff;
           font-size: 12px; font-weight: 700; padding: 7px 18px; cursor: pointer; }
.cm_save:disabled { background: #d1d5db; cursor: not-allowed; }
.cm_cancel { border: 1px solid #d1d5db; border-radius: 8px; background: #fff;
             color: #4b5563; font-size: 12px; padding: 7px 14px; cursor: pointer; }
/* 社内登録の札。⚠️ 顧客の商談資料と見分けるため */
.cm_tag.is_house { background: #eff6ff; color: #1d4ed8; }
```

---

## ⚠️ 検証（ローカル実データ）

⚠️ ⚠️ **画面からの操作ではなく、実際に ① と同じ PHP へ multipart を投げて確かめた。**

| 確認 | 結果 |
|---|---|
| ⚠️ **登録（`competitor_pdf_upload`）** | ⚠️ **`{"status":"success","uploaded":1,"total":1}`** |
| ⚠️ **DB に入った値** | ⚠️ **name / staff / company / category が欠けずに入る**（下の表） |
| ⚠️⚠️ **3回続けて登録** | ⚠️⚠️ **3件とも残る**（id を毎回変えているため） |
| ⚠️ 一覧 SQL の結合 | ⚠️ **顧客が引けなくても行は出る**（`customer_name` は空） |
| ⚠️ 他社名の候補 | ⚠️ **379件**（`house_maker`） |
| `npm run build` | ⚠️ **成功**（711.6 kB、+2.1 kB） |
| ⚠️ このコンポーネントの警告 | ⚠️ **0件**（`node_modules/.cache` を消して再ビルド） |

```
| no | id                               | name                       | staff    | company  | category |
| 64 | marketing_20260921_150000_test01 | 秋のリフォーム相談会チラシ | 河野伸二 | 七呂建設 | チラシ   |
| 65 | marketing_20260921_150001_test02 | 2回目のチラシ              | 河野伸二 |          | チラシ   |
| 66 | marketing_20260921_150002_test03 | 3回目のチラシ              | 河野伸二 |          | チラシ   |
```

⚠️ ⚠️ **テストで入れた3行と、アップロードされた3ファイルの実体は削除済み**（`competitor_pdf` は53行に戻してある）。

### ⚠️ 検証中に出た（コードとは無関係の）失敗

⚠️ 最初の `curl` が ⚠️ **`Incorrect string value`** で失敗した。
⚠️ ⚠️ **Git Bash のコマンドラインに日本語を書いて化けただけ**で、⚠️ **実装の問題ではない。**
⚠️ Python から UTF-8 で multipart を組み直したら通った。

---

## ⚠️ 未実施（ブラウザでの確認）

- [ ] ヘッダー → 他社動向 → 他社資料 で「チラシを登録」が出るか
- [ ] PDF を複数選んで、行が選んだ数だけ増えるか
- [ ] 表示名の既定が ⚠️ **拡張子なしのファイル名**になっているか
- [ ] 社名を打つと ⚠️ **候補が出て、クリックで入るか**（⚠️ **読み仮名でも引けるか**）
- [ ] 登録後に ⚠️ **「チラシ」フォルダに入るか**、⚠️ **他社フォルダが正しいか**
- [ ] 一覧のお客様名の欄に ⚠️ **「社内登録」の札**が出るか
- [ ] ⚠️ **PDF 以外を選んだとき**に ⚠️ **「PDF以外の N 件は登録できないため外しました。」**が出るか
      （⚠️ ① 側は ⚠️ **黙って捨てる**ので、⚠️ **画面側で止めている**）
