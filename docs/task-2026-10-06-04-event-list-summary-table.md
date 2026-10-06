# 2026-10-06-04　集客イベントの予約一覧にイベント別の集計表（v2.2.166）

## 依頼（ReadMeClaude.md）

> targetEvent が真の場合に、コンポネント上部のコントロール部分にサマリテーブルを追加したい。テーブル上部にイベント名表示。
> 日付｜10:00｜10:30｜11:00〜｜相談内容（interview のカンマ区切り）｜検討内容（request のカンマ区切り）
> date[0]｜実数… / date[1]｜実数…。あまり縦幅が広くならないように

## 確認したこと（ユーザーの回答）

| 質問 | 回答 |
|---|---|
| 相談内容・検討内容の数え方 | ⚠️ **値ごとに1列ずつ** |
| 数える予約 | ⚠️ **そのイベントの全予約**（⚠️ 店舗・日付・時間・来場状況の絞り込みに影響されない） |
| 集計表も固定するか | ⚠️ **固定しない**（固定はボタンと絞り込みの行だけ） |

## 作ったもの

- 列: 日付 ｜ 予約数 ｜ 来場予定時間ごと（`normalizeTime` 済み・早い順）｜ 相談内容の値ごと ｜ 検討内容の値ごと
  - ⚠️ 見出しは2段（「来場予定時間」「相談内容」「検討内容」のまとまり）
  - ⚠️ 相談内容・検討内容の列は ⚠️ **人数の多い順**（⚠️ イベントごとに選択肢が違うため）
- 行: 来場予定日ごと ＋ ⚠️ 空の日付は「未設定」 ＋ 合計
- ⚠️ 0 は薄い灰色で出す（⚠️ 空欄だと集計漏れと区別が付かない）
- ⚠️ 縦幅: 文字 10〜11px、セルの余白 1px 6px。⚠️ 列が多いときは横スクロール

## 変更したファイル

| ディレクトリ | ファイル | 追加・変更 |
|---|---|---|
| `frontend/src/components/header/` | **EventList.tsx** | 関数 `splitValues` `rankByCount`・定数 `UNSET_LABEL`（新規・モジュール直下）、`summaryTable`（新規 useMemo）、集計表の JSX と CSS |
| `backend/scripts/sql/` | **2026-10-06_update_log_2.2.166.sql** | 文言に集計表を追記。⚠️ ローカルDBも UPDATE で揃えた |
| `docs/` | **deploy-v2.2.166.md** | 本体を `main.84fb8405.js` に。確認項目 3-2・10〜13 を追加 |

## 動作確認

| 確認 | 結果 |
|---|---|
| `npm run build` | 成功（`main.84fb8405.js`）。⚠️ 警告は以前からの fetchData のみ |
| 画面と同じ計算 と SQL の件数（おうちづくりフェスタ2026・ローカル） | ⚠️ **一致**: 10/10(土) 予約61・10:00 21・住宅相談14・注文住宅を検討している9 ／ 10/11(日) 55・15・10・9 |
| ⚠️ 画面での表示 | ⚠️ **未確認** |

## 追加したコード（全文）

### モジュール直下

```tsx
/** カンマ区切りの値を分ける（相談内容 interview・検討内容 request）。⚠️ 空は落とす */
const splitValues = (value: string | null | undefined): string[] =>
    String(value ?? '').split(',').map(v => v.trim()).filter(v => v !== '');

/** ⚠️ 集計表で、空の日付・時間をまとめる見出し */
const UNSET_LABEL = '未設定';

/**
 * 値 → 件数 を、件数の多い順に並べた見出しにする。
 * ⚠️ 同数のときは名前の順（⚠️ 並びが毎回変わらないように）。
 */
const rankByCount = (counts: Map<string, number>): string[] =>
    [...counts.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], 'ja')).map(([key]) => key);

```

### summaryTable

```tsx
    /**
     * イベントの集計表（2026-10-06 追加）。⚠️ イベントを選んでいるときだけ。
     *
     *   行 … 来場予定日（⚠️ 空の日付は「未設定」の行）＋ 合計
     *   列 … 予約数 ｜ 来場予定時間ごと（normalizeTime 済み・早い順）｜ 相談内容の値ごと ｜ 検討内容の値ごと
     *
     * ⚠️⚠️ **数えるのはそのイベントの全予約**（2026-10-06 の確認）。
     *   ⚠️ 店舗・日付・時間・来場状況の絞り込みには ⚠️ **影響されない**（⚠️ eventRows を使う。filteredData ではない）。
     * ⚠️ 相談内容・検討内容は ⚠️ **1人が複数選べる**。⚠️ 列の合計は予約数を超えることがある。
     * ⚠️ 値ごとの列は ⚠️ **人数の多い順**（⚠️ イベントごとに選択肢が違うので、固定の順にしない）。
     */
    const summaryTable = useMemo(() => {
        if (targetEvent === '') return null;

        const hasUnsetDate = eventRows.some(item => (item.date || '').trim() === '');
        const hasUnsetTime = eventRows.some(item => normalizeTime(item.time) === '');
        const dates = hasUnsetDate ? [...dateArray, UNSET_LABEL] : dateArray;
        const times = hasUnsetTime ? [...timeArray, UNSET_LABEL] : timeArray;

        const interviewTotal = new Map<string, number>();
        const requestTotal = new Map<string, number>();
        eventRows.forEach(item => {
            splitValues(item.interview).forEach(v => interviewTotal.set(v, (interviewTotal.get(v) ?? 0) + 1));
            splitValues(item.request).forEach(v => requestTotal.set(v, (requestTotal.get(v) ?? 0) + 1));
        });
        const interviews = rankByCount(interviewTotal);
        const requests = rankByCount(requestTotal);

        type Line = { total: number; time: Map<string, number>; interview: Map<string, number>; request: Map<string, number> };
        const emptyLine = (): Line => ({ total: 0, time: new Map(), interview: new Map(), request: new Map() });
        const lines = new Map<string, Line>(dates.map(d => [d, emptyLine()]));
        const sum = emptyLine();
        const add = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

        eventRows.forEach(item => {
            const line = lines.get((item.date || '').trim() || UNSET_LABEL);
            if (!line) return;
            const time = normalizeTime(item.time) || UNSET_LABEL;
            [line, sum].forEach(target => {
                target.total += 1;
                add(target.time, time);
                splitValues(item.interview).forEach(v => add(target.interview, v));
                splitValues(item.request).forEach(v => add(target.request, v));
            });
        });

        return { dates, times, interviews, requests, lines, sum };
    }, [targetEvent, eventRows, dateArray, timeArray]);
```

