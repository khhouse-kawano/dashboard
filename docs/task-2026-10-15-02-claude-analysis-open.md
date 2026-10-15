# 2026-10-15 Claudeによる分析を全員に開放し、競合分析レポートを上部に表示（v2.2.191）

## 依頼（ReadMeClaude.md）
- Header.tsx の「Claudeによる分析」を全ての authority でクリックでき、モーダルも閲覧できるようにする
- ClaudeAnalysis.tsx（指示書では ClaudeAnalytics.tsx）の中に CompetitorAnalysisReports.tsx の機能を入れる
  - 「分析したい内容を選んでください〜」より上に置く
- 「分析したい内容を選んでください〜」から下は今までどおり Master のみ。**管理者専用** の文言を付ける
- 確認事項への回答: モーダルは **案A（xl のまま。一覧と本文の高さ 60vh）**

## 変更ファイル一覧
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/header | **Header.tsx** | `openClaude` の Master チェック（`alert('権限がありません')`）を外した |
| frontend/src/components/header | **ClaudeAnalysis.tsx** | `CompetitorAnalysisReports` を import して上部に埋め込み。`isMaster` を追加し、下の分析メニュー一式を Master だけに。「管理者専用」の印。Master 以外では `kpi_filter_master` / `kpi_analysis_list` を呼ばない |
| frontend/src/components/header | **CompetitorAnalysisReports.tsx** | 型 `Props`（`embedded?: boolean`）を追加。埋め込み用のクラス `car_embedded` |
| backend/scripts/sql | 2026-10-15_update_log_2.2.191.sql | 文言に今回分を追記（ローカルDBの no=287 も UPDATE 済み） |

⚠️ ②・①の PHP・DB は変更なし。② の権限は元からこの形になっている:
- `kpi_filter_master` / `kpi_analysis_list` / `kpi_analysis_get` / `kpi_analyze` … auth: 'master'
- `analysis_report_list` / `analysis_report_get` … auth: 'staff'（登録・削除は 'master'）

⚠️ 他社動向 →「Claudeによる競合分析」（全画面）はそのまま残している（`embedded` を渡さないので見た目も同じ）。

## 確認（ビルドした画面を Playwright で表示。API はすべて偽の応答）
| authority | 見えたもの | 呼んだ API |
|---|---|---|
| Master | 上: 競合分析レポート（「レポートを登録」「削除」あり）／下: 管理者専用・分析メニュー・保存済みの分析 | analysis_report_list・analysis_report_get・kpi_filter_master・kpi_analysis_list |
| Staff | 競合分析レポートのみ（登録・削除なし）。「権限がありません」は出ない | analysis_report_list・analysis_report_get（kpi_* は呼ばない） |

- 型チェック: 既存の5件（CompetitorMaterials.tsx など）以外のエラーなし
- ビルド: main.d1539a8f.js / main.b8a7c60b.css

---

## frontend/src/components/header/Header.tsx
```tsx
    // Claudeによる分析（menuMapping とは独立した導線）
    const [claudeModal, setClaudeModal] = useState<boolean>(false);
    const [claudeHover, setClaudeHover] = useState<boolean>(false);
    /**
     * ⚠️⚠️ **v2.2.191 から全員が開ける**（以前は Master 以外「権限がありません」）。
     *   ⚠️ 全員に見せるのは上部の競合分析レポート（閲覧のみ・課金なし）だけ。
     *   ⚠️ ⚠️ **分析の実行と保存済みの分析は ClaudeAnalysis.tsx 側で Master だけに出している**
     *     （⚠️ ② の `kpi_*` も auth: 'master'）。
     */
    const openClaude = (): void => {
        setClaudeModal(true);
    };
```
（削除したもの）
```tsx
        if (authority !== 'Master') {
            alert('権限がありません');
            return;
        }
```

