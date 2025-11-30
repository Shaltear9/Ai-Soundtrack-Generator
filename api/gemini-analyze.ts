// api/gemini-analyze.ts

const GEMINI_ENDPOINT =
    'https://yunwu.ai/v1beta/models/gemini-2.0-flash:generateContent';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY 未配置' });
    }

    try {
        // Vercel Node 函数中，req.body 可能是对象，也可能是字符串
        let bodyData: any = req.body;
        if (typeof bodyData === 'string') {
            try {
                bodyData = JSON.parse(bodyData);
            } catch (e) {
                return res.status(400).json({ error: 'Invalid JSON body' });
            }
        }
        bodyData = bodyData || {};

        const { scriptText, video } = bodyData as {
            scriptText?: string;
            video?: { mimeType: string; data: string } | null;
        };

        if (!scriptText?.trim() && !video) {
            return res
                .status(400)
                .json({ error: '请至少提供视频或剧本/描述之一。' });
        }

        const parts: any[] = [];

        // 1) 视频 part：用你 txt 文档里的字段：inline_data + mime_type
        if (video) {
            parts.push({
                inline_data: {
                    mime_type: video.mimeType || 'video/mp4',
                    data: video.data,
                },
            });
        }

        // 2) 文本 part（系统提示 + 用户剧本）
        const scriptSegment = (scriptText || '').trim();

        const textPrompt = `
You are a professional film score composer.
You will receive a video (and optionally its script / description).
Your goal is to create a single, cohesive music generation prompt that acts as the soundtrack for the entire video.

Return a JSON object with the following fields:
1. summary: A brief 1-sentence summary of the video's content.
2. mood: 2-3 words describing the emotional tone (e.g., "Melancholic, Hopeful").
3. title: A creative title for the soundtrack.
4. music_prompt: A detailed description for an AI music generator (Suno).
   - Focus on instruments, tempo, genre, and atmosphere.
   - Do NOT include lyrics.
   - Keep it under 450 characters.

${scriptSegment
                ? `Here is the script or description of the video:\n\n${scriptSegment}`
                : 'No script was provided. Infer everything from the video only.'
            }
    `.trim();

        parts.push({ text: textPrompt });

        const upstreamBody = {
            contents: [
                {
                    role: 'user',
                    parts,
                },
            ],
        };

        const upstreamRes = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(upstreamBody),
        });

        const upstreamText = await upstreamRes.text();

        if (!upstreamRes.ok) {
            // 把上游错误透传回前端，方便排查
            return res.status(upstreamRes.status).json({
                error: 'Gemini upstream error',
                status: upstreamRes.status,
                body: upstreamText,
            });
        }

        // yunwu 代理基本跟官方一致：candidates[0].content.parts[0].text
        let text: string | null = null;
        try {
            const data = JSON.parse(upstreamText);
            text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
        } catch {
            // 防御：万一上游直接返回纯文本
            text = upstreamText;
        }

        if (!text || typeof text !== 'string') {
            return res
                .status(500)
                .json({ error: 'Gemini 返回的结果中没有文本内容。' });
        }

        // 让模型返回 JSON 字符串，我们在后端解析
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        const jsonSlice =
            firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
                ? text.slice(firstBrace, lastBrace + 1)
                : text;

        let parsed: any;
        try {
            parsed = JSON.parse(jsonSlice);
        } catch (e) {
            return res.status(500).json({
                error: 'Gemini 返回的 JSON 格式不合法，解析失败。',
                raw: text,
            });
        }

        // 直接把解析好的 JSON 返回给前端
        return res.status(200).json(parsed);
    } catch (err: any) {
        console.error('[api/gemini-analyze] error:', err);
        return res.status(500).json({
            error: err?.message || 'Unknown server error',
        });
    }
}
