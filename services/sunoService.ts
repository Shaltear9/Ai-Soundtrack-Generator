import type { SunoTask } from "../types";

const SUNO_API_BASE = "https://api.sunoapi.org";

interface GenerateResponse {
    code: number;
    msg: string;
    data: {
        taskId: string;
    };
}

interface TrackData {
    id: string;
    audioUrl: string;
    streamAudioUrl: string;
    imageUrl: string;
    prompt: string;
    modelName: string;
    title: string;
    tags: string;
    createTime: string;
    duration: number;
}

interface TaskInfoResponse {
    code: number;
    msg: string;
    data: {
        taskId: string;
        parentMusicId: string;
        param: string;
        response: {
            taskId: string;
            sunoData: TrackData[];
        };
        status: 'PENDING' | 'TEXT_SUCCESS' | 'FIRST_SUCCESS' | 'SUCCESS' | 'CREATE_TASK_FAILED' | 'GENERATE_AUDIO_FAILED' | 'CALLBACK_EXCEPTION' | 'SENSITIVE_WORD_ERROR';
        type: string;
        operationType: 'generate' | 'extend' | 'upload_cover' | 'upload_extend';
        errorCode: number | null;
        errorMessage: string | null;
    };
}

/**
 * Generate music using Suno API
 */
export async function generateMusic(
    prompt: string,
    apiKey: string,
    instrumental: boolean = true,
    title?: string,
    style?: string
): Promise<string> {
    if (!apiKey) throw new Error("Suno API Key is required.");

    const body = {
        prompt: prompt,
        style: style || "Cinematic",
        title: title || "Generated Soundtrack",
        customMode: true,
        instrumental: instrumental,
        model: "V5",
        callBackUrl:"https://ai.shaltearasg.xyz/api/suno"
    };

    const response = await fetch(`${SUNO_API_BASE}/api/v1/generate`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Suno API Request Failed (${response.status}): ${errorText}`);
    }

    const result: GenerateResponse = await response.json();

    if (result.code !== 200) {
        throw new Error(`Suno API Error (${result.code}): ${result.msg}`);
    }

    return result.data.taskId;
}

/**
 * Poll task status until completion or failure
 */
export async function pollForMusic(
    taskId: string,
    apiKey: string,
    onProgress?: (status: string, progress?: number) => void
): Promise<SunoTask[]> {
    const MAX_ATTEMPTS = 60; // Maximum attempts (10 minutes)
    const INTERVAL = 5000; // 5 second interval

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        await new Promise(resolve => setTimeout(resolve, INTERVAL));

        try {
            const response = await fetch(
                `${SUNO_API_BASE}/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
                {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            if (!response.ok) {
                console.warn(`Polling request failed (${response.status}), attempt ${attempt + 1}`);
                if (onProgress) {
                    onProgress(`Request failed, retrying... (${attempt + 1}/${MAX_ATTEMPTS})`);
                }
                continue;
            }

            const result: TaskInfoResponse = await response.json();

            if (result.code !== 200) {
                console.warn(`API returned error code ${result.code}: ${result.msg}`);
                if (onProgress) {
                    onProgress(`API error, retrying... (${attempt + 1}/${MAX_ATTEMPTS})`);
                }
                continue;
            }

            const taskData = result.data;
            const status = taskData.status;

            // Update progress status
            let progressMessage = `Status: ${status}`;
            let progressValue: number | undefined;

            switch (status) {
                case 'PENDING':
                    progressMessage = "Task queued...";
                    progressValue = 10;
                    break;
                case 'TEXT_SUCCESS':
                    progressMessage = "Text generation complete, generating audio...";
                    progressValue = 40;
                    break;
                case 'FIRST_SUCCESS':
                    progressMessage = "First part audio generated...";
                    progressValue = 70;
                    break;
                case 'SUCCESS':
                    progressMessage = "Audio generation complete!";
                    progressValue = 100;
                    break;
                case 'CREATE_TASK_FAILED':
                case 'GENERATE_AUDIO_FAILED':
                case 'CALLBACK_EXCEPTION':
                case 'SENSITIVE_WORD_ERROR':
                    throw new Error(`Generation failed: ${taskData.errorMessage || status}`);
            }

            if (onProgress) {
                onProgress(progressMessage, progressValue);
            }

            // Check if completed
            if (status === 'SUCCESS') {
                const sunoData = taskData.response?.sunoData;
                if (sunoData && sunoData.length > 0) {
                    console.log("Suno generation completed successfully:", sunoData);

                    // Convert to SunoTask format
                    return sunoData.map(track => ({
                        id: track.id,
                        status: 'SUCCESS',
                        audio_url: track.audioUrl,
                        image_url: track.imageUrl,
                        title: track.title,
                        model_name: track.modelName,
                        prompt: track.prompt
                    }));
                } else {
                    throw new Error("Generation completed but no audio data returned");
                }
            }

            // Handle failure states
            if (status.includes('FAILED') || status.includes('ERROR')) {
                throw new Error(`Generation failed: ${taskData.errorMessage || status}`);
            }

        } catch (error) {
            if (error instanceof Error) {
                // If it's a clear error, throw directly
                if (error.message.includes('Generation failed')) {
                    throw error;
                }
                // Network errors and other temporary issues, continue retrying
                console.warn(`Polling attempt ${attempt + 1} failed:`, error.message);
            }

            if (onProgress) {
                onProgress(`Connection issue, retrying... (${attempt + 1}/${MAX_ATTEMPTS})`);
            }
        }
    }

    throw new Error("Generation timeout, please try again later");
}

/**
 * Get task info (single query, no polling)
 */
export async function getTaskInfo(taskId: string, apiKey: string): Promise<TaskInfoResponse['data']> {
    const response = await fetch(
        `${SUNO_API_BASE}/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            }
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to get task info: ${response.status}`);
    }

    const result: TaskInfoResponse = await response.json();

    if (result.code !== 200) {
        throw new Error(`API error: ${result.msg}`);
    }

    return result.data;
}