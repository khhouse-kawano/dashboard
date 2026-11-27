import { useCallback, useEffect, useState } from 'react';
import apiClient from '../../utils/apiClient';
import type { ReplyLevel } from './landLogic';

/**
 * 土地仕入（v2.2.311）の通信と型。② は features/landAcquisition/。
 *
 * ⚠️ 読み込み（land_*）は GET。⚠️ GET が落ちたら（① の許可リストが古いなど）同じ request を POST で送る（② の中身は同じ）。
 * ⚠️ 書き込みは POST の land:<roll>。
 * ⚠️ 条件のキーは ② と URL で同じ（担当は sel：'' ＝チーム全員 / 'm:<担当者の id>' / 'a:<エリアの id>'、'a:0' はその他）。
 */

export const landGet = async <T = Record<string, unknown>>(request: string, params: Record<string, string | number> = {}): Promise<T> => {
    const clean: Record<string, string> = {};
    Object.entries(params).forEach(([k, v]) => { if (String(v) !== '') clean[k] = String(v); });
    try {
        const res = await apiClient.get('', { params: { request, ...clean } });
        if (res?.data?.status !== 'ok') throw new Error(res?.data?.message ?? 'invalid response');
        return res.data as T;
    } catch (e) {
        const status = (e as { response?: { status?: number } }).response?.status;
        // ⚠️ 権限・見つからないは POST でも同じ。送り直さない
        if (status === 401 || status === 403 || status === 404) throw e;
        console.warn(`${request} の GET に失敗しました。POST で送り直します:`, e);
        const res = await apiClient.post('', { request, ...clean });
        if (res?.data?.status !== 'ok') throw new Error(res?.data?.message ?? 'invalid response');
        return res.data as T;
    }
};

export const landPost = async <T = Record<string, unknown>>(roll: string, body: Record<string, unknown>): Promise<T> => {
    const res = await apiClient.post('', { request: 'land', roll, ...body });
    if (res?.data?.status !== 'ok') throw new Error(res?.data?.message ?? '保存できませんでした。');
    return res.data as T;
};

/** エラーの文（② の message があればそれ） */
export const errorText = (e: unknown, fallback: string): string => {
    const m = (e as { response?: { data?: { message?: string } } }).response?.data?.message ?? (e as Error)?.message;
    return m && !/^Request failed|invalid response|Network Error/.test(m) ? m : fallback;
};

export interface LandMember { id: number; name: string; areaId: number | null; areaName: string; staffId: number | null; active: boolean }
export interface LandArea { id: number; name: string; label: string }
export interface KpiDef { key: string; label: string; unit: string; calc: string; description: string }
export interface LandMaster {
    settings: { fyStart: number; leadDays: number; warnDays: number };
    areas: LandArea[]; members: LandMember[]; kpiDefs: KpiDef[]; options: Record<string, string[]>;
    statuses: string[]; apBreakdown: { k: string; label: string }[]; apTypesLead: string[];
    sources: { id: number; name: string; kind: string }[]; meMemberId: number | null; today: string;
}

export interface LandDeal {
    id: number; memberId: number | null; memberName: string; areaId: number | null; kind: string; vendorId: number | null; vendorName: string;
    address: string; mapUrl: string; lots: number; landM2: number | null; price: number | null; sellerName: string; agentName: string;
    buyPrice: number | null; terms: string; termsMemo: string; status: string; infoDate: string | null; propDate: string | null;
    offerDate: string | null; contractDate: string | null; settleDate: string | null; memo: string; simSales: number | null;
    simBuild: number | null; simDemolition: number | null; simExpenseRate: number; simProfitRate: number; offerTo: string;
    replyDue: string | null; replyResult: string; replyDate: string | null; replyMemo: string; lostReason: string; lostMemo: string;
    apId: number | null; sourceId: number | null; createdBy: string; updatedBy: string; updatedAt: string;
    simMaxOffer: number | null; tsuboUnit: number | null; tsubo: number | null; replyLevel: ReplyLevel; replyDays: number | null; nextStatus: string | null;
}
export interface LandApproach {
    id: number; date: string; time: string; memberId: number | null; memberName: string; vendorId: number | null; vendorName: string;
    type: string; contact: string; reaction: string; infoCount: number; memo: string; address: string; mapUrl: string;
    landM2: number | null; tsubo: number | null; isCandidate: boolean; sourceId: number | null; dealCount: number; createdBy: string; updatedBy: string;
}
export interface LandVendor {
    id: number; name: string; vkind: string; contact: string; tel: string; email: string; area: string; addr: string; url: string;
    ownerMemberId: number | null; ownerName: string; rank: string; temp: string; lastVisit: string | null; buyCount: number; memo: string;
    updatedBy: string; updatedAt: string;
    ap?: number; apMonth?: number; apFy?: number; deals?: number; settledLots?: number; buyTotal?: number; lastContact?: string | null; daysSince?: number | null;
}

