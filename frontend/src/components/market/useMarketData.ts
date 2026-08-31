/**
 * 市況分析のデータ取得フック。
 *
 * 取得は初回マウント時の1回だけ。絞り込みはすべてクライアント側で行うため、
 * セレクタを触るたびに通信が走ることはない。
 */

import { useEffect, useState } from 'react';
import { fetchMarketData } from './api';
import type { MarketData } from './types';

type State = {
  data: MarketData | null;
  loading: boolean;
  error: string | null;
};

export const useMarketData = (): State => {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    // アンマウント後に setState して警告が出るのを防ぐ
    let alive = true;

    fetchMarketData()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        // 失敗を握りつぶすと「表が空なのは0件だから」と誤解されるため、必ず表面化させる
        const message = error instanceof Error ? error.message : '市況データの取得に失敗しました。';
        console.error('市況データの取得に失敗しました', error);
        if (alive) setState({ data: null, loading: false, error: message });
      });

    return () => {
      alive = false;
    };
  }, []);

  return state;
};
