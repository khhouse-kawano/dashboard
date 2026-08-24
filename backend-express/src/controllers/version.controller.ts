import type { RequestHandler } from 'express';
import { fetchLatestVersion } from '../services/version.service';

/**
 * Controller 層：HTTP の入口と出口だけを担当する。
 * try-catch は書かない。throw された例外は Express 5 が errorHandler まで運ぶ。
 */
export const getLatestVersion: RequestHandler = async (_req, res) => {
  const version = await fetchLatestVersion();

  res.json({
    status: 'ok',
    data: version,
  });
};
