import { GoogleGenAI, Type } from "@google/genai";
import type { ScriptAnalysis } from '../types';

// Lazily initialize the AI client to avoid errors on module load.
let ai: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
    if (!ai) {
        const API_KEY = process.env.API_KEY;
        if (!API_KEY) {
            throw new Error("API_KEY environment variable not set. Please ensure it's configured.");
        }
        ai = new GoogleGenAI({
            apiKey: API_KEY,
            httpOptions: {
                // 使用你的第三方代理 base URL
                baseUrl: "https://yunwu.ai",
            },
        });
    }
    return ai;
}

/**
 * 把前端上传的 File 转成 base64，用于 inlineData.data
 */
async function fileToBase64(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const len = bytes.byteLength;

    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    // 浏览器环境下用 btoa
    return btoa(binary);
}

/**
 * 支持：
 * - 只有脚本/文本
 * - 脚本 + 视频（推荐）
 * 会返回 ScriptAnalysis（summary、mood、title、music_prompt）
 */
export async function analyzeScriptAndGeneratePrompts(
    scriptText: string,
    videoFile?: File | null
): Promise<ScriptAnalysis> {
    const aiClient = getAiClient();
    const model = "gemini-2.5-flash";

    if (!scriptText.trim() && !videoFile) {
        throw new Error("Please provide at least a video or a script/description.");
    }

    // 总体指令（角色说明 + 要求返回 JSON）
    const instruction = `
You are a professional film score composer.
You will receive a video (and optionally its script / description).
Your goal is to create a single, cohesive music generation prompt that acts as the soundtrack for the entire video.

Output JSON with the following fields:
1. summary: A brief 1-sentence summary of the video's content.
2. mood: 2-3 words describing the emotional tone (e.g., "Melancholic, Hopeful").
3. title: A creative title for the soundtrack.
4. music_prompt: A detailed description for an AI music generator (Suno). 
   - Focus on instruments, tempo, genre, and atmosphere.
   - Do NOT include lyrics. 
   - Keep it under 450 characters.
   - Example: "A cinematic orchestral piece building from a quiet piano intro into a heroic crescendo with strings and brass, ending on a triumphant note."
`.trim();

    const parts: any[] = [
        { text: instruction }
    ];

    if (scriptText.trim()) {
        parts.push({
            text: `Here is the script or description of the video:\n\n${scriptText.trim()}`
        });
    }

    if (videoFile) {
        // 把视频作为 inlineData 传给 Gemini，多模态视频理解示例在你上传的文档里就是这种结构
        const base64Video = await fileToBase64(videoFile);
        parts.push({
            inlineData: {
                mimeType: videoFile.type || "video/mp4",
                data: base64Video,
            },
        });
    }

    const response = await aiClient.models.generateContent({
        model,
        contents: [
            {
                role: "user",
                parts,
            },
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: { type: Type.STRING },
                    mood: { type: Type.STRING },
                    title: { type: Type.STRING },
                    music_prompt: { type: Type.STRING },
                },
                required: ["summary", "mood", "title", "music_prompt"],
            },
        },
    });

    const jsonText = response.text.trim();
    try {
        const parsedResult = JSON.parse(jsonText);
        return parsedResult as ScriptAnalysis;
    } catch (e) {
        console.error("Failed to parse JSON response:", jsonText);
        throw new Error("The AI returned an invalid format. Please try again.");
    }
}
