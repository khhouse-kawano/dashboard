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
 *   ⚠️ フォームタグは常に出す（2026-09-16 の指示）。
 *   ⚠️ 横長・最大2カラム。狭い画面では1列に落ちる。
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
            //   ⚠️ タグは常に出しているので、そのまま選択してもらえる
            setLoadError('コピーできませんでした。下のフォームタグを選択してコピーしてください。');
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
                                className="bg-white shadow-sm rounded-3 p-3 d-flex align-items-center justify-content-center"
                                /**
                                 * ⚠️⚠️ **`hover` クラスを使わない。**
                                 *   ⚠️ 共通CSS（App.css / index.css）の `.hover` は
                                 *     `text-decoration: underline` と `color: blue` を付けるため、
                                 *     ⚠️ **カード全体に下線が入る**。
                                 *   ⚠️ `.hover` は他の8ファイルでも使われているので**共通CSSは触らない**。
                                 *     ここでは必要な `cursor` だけ自前で指定する。
                                 *
                                 * ⚠️⚠️ **高さを固定する。**
                                 *   ⚠️ ロゴの縦横比がブランドごとに違う（横長のものと正方形に近いものがある）。
                                 *     ⚠️ 高さを決めないと**カードの丈が揃わず、上揃えで不格好になる**。
                                 *   ⚠️ 中身は上下左右とも中央に置く。
                                 */
                                style={{
                                    cursor: 'pointer', border: '1px solid #e9ecef', textDecoration: 'none',
                                    height: '110px',
                                }}
                                onClick={() => setBrandValue(item)}
                            >
                                {/* ⚠️ ロゴ下の日本語表記は出さない（2026-09-16 の指示）。
                                      ⚠️ alt には残す。読み上げと画像が出ないときに要る */}
                                {/* ⚠️ `maxHeight` を付けないと、縦長のロゴがカードからはみ出す */}
                                <img src={brandLogo(item)} alt={brandLabel(item)}
                                    style={{
                                        maxWidth: '100%', maxHeight: '100%',
                                        width: 'auto', height: 'auto', objectFit: 'contain',
                                    }} />
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
                        /**
                         * ⚠️⚠️ **最大2カラム**（2026-09-16 の指示）。
                         *   ⚠️ `auto-fill` のままだと広い画面で3列以上になる。
                         *   ⚠️ 下限を大きめに取って横長にし、
                         *     狭い画面では1列に落ちるようにしている。
                         */
                        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 520px), 1fr))',
                        gap: '1rem',
                        /**
                         * ⚠️⚠️ **`start` にしない。**
                         *   ⚠️ キャンペーン名の行数で高さが変わるため、
                         *     上揃えだと**カードの丈がばらついて不格好になる**。
                         *   ⚠️ `stretch` で行内の高さを揃える。
                         */
                        alignItems: 'stretch',
                        maxWidth: '1180px',
                    }}
                >
                    {shown.map(item => (
                        <div key={item.campaign_id}
                            className="bg-white shadow-sm rounded-3 d-flex flex-column"
                            // ⚠️ 高さを揃えたうえで、ボタン以下を下端に寄せる（下の mt-auto）
                            style={{ border: '1px solid #e9ecef', overflow: 'hidden', height: '100%' }}>

                            <div className="p-3">
                                <div className="text-muted mb-1" style={{ fontSize: '0.7rem' }}>
                                    <i className="fa-regular fa-calendar me-1"></i>{item.registered_date}
                                </div>
                                {/**
                                  * ⚠️ 2行で切る。⚠️ さらに**2行ぶんの高さを確保**しておく。
                                  *   ⚠️ 切るだけだと1行の名前でカードが縮み、丈が揃わない。
                                  */}
                                <div className="fw-bold text-dark mb-2" style={{
                                    fontSize: '0.88rem', lineHeight: 1.5,
                                    display: '-webkit-box', WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                    minHeight: 'calc(0.88rem * 1.5 * 2)',
                                }}>
                                    {item.campaign}
                                </div>
                                <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}
                                    title={item.campaign_id}>
                                    {item.campaign_id}
                                </div>
                            </div>

                            {/* ⚠️ `mt-auto` でボタン以下を下端へ。⚠️ 高さを揃えたぶんの余白を上に寄せる */}
                            <div className="px-3 pb-3 d-flex flex-wrap gap-2 mt-auto">
                                {/* ⚠️ Button を href で使うと <a> になり、
                                      ⚠️ 全体CSSの影響で下線が付く。ここで打ち消す */}
                                <Button size="sm" variant="white" className="border text-secondary"
                                    href={item.url} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: '0.75rem', textDecoration: 'none' }}>
                                    <i className="fa-solid fa-arrow-up-right-from-square me-1"></i>開く
                                </Button>
                                <Button size="sm" variant="white" className="border text-secondary"
                                    onClick={() => copyTag(item)} style={{ fontSize: '0.75rem' }}>
                                    <i className="fa-regular fa-copy me-1"></i>
                                    {copied === item.campaign_id ? 'コピーしました' : 'フォームタグをコピー'}
                                </Button>
                                <Button size="sm" variant="primary" className="ms-auto"
                                    onClick={() => editForm(item.brand, item.campaign_id)}
                                    style={{ fontSize: '0.75rem' }}>
                                    修正
                                </Button>
                            </div>

                            {/* ⚠️ フォームタグは常に出す（2026-09-16 の指示）。畳まない */}
                            <div className="px-3 pb-3">
                                <div className="text-muted mb-1" style={{ fontSize: '0.68rem' }}>フォームタグ</div>
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
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CampaignList;
