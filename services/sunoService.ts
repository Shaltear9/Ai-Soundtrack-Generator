
import type { SunoTask } from "../types";

const SUNO_API_URL = "https://api.sunoapi.org/api/v1";

interface GenerateResponse {
    code: number;
    msg: string;
    data: {
        taskId: string;
    };
}

// Flexible track data interface to handle API variations
interface TrackData {
    id?: string;
    audio_url?: string;
    audioUrl?: string;
    image_url?: string;
    imageUrl?: string;
    title?: string;
    tags?: string;
    duration?: number;
    prompt?: string;
    [key: string]: any;
}

interface TaskInfoData {
    taskId: string;
    status: string; 
    response?: {
        data: TrackData[];
        [key: string]: any;
    };
    data?: TrackData[]; // Fallback location
    errorMessage?: string;
    [key: string]: any;
}

interface TaskStatusResponse {
    code: number;
    msg: string;
    data: TaskInfoData;
}

/**
 * Triggers music generation via Suno API.
 * Using "Inspiration Mode" (customMode: false) allows us to pass a descriptive prompt
 * and let the model decide on the lyrics (or lack thereof) and composition.
 */
export async function generateMusic(prompt: string, apiKey: string, instrumental: boolean = true): Promise<string> {
    if (!apiKey) throw new Error("Suno API Key is required.");

    // The API requires callBackUrl even if we are polling.
    const body = {
        prompt: prompt,
        customMode: false, 
        instrumental: instrumental,
        model: "V5",
        callBackUrl: "https://webhook.site/8e599e44-1a3e-4630-bbbf-9dc75d9bd674"
    };

    let response;
    try {
        response = await fetch(`${SUNO_API_URL}/generate`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
    } catch (networkError) {
        throw new Error(`Network error during generation request: ${networkError instanceof Error ? networkError.message : String(networkError)}`);
    }

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Suno API Request Failed (${response.status}): ${errText}`);
    }

    const res: GenerateResponse = await response.json();

    if (res.code !== 200) {
        throw new Error(`Suno API Error (${res.code}): ${res.msg}`);
    }

    return res.data.taskId;
}

/**
 * Polls the task status until it is complete or fails.
 * @param taskId The ID returned from generation
 * @param apiKey The user's API key
 * @param onProgress Optional callback to update status message in UI
 */
export async function pollForMusic(
    taskId: string, 
    apiKey: string, 
    onProgress?: (status: string) => void
): Promise<SunoTask[]> {
    const MAX_ATTEMPTS = 60; // 5 minutes
    const INTERVAL = 5000; // 5 seconds

    let consecutiveErrors = 0;
    let lastKnownStatus = "Initializing";

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await new Promise(resolve => setTimeout(resolve, INTERVAL));

        try {
            const response = await fetch(`${SUNO_API_URL}/generate/record-info?taskId=${taskId}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                consecutiveErrors++;
                const errText = await response.text();
                console.warn(`Polling HTTP Error (${response.status}):`, errText);
                if (consecutiveErrors >= 5) throw new Error(`Repeated API errors (${response.status}): ${errText}`);
                if (onProgress) onProgress(`Connection issue... retrying (${i+1}/${MAX_ATTEMPTS})`);
                continue;
            }

            const res: TaskStatusResponse = await response.json();

            if (res.code !== 200) {
                consecutiveErrors++;
                console.warn(`Polling API Error (${res.code}):`, res.msg);
                if (consecutiveErrors >= 5) throw new Error(`Repeated API error code ${res.code}: ${res.msg}`);
                continue;
            }

            consecutiveErrors = 0;
            const data = res.data;
            
            if (!data) {
                 if (onProgress) onProgress(`Waiting for data... (${i+1}/${MAX_ATTEMPTS})`);
                 continue;
            }

            const status = (data.status || 'UNKNOWN').toUpperCase();
            lastKnownStatus = status;

            if (onProgress) {
                onProgress(`Status: ${status} (${Math.round(((i + 1) * INTERVAL)/1000)}s)`);
            }

            // Flexible extraction of tracks
            let tracks: TrackData[] = [];
            
            // Handle case where response might be a JSON string (rare but possible in some proxy configs)
            let responseObj = data.response;
            if (typeof responseObj === 'string') {
                try {
                     responseObj = JSON.parse(responseObj);
                } catch (e) {
                    console.warn("Failed to parse data.response string:", responseObj);
                }
            }

            // Prioritize documented location (data.response.data)
            if (responseObj?.data && Array.isArray(responseObj.data)) {
                tracks = responseObj.data;
            } else if (Array.isArray(responseObj)) {
                tracks = responseObj as any;
            } else if (Array.isArray(data.data)) {
                // Fallback: sometimes APIs return data directly in data.data
                tracks = data.data;
            } else if (responseObj?.clips && Array.isArray(responseObj.clips)) {
                 // Fallback: some versions use 'clips'
                 tracks = responseObj.clips;
            }

            // Helpers for loose property matching (camelCase vs snake_case)
            const getAudioUrl = (t: any) => t.audio_url || t.audioUrl || t.audio_src || t.url || t.audio;
            const getImageUrl = (t: any) => t.image_url || t.imageUrl || t.image_src || t.image;

            // If we have tracks, check if they have content
            if (tracks.length > 0) {
                const validTracks = tracks.filter(t => getAudioUrl(t));
                
                if (validTracks.length > 0) {
                    console.log("Suno Generation Success:", validTracks);
                    return validTracks.map(item => ({
                        id: item.id || `gen-${Date.now()}-${Math.random()}`,
                        status: 'SUCCESS',
                        audio_url: getAudioUrl(item),
                        image_url: getImageUrl(item),
                        title: item.title || 'Generated Track',
                        prompt: item.prompt || item.metadata?.prompt
                    }));
                }
            }

            if (status === 'SUCCESS') {
                // Status says success, but we didn't find valid tracks in the previous block.
                console.warn("Status SUCCESS but no valid audio found. Full Response:", JSON.stringify(res));
                
                if (tracks.length > 0) {
                     throw new Error("Generation marked as complete, but audio URLs were missing from the response.");
                } else {
                     throw new Error("Generation marked as complete, but no track data was returned.");
                }
            }

            if (status === 'FAILED') {
                throw new Error(`Suno API task failed: ${data.errorMessage || 'Unknown error'}`);
            }

        } catch (e) {
            // Check if it's a fatal error we just threw
            if (e instanceof Error && (
                e.message.includes("Repeated API") || 
                e.message.includes("Suno API task failed") ||
                e.message.includes("Generation marked as complete")
            )) {
                throw e;
            }
            console.warn("Polling loop exception:", e);
        }
    }

    throw new Error(`Timeout waiting for music generation. Last known status: ${lastKnownStatus}. If the status was SUCCESS, it may indicate a data parsing issue.`);
}
