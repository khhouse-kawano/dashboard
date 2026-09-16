import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Form, InputGroup } from "react-bootstrap";
import { fetchList, CampaignListRow } from './campaignApi';
import { CAMPAIGN_BRANDS, brandLabel, brandLogo } from './brands';

/**
 * キャンペーンの一覧と作成。
 *
 * ⚠️ 2026-09-16 に表からカードへ変えた。
 *   ⚠️ 埋め込みタグが長く、表のままでは1行が縦に伸びて読めなかった。
 *   ⚠️ タグは既定で畳んである（常に出すと1件で画面が埋まる）。
 */

interface CampaignListProps {
    activeTab: string | null;
}

const CampaignList: React.FC<CampaignListProps> = () => {
    const [formList, setFormList] = useState<CampaignListRow[]>([]);
    const [brandValue, setBrandValue] = useState<string>('');
    /** ⚠️ 取得に失敗したことを画面に出すため。空なら問題なし */
    const [loadError, setLoadError] = useState<string>('');
    const [keyword, setKeyword] = useState<string>('');
    /** どのカードの埋め込みタグを開いているか */
    const [openTag, setOpenTag] = useState<string>('');
    const [copied, setCopied] = useState<string>('');
    const navigate = useNavigate();

    useEffect(() => {
        /**
         * ⚠️⚠️ **ブランド未選択のうちは叩かない。**
         *   ⚠️ 以前は `brand: ''` で毎回1回リクエストしていた（必ず0件が返るだけ）。
         */
        if (!brandValue) {
            setFormList([]);
            setLoadError('');
            return;
        }

        const fetchData = async () => {
            setLoadError('');
            try {
                const response = await fetchList(brandValue);
                setFormList(response.data ?? []);
            } catch (error) {
                /**
                 * ⚠️⚠️ **握りつぶさない。**
                 *   ⚠️ 以前は `catch (error) { }` で**何もしていなかった**。
                 *     通信に失敗しても一覧が空で表示されるだけなので、
                 *     ⚠️ 「キャンペーンが1件も無い」のと**見分けがつかなかった**。
                 */
                console.error('キャンペーン一覧の取得に失敗:', error);
                setLoadError('キャンペーン一覧を取得できませんでした。');
                setFormList([]);
            }
        };
        fetchData();
    }, [brandValue])

    /** ⚠️ 100件近いブランドがあるので絞り込めるようにする */
    const shown = useMemo(() => {
        const q = keyword.trim().toLowerCase();
        if (q === '') return formList;
        return formList.filter(item =>
            (item.campaign ?? '').toLowerCase().includes(q)
            || (item.campaign_id ?? '').toLowerCase().includes(q));
    }, [formList, keyword]);

    const editForm = (brand: string, id: string) => navigate(`/editcampaign?brand=${brand}&id=${id}`);
    const createForm = (brand: string) => navigate(`/editcampaign?brand=${brand}`);

    const copyTag = async (item: CampaignListRow) => {
        try {
            await navigator.clipboard.writeText(item.tag);
            setCopied(item.campaign_id);
            // ⚠️ 表示を戻す。出しっぱなしだと次にコピーしたのか分からない
            window.setTimeout(() => setCopied(''), 2000);
        } catch {
            // ⚠️ 権限が無い環境がある。黙らずに手動コピーを促す
            setOpenTag(item.campaign_id);
            setLoadError('コピーできませんでした。開いたタグを選択してコピーしてください。');
        }
    };

    // ---- ブランド選択 ----
    if (!brandValue) {
        return (
            <div className="p-4" style={{ backgroundColor: '#f5f6f8', minHeight: '70vh' }}>
                <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
                    <div className="text-center mb-4">
                        <div className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>ブランドを選択</div>
                        <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                            キャンペーンフォームの作成・修正を行います
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            // ⚠️ 幅に応じて列数が変わる。固定列にすると広い画面で間延びする
                            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                            gap: '1rem',
                        }}
                    >
                        {CAMPAIGN_BRANDS.map(item => (
                            <div
                                key={item}
                                className="bg-white shadow-sm rounded-3 p-3 d-flex flex-column align-items-center hover"
                                style={{ cursor: 'pointer', border: '1px solid #e9ecef' }}
                                onClick={() => setBrandValue(item)}
                            >
                                <img src={brandLogo(item)} alt={brandLabel(item)}
                                    style={{ width: '100%', maxWidth: '150px', objectFit: 'contain' }} />
                                <div className="text-secondary mt-2 text-center" style={{ fontSize: '0.78rem' }}>
                                    {brandLabel(item)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ---- 一覧 ----
    return (
        <div className="p-4" style={{ backgroundColor: '#f5f6f8', minHeight: '70vh' }}>
            <div style={{ maxWidth: '1180px', margin: '0 auto' }}>

                {/* ---- 見出し ---- */}
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                    <div className="d-flex align-items-center gap-3">
                        <img src={brandLogo(brandValue)} alt={brandLabel(brandValue)}
                            style={{ height: '34px', objectFit: 'contain' }} />
                        <div>
                            <div className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>
                                {brandLabel(brandValue)}
                            </div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                {shown.length.toLocaleString()} 件
                                {shown.length === formList.length || ` / 全 ${formList.length.toLocaleString()} 件`}
                            </div>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        <InputGroup size="sm" style={{ width: '260px' }}>
                            <InputGroup.Text className="bg-white border-end-0">
                                <i className="fa-solid fa-magnifying-glass text-muted"></i>
                            </InputGroup.Text>
                            <Form.Control
                                type="text"
                                placeholder="キャンペーン名 / ID で絞り込み"
                                value={keyword}
                                onChange={e => setKeyword(e.target.value)}
                                className="border-start-0 ps-0"
                                style={{ fontSize: '0.8rem' }}
                            />
                        </InputGroup>

                        <Button size="sm" variant="primary" onClick={() => createForm(brandValue)}
                            style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            <i className="fa-solid fa-plus me-1"></i>新規作成
                        </Button>
                        <Button size="sm" variant="white" className="border text-secondary"
                            onClick={() => { setBrandValue(''); setKeyword(''); }}
                            style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            ブランド選択へ
                        </Button>
                    </div>
                </div>

                {/**
                  * ⚠️⚠️ **取得に失敗したことを必ず画面に出す。**
                  *   ⚠️ 以前は失敗しても一覧が空になるだけで、
                  *     「1件も無い」のと**見分けがつかなかった**。
                  */}
                {!loadError ||
                    <div className="bg-white border rounded-3 p-3 mb-3" style={{ fontSize: '0.8rem', color: '#dc3545' }}>
                        {loadError}
                    </div>}

                {/* ⚠️ 0件のときも黙らない。登録が無いのか絞り込みすぎなのかを分ける */}
                {loadError || shown.length > 0 ||
                    <div className="bg-white border rounded-3 p-5 text-center text-muted" style={{ fontSize: '0.85rem' }}>
                        {formList.length === 0
                            ? 'このブランドのキャンペーンはまだありません。'
                            : '絞り込みに一致するキャンペーンがありません。'}
                    </div>}

                {/* ---- カード ---- */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
                        gap: '1rem',
                        alignItems: 'start',
                    }}
                >
                    {shown.map(item => (
                        <div key={item.campaign_id}
                            className="bg-white shadow-sm rounded-3"
                            style={{ border: '1px solid #e9ecef', overflow: 'hidden' }}>

                            <div className="p-3">
                                <div className="text-muted mb-1" style={{ fontSize: '0.7rem' }}>
                                    <i className="fa-regular fa-calendar me-1"></i>{item.registered_date}
                                </div>
                                <div className="fw-bold text-dark mb-2" style={{
                                    fontSize: '0.88rem', lineHeight: 1.5,
                                    display: '-webkit-box', WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                }}>
                                    {item.campaign}
                                </div>
                                <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}
                                    title={item.campaign_id}>
                                    {item.campaign_id}
                                </div>
                            </div>

                            <div className="px-3 pb-3 d-flex flex-wrap gap-2">
                                <Button size="sm" variant="white" className="border text-secondary"
                                    href={item.url} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: '0.75rem' }}>
                                    <i className="fa-solid fa-arrow-up-right-from-square me-1"></i>開く
                                </Button>
                                <Button size="sm" variant="white" className="border text-secondary"
                                    onClick={() => copyTag(item)} style={{ fontSize: '0.75rem' }}>
                                    <i className="fa-regular fa-copy me-1"></i>
                                    {copied === item.campaign_id ? 'コピーしました' : 'タグをコピー'}
                                </Button>
                                <Button size="sm" variant="white" className="border text-secondary"
                                    onClick={() => setOpenTag(openTag === item.campaign_id ? '' : item.campaign_id)}
                                    style={{ fontSize: '0.75rem' }}>
                                    {openTag === item.campaign_id ? '隠す' : 'タグ'}
                                </Button>
                                <Button size="sm" variant="primary" className="ms-auto"
                                    onClick={() => editForm(item.brand, item.campaign_id)}
                                    style={{ fontSize: '0.75rem' }}>
                                    修正
                                </Button>
                            </div>

                            {openTag === item.campaign_id &&
                                <div className="px-3 pb-3">
                                    <textarea
                                        value={item.tag}
                                        readOnly
                                        rows={4}
                                        onFocus={(e) => e.target.select()}
                                        style={{
                                            width: '100%', fontSize: '0.68rem', fontFamily: 'monospace',
                                            border: '1px solid #dee2e6', borderRadius: '6px', padding: '8px',
                                            backgroundColor: '#f8f9fa',
                                        }}
                                    />
                                </div>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CampaignList;
