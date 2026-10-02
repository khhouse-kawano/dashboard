# 2026-09-28 (5) 「要確認」ボタンと、報告されたコンソールエラーの調査（v2.2.150）

⚠️ [task-2026-09-28-04](task-2026-09-28-04-daily-action-campaign-and-trigger.md) の続き。⚠️ **同じ版**。

## 依頼（`ReadMeClaude.md`）

1. ⚠️ **コンソールにエラー表示**

```
Uncaught Error: Element type is invalid: expected a string (for built-in components)
or a class/function (for composite components) but got: undefined.
You likely forgot to export your component from the file it's defined in,
or you might have mixed up default and named imports.

Check the render method of `AppInner`.
```

2. ⚠️ `ActiveUser.tsx` のユーザー名の上に、⚠️ **`category === 'order'` のときのみ常に「要確認」ボタン**を出す
   → ⚠️ クリックで `DailyAction.tsx` を開く
   → ⚠️⚠️ **すでに確認済みのユーザーは「確認しました」→「閉じる」に変更**

---

## ⚠️⚠️ 1. コンソールエラー — 再現しなかった

⚠️ **現在のソースからは再現しない。** ⚠️ 次の4つをすべて確認した。

| # | 調べたこと | 結果 |
|---|---|---|
| 1 | `DailyAction.tsx` の `export default` | ⚠️ **ある**（392行目） |
| 2 | `App.tsx` の import 先 | ⚠️ **正しい**（`./components/DailyAction`） |
| 3 | ⚠️ **`DailyActionModal` への参照が残っていないか** | ⚠️ **0件**（⚠️ ファイルも削除済み） |
| 4 | ⚠️⚠️ **循環 import** | ⚠️⚠️ **0件**（⚠️ `src` 全体を機械的に探索した） |

⚠️ さらに ⚠️ **型チェックもエラー0件**、⚠️ **ビルドも成功**する。

### ⚠️ 原因の見立て

⚠️⚠️ **開発サーバー（`npm start`）が握っていた古いモジュールだと考えられる。**
⚠️ 直前の版で ⚠️ **`DailyActionModal.tsx` を消して `DailyAction.tsx` を作った**（改名）。
⚠️ ⚠️ **起動したままファイルを消すと、HMR が消えたモジュールを参照し続けてこのエラーになる。**

⚠️ ⚠️ **対処: `npm start` を止めて開き直す**（⚠️ ブラウザの再読み込みだけでは消えないことがある）。

### ⚠️⚠️ ただし、別の本当の問題を見つけた

⚠️⚠️ **`frontend/tsconfig.json` の `include` が壊れている。**

```json
  "include": ["frontend/src", "frontend/src/types/images.d.ts"],
```

⚠️ `include` は ⚠️ **tsconfig.json のある場所からの相対**である。
⚠️ ⚠️ **いまは `frontend/frontend/src` を指しており、存在しない。**

```
error TS18003: No inputs were found in config file '.../frontend/tsconfig.json'.
```

⚠️⚠️ **そのため `react-scripts build` の型チェックが何も見ていない。**
⚠️ 実際、⚠️ **型エラーでビルドが落ちたことが一度も無い**（⚠️ 落ちたのは Babel の構文エラーだけ）。

⚠️ ⚠️ **直すなら `"include": ["src"]` の1行。**
⚠️ ⚠️ **今回は直していない**（⚠️ 指示に無く、⚠️ **直すと既存の型エラーが一斉に出てビルドが通らなくなる可能性がある**ため）。
⚠️ 今回は ⚠️ **`include` を直した使い捨ての tsconfig で確認した**（⚠️ `src` 配下の `.tsx` は ⚠️ **エラー0件**。⚠️ `test.js` / `work.js` という古い JS だけが引っかかる）。

---

## 2. 「要確認」ボタン

### `frontend/src/components/DailyAction.tsx`

**(a) 外から開くための入口（⚠️ 新規）**

```tsx
/**
 * ⚠️⚠️ **自動では出さない画面。**
 *   ⚠️ `App.tsx` の「メニューを出す条件」と同じにしてある。
 *   ⚠️ ⚠️ **手動（ActiveUser の「要確認」ボタン）では出せる。**
 */
const NO_AUTO_OPEN: string[] = ['/home', '/login'];

/**
 * ⚠️⚠️ **外から開くための入口**（2026-09-28）。
 *   ⚠️ `ActiveUser.tsx` の「要確認」ボタンが呼ぶ。
 *   ⚠️ ⚠️ **状態を持ち回さずに済ませるため、purpose を絞った小さな購読にしてある。**
 *     ⚠️ Context を足すと `App.tsx` の階層を触ることになり、影響範囲が広い。
 *   ⚠️ 実体は `DailyAction` が1つだけ描画されている前提（⚠️ `App.tsx` を参照）。
 */
type Listener = () => void;
const listeners = new Set<Listener>();
export const openDailyAction = (): void => {
    listeners.forEach((listener) => listener());
};
```

