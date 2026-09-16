import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import { fetchDetail, fetchList, CampaignListRow } from './campaignApi';
import { BUILDER_FIELDS, BuilderField, buildHtml, usedFromSettings } from './formBuilderUtils';
import { CAMPAIGN_BRANDS, brandLabel } from './brands';

/**
 * LP に貼り付けるための HTML フォームを作る。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **既存の「埋め込みタグ」とは別物である。**
 *   埋め込みタグ … iframe で React アプリを読み込む（キャンペーン作成タブ）
 *   ここ        … **単体で動く HTML**。LP の中に直接書ける
 *
 * ⚠️⚠️ **通知先・サンクスメールはここでは設定しない。**
 *   ⚠️ 生成した HTML は誰でもソースを読めるため、宛先を書くと
 *     書き換えて任意の宛先へ送らせることができる。
 *   ⚠️ それらは**キャンペーン設定（form_table）側**で管理する。
 *     ここは「どのキャンペーンに紐づけるか」を選ぶだけでよい。
 * ─────────────────────────────────────────────
 */

interface Props {
    activeTab: string | null;
}

/** form_table の JSON 列から選択肢を取り出す。⚠️ 壊れていても落とさない */
const optionsFrom = (raw: string | undefined, key: string): string[] => {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const list = parsed[key];
        return Array.isArray(list) ? list.map(v => String(v)) : [];
    } catch {
        console.error(`[formBuilder] 設定の解釈に失敗しました: ${raw.slice(0, 80)}`);
        return [];
    }
};

