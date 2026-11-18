import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import { GoogleMapContext } from '../../context/GoogleMapContext';
import apiClient from '../../utils/apiClient';
import OwnersHouseImages from './OwnersHouseImages';
import type { LgCode, OwnersHouse, ShopOption } from './types';
import { IMAGE_KEYS, brandOfShop, formatLatLng, parseLatLng, toFormalShopName, toShortShopName } from './types';

/**
 * オーナーズハウスの物件1件の編集（v2.2.284）。一覧（OwnersHouseAdmin.tsx）の行を押すと開く。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 地図を押す（またはピンを動かす）と lat_and_long が決まる。物件ページの地図（map_address）は ② が保存のときに作り直す。
 * ⚠️ 都道府県・市区町村は lg_code から選ぶ。保存するのは「都府県」「市区町村」を抜いた形（サイトの絞り込みがこの形のため）。
 *   ⚠️ 一覧に無い呼び名（出水阿久根・加世田・肝属）は「いまの値」として選択肢に残す。
 * ⚠️ 管理店舗は shop_list の注文事業の店舗名（略称）で選び、保存するときに正式名称に直す（types.ts の toFormalShopName / toShortShopName）。
 * ⚠️ 種別は本文の house_category で送る（category で送るとゲートウェイの振り分けの鍵になり 502）。
 * ⚠️ 画像は OwnersHouseImages.tsx が枠ごとにすぐ保存する。画像を変えたあと閉じたら、一覧を読み直す（onSaved）。
 * ─────────────────────────────────────────────
 */

type Props = {
    house: OwnersHouse | null;
    shops: ShopOption[];
    codes: LgCode[];
    categories: string[];
    brands: string[];
    onClose: () => void;
    onSaved: () => void;
};

/** 地図の初期位置（鹿児島県の中ほど） */
const DEFAULT_CENTER = { lat: 31.7252, lng: 130.6202 };

const TEXT_FIELDS: Array<[keyof OwnersHouse, string, string]> = [
    ['title', '見出し', 'オーナーズハウスのとき、一覧・物件ページ・地図の吹き出しに出ます'],
    ['name', '所在地の表示', '番地は書かない（例 鹿児島県霧島市国分府中町）'],
    ['structure', '構造', '例 平屋・2階建て'],
    ['large', '延床面積', '例 110.96㎡'],
    ['plan', '間取り', '例 4LDK'],
    ['tag', 'タグ', 'カンマ区切り。サイトの #タグ で絞り込めます'],
    ['staff', '担当', 'オーナー様が書いてきた内容のまま'],
    ['shop_zip', '管理店舗の郵便番号', ''],
    ['shop_address', '管理店舗の住所', ''],
];