**(b) 取得を関数に切り出した（⚠️ 自動と手動で使い分ける）**

```tsx
    /**
     * ⚠️⚠️ **今日もう「確認しました」を押しているか。**
     *   ⚠️ 押していれば ⚠️ **自動では出さない**が、⚠️ **ボタンからは開ける。**
     *   ⚠️ そのときの閉じるボタンは ⚠️ **「閉じる」**（⚠️ 二重に記録しない）。
     */
    const [alreadyChecked, setAlreadyChecked] = useState(false);

    /**
     * 件数を取ってくる。
     *
     * ⚠️ `force` … ⚠️ **ボタンから開いたときは取り直す**（⚠️ 古い数字を見せたくない）。
     *   ⚠️ 自動で出すときは ⚠️ **5分キャッシュ**を使う（⚠️ 画面を移るたびに叩かないため）。
     */
    const load = (force: boolean): Promise<ListResponse> => {
        const now = Date.now();
        if (force || cached === null || now - cached.at > CACHE_MS) {
            cached = {
                at: now,
                promise: apiClient
                    .post('', { request: 'daily_action', roll: 'list', category })
                    .then((response) => (response.data ?? {}) as ListResponse),
            };
        }
        return cached.promise;
    };

    /** ⚠️ 受け取った結果を画面の状態へ移す。⚠️ 自動・手動の両方から呼ぶ */
    const apply = (data: ListResponse): void => {
        setSections(data.sections ?? []);
        setTotal(Number(data.total ?? 0));
        setTruncated(data.truncated === true);
        setAlreadyChecked(data.show !== true);
    };

    /**
     * ⚠️ 取得に失敗したとき。
     *
     * ⚠️ 黙らせない。⚠️ **空なのか取得に失敗したのかが区別できないと、
     *   「今日は0件だった」と誤解される。**
     * ⚠️ ⚠️ **失敗したキャッシュは捨てる。** 残すと次の画面でも失敗したままになる。
     */
    const fail = (e: unknown): void => {
        cached = null;
        console.error('要確認の取得に失敗しました', e);
        setOpen(false);
    };
```

**(c) 自動で出す（⚠️ 除外パスを追加）**

```tsx
    // --- 自動で出す（URL が変わるたび）---
    useEffect(() => {
        if (!isTarget || sessionChecked) return;
        // ⚠️ トップとログインでは自動で出さない（⚠️ ボタンからは開ける）
        if (NO_AUTO_OPEN.includes(location.pathname)) return;

        let alive = true;
        load(false)
            .then((data) => {
                if (!alive) return;
                apply(data);
                // ⚠️⚠️ **0件・確認済みなら開かない。** ⚠️ 空の枠を出しても意味がない
                setOpen(data.show === true && Number(data.total ?? 0) > 0);
            })
            .catch((e) => { if (alive) fail(e); });

        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullPath, isTarget, category]);
```

**(d) ボタンから開く（⚠️ 新規）**

```tsx
    // --- ボタンから開く（ActiveUser.tsx）---
    useEffect(() => {
        if (!isTarget) return;

        const onOpen = () => {
            // ⚠️⚠️ **押したときは取り直す。** ⚠️ 対応した直後に古い件数を見せない
            load(true)
                .then((data) => {
                    apply(data);
                    // ⚠️⚠️ **0件でも開く。** ⚠️ 押した反応が無いほうが困る
                    setOpen(true);
                })
                .catch(fail);
        };
        listeners.add(onOpen);
        return () => { listeners.delete(onOpen); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTarget, category]);
```

**(e) 確認済みなら「閉じる」**

```tsx
    const handleCheck = async () => {
        if (sending) return;
        /**
         * ⚠️⚠️ **今日もう押している人は記録しない**（2026-09-28 の指示）。
         *   ⚠️ ボタンの文字も「閉じる」になっている。⚠️ **閉じるだけ。**
         */
        if (alreadyChecked) {
            setOpen(false);
            return;
        }
        setSending(true);
```
```tsx
                    {/* ⚠️⚠️ **確認済みなら「閉じる」**（⚠️ 押しても記録しない） */}
                    <button className='da_btn' onClick={handleCheck} disabled={sending}>
                        {alreadyChecked ? '閉じる' : '確認しました'}
                    </button>
```

**(f) 0件で開いたときの文言（⚠️ ボタンからは0件でも開く）**

```tsx
                {/* ⚠️ ボタンから開いたときは0件でも開く。⚠️ **空の枠だけ出さない** */}
                {visible.length === 0 && (
                    <div className='da_none'>対応が必要な顧客はありません。本日の予定もありません。</div>
                )}
```
```css
                .da_none { font-size: 12px; color: #6b7280; background: #f8fafc;
                           border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px;
                           text-align: center; }
```