const FormBuilder: React.FC<Props> = ({ activeTab }) => {
    const navigate = useNavigate();
    const [brand, setBrand] = useState('');
    const [list, setList] = useState<CampaignListRow[]>([]);
    const [campaignId, setCampaignId] = useState('');
    const [fields, setFields] = useState<BuilderField[]>(BUILDER_FIELDS);
    const [thanksUrl, setThanksUrl] = useState('');
    const [html, setHtml] = useState('');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    // ---- ブランドを選んだらキャンペーン一覧を取る ----
    useEffect(() => {
        // ⚠️ 未選択のうちは叩かない。必ず0件が返るだけ
        if (!brand) { setList([]); setCampaignId(''); return; }

        const run = async () => {
            setError('');
            try {
                const res = await fetchList(brand);
                setList(res.data ?? []);
            } catch (e) {
                console.error('キャンペーン一覧の取得に失敗:', e);
                setError('キャンペーン一覧を取得できませんでした。');
                setList([]);
            }
        };
        run();
    }, [brand]);

    // ---- キャンペーンを選んだら、その設定から選択肢を取り込む ----
    useEffect(() => {
        if (!brand || !campaignId) {
            setFields(BUILDER_FIELDS);
            // ⚠️ 前に選んだキャンペーンのチェックが残らないようにする
            setUsed(Object.fromEntries(BUILDER_FIELDS.map(f => [f.key, false])));
            return;
        }

        const run = async () => {
            setError('');
            try {
                const res = await fetchDetail(brand, campaignId);
                const row = res.data;
                if (!row) {
                    setError('キャンペーン設定が見つかりませんでした。');
                    return;
                }

                /**
                 * ⚠️ 選択肢はキャンペーン設定から取る。
                 *   ⚠️ 手で打ち直すと、iframe 版のフォームと**選択肢が食い違う**。
                 *     同じキャンペーンなのに店舗の一覧が違う、という状態になる。
                 */
                setFields(BUILDER_FIELDS.map(field => {
                    if (field.key === 'shop') return { ...field, options: optionsFrom(row.shop, 'shopName') };
                    if (field.key === 'time') return { ...field, options: optionsFrom(row.date, 'time') };
                    if (field.key === 'medium') return { ...field, options: optionsFrom(row.medium, 'mediumName') };
                    return { ...field };
                }));

                /**
                 * ⚠️⚠️ **チェックをキャンペーン設定に合わせる。**
                 *   ⚠️ そのフォームで実際に聞いている項目だけが入る。
                 *   ⚠️ 設定の1項目が複数の入力欄に対応することがある
                 *     （name → 姓・名 など）。対応表は formBuilderUtils.ts。
                 */
                setUsed(usedFromSettings(row));

                // ⚠️ サンクスページは設定側の値を初期値にする。変えたければ画面で直せる
                setThanksUrl(row.redirect ?? '');
            } catch (e) {
                console.error('キャンペーン設定の取得に失敗:', e);
                setError('キャンペーン設定を取得できませんでした。');
            }
        };
        run();
    }, [brand, campaignId]);

    const selected = list.find(item => item.campaign_id === campaignId);

    /**
     * 使う項目。
     * ⚠️⚠️ **選んだキャンペーンの設定と連動する**（2026-09-16 の指示）。
     *   ⚠️ キャンペーンを選ぶと、そのフォームで実際に聞いている項目に
     *     チェックが入る。⚠️ 手で変えてもよい。
     *   ⚠️ 未選択のうちは全部外しておく（既定で勝手に項目が入らないように）。
     */
    const [used, setUsed] = useState<Record<string, boolean>>(
        () => Object.fromEntries(BUILDER_FIELDS.map(f => [f.key, false]))
    );

    const generate = () => {
        if (!brand || !campaignId) {
            setError('ブランドとキャンペーンを選んでください。');
            return;
        }
        const chosen = fields.filter(f => used[f.key]);
        if (chosen.length === 0) {
            setError('項目を1つ以上選んでください。');
            return;
        }
        setError('');
        setCopied(false);
        setHtml(buildHtml({
            brand,
            campaignId,
            campaign: selected?.campaign ?? '',
            fields: chosen,
            thanksUrl,
        }));
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(html);
            setCopied(true);
        } catch {
            // ⚠️ 権限が無い環境がある。⚠️ 黙らずに手動コピーを促す
            setError('コピーできませんでした。テキストを選択してコピーしてください。');
        }
    };

    if (activeTab !== 'builder') return null;

    return (
        <div className="bg-light p-3 w-100">
            <div className="bg-white" style={{ width: '90%', maxWidth: '960px', margin: '0 auto', padding: '24px', paddingBottom: '120px' }}>

                <div className="fw-bold mb-1" style={{ fontSize: '15px' }}>LP用フォームHTMLの作成</div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px', lineHeight: 1.8 }}>
                    貼り付けるだけで動く HTML を作ります。デザインは付かないので、LP 側のCSSで整えてください。<br />
                    通知先・サンクスメールは「キャンペーン作成」タブの設定がそのまま使われます。
                </div>

                {!error || <div className="mb-3" style={{ color: 'red', fontSize: '13px' }}>{error}</div>}

                {/* ---- ブランド ---- */}
                <div className="mb-3">
                    <div style={{ fontSize: '13px', marginBottom: '6px' }}>ブランド</div>
                    <select value={brand} onChange={e => { setBrand(e.target.value); setCampaignId(''); setHtml(''); }}
                        style={{ fontSize: '13px', padding: '4px 8px', minWidth: '220px' }}>
                        <option value="">選択してください</option>
                        {CAMPAIGN_BRANDS.map(b => <option key={b} value={b}>{brandLabel(b)}</option>)}
                    </select>
                </div>

                {/* ---- キャンペーン ---- */}
                <div className="mb-4">
                    <div style={{ fontSize: '13px', marginBottom: '6px' }}>キャンペーン</div>
                    <select value={campaignId} onChange={e => { setCampaignId(e.target.value); setHtml(''); }}
                        disabled={!brand}
                        style={{ fontSize: '13px', padding: '4px 8px', minWidth: '420px', maxWidth: '100%' }}>
                        <option value="">選択してください</option>
                        {list.map(item =>
                            <option key={item.campaign_id} value={item.campaign_id}>{item.campaign}</option>)}
                    </select>
                    {!brand || list.length > 0 ||
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                            このブランドのキャンペーンはまだありません。
                        </div>}

                    {/**
                      * ⚠️ ここからも新しいキャンペーンを作れるようにする（2026-09-16 の指示）。
                      *   ⚠️ 作成画面は「キャンペーン作成」タブと同じものを使う。
                      *     ⚠️ 別の作成画面を増やすと、設定の項目が食い違う。
                      */}
                    {!brand ||
                        <div style={{ marginTop: '10px' }}>
                            <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => navigate(`/editcampaign?brand=${brand}`)}
                                style={{ fontSize: '12px' }}
                            >
                                <i className="fa-solid fa-plus me-1"></i>新しいキャンペーンを作成
                            </Button>
                            <span className="text-muted ms-2" style={{ fontSize: '11px' }}>
                                作成後、この画面に戻って選び直してください。
                            </span>
                        </div>}
                </div>

                {/* ---- 項目 ---- */}
                <div className="mb-4">
                    <div style={{ fontSize: '13px', marginBottom: '6px' }}>項目</div>
                    <Table style={{ fontSize: '12px' }}>
                        <thead>
                            <tr><td style={{ width: '60px' }}>使う</td><td>項目</td><td style={{ width: '90px' }}>必須</td><td>選択肢</td></tr>
                        </thead>
                        <tbody>
                            {fields.map(field => (
                                <tr key={field.key}>
                                    <td style={{ verticalAlign: 'middle' }}>
                                        <input type="checkbox" checked={used[field.key] ?? false}
                                            onChange={() => setUsed(prev => ({ ...prev, [field.key]: !prev[field.key] }))} />
                                    </td>
                                    <td style={{ verticalAlign: 'middle' }}>{field.label}</td>
                                    <td style={{ verticalAlign: 'middle' }}>
                                        <input type="checkbox" checked={field.required} disabled={!used[field.key]}
                                            onChange={() => setFields(prev => prev.map(f =>
                                                f.key === field.key ? { ...f, required: !f.required } : f))} />
                                    </td>
                                    <td style={{ verticalAlign: 'middle', color: '#666' }}>
                                        {field.type !== 'select' ? '—'
                                            : (field.options ?? []).length === 0
                                                ? 'キャンペーン設定に選択肢がありません'
                                                : (field.options ?? []).join(' / ')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>

                {/* ---- サンクスページ ---- */}
                <div className="mb-4">
                    <div style={{ fontSize: '13px', marginBottom: '6px' }}>送信後に飛ばす先（空ならページ内に完了文言）</div>
                    <input type="text" value={thanksUrl} onChange={e => setThanksUrl(e.target.value)}
                        style={{ fontSize: '13px', padding: '4px 8px', width: '100%' }} />
                </div>

                <div className="mb-4">
                    <button onClick={generate} className="hover"
                        style={{ backgroundColor: 'blue', color: '#fff', border: 'none', borderRadius: '20px', padding: '8px 28px', fontSize: '13px' }}>
                        HTMLを作成
                    </button>
                </div>

                {/* ---- 生成結果 ---- */}
                {!html ||
                    <div>
                        <div className="d-flex align-items-center mb-2" style={{ gap: '12px' }}>
                            <div style={{ fontSize: '13px' }}>生成されたHTML</div>
                            <button onClick={copy} className="hover"
                                style={{ backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: '14px', padding: '2px 14px', fontSize: '12px' }}>
                                コピー
                            </button>
                            {!copied || <span style={{ fontSize: '12px', color: 'green' }}>コピーしました</span>}
                        </div>
                        <textarea value={html} readOnly rows={22}
                            onFocus={e => e.target.select()}
                            style={{ width: '100%', fontSize: '11px', fontFamily: 'monospace', border: '1px solid #D3D3D3', borderRadius: '5px', padding: '8px' }} />
                    </div>}
            </div>
        </div>
    );
};

export default FormBuilder;