const OwnersHouseEditModal: React.FC<Props> = ({ house, shops, codes, categories, brands, onClose, onSaved }) => {
    const { isLoaded } = useContext(GoogleMapContext);
    const [form, setForm] = useState<OwnersHouse | null>(house);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [searchText, setSearchText] = useState('');
    /** 画像を変えたか（変えたら閉じるときに一覧を読み直す） */
    const imagesChanged = useRef(false);

    useEffect(() => {
        if (!house) { setForm(null); return; }
        const shopName = toShortShopName(house.shop);
        setForm({ ...house, shop: shops.some(s => s.shop === shopName) ? shopName : house.shop });
        setError('');
        setSearchText(house.name);
        imagesChanged.current = false;
    }, [house, shops]);

    const prefOptions = useMemo(() => codes.filter(c => c.city_short === ''), [codes]);
    const cityOptions = useMemo(() => codes.filter(c => c.city_short !== '' && c.pref_short === form?.pref), [codes, form?.pref]);
    const shopOptions = useMemo(() => shops.filter(s => !/(全店舗|店舗未設定)/.test(s.shop)), [shops]);
    const position = form ? parseLatLng(form.lat_and_long) : null;

    if (!form) return null;

    const set = <K extends keyof OwnersHouse>(key: K, value: OwnersHouse[K]) => setForm(prev => (prev ? { ...prev, [key]: value } : prev));

    const onPref = (pref: string) => setForm(prev => (prev ? { ...prev, pref, area: '', lg_code: null } : prev));
    const onCity = (code: string) => {
        const c = codes.find(x => x.code === code);
        setForm(prev => (prev ? { ...prev, area: c ? c.city_short : prev.area, lg_code: c ? c.code : prev.lg_code } : prev));
    };
    const onShop = (shop: string) => setForm(prev => (prev ? { ...prev, shop, brand: brandOfShop(shop) || prev.brand } : prev));
    const onPick = (e: google.maps.MapMouseEvent) => {
        if (e.latLng) set('lat_and_long', formatLatLng({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
    };

    /** 住所で地図を動かす（⚠️ Geocoding が使えないキーのときは、地図を押して決めてもらう） */
    const searchAddress = () => {
        if (!searchText.trim() || !window.google?.maps) return;
        new window.google.maps.Geocoder().geocode({ address: searchText, region: 'jp' }, (results, status) => {
            const loc = status === 'OK' ? results?.[0]?.geometry.location : undefined;
            if (loc) set('lat_and_long', formatLatLng({ lat: loc.lat(), lng: loc.lng() }));
            else setError('住所から位置を探せませんでした。地図を押してピンを立ててください。');
        });
    };

    const save = async () => {
        setError('');
        if (!form.category) { setError('種別を選んでください。'); return; }
        if (form.lat_and_long && !parseLatLng(form.lat_and_long)) { setError('地図の位置が不正です。地図を押し直してください。'); return; }
        setSaving(true);
        try {
            // ⚠️ 画像の列は送らない（OwnersHouseImages が保存する。② も受け付けない）
            const { category, no, id, map_address, updated_at, updated_by, ...rest } = form;
            IMAGE_KEYS.forEach(k => { delete (rest as Partial<OwnersHouse>)[k]; });
            // ⚠️ 管理店舗は略称で選び、正式名称で保存する（サイトの表示が正式名称のため）
            const res = await apiClient.post('', { request: 'owners_house_admin_save', ...rest, shop: toFormalShopName(rest.shop), no: no || undefined, house_category: category });
            if (res.data?.status !== 'success') { setError(res.data?.message ?? '保存に失敗しました。'); return; }
            onSaved();
        } catch (e) {
            console.error('[ownershouse] 保存に失敗しました', e);
            setError('保存に失敗しました。時間をおいてもう一度お試しください。');
        } finally {
            setSaving(false);
        }
    };

    const close = () => (imagesChanged.current ? onSaved() : onClose());

    const isUnlistedArea = form.area !== '' && !cityOptions.some(c => c.city_short === form.area);

    return (
        <Modal show onHide={close} size="xl" centered scrollable>
            <style>{`
                .ohm_body { font-size: 13px; color: #1f2937; }
                .ohm_grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
                .ohm_section { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; }
                .ohm_section + .ohm_section { margin-top: 12px; }
                .ohm_section_title { font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 8px; }
                .ohm_row { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 8px; align-items: center; margin-bottom: 8px; }
                .ohm_label { font-size: 11px; font-weight: 700; color: #6b7280; }
                .ohm_hint { font-size: 10px; color: #9ca3af; grid-column: 2; margin-top: -4px; }
                .ohm_map { height: 380px; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb; }
                .ohm_latlng { font-size: 11px; color: #4b5563; font-variant-numeric: tabular-nums; }
                .ohm_caution { font-size: 11px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 6px 10px; }
                .ohm_img_grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
                .ohm_img_main { grid-column: span 1; }
                .ohm_img_box { aspect-ratio: 4 / 3; background: #f3f4f6; border: 1px dashed #d1d5db; border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #9ca3af; cursor: pointer; }
                .ohm_img_box:hover { border-color: #2563eb; color: #2563eb; }
                .ohm_img_box:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
                .ohm_img_box img { width: 100%; height: 100%; object-fit: cover; }
                .ohm_img_main .ohm_img_box { border-style: solid; border-color: #bfdbfe; }
                .ohm_img_foot { display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #6b7280; margin-top: 2px; }
                .ohm_img_remove { border: none; background: none; color: #b91c1c; font-size: 10px; padding: 0; cursor: pointer; }
                .ohm_switch { display: flex; align-items: center; gap: 8px; font-weight: 700; }
            `}</style>
            <Modal.Header closeButton>
                <Modal.Title style={{ fontSize: '15px', fontWeight: 700 }}>
                    <i className="fa-solid fa-house-chimney me-2 text-primary" aria-hidden="true" />
                    {form.no ? `物件 ${form.id} を編集` : '物件を追加'}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="ohm_body">
                {error && <div className="alert alert-danger py-2" style={{ fontSize: '12px' }}>{error}</div>}
                <div className="ohm_grid">
                    <div>
                        <div className="ohm_section">
                            <div className="ohm_section_title">基本</div>
                            <div className="ohm_row">
                                <span className="ohm_label">公開</span>
                                <label className="ohm_switch">
                                    <input type="checkbox" checked={form.flag === '1'} onChange={e => set('flag', e.target.checked ? '1' : '0')} />
                                    {form.flag === '1' ? 'サイトに出す' : 'サイトに出さない'}
                                </label>
                            </div>
                            <div className="ohm_row">
                                <span className="ohm_label">種別</span>
                                <select className="form-select form-select-sm" value={form.category} onChange={e => set('category', e.target.value)}>
                                    <option value="">選んでください</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="ohm_row">
                                <span className="ohm_label">都道府県</span>
                                <select className="form-select form-select-sm" value={form.pref} onChange={e => onPref(e.target.value)}>
                                    <option value="">選んでください</option>
                                    {prefOptions.map(p => <option key={p.code} value={p.pref_short}>{p.pref_short}</option>)}
                                </select>
                            </div>
                            <div className="ohm_row">
                                <span className="ohm_label">市区町村</span>
                                <select className="form-select form-select-sm"
                                    value={isUnlistedArea ? '__current' : (form.lg_code ?? cityOptions.find(c => c.city_short === form.area)?.code ?? '')}
                                    onChange={e => e.target.value !== '__current' && onCity(e.target.value)} disabled={!form.pref}>
                                    <option value="">選んでください</option>
                                    {isUnlistedArea && <option value="__current">{form.area}（いまの値・一覧にない呼び名）</option>}
                                    {cityOptions.map(c => <option key={c.code} value={c.code}>{c.city_short}</option>)}
                                </select>
                                <span className="ohm_hint">サイトのエリアの絞り込みに出る名前です（「市」「町」などを抜いた形）</span>
                            </div>
                            <div className="ohm_row">
                                <span className="ohm_label">管理店舗</span>
                                <select className="form-select form-select-sm" value={form.shop} onChange={e => onShop(e.target.value)}>
                                    <option value="">選んでください</option>
                                    {!shopOptions.some(s => s.shop === form.shop) && form.shop && <option value={form.shop}>{form.shop}（いまの値）</option>}
                                    {shopOptions.map(s => <option key={s.shop} value={s.shop}>{s.shop}</option>)}
                                </select>
                            </div>
                            <div className="ohm_row">
                                <span className="ohm_label">ブランド</span>
                                <select className="form-select form-select-sm" value={form.brand} onChange={e => set('brand', e.target.value)}>
                                    <option value="">選んでください</option>
                                    {!brands.includes(form.brand) && form.brand && <option value={form.brand}>{form.brand}（いまの値）</option>}
                                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                                <span className="ohm_hint">見学予約の通知先が決まります。管理店舗を選ぶと自動で入ります</span>
                            </div>
                        </div>

                        <div className="ohm_section">
                            <div className="ohm_section_title">物件の内容</div>
                            {TEXT_FIELDS.map(([key, label, hint]) => (
                                <div className="ohm_row" key={key}>
                                    <span className="ohm_label">{label}</span>
                                    <input className="form-control form-control-sm" value={String(form[key] ?? '')} onChange={e => set(key, e.target.value as never)} />
                                    {hint && <span className="ohm_hint">{hint}</span>}
                                </div>
                            ))}
                            {(['feature_1', 'feature_2', 'feature_3', 'feature_4'] as const).map((key, i) => (
                                <div className="ohm_row" key={key}>
                                    <span className="ohm_label">特徴{i + 1}</span>
                                    <input className="form-control form-control-sm" value={form[key]} onChange={e => set(key, e.target.value)} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="ohm_section">
                            <div className="ohm_section_title">地図のピン（押すとその場所にピンが立ちます。ピンは動かせます）</div>
                            <div className="d-flex gap-2 mb-2">
                                <input className="form-control form-control-sm" placeholder="住所で探す（例 鹿児島県霧島市国分府中町）" value={searchText}
                                    onChange={e => setSearchText(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchAddress()} />
                                <button type="button" className="btn btn-sm btn-outline-primary text-nowrap" onClick={searchAddress}>探す</button>
                            </div>
                            <div className="ohm_map">
                                {isLoaded ? (
                                    <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={position ?? DEFAULT_CENTER}
                                        zoom={position ? 16 : 9} onClick={onPick} options={{ streetViewControl: false, mapTypeControl: true, clickableIcons: false }}>
                                        {position && <MarkerF position={position} draggable onDragEnd={onPick} />}
                                    </GoogleMap>
                                ) : <div className="p-3 text-muted">地図を読み込み中…</div>}
                            </div>
                            <div className="d-flex justify-content-between mt-1">
                                <span className="ohm_latlng">{form.lat_and_long ? `緯度・経度：${form.lat_and_long}` : 'まだピンがありません'}</span>
                                {form.lat_and_long && <button type="button" className="btn btn-link btn-sm p-0" style={{ fontSize: '11px' }} onClick={() => set('lat_and_long', '')}>ピンを外す</button>}
                            </div>
                            <div className="ohm_caution mt-2">
                                オーナーズハウスはオーナー様のお住まいです。サイトの地図では、近づくとピンの代わりに円で出す予定です（モデルハウスはピンのまま）。
                            </div>
                        </div>

                        <div className="ohm_section">
                            <div className="ohm_section_title">画像（14枚まで。メイン4枚＋物件ページの下のカルーセル10枚）</div>
                            <OwnersHouseImages no={form.no} images={IMAGE_KEYS.map(k => form[k])}
                                onChanged={(slot, url) => { imagesChanged.current = true; set(IMAGE_KEYS[slot - 1], url); }} />
                        </div>
                        {form.updated_at && <div className="text-muted mt-2" style={{ fontSize: '11px' }}>最終更新：{form.updated_at}（{form.updated_by || '不明'}）</div>}
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={close} disabled={saving}>閉じる</button>
                <button type="button" className="btn btn-sm btn-primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存する'}</button>
            </Modal.Footer>
        </Modal>
    );
};

export default OwnersHouseEditModal;