### `frontend/src/components/ActiveUser.tsx`

```tsx
import { openDailyAction } from './DailyAction';
```

```tsx
/**
 * 「要確認」ボタンの見た目。
 *
 * ⚠️ ⚠️ **この枠は position: fixed で常に浮いている。** ⚠️ 幅が狭いので**1行に収める。**
 * ⚠️ 色は DailyAction.tsx の見出しと合わせてある（⚠️ 放置＝赤）。
 */
const alertButtonStyle: React.CSSProperties = {
    width: '100%',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    borderRadius: 8,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: 8,
    whiteSpace: 'nowrap',
};
```

⚠️ `category` を `AuthContext` から受け取るようにした。

```tsx
    const { token, userName, category } = useContext(AuthContext);
```

⚠️ ユーザー名の行の**上**に置く。

```tsx
                <div style={containerStyle} aria-label="Active users">
                    {/*
                      ⚠️⚠️ **「要確認」ボタン（2026-09-28 の指示）。**
                        ⚠️ ⚠️ **注文営業のときだけ・常に出す**（⚠️ 今日もう確認していても出す）。
                        ⚠️ 押すと `App.tsx` に1つだけ置いた `DailyAction` が開く。
                        ⚠️ ⚠️ **確認済みなら中のボタンは「閉じる」**になり、記録はしない。
                        ⚠️ この枠自体が `width >= 768` のときしか出ないので、
                          ⚠️ **スマホでは出ない**（DailyAction 側の条件とも一致する）。
                    */}
                    {category === 'order' && (
                        <button
                            type="button"
                            style={alertButtonStyle}
                            onClick={openDailyAction}
                            aria-label="要確認の顧客を表示"
                        >
                            要確認
                        </button>
                    )}
                    <div style={headerStyle}>
```

### `frontend/src/App.tsx`（⚠️ **置き場所を移した**）

⚠️⚠️ **メニューの条件の中から出して、`ActiveUser` と同じ並びにした。**
⚠️ ⚠️ **中に置いたままだと `/home` でボタンを押しても開かない**（⚠️ `DailyAction` が描画されていないため）。

```tsx
      <ActiveUser />
      {/*
        ⚠️⚠️ **「要確認」モーダル（2026-09-28）。**
          ⚠️ ⚠️ **ここに1つだけ置くこと。** MenuD は **PC用とSP用で2回**描画されるので、
            ⚠️ Menu.tsx の中に置くと**モーダルが二重に出る。**
          ⚠️ ⚠️ **ActiveUser と同じ並びに置く**（2026-09-28）。
            ⚠️ あちらの「要確認」ボタンは `/home` でも出るので、
            ⚠️ **メニューの条件の中に入れるとボタンを押しても開かない。**
          ⚠️ 出す・出さないの判定（注文営業のみ・スマホでは出さない・本日確認済みか・
            0件か・自動で出さない画面か）は **DailyAction.tsx 側が持っている。**
      */}
      <DailyAction />
```

⚠️ ⚠️ **自動で出さない画面は `DailyAction` 側の `NO_AUTO_OPEN` が持っている**ので、
⚠️ **`/home` で勝手に開くことはない。**

---

## 確認したこと（ローカル）

| | |
|---|---|
| ⚠️ **型チェック**（⚠️ include を直した使い捨て設定） | ⚠️ **`src` 配下の `.tsx` はエラー0件** |
| ⚠️ **循環 import** | ⚠️⚠️ **0件** |
| `react-scripts build` | ⚠️ **成功** → ⚠️ **`main.c665324e.js`** |
| API | ⚠️ **変更なし**（⚠️ ② も ① も触っていない） |
| ⚠️ ブラウザでの表示 | ⚠️⚠️ **未確認**（ヘッドレスブラウザが無い） |

---

## 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **`frontend/tsconfig.json` の `include` が壊れている**（⚠️ **型チェックが効いていない**）。⚠️ 直すかは要判断 |
| 2 | ⚠️⚠️ **ファイルを消したり改名したら `npm start` を開き直すこと。** ⚠️ HMR が古いモジュールを握り続ける |
| 3 | ⚠️⚠️ **`<DailyAction />` は `App.tsx` に1つだけ。** ⚠️ メニューの条件の中に戻すと **ボタンが効かない画面ができる** |
| 4 | ⚠️ ボタンから開いたときは ⚠️ **必ず取り直す**（⚠️ キャッシュを使わない） |
| 5 | ⚠️ ボタンから開いたときは ⚠️ **0件でも開く**（⚠️ 押した反応が無いほうが困る） |
| 6 | ⚠️⚠️ **確認済みなら記録しない。** ⚠️ ボタンの文字が「閉じる」かどうかで判断している |
| 7 | ⚠️ ボタンは ⚠️ **`width >= 768` のときだけ**（⚠️ `ActiveUser` の枠自体がそうなっている） |
