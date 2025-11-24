
export interface ScriptAnalysis {
    summary: string;
    music_prompt: string;
    mood: string;
    title: string;
}

export interface SoundtrackScene {
    scene_number: number;
    timestamp: string;
    scene_description: string;
    music_prompt: string;
    audioData?: string | null;
    error?: string | null;
}

export interface SunoTask {
    id: string;
    status: 'PENDING' | 'TEXT_GENERATION' | 'AUDIO_GENERATION' | 'SUCCESS' | 'FAILURE';
    audio_url?: string;
    image_url?: string;
    title?: string;
    model_name?: string;
    prompt?: string;
}
