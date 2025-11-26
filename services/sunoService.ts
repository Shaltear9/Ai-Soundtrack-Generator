import type { SunoTask } from "../types";

const SUNO_API_URL = "https://api.sunoapi.org/api/v1";

interface GenerateResponse {
    code: number;
    msg: string;
    data: {
        taskId: string;
    };
}

// 根据轮询.txt文档修正接口
interface WavRecordInfoResponse {
    code: number;
    msg: string;
    data: {
        taskId: string;
        musicId: string;
        callbackUrl: string;
        completeTime: string;
        response: {
            audioWavUrl: string;
        };
        successFlag: 'PENDING' | 'SUCCESS' | 'CREATE_TASK_FAILED' | 'GENERATE_WAV_FAILED' | 'CALLBACK_EXCEPTION';
        createTime: string;
        errorCode: number | null;
        errorMessage: string | null;
    };
}

/**
 * Triggers music generation via Suno API.
 */
export async function generateMusic(prompt: string, apiKey: string, instrumental: boolean = true): Promise<string> {
    if (!apiKey) throw new Error("Suno API Key is required.");

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
 * 增加轮询次数以适应长时间生成的音乐
 */
export async function pollForMusic(
    taskId: string,
    apiKey: string,
    onProgress?: (status: string) => void
): Promise<SunoTask[]> {
    const MAX_ATTEMPTS = 120; // 增加到10分钟 (120 * 5秒 = 600秒)
    const INTERVAL = 5000; // 5 seconds

    let consecutiveErrors = 0;
    let lastKnownData: any = null;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await new Promise(resolve => setTimeout(resolve, INTERVAL));

        try {
            // 使用WAV记录信息接口
            const response = await fetch(`${SUNO_API_URL}/wav/record-info?taskId=${taskId}`, {
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
                if (onProgress) onProgress(`Connection issue... retrying (${i + 1}/${MAX_ATTEMPTS})`);
                continue;
            }

            const res: WavRecordInfoResponse = await response.json();
            console.log(`Polling attempt ${i + 1}:`, res); // 详细调试日志

            if (res.code !== 200) {
                consecutiveErrors++;
                console.warn(`Polling API Error (${res.code}):`, res.msg);
                if (consecutiveErrors >= 5) throw new Error(`Repeated API error code ${res.code}: ${res.msg}`);
                if (onProgress) onProgress(`API Error: ${res.msg} (${i + 1}/${MAX_ATTEMPTS})`);
                continue;
            }

            consecutiveErrors = 0;
            const data = res.data;
            lastKnownData = data;

            if (!data) {
                if (onProgress) onProgress(`Waiting for data... (${i + 1}/${MAX_ATTEMPTS})`);
                continue;
            }

            const status = data.successFlag || 'UNKNOWN';
            const elapsedSeconds = Math.round(((i + 1) * INTERVAL) / 1000);
            const progressMsg = `Status: ${status} (${elapsedSeconds}s)`;

            if (onProgress) onProgress(progressMsg);

            // 检查任务状态
            if (status === 'SUCCESS') {
                if (data.response?.audioWavUrl) {
                    console.log("Suno Generation Success:", data);
                    return [{
                        id: data.taskId,
                        status: 'SUCCESS',
                        audio_url: data.response.audioWavUrl,
                        title: 'Generated Track',
                        // 这里需要prompt信息，但WAV接口不返回，可能需要从其他途径获取
                    }];
                } else {
                    console.warn("SUCCESS status but no audio URL:", data);
                    // 继续轮询一小段时间，等待URL出现
                    if (i < MAX_ATTEMPTS - 5) {
                        continue;
                    } else {
                        throw new Error("Generation marked as complete but audio URL was never provided");
                    }
                }
            }

            // 失败状态
            if (status === 'CREATE_TASK_FAILED' || status === 'GENERATE_WAV_FAILED' || status === 'CALLBACK_EXCEPTION') {
                throw new Error(`Suno API task failed: ${data.errorMessage || 'Unknown error'}`);
            }

            // PENDING状态继续轮询

        } catch (e) {
            // 检查是否是我们抛出的致命错误
            if (e instanceof Error && (
                e.message.includes("Repeated API") ||
                e.message.includes("Suno API task failed") ||
                e.message.includes("Generation marked as complete")
            )) {
                throw e;
            }
            console.warn("Polling loop exception:", e);
            if (onProgress) onProgress(`Polling error, continuing... (${i + 1}/${MAX_ATTEMPTS})`);
        }
    }

    // 提供更详细的超时信息
    let timeoutMessage = `Timeout waiting for music generation after ${MAX_ATTEMPTS} attempts (${Math.round(MAX_ATTEMPTS * INTERVAL / 1000)} seconds).`;
    if (lastKnownData) {
        timeoutMessage += ` Last known status: ${lastKnownData.successFlag || 'UNKNOWN'}.`;
        if (lastKnownData.errorMessage) {
            timeoutMessage += ` Error: ${lastKnownData.errorMessage}`;
        }
    }

    throw new Error(timeoutMessage);
}