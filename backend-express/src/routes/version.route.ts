import { Router } from 'express';
import { getLatestVersion } from '../controllers/version.controller';

/** マウント先: /api/v1/version */
export const versionRouter = Router();

// GET /api/v1/version
versionRouter.get('/', getLatestVersion);
