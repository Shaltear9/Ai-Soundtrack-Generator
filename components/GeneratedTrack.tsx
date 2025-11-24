
import React from 'react';
import type { SoundtrackScene } from '../types';

interface GeneratedTrackProps {
    scene: Omit<SoundtrackScene, 'audioData' | 'error'>;
}

export const GeneratedTrack: React.FC<GeneratedTrackProps> = ({ scene }) => {
    return (
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 transition-shadow hover:shadow-lg hover:shadow-cyan-500/10">
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-white">Scene {scene.scene_number}</h3>
                <span className="text-sm bg-gray-700 text-gray-300 px-2 py-1 rounded">{scene.timestamp}</span>
            </div>
            <p className="text-gray-400 mb-3 text-sm">{scene.scene_description}</p>
            <div className="bg-gray-900/50 p-3 rounded-md">
                <p className="text-cyan-300 font-mono text-xs selection:bg-cyan-800 selection:text-cyan-100">
                    <span className="font-semibold text-cyan-500">PROMPT: </span>{scene.music_prompt}
                </p>
            </div>
        </div>
    );
};
