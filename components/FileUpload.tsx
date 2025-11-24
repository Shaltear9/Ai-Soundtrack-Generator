
import React, { useRef } from 'react';
import { UploadIcon } from './icons/UploadIcon';

interface FileUploadProps {
    onFileUpload: (file: File) => void;
    accept: string;
    label: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, accept, label }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onFileUpload(file);
        }
    };

    const handleClick = () => {
        inputRef.current?.click();
    };

    return (
        <div>
            <input
                type="file"
                ref={inputRef}
                onChange={handleFileChange}
                accept={accept}
                className="hidden"
            />
            <button
                onClick={handleClick}
                className="w-full h-full flex flex-col items-center justify-center p-4 bg-gray-700/50 border-2 border-dashed border-gray-600 rounded-lg hover:bg-gray-700 hover:border-cyan-500 transition-colors"
            >
                <UploadIcon className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-300">{label}</span>
            </button>
        </div>
    );
};
