import React, { useRef, useState } from 'react';
import apiClient from '../../utils/apiClient';
import { IMAGE_SLOTS } from './types';

/**
 * オーナーズハウスの画像14枠（v2.2.285）。編集のモーダル（OwnersHouseEditModal.tsx）の中で使う。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 1〜4 がメイン（1 は一覧・地図のサムネイル）、5〜14 は物件ページの下のカルーセル。
 * ⚠️ 選んだ画像は、ブラウザで長い辺 1600px までの JPEG に縮めてから送る（② owners_house_admin_image）。
 *   ⚠️ 枠ごとにすぐ保存する（モーダルの「保存する」は待たない）。
 * ⚠️ 新しい物件（まだ保存していない）は no が無いので、先に「保存する」を押してもらう。
 * ─────────────────────────────────────────────
 */

type Props = {
    no: number;
    images: string[];
    onChanged: (slot: number, url: string) => void;
};

const MAX_EDGE = 1600;
const QUALITY = 0.85;

/** 画像ファイル → 長い辺 1600px までの JPEG の data URL */
const shrink = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); reject(new Error('canvas')); return; }
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', QUALITY));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load')); };
    img.src = url;
});

const OwnersHouseImages: React.FC<Props> = ({ no, images, onChanged }) => {
    const [busySlot, setBusySlot] = useState<number | null>(null);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement | null>(null);
    const targetSlot = useRef(0);

    const send = async (slot: number, data: string) => {
        setBusySlot(slot);
        setError('');
        try {
            const res = await apiClient.post('', { request: 'owners_house_admin_image', no, slot, data });
            if (res.data?.status !== 'success') { setError(res.data?.message ?? '画像を保存できませんでした。'); return; }
            onChanged(slot, String(res.data.url ?? ''));
        } catch (e) {
            console.error('[ownershouse] 画像の保存に失敗しました', e);
            setError('画像を保存できませんでした。時間をおいてもう一度お試しください。');
        } finally {
            setBusySlot(null);
        }
    };

    const pick = (slot: number) => {
        targetSlot.current = slot;
        inputRef.current?.click();
    };

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
            setError('JPEG・PNG・WebP の画像を選んでください。');
            return;
        }
        try {
            await send(targetSlot.current, await shrink(file));
        } catch {
            setError('この画像は読み込めませんでした。JPEG・PNG・WebP の画像を選んでください。');
        }
    };

    const remove = (slot: number) => {
        if (window.confirm(`画像${slot}を外しますか？（サイトからも消えます）`)) send(slot, '');
    };

    if (!no) return <div className="ohm_hint" style={{ gridColumn: 'auto' }}>画像は、物件を一度「保存する」と登録できるようになります。</div>;

    return (
        <>
            {error && <div className="alert alert-danger py-1 mb-2" style={{ fontSize: '11px' }}>{error}</div>}
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />
            <div className="ohm_img_grid">
                {Array.from({ length: IMAGE_SLOTS }, (_, i) => i + 1).map(slot => {
                    const url = images[slot - 1] ?? '';
                    return (
                        <div className={`ohm_img${slot <= 4 ? ' ohm_img_main' : ''}`} key={slot}>
                            <div className="ohm_img_box" onClick={() => busySlot === null && pick(slot)} role="button" tabIndex={0}
                                onKeyDown={e => e.key === 'Enter' && busySlot === null && pick(slot)} aria-label={`画像${slot}を選ぶ`}>
                                {busySlot === slot ? <span>保存中…</span>
                                    : url ? <img src={url} alt={`画像${slot}`} loading="lazy" />
                                        : <span><i className="fa-solid fa-plus" aria-hidden="true" /></span>}
                            </div>
                            <div className="ohm_img_foot">
                                <span>{slot <= 4 ? `メイン${slot}` : `下${slot - 4}`}</span>
                                {url && busySlot === null && <button type="button" className="ohm_img_remove" onClick={() => remove(slot)}>外す</button>}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="ohm_hint mt-1" style={{ gridColumn: 'auto' }}>
                枠を押して画像を選ぶと、すぐ保存されます。メイン1は一覧と地図のサムネイルです。下1〜10は物件ページの下にカルーセルで出ます。
            </div>
        </>
    );
};

export default OwnersHouseImages;
