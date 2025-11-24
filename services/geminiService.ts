
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
               baseUrl: "https://edge.tb.api.mkeai.com",
            },
            });
    }
    return ai;
}

export async function analyzeScriptAndGeneratePrompts(scriptText: string): Promise<ScriptAnalysis> {
    const aiClient = getAiClient();
    const model = "gemini-2.5-flash";

    const prompt = `
        You are a professional film score composer.
        Analyze the following movie script or video description.
        
        Your goal is to create a **single, cohesive music generation prompt** that acts as the soundtrack for the entire video.
        
        Output JSON with the following fields:
        1.  **summary**: A brief 1-sentence summary of the video's content.
        2.  **mood**: 2-3 words describing the emotional tone (e.g., "Melancholic, Hopeful").
        3.  **title**: A creative title for the soundtrack.
        4.  **music_prompt**: A detailed description for an AI music generator (Suno). 
            - Focus on instruments, tempo, genre, and atmosphere.
            - Do NOT include lyrics. 
            - Keep it under 450 characters.
            - Example: "A cinematic orchestral piece building from a quiet piano intro into a heroic crescendo with strings and brass, ending on a triumphant note."

        Here is the script:
        ---
        ${scriptText}
        ---
    `;

    const response = await aiClient.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: { type: Type.STRING },
                    mood: { type: Type.STRING },
                    title: { type: Type.STRING },
                    music_prompt: { type: Type.STRING }
                },
                required: ["summary", "mood", "title", "music_prompt"]
            }
        }
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