## frontend/src/components/header/CompetitorAnalysisReports.tsx
```tsx
type Props = {
    /**
     * Claudeによる分析（ClaudeAnalysis.tsx）の上部に埋め込むとき true（v2.2.191）。
     *
     * ⚠️⚠️ **既定（false）は全画面モーダル用**（他社動向 →「Claudeによる競合分析」）。
     *   ⚠️ 全画面では高さを画面いっぱいに使うが、⚠️ **xl のモーダルの中では親に高さが無い。**
     *   ⚠️ ⚠️ **埋め込み時は一覧と本文の高さを 60vh に固定し、外側の余白を外す**（`car_embedded`）。
     */
    embedded?: boolean;
};

const CompetitorAnalysisReports = ({ embedded = false }: Props) => {
```
```tsx
        <div className={`car_wrap${embedded ? ' car_embedded' : ''}`}>
```
```css
                /* ⚠️ 埋め込み（v2.2.191）。⚠️⚠️ **必ず上の .car_wrap / .car_body より後ろに置くこと**
                   （⚠️ 詳細度が上なので負けはしないが、読む順をそろえる）。
                   ⚠️ 高さは本文の iframe を読める最低限。⚠️ **モーダルの 80vh に収まるよう 60vh** */
                .car_embedded.car_wrap { height: auto; padding: 0; }
                .car_embedded .car_inner { max-width: none; }
                .car_embedded .car_body { flex: none; height: 60vh; }
```

