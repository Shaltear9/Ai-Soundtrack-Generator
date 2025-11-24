
import React from 'react';
import { DownloadIcon } from './icons/DownloadIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { ExternalLinkIcon } from './icons/ExternalLinkIcon';

interface SoundtrackPlayerProps {
    audioUrl: string | null;
    isGenerating: boolean;
}

export const SoundtrackPlayer: React.FC<SoundtrackPlayerProps> = ({ audioUrl, isGenerating }) => {
    if (isGenerating) {
        return (
            <div className="flex items-center justify-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                <SpinnerIcon className="h-6 w-6 animate-spin text-cyan-400" />
                <span className="text-gray-300">Generating full soundtrack audio...</span>
            </div>
        );
    }

    if (!audioUrl) {
        return null;
    }

    const handleDownload = () => {
        if (!audioUrl) return;
        const link = document.createElement('a');
        link.href = audioUrl;
        link.download = 'soundtrack.mp3';
        link.target = "_blank"; // Fallback
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleOpenNewTab = () => {
        if(!audioUrl) return;
        window.open(audioUrl, '_blank');
    }

    return (
        <div className="flex flex-col gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <audio controls src={audioUrl} className="w-full bg-gray-800 rounded" controlsList="nodownload">
                Your browser does not support the audio element.
            </audio>
            <div className="flex gap-2">
                <button
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-2 text-sm bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-3 rounded-md transition-colors"
                >
                    <DownloadIcon className="h-4 w-4" />
                    <span>Download MP3</span>
                </button>
                <button
                    onClick={handleOpenNewTab}
                    className="flex items-center justify-center gap-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold py-2 px-3 rounded-md transition-colors border border-gray-600"
                    title="Open in new tab if player fails"
                >
                    <ExternalLinkIcon className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};
