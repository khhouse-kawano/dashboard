import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import type { JobScope, UsageTotals } from './job';
import { failJob, finishJob, markRunning, updateProgress } from './job';
import { buildUserMessage, SYSTEM_PROMPT } from './prompt';
import type { ReportInput } from './tools';
import { executeTool, progressLabel, reportInput, SUBMIT_TOOL, TOOLS } from './tools';

/**
 * 「Claudeによる分析」の実行（v2.2.217）。
 *
 * Claude に道具を渡し、データを取りに行かせながら分析させる（手書きのループ）。
 * 画面からの要求とは切り離して ② のプロセス内で動き、進み具合は ai_analysis_job に書く。
 *
 * ⚠️ 1回で数分〜十数分かかる。ゲートウェイの要求（120秒で切れる）の中で待たないこと。
 * ⚠️ 実行のたびに課金される。上限は registry 側（1人1日5回・同時実行数）でも掛けている。
 */

export const MODEL = 'claude-opus-5-5';

/** Claude とのやり取りの最大往復数。超えたら失敗にする（暴走で費用が膨らむのを防ぐ） */
const MAX_TURNS = 40;
/** レポートを出さずに止まったとき、提出を促す回数 */
const MAX_NUDGES = 2;

/**
 * 100万トークンあたりの単価（USD）。Claude Opus 5.5。
 * ⚠️ 拒否されて別のモデルで続いた場合も同じ単価で数えるため、費用は概算である。
 */
const PRICE = { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 };

const costOf = (usage: Anthropic.Beta.BetaUsage): number =>
  ((usage.input_tokens ?? 0) * PRICE.input +
    (usage.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
    (usage.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
    (usage.output_tokens ?? 0) * PRICE.output) /
  1_000_000;

let client: Anthropic | null = null;
const getClient = (): Anthropic => {
  if (client === null) {
    // ⚠️ 1回の応答が長い（レポートの HTML を書く）ため、既定より長く待つ
    client = new Anthropic({ apiKey: env.anthropicApiKey, timeout: 15 * 60 * 1000, maxRetries: 3 });
  }
  return client;
};

const todayJst = (): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());

/** 失敗を利用者に見せる文言にする（⚠️ API の生のメッセージには英語や内部情報が混ざる） */
const userMessageOf = (error: unknown): string => {
  if (error instanceof Anthropic.AuthenticationError) return 'API キーが無効です。管理者に API キーの設定を確認してもらってください。';
  if (error instanceof Anthropic.PermissionDeniedError) return 'この API キーでは分析を実行できません。';
  if (error instanceof Anthropic.RateLimitError) return 'Claude が混み合っています。少し時間をおいて、もう一度実行してください。';
  if (error instanceof Anthropic.BadRequestError) {
    return /credit balance/i.test(error.message)
      ? 'Claude のクレジット残高が不足しています。管理者に連絡してください。'
      : '分析の依頼を Claude が受け付けませんでした。依頼文を変えて、もう一度実行してください。';
  }
  if (error instanceof Anthropic.APIConnectionError) return 'Claude に接続できませんでした。もう一度実行してください。';
  if (error instanceof Anthropic.APIError) return 'Claude 側で一時的な障害が起きています。時間をおいて、もう一度実行してください。';
  return error instanceof Error ? error.message : '分析に失敗しました。';
};

/**
 * 分析を最後まで実行する。⚠️ 例外を外に出さない（呼び出し側は待たずに放っておく）。
 */
export const runAnalysisJob = async (jobId: number, scope: JobScope, prompt: string): Promise<void> => {
  const usage: UsageTotals = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  let toolCalls = 0;

  try {
    await markRunning(jobId, MODEL);

    const messages: Anthropic.Beta.BetaMessageParam[] = [
      { role: 'user', content: buildUserMessage(scope, prompt, todayJst()) },
    ];
    let nudges = 0;
    let report: ReportInput | null = null;

    for (let turn = 0; turn < MAX_TURNS && report === null; turn++) {
      const stream = getClient().beta.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        // ⚠️ Opus 5.5 は思考を止められない。深さは effort で決める（既定 medium より1段深く）
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        // ⚠️ 安全のための拒否が起きたら、同じ要求を別のモデルで続けてもらう
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        // ⚠️ 指示文・道具・それまでのやり取りを毎回キャッシュする（往復が多いため費用が大きく下がる）
        cache_control: { type: 'ephemeral' },
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      const message = await stream.finalMessage();
      usage.inputTokens +=
        (message.usage.input_tokens ?? 0) +
        (message.usage.cache_creation_input_tokens ?? 0) +
        (message.usage.cache_read_input_tokens ?? 0);
      usage.outputTokens += message.usage.output_tokens ?? 0;
      usage.costUsd += costOf(message.usage);

      if (message.stop_reason === 'refusal') {
        throw new Error('Claude がこの依頼の分析を断りました。依頼文を変えて、もう一度実行してください。');
      }
      if (message.stop_reason === 'max_tokens') {
        throw new Error('レポートが長くなりすぎて途中で切れました。対象や観点を絞って、もう一度実行してください。');
      }

      messages.push({ role: 'assistant', content: message.content });

      const toolUses = message.content.filter(
        (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use'
      );

      if (toolUses.length === 0) {
        // レポートを出さずに止まった。提出を促す
        if (nudges >= MAX_NUDGES) throw new Error('Claude がレポートを提出しないまま止まりました。もう一度実行してください。');
        nudges++;
        messages.push({
          role: 'user',
          content: `分析結果は ${SUBMIT_TOOL} でレポートとして提出してください。`,
        });
        continue;
      }

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        toolCalls++;
        await updateProgress(jobId, progressLabel(toolUse.name), toolCalls);

        if (toolUse.name === SUBMIT_TOOL) {
          const parsed = reportInput.safeParse(toolUse.input);
          if (parsed.success) {
            report = parsed.data;
            break;
          }
          results.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            is_error: true,
            content: 'title・summary・html の3つがそろっていません（html は完結した HTML 全文）。もう一度提出してください。',
          });
          continue;
        }

        try {
          const content = await executeTool(toolUse.name, toolUse.input, scope);
          results.push({ type: 'tool_result', tool_use_id: toolUse.id, content });
        } catch (error) {
          results.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            is_error: true,
            content: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (report === null) messages.push({ role: 'user', content: results });
    }

    if (report === null) {
      throw new Error('分析が長くなりすぎたため打ち切りました。対象や観点を絞って、もう一度実行してください。');
    }

    await finishJob(jobId, report, usage, toolCalls);
    logger.info(
      `ai_analysis job=${jobId} done tools=${toolCalls} in=${usage.inputTokens} out=${usage.outputTokens} usd=${usage.costUsd.toFixed(4)}`
    );
  } catch (error) {
    logger.error(`ai_analysis job=${jobId} failed`, error instanceof Error ? error.message : error);
    try {
      await failJob(jobId, userMessageOf(error), usage, toolCalls);
    } catch (saveError) {
      logger.error(`ai_analysis job=${jobId} could not save failure`, saveError);
    }
  }
};
