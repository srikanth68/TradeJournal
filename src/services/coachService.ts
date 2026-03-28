import Anthropic from '@anthropic-ai/sdk';
import { fromStoredPrice } from '../utils/price';
import type { PositionWithEntries } from './positionService';

export type Message = { role: 'user' | 'assistant'; content: string };

function buildTradeContext(positions: PositionWithEntries[]): string {
  if (positions.length === 0) return 'No trades recorded yet.';

  const closed = positions.filter(p => p.status === 'closed');
  const open = positions.filter(p => p.status === 'open');

  const totalPnl = closed.reduce((s, p) => s + (p.realizedPnl ?? 0), 0);
  const wins = closed.filter(p => (p.realizedPnl ?? 0) > 0).length;
  const losses = closed.filter(p => (p.realizedPnl ?? 0) <= 0).length;
  const winRate = closed.length ? Math.round((wins / closed.length) * 100) : 0;

  // Top strategies by P&L
  const byStrategy: Record<string, { pnl: number; count: number }> = {};
  for (const p of closed) {
    const s = p.strategyId ?? 'No Strategy';
    byStrategy[s] = { pnl: (byStrategy[s]?.pnl ?? 0) + (p.realizedPnl ?? 0), count: (byStrategy[s]?.count ?? 0) + 1 };
  }

  // Emotion P&L
  const byEmotion: Record<string, { pnl: number; count: number }> = {};
  for (const p of closed) {
    if (!p.emotionTag) continue;
    byEmotion[p.emotionTag] = { pnl: (byEmotion[p.emotionTag]?.pnl ?? 0) + (p.realizedPnl ?? 0), count: (byEmotion[p.emotionTag]?.count ?? 0) + 1 };
  }

  const recent = [...closed]
    .sort((a, b) => new Date(b.exitDate ?? 0).getTime() - new Date(a.exitDate ?? 0).getTime())
    .slice(0, 10)
    .map(p => {
      const pnlVal = fromStoredPrice(p.realizedPnl ?? 0);
      return `- ${p.ticker} (${p.tradeType === 'buy' ? 'LONG' : 'SHORT'}): $${pnlVal >= 0 ? '+' : ''}${pnlVal.toFixed(2)}, grade=${p.tradeGrade ?? '?'}, emotion=${p.emotionTag ?? '?'}`;
    })
    .join('\n');

  const emotionSummary = Object.entries(byEmotion)
    .map(([e, v]) => `${e}: avg $${(fromStoredPrice(v.pnl) / v.count).toFixed(0)} over ${v.count} trades`)
    .join(', ');

  return `
TRADING ACCOUNT SUMMARY
Open positions: ${open.length}
Closed trades: ${closed.length}
Win rate: ${winRate}% (${wins}W / ${losses}L)
Total realized P&L: $${fromStoredPrice(totalPnl).toFixed(2)}

EMOTION TAG P&L BREAKDOWN
${emotionSummary || 'No emotion data yet'}

RECENT CLOSED TRADES (most recent 10)
${recent || 'None'}

OPEN POSITIONS
${open.map(p => `- ${p.ticker} (${p.tradeType === 'buy' ? 'LONG' : 'SHORT'}), ${p.totalQuantity} shares`).join('\n') || 'None'}
`.trim();
}

const SYSTEM_PROMPT = `You are a sharp, honest trading coach embedded inside a personal trade journal app. You have full access to the user's trade history, win rates, emotional patterns, and strategy performance.

Your job:
1. Give brutally honest, data-driven feedback — no fluff
2. Spot behavioral patterns the user might not see (e.g. FOMO trades losing money, revenge trading tendencies)
3. Praise what's working specifically
4. Ask probing questions to deepen self-awareness
5. Keep responses concise — 3–5 sentences max unless asked for more
6. Use dollar amounts and percentages from the actual data when making points

You are NOT a financial advisor. Never give buy/sell recommendations for specific securities. Focus only on trading psychology, discipline, and process.`;

export async function streamCoachReply(
  apiKey: string,
  history: Message[],
  positions: PositionWithEntries[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const tradeContext = buildTradeContext(positions);

  const contextMessage: Anthropic.MessageParam = {
    role: 'user',
    content: `[TRADE DATA — updated each session]\n${tradeContext}`,
  };

  const systemWithContext = `${SYSTEM_PROMPT}\n\n${tradeContext}`;

  const messages: Anthropic.MessageParam[] = history.map(m => ({
    role: m.role,
    content: m.content,
  }));

  try {
    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemWithContext,
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        onChunk(event.delta.text);
      }
    }
    onDone();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    onError(msg);
  }
}
