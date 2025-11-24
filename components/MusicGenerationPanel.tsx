
import React, { useState, useEffect } from 'react';
import { generateTrack, pollForTrack } from '../services/udioService';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { SoundtrackPlayer } from './SoundtrackPlayer';
import { MusicIcon } from './icons/MusicIcon';

interface MusicGenerationPanelProps {
    prompt: string;
    isAnalyzing: boolean;
}

export const MusicGenerationPanel: React.FC<MusicGenerationPanelProps> = ({ prompt, isAnalyzing }) => {
    const [apiKey, setApiKey] = useState<string>(process.env.UDIO_API_KEY || '');
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // If the environment variable is set, use it. Otherwise keep user input.
    useEffect(() => {
        if (process.env.UDIO_API_KEY) {
            setApiKey(process.env.UDIO_API_KEY);
        }
    }, []);

    if (isAnalyzing) return null;
    if (!prompt) return null;

    const handleGenerate = async () => {
        if (!apiKey) {
            setError("Please enter a Udio API Key.");
            return;
        }
        setError(null);
        setIsGenerating(true);
        setAudioUrl(null);
        setStatusMessage("Initializing generation...");

        try {
            // 1. Start Generation
            const workId = await generateTrack(prompt, apiKey);
            setStatusMessage("Creating music (this may take 2-3 minutes)...");
            
            // 2. Poll for result
            const url = await pollForTrack(workId, apiKey);
            setAudioUrl(url);
            setStatusMessage("");
        } catch (e: any) {
            setError(e.message || "Failed to generate music");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-cyan-900/50 rounded-xl p-6 shadow-lg mb-4">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-cyan-900/30 rounded-full">
                   <MusicIcon className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                     <h3 className="text-lg font-bold text-white">Udio Music Generator</h3>
                     <p className="text-xs text-gray-400">Generates MP3 using Udio's Chirp v3.5 model</p>
                </div>
            </div>
           
            {!process.env.UDIO_API_KEY && (
                <div className="mb-4">
                    <label className="block text-xs text-gray-400 mb-1 uppercase font-semibold">Udio API Key</label>
                    <input 
                        type="password" 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your Udio API Key..."
                        className="w-full bg-black/20 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Key is used locally for this session.</p>
                </div>
            )}

            <div className="mb-4">
                 <label className="block text-xs text-gray-400 mb-1 uppercase font-semibold">Optimization Prompt</label>
                <div className="bg-black/30 border border-gray-700 rounded p-3 text-sm text-cyan-100 italic">
                    "{prompt}"
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-900/20 border border-red-800/50 text-red-300 rounded mb-4 text-sm">
                    {error}
                </div>
            )}

            {audioUrl ? (
                <div className="animate-in fade-in duration-500">
                    <div className="text-green-400 text-sm font-semibold mb-2 flex items-center gap-2">
                        ✓ Generation Complete
                    </div>
                    <SoundtrackPlayer audioUrl={audioUrl} isGenerating={false} />
                    <button 
                        onClick={() => setAudioUrl(null)}
                        className="mt-4 text-xs text-gray-500 hover:text-white underline"
                    >
                        Generate New Track
                    </button>
                </div>
            ) : (
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !apiKey}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg shadow-purple-900/20"
                >
                    {isGenerating ? (
                        <>
                            <SpinnerIcon className="h-5 w-5 animate-spin" />
                            <span>{statusMessage || "Processing..."}</span>
                        </>
                    ) : (
                        'Generate Soundtrack (MP3)'
                    )}
                </button>
            )}
        </div>
    );
};