/** マスタは画面をまたいで使い回す（⚠️ 担当者を直したら reloadLandMaster で読み直す） */
let masterCache: LandMaster | null = null;
let masterPromise: Promise<LandMaster> | null = null;
const listeners = new Set<(m: LandMaster) => void>();
const fetchMaster = (): Promise<LandMaster> => {
    masterPromise = landGet<LandMaster>('land_master').then((m) => {
        masterCache = m;
        listeners.forEach((fn) => fn(m));
        return m;
    }).finally(() => { masterPromise = null; });
    return masterPromise;
};
export const reloadLandMaster = (): Promise<LandMaster> => fetchMaster();

export const useLandMaster = () => {
    const [master, setMaster] = useState<LandMaster | null>(masterCache);
    const [error, setError] = useState('');
    useEffect(() => {
        listeners.add(setMaster);
        if (!masterCache) (masterPromise ?? fetchMaster()).catch((e) => setError(errorText(e, '土地仕入の設定を読み込めませんでした。')));
        return () => { listeners.delete(setMaster); };
    }, []);
    return { master, error };
};

/** 担当の選択肢（チーム全員・エリアの合算・1人ずつ） */
export const selOptions = (m: LandMaster): { value: string; label: string; group: string }[] => {
    const list: { value: string; label: string; group: string }[] = [{ value: '', label: `チーム全員（${m.members.filter((x) => x.active).length}名）`, group: '' }];
    const areas = [...m.areas.map((a) => ({ id: a.id, label: a.label })), { id: 0, label: 'その他' }];
    for (const a of areas) {
        const n = m.members.filter((x) => (a.id === 0 ? x.areaId === null : x.areaId === a.id) && x.active).length;
        if (n > 0) list.push({ value: `a:${a.id}`, label: `${a.label}（${n}名の合算）`, group: 'エリア集計' });
    }
    for (const x of m.members) list.push({ value: `m:${x.id}`, label: x.active ? x.name : `${x.name}（停止中）`, group: x.active ? x.areaName : '停止中' });
    return list;
};

/** sel の表示名 */
export const selLabel = (m: LandMaster | null, sel: string): string => {
    if (!m || sel === '') return 'チーム全体';
    return selOptions(m).find((o) => o.value === sel)?.label.replace(/（.*$/, '') ?? '';
};

/** 一覧などで何度も使う「読み込んで、失敗したら文を出す」 */
export const useAsync = <T,>(fn: () => Promise<T>, deps: unknown[]) => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const run = useCallback(fn, deps);
    const reload = useCallback(async () => {
        setLoading(true);
        try { setData(await run()); setError(''); } catch (e) { setError(errorText(e, '読み込めませんでした。時間をおいて、もう一度お試しください。')); } finally { setLoading(false); }
    }, [run]);
    useEffect(() => {
        // ⚠️ setTimeout(0)：StrictMode の2回の effect を1回にまとめる
        const t = window.setTimeout(() => { void reload(); }, 0);
        return () => window.clearTimeout(t);
    }, [reload]);
    return { data, loading, error, reload, setData };
};

export const fmtNum = (v: number | null | undefined, digits = 0): string =>
    v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : Number(v).toLocaleString('ja-JP', { maximumFractionDigits: digits });
export const monthLabel = (ym: string): string => `${ym.slice(0, 4)}年${Number(ym.slice(5, 7))}月`;
export const mapUrlOf = (address: string, mapUrl: string): string =>
    mapUrl || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '');