## frontend/src/components/header/ClaudeAnalysis.tsx
冒頭
```tsx
import CompetitorAnalysisReports from './CompetitorAnalysisReports';
```
```tsx
 * ⚠️⚠️ **v2.2.191 から全員が開ける**（Header.tsx の openClaude）。
 *   ⚠️ 全員に見せるのは ⚠️ **上部の競合分析レポート**（CompetitorAnalysisReports。閲覧のみ・課金なし）。
 *   ⚠️ ⚠️ **「分析したい内容を選んでください」から下は Master だけ**（「管理者専用」の印を付ける）。
 *     ⚠️ ② の `kpi_filter_master` / `kpi_analysis_list` / `kpi_analyze` などは auth: 'master'。
 *     ⚠️ ⚠️ **Master 以外では呼ばないこと**（⚠️ 呼ぶと 403 になる）。
```
```tsx
    const { userName, authority } = useContext(AuthContext);
    /** ⚠️ 分析の実行・保存済みの分析は Master だけ（v2.2.191） */
    const isMaster = authority === 'Master';
```
絞り込みマスタの取得
```tsx
    useEffect(() => {
        // ⚠️ Master 以外は呼ばない（⚠️ ② は auth: 'master'。画面にも出さない）
        if (!isMaster) return;
        let cancelled = false;
        // ...（従来どおり）
        return () => { cancelled = true; };
    }, [isMaster]);
```
保存済みの分析の取得
```tsx
    // ⚠️ Master 以外は呼ばない（⚠️ ② の kpi_analysis_list は auth: 'master'）
    useEffect(() => {
        if (isMaster) void loadHistory(historyLimit);
    }, [isMaster, loadHistory, historyLimit]);
```
メニュー選択画面（全文。中身は従来のものを `isMaster &&` の中へ移し、字下げを1段深くした）
```tsx
    if (selected === null) {
        const selectStyle: React.CSSProperties = { fontSize: '13px', borderColor: '#e8e6dc' };

        return (
            <div className="py-2">
                {/* ⚠️ 競合分析レポート（v2.2.191）。⚠️⚠️ **全員に出す**（閲覧のみ・課金なし）。
                      ⚠️ 登録・削除のボタンは CompetitorAnalysisReports 側で Master だけに出している */}
                <CompetitorAnalysisReports embedded />

                {/* ⚠️⚠️ **ここから下は Master だけ**（v2.2.191）。⚠️ ② の kpi_* も auth: 'master' */}
                {isMaster && (
                    <div className="mt-4 pt-3" style={{ borderTop: '1px solid #e8e6dc' }}>
                        <p className="text-muted mb-3 d-flex align-items-center flex-wrap gap-2" style={{ fontSize: '13px' }}>
                            {/* ⚠️ 管理者だけに見えていることを明示する（2026-10-15 の指示） */}
                            <span
                                className="px-2 py-1 fw-bold"
                                style={{
                                    fontSize: '11px', lineHeight: 1, borderRadius: '4px',
                                    backgroundColor: '#fdf8f6', color: CLAUDE_ORANGE, border: `1px solid ${CLAUDE_ORANGE}`,
                                }}
                            >
                                <i className="fa-solid fa-lock me-1" aria-hidden="true" />
                                管理者専用
                            </span>
                            <span>分析したい内容を選んでください。ダッシュボードの集計値をもとに Claude が分析します。</span>
                        </p>

                        {/* 履歴の削除・復元の失敗はこの画面で起きる。
                            結果画面にしかエラー欄が無いと、失敗が黙って握り潰される */}
                        {error !== '' && (
                            <div className="alert alert-danger d-flex align-items-start gap-2" style={{ fontSize: '13px' }}>
                                <i className="fa-solid fa-triangle-exclamation mt-1" aria-hidden="true" />
                                <span className="flex-grow-1">{error}</span>
                                <button
                                    type="button"
                                    onClick={() => setError('')}
                                    className="btn-close flex-shrink-0"
                                    aria-label="閉じる"
                                />
                            </div>
                        )}

                        {/* 分析対象。部門 → 課 → 店舗 → スタッフ の順に絞り込める。
                            親を選ばないと子は選べない（サーバー側も同じ制約で検証する） */}
                        <div className="row g-2 mb-2">
                            <div className="col-6 col-md-3">
                                <label htmlFor="claude-division" className="form-label fw-bold mb-1" style={{ fontSize: '12px' }}>
                                    分析対象
                                </label>
                                <select
                                    id="claude-division"
                                    className="form-select form-select-sm"
                                    value={division}
                                    onChange={(e) => changeDivision(e.target.value as Division)}
                                    style={selectStyle}
                                >
                                    {DIVISIONS.map((d) => (
                                        <option key={d.value} value={d.value}>{d.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-6 col-md-3">
                                <label htmlFor="claude-section" className="form-label fw-bold mb-1" style={{ fontSize: '12px' }}>
                                    課を選択
                                </label>
                                {/* 分析対象は常に選択済みなので、この欄も初回描画から操作できる。
                                    マスタ取得中は選択肢がまだ無いことだけを伝える */}
                                <select
                                    id="claude-section"
                                    className="form-select form-select-sm"
                                    value={section}
                                    onChange={(e) => changeSection(e.target.value)}
                                    style={selectStyle}
                                >
                                    <option value="">部門全体</option>
                                    {/* value を空にすると「部門全体」と重複するため別値にする。
                                        disabled なので選択されることはない */}
                                    {masterLoading && <option value="__loading" disabled>読み込み中…</option>}
                                    {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div className="col-6 col-md-3">
                                <label htmlFor="claude-shop" className="form-label fw-bold mb-1" style={{ fontSize: '12px' }}>
                                    店舗を選択
                                </label>
                                <select
                                    id="claude-shop"
                                    className="form-select form-select-sm"
                                    value={shop}
                                    onChange={(e) => changeShop(e.target.value)}
                                    disabled={section === ''}
                                    style={selectStyle}
                                >
                                    <option value="">課内すべて</option>
                                    {shopOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div className="col-6 col-md-3">
                                <label htmlFor="claude-staff" className="form-label fw-bold mb-1" style={{ fontSize: '12px' }}>
                                    スタッフを選択
                                </label>
                                <select
                                    id="claude-staff"
                                    className="form-select form-select-sm"
                                    value={staff}
                                    onChange={(e) => setStaff(e.target.value)}
                                    disabled={shop === ''}
                                    style={selectStyle}
                                >
                                    <option value="">店舗内すべて</option>
                                    {staffOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <p className="text-muted mb-3" style={{ fontSize: '12px' }}>
                            <i className="fa-solid fa-filter me-1" aria-hidden="true" />
                            {scopeLabel} のデータを分析します
                        </p>

                        <div className="row g-2">
                            {MENUS.map((menu) => {
                                // 店舗を絞り込んでいる間は「店舗別サマリー」を選べない
                                const blocked   = menu.type === 'shop' && shopSummaryBlocked;
                                const available = AVAILABLE.has(menu.type) && !blocked;
                                const badge     = blocked ? '対象外' : (!AVAILABLE.has(menu.type) ? '準備中' : null);
                                const tip       = blocked
                                    ? '店舗・スタッフを絞り込んでいる間は選択できません'
                                    : (available ? menu.description : '準備中です');

                                return (
                                    <div key={menu.type} className="col-12 col-md-6 col-lg-4">
                                        <button
                                            type="button"
                                            onClick={() => handleSelect(menu)}
                                            disabled={!available}
                                            title={tip}
                                            className="btn w-100 h-100 text-start d-flex align-items-start gap-2 p-3 position-relative"
                                            style={{
                                                fontSize: '13px',
                                                border: '1px solid #e8e6dc',
                                                borderRadius: '8px',
                                                backgroundColor: available ? '#fff' : '#f5f4f0',
                                                boxShadow: 'none',
                                                // 選べないメニューは薄く見せる（表示自体は残す）
                                                opacity: available ? 1 : 0.5,
                                                cursor: available ? 'pointer' : 'not-allowed',
                                                // Bootstrap の disabled 既定より、上の opacity を優先させる
                                                pointerEvents: 'auto',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!available) return;
                                                e.currentTarget.style.borderColor = CLAUDE_ORANGE;
                                                e.currentTarget.style.backgroundColor = '#fdf8f6';
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!available) return;
                                                e.currentTarget.style.borderColor = '#e8e6dc';
                                                e.currentTarget.style.backgroundColor = '#fff';
                                            }}
                                        >
                                            <i
                                                className={`fa-solid ${menu.icon} mt-1`}
                                                style={{ color: available ? CLAUDE_ORANGE : '#b0aea5', width: '16px' }}
                                                aria-hidden="true"
                                            />
                                            <span>
                                                <span className="d-block fw-bold text-dark">{menu.label}</span>
                                                <span className="d-block text-muted mt-1" style={{ fontSize: '12px' }}>
                                                    {blocked ? tip : menu.description}
                                                </span>
                                            </span>

                                            {badge !== null && (
                                                <span
                                                    className="position-absolute top-0 end-0 mt-2 me-2 px-2 py-1"
                                                    style={{
                                                        fontSize: '10px',
                                                        backgroundColor: '#e8e6dc',
                                                        color: '#6c6a63',
                                                        borderRadius: '4px',
                                                        lineHeight: 1,
                                                    }}
                                                >
                                                    {badge}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        <p className="text-muted mt-3 mb-0" style={{ fontSize: '12px' }}>
                            <i className="fa-regular fa-clock me-1" aria-hidden="true" />
                            分析には40〜60秒かかります。1回あたり十数円の費用が発生します。
                        </p>

                        {/* 保存済みの分析。開いても課金は発生しない */}
                        {history.length > 0 && (
                            <div className="mt-4">
                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <span className="fw-bold" style={{ fontSize: '13px' }}>
                                        <i className="fa-regular fa-bookmark me-1" style={{ color: CLAUDE_ORANGE }} aria-hidden="true" />
                                        保存済みの分析
                                    </span>
                                    <span className="text-muted" style={{ fontSize: '11px' }}>
                                        開いても課金は発生しません（全{historyTotal}件）
                                    </span>
                                </div>

                                {history.map((item) => (
                                    <div
                                        key={item.id}
                                        className="d-flex align-items-start gap-2 px-3 py-2 mb-1"
                                        style={{ border: '1px solid #e8e6dc', borderRadius: '8px', backgroundColor: '#fff' }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => void openHistory(item)}
                                            className="btn btn-link p-0 text-start flex-grow-1"
                                            style={{ fontSize: '12px', textDecoration: 'none', color: 'inherit' }}
                                        >
                                            <span className="d-block fw-bold text-dark">{item.title}</span>
                                            <span
                                                className="d-block text-muted mt-1"
                                                style={{
                                                    fontSize: '11px', lineHeight: 1.6,
                                                    display: '-webkit-box', WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                                }}
                                            >
                                                {item.headline}
                                            </span>
                                            <span className="d-block text-muted mt-1" style={{ fontSize: '10px' }}>
                                                {formatSavedAt(item.created_at)}
                                                {item.staff_name !== null && ` ／ ${item.staff_name}`}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void deleteHistory(item)}
                                            className="btn btn-sm btn-link text-muted p-1 flex-shrink-0"
                                            title="この分析結果を削除"
                                            style={{ fontSize: '12px' }}
                                        >
                                            <i className="fa-regular fa-trash-can" aria-hidden="true" />
                                        </button>
                                    </div>
                                ))}

                                {/* 上限まで到達したらボタンを出さない。
                                    押しても増えないボタンが残ると壊れて見える */}
                                {historyTotal > history.length && history.length < HISTORY_MAX_COUNT && (
                                    <button
                                        type="button"
                                        onClick={() => setHistoryLimit((n) => Math.min(n + HISTORY_PAGE_SIZE, HISTORY_MAX_COUNT))}
                                        className="btn btn-sm btn-link p-0 mt-1"
                                        style={{ fontSize: '12px', color: CLAUDE_ORANGE, textDecoration: 'none' }}
                                    >
                                        もっと見る（残り {historyTotal - history.length} 件）
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }
```
