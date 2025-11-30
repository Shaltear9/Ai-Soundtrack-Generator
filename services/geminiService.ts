// src/services/geminiService.ts
import type { ScriptAnalysis } from '../types';

/**
 * 浏览器端 File -> base64（去掉 data:xxx;base64, 那一截头）
 */
async function fileToBase64(file: File): Promise<string> {
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('File read error'));
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
                return reject(new Error('Unexpected FileReader result type'));
            }
            const [, base64] = result.split(',');
            resolve(base64 || result);
        };
        reader.readAsDataURL(file);
    });
}

/**
 * 前端只调用自己的 /api/gemini-analyze，不直接访问 yunwu
 */
export async function analyzeScriptAndGeneratePrompts(
    scriptText: string,
    videoFile?: File | null
): Promise<ScriptAnalysis> {
    if (!scriptText.trim() && !videoFile) {
        throw new Error('请至少提供视频或剧本/描述之一。');
    }

    let videoPayload: { mimeType: string; data: string } | null = null;

    if (videoFile) {
        const base64Video = await fileToBase64(videoFile);
        videoPayload = {
            mimeType: videoFile.type || 'video/mp4',
            data: base64Video,
        };
    }

    const res = await fetch('/api/gemini-analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            scriptText,
            video: videoPayload,
        }),
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(
            `Gemini API Error ${res.status}: ${errText || res.statusText}`
        );
    }

    const data = (await res.json()) as ScriptAnalysis;
    return data;
}
