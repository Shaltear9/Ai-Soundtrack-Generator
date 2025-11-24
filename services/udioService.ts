
const UDIO_API_URL = "https://udioapi.pro/api/v2";

interface GenerateResponse {
    code: number;
    message: string;
    workId?: string;
    data?: {
        task_id: string; // Some versions return task_id, some workId
    };
}

interface FeedResponse {
    code: number;
    data: {
        id: string;
        audio_url: string;
        status: string; // 'SUCCESS', 'PENDING', 'FAILED'
        image_url?: string;
        title?: string;
        duration?: number;
    }[];
}

export async function generateTrack(prompt: string, apiKey: string): Promise<string> {
    if (!apiKey) throw new Error("Udio API Key is required.");

    // Using Inspiration Mode as requested by user documentation
    const body = {
        model: "chirp-v3-5",
        gpt_description_prompt: prompt,
        make_instrumental: true // Usually soundtracks are instrumental, but user can change via prompt if needed. Defaulting to true for scores.
    };

    const response = await fetch(`${UDIO_API_URL}/generate`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Udio API Error (${response.status}): ${errText}`);
    }

    const data: GenerateResponse = await response.json();

    // Handle potential variations in response structure
    const workId = data.workId || data.data?.task_id;

    if (!workId) {
        throw new Error("Failed to retrieve Task ID from Udio response.");
    }

    return workId;
}

export async function pollForTrack(workId: string, apiKey: string): Promise<string> {
    const MAX_ATTEMPTS = 30; // 5 minutes roughly
    const INTERVAL = 10000; // 10 seconds

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await new Promise(resolve => setTimeout(resolve, INTERVAL));

        try {
            // Polling the feed for the specific workId
            const response = await fetch(`${UDIO_API_URL}/feed?workId=${workId}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) continue; // Retry on transient network errors

            const res: FeedResponse = await response.json();
            
            // API usually returns an array in 'data'. Find our task.
            const track = res.data?.find(t => t.id === workId);

            if (track) {
                if (track.status === 'SUCCESS' && track.audio_url) {
                    return track.audio_url;
                } else if (track.status === 'FAILED') {
                    throw new Error("Udio generation failed.");
                }
                // If PENDING or CREATED, continue loop
            }
        } catch (e) {
            console.warn("Polling error:", e);
            // Continue polling unless it's a fatal error
        }
    }

    throw new Error("Timeout waiting for audio generation.");
}
