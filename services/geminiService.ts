// services/geminiService.ts
import type { ScriptAnalysis } from '../types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;

if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not set. Multimodal analysis will fail without it.');
}

// 上传视频文件到 Gemini File API，返回 { uri, mimeType }
async function uploadVideoToGemini(videoFile: File) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const formData = new FormData();
    formData.append('file', videoFile);
    // 可选：formData.append('fileId', videoFile.name);

    const res = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            body: formData,
        }
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to upload video: ${res.status} - ${text}`);
    }

    const data = await res.json();
    // 典型返回格式：{ file: { uri, mimeType, ... } }
    if (!data.file || !data.file.uri) {
        throw new Error('Upload succeeded but no file URI returned from Gemini.');
    }

    return {
        uri: data.file.uri as string,
        mimeType: data.file.mimeType as string,
    };
}

/**
 * 多模态分析：
 * - scriptText: 文本脚本或描述（可以为空）
 * - videoFile: 上传的视频文件（可以为空）
 *
 * 二者只要有一个存在就可以工作；如果都有，则做视频 + 文本联合理解。
 */
export async function analyzeScriptAndGeneratePrompts(
    scriptText: string,
    videoFile?: File
): Promise<ScriptAnalysis> {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const parts: any[] = [];

    // 1. 如果有视频，先上传，再把 fileData 放入 parts
    if (videoFile) {
        const uploaded = await uploadVideoToGemini(videoFile);
        parts.push({
            fileData: {
                fileUri: uploaded.uri,
                mimeType: uploaded.mimeType,
            },
        });
    }

    // 2. 系统指令 + 文本内容
    const systemPrompt = `
You are a film and soundtrack expert. Analyze the given video (if present) together with the script/description.

Return ONLY a strict JSON object with the following fields (no markdown, no extra text):
{
  "summary": "2-4 sentences summarizing the story and visuals.",
  "music_prompt": "1-2 sentences describing the ideal background music.",
  "mood": "short phrase describing overall mood, e.g. 'tense and mysterious'.",
  "title": "short cinematic title for the soundtrack."
}
`.trim();

    parts.push(
        { text: systemPrompt },
        {
            text:
                scriptText && scriptText.trim().length > 0
                    ? `SCRIPT_OR_DESCRIPTION:\n${scriptText}`
                    : 'No script text provided. Infer as much as you can from the video alone.',
        }
    );

    // 3. 调用 Gemini 多模态模型
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts,
                    },
                ],
            }),
        }
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gemini API error: ${res.status} - ${text}`);
    }

    const data = await res.json();

    const rawText =
        data.candidates?.[0]?.content?.parts?.[0]?.text ??
        data.candidates?.[0]?.content?.parts
            ?.map((p: any) => p.text)
            .filter(Boolean)
            .join('\n');

    if (!rawText) {
        throw new Error('No text content returned from Gemini.');
    }

    // 4. 尝试从模型返回中抠出 JSON 并解析
    try {
        const jsonStart = rawText.indexOf('{');
        const jsonEnd = rawText.lastIndexOf('}');
        const jsonString =
            jsonStart >= 0 && jsonEnd >= 0
                ? rawText.slice(jsonStart, jsonEnd + 1)
                : rawText;

        const parsed = JSON.parse(jsonString);

        // 简单的类型兜底
        const result: ScriptAnalysis = {
            summary: parsed.summary ?? '',
            music_prompt: parsed.music_prompt ?? '',
            mood: parsed.mood ?? '',
            title: parsed.title ?? '',
        };

        return result;
    } catch (e) {
        console.error('Failed to parse Gemini response as JSON:', rawText);
        throw new Error('Failed to parse Gemini response as JSON. Check console output.');
    }
}
