import type { VercelRequest, VercelResponse } from '@vercel/node'
import fetch from 'node-fetch'

const SYSTEM_PROMPT = `你是"伊卫 EVE"的隐患结构化助手。请根据输入的 rawText 和 locationText，输出 JSON：
{
  "riskTypes": string[],
  "riskLevel": "low" | "medium" | "high",
  "publicSummary": string,
  "expiresInHours": number,
  "privacyRemoved": boolean
}`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } })
  }

  const { rawText = '', locationText = '' } = req.body ?? {}

  if (!rawText) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'rawText is required' } })
  }

  try {
    const completion = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY ?? ''}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({ rawText, locationText }),
          },
        ],
        temperature: 0.3,
      }),
    })

    const payload = await completion.json()
    const content = payload?.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(content)

    return res.status(200).json({
      riskTypes: parsed.riskTypes ?? ['夜间环境异常'],
      riskLevel: parsed.riskLevel ?? 'medium',
      publicSummary:
        parsed.publicSummary ?? `${locationText || '该路段'}存在待核验风险，建议调整路线。`,
      expiresInHours: parsed.expiresInHours ?? 48,
      privacyRemoved: parsed.privacyRemoved ?? true,
    })
  } catch (error) {
    console.error('Hazard proxy error', error)
    return res.status(500).json({
      error: { code: 'DEEPSEEK_ERROR', message: 'Hazard AI request failed' },
    })
  }
}
