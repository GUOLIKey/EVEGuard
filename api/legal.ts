import type { VercelRequest, VercelResponse } from '@vercel/node'
import fetch from 'node-fetch'

const LEGAL_PROMPT = `你是"伊卫 EVE"的法律援助手，输出 JSON：
{
  "immediateActions": string[],
  "evidenceTips": string[],
  "legalReferences": [{"title": string, "summary": string, "article"?: string, "link"?: string}],
  "riskWarnings": string[],
  "suggestedContacts": string[],
  "tone"?: string,
  "confidence"?: number
}`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } })
  }

  const { scenario = 'stranger_tail', userStatement = '', location = '', language = 'zh-CN' } =
    req.body ?? {}

  if (!userStatement) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'userStatement is required' } })
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
          { role: 'system', content: LEGAL_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({ scenario, userStatement, location, language }),
          },
        ],
        temperature: 0.4,
      }),
    })

    const payload = await completion.json()
    const content = payload?.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(content)

    return res.status(200).json({
      immediateActions: parsed.immediateActions ?? [],
      evidenceTips: parsed.evidenceTips ?? [],
      legalReferences: parsed.legalReferences ?? [],
      riskWarnings: parsed.riskWarnings ?? [],
      suggestedContacts: parsed.suggestedContacts ?? [],
      tone: parsed.tone,
      confidence: parsed.confidence,
    })
  } catch (error) {
    console.error('Legal proxy error', error)
    return res.status(500).json({ error: { code: 'DEEPSEEK_ERROR', message: 'Legal AI request failed' } })
  }
}
