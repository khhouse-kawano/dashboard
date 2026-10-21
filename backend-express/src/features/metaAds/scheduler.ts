import { logger } from '../../utils/logger';
import { importMetaAds, isMetaConfigured } from './importer';

/**
 * Meta 広告の自動取り込み（v2.2.203）。② の起動から少し待って1回、その後 INTERVAL ごとに取り込み続ける。
 * ⚠️ cron の設定は要らない。⚠️ ② を再起動すると、起動のたびに1回取り込む。
 * ⚠️ .env の META_ACCESS_TOKEN・META_AD_ACCOUNTS が無ければ何もしない。
 */
const FIRST_DELAY_MS = 60_000;
const INTERVAL_MS = 6 * 60 * 60 * 1000;

export const startMetaAdsScheduler = (): void => {
  if (!isMetaConfigured()) {
    logger.info('metaAds: META_ACCESS_TOKEN / META_AD_ACCOUNTS が無いため、自動取り込みはしません');
    return;
  }
  const run = (): void => {
    importMetaAds().catch((error: unknown) => logger.error('metaAds: 自動取り込みに失敗しました', error));
  };
  setTimeout(run, FIRST_DELAY_MS).unref();
  setInterval(run, INTERVAL_MS).unref();
  logger.info('metaAds: 自動取り込みを始めます（起動の1分後と、その後6時間ごと）');
};