### 集計表の JSX

```tsx
                    {/*
                      ⚠️ イベントの集計表（2026-10-06 追加）。⚠️ イベントを選んだときだけ出す。
                        ⚠️ 上の操作の行とは違い ⚠️ **固定しない**（⚠️ 一覧を広く使うため。2026-10-06 の確認）。
                        ⚠️ 縦に広がらないよう、文字は 10〜11px・余白は最小。⚠️ 列が多いときは横スクロール。
                        ⚠️⚠️ **ここは <style>{...} のテンプレートリテラルの中にバッククォートを書かないこと。**
                    */}
                    {summaryTable && (
                        <div className="bg-white rounded shadow-sm border mb-2 p-2">
                            <style>{`
                                .ev_sum_title { font-size: 12px; font-weight: 700; color: #32325d; margin-bottom: 4px; }
                                .ev_sum_title small { font-size: 10px; font-weight: 400; color: #8898aa; margin-left: 8px; }
                                .ev_sum_wrap { overflow-x: auto; }
                                .ev_sum { border-collapse: collapse; font-size: 11px; white-space: nowrap; }
                                .ev_sum th, .ev_sum td { border: 1px solid #e9ecef; padding: 1px 6px; line-height: 1.35; text-align: right; }
                                .ev_sum th { background: #f6f9fc; color: #525f7f; font-size: 10px; font-weight: 700; text-align: center; }
                                .ev_sum .ev_sum_group { background: #eef2f7; color: #32325d; }
                                .ev_sum .ev_sum_date { text-align: left; font-weight: 700; color: #32325d; background: #fff; }
                                .ev_sum .ev_sum_total { font-weight: 700; color: #32325d; }
                                .ev_sum tr.ev_sum_sum td { background: #f6f9fc; font-weight: 700; }
                                .ev_sum .ev_sum_zero { color: #ced4da; }
                                .ev_sum .ev_sum_sep { border-left: 2px solid #ced4da; }
                            `}</style>
                            <div className="ev_sum_title">
                                {targetEvent}
                                <small>予約 {summaryTable.sum.total.toLocaleString()}件 ／ 相談内容・検討内容は複数選択のため予約数と一致しません</small>
                            </div>
                            <div className="ev_sum_wrap">
                                <table className="ev_sum">
                                    <thead>
                                        <tr>
                                            <th rowSpan={2}>日付</th>
                                            <th rowSpan={2}>予約数</th>
                                            {summaryTable.times.length > 0 && <th className="ev_sum_group ev_sum_sep" colSpan={summaryTable.times.length}>来場予定時間</th>}
                                            {summaryTable.interviews.length > 0 && <th className="ev_sum_group ev_sum_sep" colSpan={summaryTable.interviews.length}>相談内容</th>}
                                            {summaryTable.requests.length > 0 && <th className="ev_sum_group ev_sum_sep" colSpan={summaryTable.requests.length}>検討内容</th>}
                                        </tr>
                                        <tr>
                                            {summaryTable.times.map((t, i) => <th key={`t-${t}`} className={i === 0 ? 'ev_sum_sep' : ''}>{t}</th>)}
                                            {summaryTable.interviews.map((v, i) => <th key={`i-${v}`} className={i === 0 ? 'ev_sum_sep' : ''}>{v}</th>)}
                                            {summaryTable.requests.map((v, i) => <th key={`r-${v}`} className={i === 0 ? 'ev_sum_sep' : ''}>{v}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...summaryTable.dates.map(d => ({ label: d, line: summaryTable.lines.get(d), isSum: false })),
                                          { label: '合計', line: summaryTable.sum, isSum: true }].map(({ label, line, isSum }) => {
                                            if (!line) return null;
                                            // ⚠️ 0 は薄く出す（⚠️ 空欄だと集計漏れと区別が付かない）
                                            const cell = (map: Map<string, number>, key: string, first: boolean) => {
                                                const n = map.get(key) ?? 0;
                                                return <td key={key} className={`${n === 0 ? 'ev_sum_zero' : ''}${first ? ' ev_sum_sep' : ''}`}>{n}</td>;
                                            };
                                            return (
                                                <tr key={label} className={isSum ? 'ev_sum_sum' : ''}>
                                                    <td className="ev_sum_date">{label}</td>
                                                    <td className="ev_sum_total">{line.total}</td>
                                                    {summaryTable.times.map((t, i) => cell(line.time, t, i === 0))}
                                                    {summaryTable.interviews.map((v, i) => cell(line.interview, v, i === 0))}
                                                    {summaryTable.requests.map((v, i) => cell(line.request, v, i === 0))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
```
