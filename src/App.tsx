/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Send, 
  Download, 
  Plus, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  RefreshCcw,
  Image as ImageIcon,
  Type,
  LayoutGrid
} from 'lucide-react';
import { analyzeStory, generateImage, StorySummary } from './services/geminiService';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  paragraph: string;
  status: 'idle' | 'loading' | 'completed' | 'error';
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const [maxImages, setMaxImages] = useState(5);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [summary, setSummary] = useState<StorySummary | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const ensureApiKey = async () => {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await (window as any).aistudio.openSelectKey();
    }
  };

  const analyzeAndPrepare = async () => {
    if (!inputText.trim()) return;
    setIsAnalyzing(true);
    setSummary(null);
    setImages([]);
    
    try {
      const result = await analyzeStory(inputText, maxImages);
      setSummary(result);
      setImages(result.scenes.map((scene, i) => ({
        id: `img-${i}`,
        url: '',
        prompt: scene.imagePrompt,
        paragraph: scene.paragraph,
        status: 'idle'
      })));
      setIsSidebarOpen(false); // Close sidebar after setup
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Failed to analyze the story. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateAllImages = async () => {
    await ensureApiKey();
    setIsGenerating(true);
    
    for (let i = 0; i < images.length; i++) {
      if (images[i].status === 'completed') continue;
      
      setImages(prev => prev.map((img, idx) => 
        idx === i ? { ...img, status: 'loading' } : img
      ));

      try {
        const url = await generateImage(images[i].prompt, aspectRatio);
        setImages(prev => prev.map((img, idx) => 
          idx === i ? { ...img, url, status: 'completed' } : img
        ));
      } catch (error) {
        console.error(`Failed to generate image ${i}:`, error);
        setImages(prev => prev.map((img, idx) => 
          idx === i ? { ...img, status: 'error' } : img
        ));
      }
    }
    
    setIsGenerating(false);
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    const folder = zip.folder("storyboard-images");
    
    images.forEach((img, i) => {
      if (img.url) {
        const base64Data = img.url.split(',')[1];
        folder?.file(`scene-${i + 1}.png`, base64Data, { base64: true });
      }
    });

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "storyboard.zip");
  };

  const progress = images.length > 0 ? (images.filter(img => img.status === 'completed').length / images.length) * 100 : 0;

  return (
    <div className="h-screen bg-[#020204] text-zinc-100 flex flex-col font-sans overflow-hidden">
      {/* Navigation */}
      <nav className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-zinc-950/50 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-10 h-10 rounded-lg hover:bg-white/5 flex items-center justify-center transition-colors"
          >
            <LayoutGrid size={20} className={isSidebarOpen ? 'text-indigo-400' : 'text-zinc-400'} />
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.5)]">
            <div className="w-4 h-4 border-2 border-white rounded-full"></div>
          </div>
          <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500 hidden sm:inline">
            CHRONICLE AI
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-zinc-900/80 px-4 py-1.5 rounded-full border border-white/5">
            <span className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'}`}></span>
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-widest hidden xs:inline">
              {isGenerating ? 'Pro Engine Active' : 'Character Engine Ready'}
            </span>
          </div>
          <button 
            onClick={() => (window as any).aistudio.openSelectKey()}
            className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
          >
            Update Key
          </button>
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.aside 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-white/10 bg-zinc-950/40 shrink-0 overflow-hidden relative group"
            >
              <div className="w-80 p-6 flex flex-col gap-8 h-full">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Story Configuration</label>
                  <button 
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1 hover:bg-white/5 rounded-md text-zinc-500 hover:text-white transition-colors"
                  >
                    <Plus className="rotate-45" size={16} />
                  </button>
                </div>

                <div className="space-y-4">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Input Narrative</label>
                  <div className="relative group/textarea">
                    <textarea 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="w-full h-48 bg-zinc-900/50 border border-white/10 rounded-xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50 resize-none transition-all placeholder:text-zinc-700" 
                      placeholder="Paste your story here. One paragraph equals one generated image..." 
                    />
                    <div className="absolute bottom-3 right-3 text-[10px] text-zinc-600 font-mono">
                      {inputText.split(/\n\s*\n/).filter(Boolean).length} Scenes
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Frame Sequence</label>
                    <span className="text-xs font-mono text-cyan-400">{maxImages}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={maxImages} 
                    onChange={(e) => setMaxImages(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                    <span>1</span>
                    <span>100</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Aspect Ratio</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: '1:1', value: '1:1', icon: 'w-4 h-4' },
                      { label: '16:9', value: '16:9', icon: 'w-6 h-4' },
                      { label: '9:16', value: '9:16', icon: 'w-3 h-5' }
                    ].map((ratio) => (
                      <button 
                        key={ratio.value}
                        onClick={() => setAspectRatio(ratio.value as AspectRatio)}
                        className={`h-12 border rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${
                          aspectRatio === ratio.value 
                          ? 'border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/30' 
                          : 'border-white/20 bg-white/5 hover:border-white/40'
                        }`}
                      >
                        <div className={`${ratio.icon} border ${aspectRatio === ratio.value ? 'border-indigo-400' : 'border-zinc-500'} rounded-sm`}></div>
                        <span className={`text-[10px] ${aspectRatio === ratio.value ? 'text-indigo-400' : 'text-zinc-500'}`}>{ratio.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={analyzeAndPrepare}
                  disabled={isAnalyzing || !inputText.trim()}
                  className="mt-auto w-full py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-xl font-bold text-sm tracking-wide shadow-[0_10px_30px_rgba(79,70,229,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : "INITIALIZE SYNC"}
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div className="flex-1 p-8 bg-black relative overflow-y-auto custom-scrollbar">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(79,70,229,0.15),transparent_60%)]"></div>
          
          <div className="relative z-10 flex flex-col h-full h-min-full">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-light text-zinc-200">
                  Consistency Preview 
                  {summary && (
                    <span className="text-zinc-600 text-lg font-mono ml-3 tracking-tighter">[ Character Locked ]</span>
                  )}
                </h2>
                <p className="text-sm text-zinc-500">
                  {summary ? `Syncing visuals across ${images.length} unique environment iterations.` : 'Enter a story to begin visual synthesis.'}
                </p>
              </div>
              <div className="flex gap-3">
                {summary && (
                  <>
                    <button 
                      onClick={generateAllImages}
                      disabled={isGenerating}
                      className="px-4 py-2 bg-zinc-900 border border-white/10 rounded-lg text-xs font-medium hover:bg-zinc-800 transition-colors flex items-center gap-2"
                    >
                      {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                      Re-generate All
                    </button>
                    <button 
                      onClick={downloadAll}
                      disabled={!images.some(i => i.url)}
                      className="px-4 py-2 bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 rounded-lg text-xs font-medium flex items-center gap-2 hover:bg-indigo-500/30 transition-all disabled:opacity-30"
                    >
                      <Download size={14} />
                      Download All ({images.filter(i => i.url).length})
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Grid */}
            {!summary && !isAnalyzing ? (
              <div className="flex-1 border border-white/5 bg-zinc-900/20 rounded-3xl flex flex-col items-center justify-center text-zinc-600 border-dashed">
                <LayoutGrid size={48} strokeWidth={1} className="mb-4 opacity-20" />
                <p className="text-lg font-light">Input story narrative to synthesize scenes.</p>
                <p className="text-xs uppercase tracking-[0.2em] mt-2 opacity-50">Awaiting Data Stream</p>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start content-start pb-24">
                <AnimatePresence mode='popLayout'>
                  {images.map((img, i) => (
                    <motion.div 
                      key={img.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.05 }}
                      className={`group relative rounded-2xl overflow-hidden border transition-all duration-500 bg-zinc-900 ${
                        img.status === 'loading' ? 'border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.2)]' : 'border-white/10'
                      }`}
                    >
                      <div className="aspect-video relative overflow-hidden flex items-center justify-center">
                        {img.url ? (
                          <img 
                            src={img.url} 
                            alt={`Scene ${i+1}`} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center">
                              {img.status === 'loading' ? (
                                <Loader2 className="animate-spin text-indigo-400" size={24} />
                              ) : (
                                <Camera className="text-zinc-700" size={24} />
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-zinc-600 tracking-widest uppercase">
                              {img.status === 'loading' ? 'Rendering...' : `Ready Scene ${i+1}`}
                            </span>
                          </div>
                        )}

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                          <span className="text-[10px] text-indigo-400 font-mono mb-1">SCENE {String(i + 1).padStart(2, '0')}</span>
                          <p className="text-[11px] leading-relaxed text-zinc-300 line-clamp-2">{img.paragraph}</p>
                          {img.url && (
                            <a 
                              href={img.url} 
                              download={`scene-${i+1}.png`}
                              className="mt-3 w-max flex items-center gap-2 text-[10px] font-bold text-white uppercase tracking-wider hover:text-indigo-400 transition-colors"
                            >
                              <Download size={12} />
                              Export Frame
                            </a>
                          )}
                        </div>

                        {img.status === 'loading' && (
                          <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-indigo-500/80 text-[10px] font-bold text-white flex items-center gap-1.5 backdrop-blur-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                            PROCESSING
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Sticky Progress Bar at Bottom */}
            {summary && (
              <div className="h-24 shrink-0 border-t border-white/5 flex items-center gap-6 mt-auto bg-black/60 backdrop-blur-3xl px-8 -mx-8">
                <div className="w-12 h-12 rounded-full border border-indigo-500/30 flex items-center justify-center bg-zinc-900 relative">
                  <div className="w-8 h-8 rounded-full bg-indigo-400/10 blur-md absolute"></div>
                  <LayoutGrid size={16} className="text-indigo-400 relative z-10" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Consistency Mapping</span>
                    <span className="text-[10px] font-mono text-zinc-400">{Math.round(progress)}% Processed</span>
                  </div>
                  <div className="w-full h-1 bg-zinc-950 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-gradient-to-r from-indigo-600 to-cyan-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

