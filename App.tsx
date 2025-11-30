import React, { useState, useCallback } from 'react';
import { analyzeScriptAndGeneratePrompts } from './services/geminiService';
import type { ScriptAnalysis } from './types';
import { FileUpload } from './components/FileUpload';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import { MusicIcon } from './components/icons/MusicIcon';
import { SunoGenerationPanel } from './components/SunoGenerationPanel';

const App: React.FC = () => {
    // ---------- 上传与输入 ----------
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoFile, setVideoFile] = useState<File | null>(null); // ⭐ 保存视频文件本体
    const [scriptText, setScriptText] = useState<string>('');

    // 是否启用视频参与分析（方便你排查“只文本OK、加视频就挂”的情况）
    const [useVideo, setUseVideo] = useState<boolean>(true);

    // ---------- 分析状态 ----------
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<ScriptAnalysis | null>(null);

    // ---------- 事件处理 ----------

    // 上传视频：同时保存预览 URL 和 File
    const handleVideoUpload = (file: File) => {
        const url = URL.createObjectURL(file);
        setVideoUrl(url);
        setVideoFile(file);
    };

    // 上传脚本 txt：读取文本内容
    const handleScriptUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = (event.target?.result as string) || '';
            setScriptText(text);
        };
        reader.readAsText(file);
    };

    // 点击分析：脚本文本 +（可选）视频文件，多模态分析
    const handleAnalyzeScript = useCallback(async () => {
        // 至少要有「脚本」或「视频」其中之一
        if (!scriptText.trim() && !videoFile) {
            setError('请先上传视频或填写脚本 / 描述。');
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysis(null);

        const TIMEOUT_MS = 120000; // 120 秒超时，防止一直卡住

        // 如果勾选了“使用视频参与分析”且有视频文件，就传给后端
        const effectiveVideoFile = useVideo ? videoFile || undefined : undefined;

        const analysisPromise = analyzeScriptAndGeneratePrompts(
            scriptText,
            effectiveVideoFile
        );

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Gemini analysis timeout')), TIMEOUT_MS)
        );

        try {
            console.log('[Gemini] start analysis', {
                hasScript: !!scriptText.trim(),
                hasVideo: !!videoFile,
                useVideo,
            });

            const result = (await Promise.race([
                analysisPromise,
                timeoutPromise,
            ])) as ScriptAnalysis;

            console.log('[Gemini] analysis success', result);
            setAnalysis(result);
        } catch (err) {
            console.error('[Gemini] analysis error', err);
            let msg = 'An unknown error occurred during generation.';
            if (err instanceof Error) {
                msg = `An error occurred: ${err.message}`;
            }
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    }, [scriptText, videoFile, useVideo]);

    // ---------- 渲染 ----------

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100">
            {/* 顶部栏，尽量保持简洁 */}
            <header className="border-b border-gray-800 bg-gray-950">
                <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gray-800 flex items-center justify-center">
                            <MusicIcon className="h-4 w-4 text-cyan-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold">AI Soundtrack Generator</h1>
                            <p className="text-xs text-gray-400">
                                分析视频 / 脚本 → 生成 Suno 提示词
                            </p>
                        </div>
                    </div>
                    <span className="text-[11px] text-gray-500">
                        Gemini (多模态代理) → Suno
                    </span>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-6">
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* 左侧：上传 + 文本输入 */}
                    <div className="space-y-6">
                        {/* 上传区域 */}
                        <section className="bg-gray-950 border border-gray-800 rounded-xl p-4 shadow-md shadow-black/40">
                            <h2 className="text-base font-semibold mb-2 text-cyan-400">
                                1. Upload Assets
                            </h2>
                            <p className="text-xs text-gray-400 mb-3">
                                上传视频和（可选）脚本，后续分析时可选择是否使用视频做多模态。
                            </p>

                            <div className="grid sm:grid-cols-2 gap-4 mb-4">
                                <FileUpload
                                    onFileUpload={handleVideoUpload}
                                    accept="video/*"
                                    label="Upload Video"
                                />
                                <FileUpload
                                    onFileUpload={handleScriptUpload}
                                    accept=".txt"
                                    label="Upload Script (.txt)"
                                />
                            </div>

                            {videoUrl && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-sm">Video Preview</h3>
                                        <label className="flex items-center gap-1 text-xs text-gray-300">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-600 bg-gray-900"
                                                checked={useVideo}
                                                onChange={(e) => setUseVideo(e.target.checked)}
                                            />
                                            使用视频参与分析
                                        </label>
                                    </div>
                                    <video
                                        controls
                                        src={videoUrl}
                                        className="w-full rounded-lg bg-black border border-gray-700 max-h-[320px]"
                                    />
                                </div>
                            )}
                        </section>

                        {/* 文本脚本输入 */}
                        <section className="bg-gray-950 border border-gray-800 rounded-xl p-4 shadow-md shadow-black/40">
                            <h2 className="text-base font-semibold mb-2 text-cyan-400">
                                2. Script / Description
                            </h2>
                            <p className="text-xs text-gray-400 mb-2">
                                可以粘贴 / 编辑脚本；若为空，则尽量只基于视频推断（建议配合脚本一起使用）。
                            </p>
                            <textarea
                                value={scriptText}
                                onChange={(e) => setScriptText(e.target.value)}
                                placeholder="在这里粘贴脚本或简单描述视频的内容、角色和情绪……"
                                className="w-full min-h-[160px] rounded-lg bg-gray-900 border border-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-sm p-2.5 resize-vertical placeholder:text-gray-500"
                            />
                            <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                                <span>提示：描述越具体，配乐越贴合。</span>
                                <span>{scriptText.length} chars</span>
                            </div>
                        </section>
                    </div>

                    {/* 右侧：分析结果 + Suno 面板 */}
                    <div className="space-y-6">
                        {/* 分析 & 结果 */}
                        <section className="bg-gray-950 border border-gray-800 rounded-xl p-4 shadow-md shadow-black/40">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h2 className="text-base font-semibold text-cyan-400">
                                        3. Analyze & Generate Prompt
                                    </h2>
                                    <p className="text-xs text-gray-400">
                                        使用 Gemini 分析视频 + 文本，生成 Suno 的配乐提示词。
                                    </p>
                                </div>
                                <button
                                    onClick={handleAnalyzeScript}
                                    disabled={isLoading}
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition
                                        ${isLoading
                                            ? 'bg-gray-700 text-gray-300 cursor-not-allowed'
                                            : 'bg-cyan-500 text-black hover:bg-cyan-400'
                                        }`}
                                >
                                    {isLoading ? (
                                        <>
                                            <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                                            Analyzing...
                                        </>
                                    ) : (
                                        <>
                                            <MusicIcon className="h-3.5 w-3.5" />
                                            Analyze for Soundtrack
                                        </>
                                    )}
                                </button>
                            </div>

                            {error && (
                                <div className="mb-3 text-xs rounded-lg border border-red-800 bg-red-950/60 px-3 py-2 text-red-200">
                                    {error}
                                    <div className="mt-1 text-[10px] text-red-200/80">
                                        建议：打开浏览器控制台 (F12) → Network / Console，查看是否有
                                        CORS / 代理 (yunwu.ai) 请求错误。
                                    </div>
                                </div>
                            )}

                            {analysis ? (
                                <div className="space-y-3">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                                            <div className="text-[11px] text-gray-400 mb-1">Title</div>
                                            <div className="text-sm font-semibold">
                                                {analysis.title || 'Untitled soundtrack'}
                                            </div>
                                        </div>
                                        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                                            <div className="text-[11px] text-gray-400 mb-1">Mood</div>
                                            <div className="text-sm">{analysis.mood}</div>
                                        </div>
                                    </div>

                                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                                        <div className="text-[11px] text-gray-400 mb-1">
                                            Story Summary
                                        </div>
                                        <p className="text-sm text-gray-200 leading-relaxed">
                                            {analysis.summary}
                                        </p>
                                    </div>

                                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-[11px] text-gray-400">
                                                Music Prompt for Suno
                                            </div>
                                            <span className="text-[10px] text-gray-500">
                                                {analysis.music_prompt.length} chars
                                            </span>
                                        </div>
                                        <p className="text-sm text-cyan-100 leading-relaxed">
                                            {analysis.music_prompt}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-2 text-xs text-gray-500">
                                    运行分析后，这里会显示自动生成的标题、情绪、摘要以及 Suno 可直接使用的提示词。
                                </div>
                            )}
                        </section>

                        {/* Suno 调用面板 */}
                        <section className="bg-gray-950 border border-gray-800 rounded-xl p-4 shadow-md shadow-black/40">
                            <SunoGenerationPanel
                                initialPrompt={analysis?.music_prompt || ''}
                                title={analysis?.title || 'AI Generated Soundtrack'}
                                isAnalyzing={isLoading}
                            />
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;
