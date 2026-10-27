import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Clock,
  Download,
  FileText,
  HelpCircle,
  Keyboard,
  List,
  Music,
  Play,
  RotateCcw,
  Sparkles,
  Upload,
  Users,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { RehearsalCuePoint } from '../data/lesMisTracks';
import {
  autoDistributeTimestamps,
  exportCuesToLrcString,
  formatSec,
  ParsedRawLine,
  parseLrcOrSrtToCues,
  parseRawPlainTextLyrics,
} from '../utils/lyricsParser';

interface SmartLyricsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackTitle: string;
  durationSec: number;
  currentTimeSec: number;
  existingCues: RehearsalCuePoint[];
  onApplyCues: (newCues: RehearsalCuePoint[]) => void;
  onSeekPlay?: (timeSec: number, autoPlay: boolean) => void;
  onShowBanner: (msg: string, type?: 'success' | 'warning') => void;
}

const SAMPLE_SCRIPT_TEXT = `【尚萬強】我有我的尊嚴，不再逃避罪愆
[Javert] Do not forget my name, do not forget me, 24601!
【芳婷】我曾有夢，在時光流逝前
【合唱】聽見人民在怒吼，這是受壓迫者的呼聲
【群演】當心跳伴隨著鼓聲，迎向新的一天
【安佐拉】與我們並肩作戰，走向街壘的黎明！
【合唱】明天我們將迎接自由的黎明！`;

export const SmartLyricsSyncModal: React.FC<SmartLyricsSyncModalProps> = ({
  isOpen,
  onClose,
  trackTitle,
  durationSec,
  currentTimeSec,
  existingCues,
  onApplyCues,
  onSeekPlay,
  onShowBanner,
}) => {
  const [activeTab, setActiveTab] = useState<'smart_paste' | 'tap_sync' | 'file_import'>('smart_paste');
  const [rawText, setRawText] = useState<string>('');
  const [parsedLines, setParsedLines] = useState<ParsedRawLine[]>([]);
  const [generatedCues, setGeneratedCues] = useState<RehearsalCuePoint[]>([]);

  // Tap-to-sync state
  const [tapCursorIdx, setTapCursorIdx] = useState<number>(0);
  const [stampedLines, setStampedLines] = useState<
    Array<{ line: ParsedRawLine; timeSec: number }>
  >([]);

  // Parse text whenever rawText changes
  useEffect(() => {
    if (!rawText.trim()) {
      setParsedLines([]);
      return;
    }
    const lines = parseRawPlainTextLyrics(rawText);
    setParsedLines(lines);
  }, [rawText]);

  // Handle Keyboard Spacebar in Tap-Sync mode
  useEffect(() => {
    if (!isOpen || activeTab !== 'tap_sync') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleStampLine(currentTimeSec);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, tapCursorIdx, parsedLines, currentTimeSec]);

  if (!isOpen) return null;

  const currentDuration = Math.max(30, durationSec || 180);

  // Auto-distribute timestamps
  const handleAutoDistribute = () => {
    if (parsedLines.length === 0) {
      onShowBanner('請先貼上歌詞文字或載入範例！', 'warning');
      return;
    }
    const cues = autoDistributeTimestamps(parsedLines, currentDuration);
    setGeneratedCues(cues);
    onShowBanner(`已自動均分生成 ${cues.length} 個排練時間點！`);
  };

  // Stamp current line
  const handleStampLine = (sec: number) => {
    if (parsedLines.length === 0) return;
    const currentLine = parsedLines[tapCursorIdx];
    if (!currentLine) return;

    const roundedSec = Math.max(0, Math.floor(sec));
    const nextStamped = [
      ...stampedLines.filter((s) => s.line.id !== currentLine.id),
      { line: currentLine, timeSec: roundedSec },
    ].sort((a, b) => a.timeSec - b.timeSec);

    setStampedLines(nextStamped);

    // Also update generated cues preview
    const newCues: RehearsalCuePoint[] = nextStamped.map((s) => ({
      timeSec: s.timeSec,
      timeFormatted: formatSec(s.timeSec),
      sectionTitle: s.line.lyric,
      characterFocus: s.line.role,
      actingTip: s.line.isEnsemble ? '按節拍整齊合唱' : '角色眼神與隊形轉換',
      vocalTip: s.line.lyric,
    }));
    setGeneratedCues(newCues);

    if (tapCursorIdx + 1 < parsedLines.length) {
      setTapCursorIdx(tapCursorIdx + 1);
    } else {
      onShowBanner('🎉 全曲歌詞打點完成！可點擊下方按鈕套用至排練室。');
    }
  };

  // Reset tap sync
  const handleResetTapSync = () => {
    setTapCursorIdx(0);
    setStampedLines([]);
    setGeneratedCues([]);
    onShowBanner('已重置打點進度');
  };

  // File import (.lrc / .srt / .txt)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith('.lrc') || file.name.toLowerCase().endsWith('.srt') || text.includes('-->') || text.includes('[00:')) {
        const cues = parseLrcOrSrtToCues(text, file.name, currentDuration);
        if (cues.length > 0) {
          setGeneratedCues(cues);
          onShowBanner(`成功解析「${file.name}」，包含 ${cues.length} 個精確時間戳！`);
          return;
        }
      }
      // Fallback: parse as plain text
      setRawText(text);
      setActiveTab('smart_paste');
      onShowBanner(`已載入「${file.name}」純文字，請點擊「一鍵均分」或進入「打點對齊」。`);
    } catch {
      onShowBanner('讀取檔案失敗，請確認為 UTF-8 編碼檔案。', 'warning');
    }
  };

  // Apply to rehearsal studio
  const handleApply = () => {
    const finalCues = generatedCues.length > 0 ? generatedCues : existingCues;
    if (finalCues.length === 0) {
      onShowBanner('目前尚無可套用的時間軸段落，請先均分或打點。', 'warning');
      return;
    }
    onApplyCues(finalCues);
    onShowBanner(`已成功套用 ${finalCues.length} 句歌詞時間軸至《${trackTitle}》！`);
    onClose();
  };

  // Export to .LRC
  const handleExportLrc = () => {
    const cuesToExport = generatedCues.length > 0 ? generatedCues : existingCues;
    if (cuesToExport.length === 0) {
      onShowBanner('尚無時間軸資料可供導出', 'warning');
      return;
    }
    const lrcString = exportCuesToLrcString(trackTitle, cuesToExport);
    const blob = new Blob([lrcString], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = trackTitle.replace(/[^\w\u4e00-\u9fa5-]+/g, '_');
    a.download = `${safeName}_動態歌詞.lrc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowBanner('已成功導出 .lrc 動態歌詞檔案！可備份或置入任一播放器使用。');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[var(--accent-gold)]/15 border border-[var(--accent-gold)]/40 flex items-center justify-center text-[var(--accent-gold)]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                  智慧歌詞解析與快速對齊精靈
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                  《{trackTitle}》· 長度 {formatSec(currentDuration)}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                免手動逐句打字！貼上文字自動識別角色、支援一鍵均分或跟唱空白鍵打點對齊
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4">
          <button
            type="button"
            onClick={() => setActiveTab('smart_paste')}
            className={`px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'smart_paste'
                ? 'border-[var(--accent-gold)] text-[var(--accent-gold)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>貼上劇本歌詞與智慧識別</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (parsedLines.length === 0 && rawText.trim()) {
                setParsedLines(parseRawPlainTextLyrics(rawText));
              }
              setActiveTab('tap_sync');
            }}
            className={`px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'tap_sync'
                ? 'border-[var(--accent-gold)] text-[var(--accent-gold)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>跟唱空白鍵打點對齊 (Tap-to-Sync)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('file_import')}
            className={`px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'file_import'
                ? 'border-[var(--accent-gold)] text-[var(--accent-gold)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>匯入現成 .LRC / .SRT</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB 1: SMART PASTE & AUTO IDENTIFY */}
          {activeTab === 'smart_paste' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-[var(--bg-elevated)] p-3 border border-[var(--border-subtle)] text-xs">
                <div className="text-[var(--text-muted)] flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-[var(--accent-gold)] shrink-0" />
                  <span>
                    支援劇本格式（如 <code className="text-[var(--accent-gold)] font-mono">【尚萬強】歌詞</code>、<code className="text-[var(--accent-gold)] font-mono">[Javert] 歌詞</code>、<code className="text-[var(--accent-gold)] font-mono">合唱: 歌詞</code>），系統會自動拆解角色與歌詞！
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setRawText(SAMPLE_SCRIPT_TEXT)}
                  className="px-2.5 py-1 text-xs border border-[var(--accent-gold-border)] bg-[var(--bg-surface)] text-[var(--accent-gold)] hover:bg-[var(--bg-highlight)] shrink-0 font-medium"
                >
                  載入悲慘世界排練範例
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  貼上純文字歌詞或劇本對白（一行一句）：
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="在此直接貼上網路上複製的歌詞，或劇本 Word 檔中的對白與歌詞...&#10;例如：&#10;【尚萬強】我有我的尊嚴，不再逃避罪愆&#10;合唱: 聽見人民在怒吼，這是受壓迫者的呼聲"
                  rows={6}
                  className="w-full p-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-mono focus:border-[var(--accent-gold)] outline-none leading-relaxed"
                />
              </div>

              {/* Parsing status & Action Bar */}
              {parsedLines.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-[var(--accent-gold)]">
                        已智慧識別 {parsedLines.length} 句歌詞
                      </span>
                      <span className="text-[var(--text-muted)]">
                        （其中 {parsedLines.filter((l) => l.isEnsemble).length} 句合唱，
                        {parsedLines.filter((l) => !l.isEnsemble).length} 句獨唱）
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAutoDistribute}
                        className="ui-btn px-3 py-1.5 bg-[var(--accent-gold)] text-black text-xs font-bold inline-flex items-center gap-1.5 hover:brightness-110"
                        title="依據歌曲時長均勻分配秒數，立刻生成初版時間軸"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>一鍵按曲長均分時間軸 (0秒完成)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTapCursorIdx(0);
                          setActiveTab('tap_sync');
                        }}
                        className="ui-btn px-3 py-1.5 border border-[var(--accent-gold-border)] bg-[var(--bg-surface)] text-[var(--accent-gold)] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[var(--bg-highlight)]"
                      >
                        <Keyboard className="w-3.5 h-3.5" />
                        <span>進入空白鍵打點對齊</span>
                      </button>
                    </div>
                  </div>

                  {/* Identified Table Preview */}
                  <div className="max-h-56 overflow-y-auto border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-[var(--bg-surface)] sticky top-0 border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-mono text-[11px]">
                        <tr>
                          <th className="py-1.5 px-3 w-12">#</th>
                          <th className="py-1.5 px-3 w-40">識別角色 / 聲部</th>
                          <th className="py-1.5 px-3">歌詞內容</th>
                          <th className="py-1.5 px-3 w-24">類型</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]/40 font-mono">
                        {parsedLines.map((line, idx) => (
                          <tr key={line.id} className="hover:bg-[var(--bg-surface)]/60">
                            <td className="py-1.5 px-3 text-[var(--text-muted)]">{idx + 1}</td>
                            <td className="py-1.5 px-3 font-semibold text-[var(--accent-gold)] truncate max-w-[150px]">
                              {line.role}
                            </td>
                            <td className="py-1.5 px-3 text-[var(--text-primary)]">{line.lyric}</td>
                            <td className="py-1.5 px-3">
                              <span
                                className={`px-1.5 py-0.5 text-[10px] font-semibold border ${
                                  line.isEnsemble
                                    ? 'bg-amber-950/40 border-amber-700/50 text-amber-300'
                                    : 'bg-blue-950/40 border-blue-700/50 text-blue-300'
                                }`}
                              >
                                {line.isEnsemble ? '群演合唱' : '角色獨唱'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TAP-TO-SYNC STUDIO */}
          {activeTab === 'tap_sync' && (
            <div className="space-y-4">
              {parsedLines.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-[var(--border-subtle)] space-y-2">
                  <p className="text-sm text-[var(--text-muted)]">尚未載入歌詞文字</p>
                  <button
                    type="button"
                    onClick={() => {
                      setRawText(SAMPLE_SCRIPT_TEXT);
                      setActiveTab('smart_paste');
                    }}
                    className="px-3 py-1.5 text-xs bg-[var(--accent-gold)] text-black font-bold"
                  >
                    先載入示範歌詞
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Big Visual Prompter Card for Tapping */}
                  <div className="p-5 border-2 border-[var(--accent-gold-border)] bg-gradient-to-b from-[var(--bg-elevated)] to-black text-center space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                      <span className="font-mono">
                        當前播放秒數：
                        <strong className="text-[var(--accent-gold)] text-sm ml-1 font-mono">
                          {formatSec(currentTimeSec)}
                        </strong>
                      </span>
                      <span className="font-mono">
                        進度：{tapCursorIdx + 1} / {parsedLines.length} 句
                      </span>
                    </div>

                    {/* Current Line */}
                    <div className="py-3">
                      <div className="text-xs text-[var(--accent-gold)] font-bold mb-1">
                        【{parsedLines[tapCursorIdx]?.role || '合唱'}】
                      </div>
                      <div className="text-lg sm:text-2xl font-bold text-white tracking-wide">
                        {parsedLines[tapCursorIdx]?.lyric || '（已無更多歌詞）'}
                      </div>
                    </div>

                    {/* Next Line Preview */}
                    {tapCursorIdx + 1 < parsedLines.length && (
                      <div className="text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-2 flex items-center justify-center gap-2">
                        <span>下一句預備：</span>
                        <span className="text-[var(--text-secondary)] italic">
                          {parsedLines[tapCursorIdx + 1]?.lyric}
                        </span>
                      </div>
                    )}

                    {/* The Big Tap Button */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleStampLine(currentTimeSec)}
                        className="w-full sm:w-auto px-6 py-3 bg-[var(--accent-gold)] text-black font-extrabold text-sm sm:text-base inline-flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-95 transition-all"
                      >
                        <Keyboard className="w-5 h-5" />
                        <span>戳記此句時間（或按鍵盤 Space 空白鍵）</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {tapCursorIdx > 0 && (
                          <button
                            type="button"
                            onClick={() => setTapCursorIdx(Math.max(0, tapCursorIdx - 1))}
                            className="px-3 py-2 border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:text-white"
                          >
                            回上一句
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setTapCursorIdx(Math.min(parsedLines.length - 1, tapCursorIdx + 1))}
                          className="px-3 py-2 border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:text-white"
                        >
                          跳過此句
                        </button>
                        <button
                          type="button"
                          onClick={handleResetTapSync}
                          className="px-3 py-2 border border-[var(--border-subtle)] text-xs text-red-400 hover:bg-red-950/40"
                        >
                          重置打點
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Stamped List */}
                  <div className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between font-bold text-[var(--text-muted)] text-[11px] font-mono">
                      <span>已打點時間軸 ({stampedLines.length} / {parsedLines.length})</span>
                      <span>點擊時間可試聽跳轉</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 font-mono">
                      {stampedLines.map((s, idx) => (
                        <div
                          key={s.line.id}
                          className="flex items-center justify-between p-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-highlight)] border border-[var(--border-subtle)]/40"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-[var(--text-muted)] w-6">{idx + 1}.</span>
                            <span className="text-[var(--accent-gold)] font-semibold truncate max-w-[120px]">
                              {s.line.role}
                            </span>
                            <span className="text-[var(--text-primary)] truncate">{s.line.lyric}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onSeekPlay?.(s.timeSec, true)}
                            className="px-2 py-0.5 bg-black/50 border border-[var(--accent-gold-border)] text-[var(--accent-gold)] text-xs font-mono font-bold hover:bg-[var(--accent-gold)] hover:text-black shrink-0"
                          >
                            {formatSec(s.timeSec)}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FILE IMPORT */}
          {activeTab === 'file_import' && (
            <div className="space-y-4 text-xs">
              <div className="border-2 border-dashed border-[var(--border-subtle)] p-6 sm:p-8 text-center space-y-3 bg-[var(--bg-elevated)] hover:border-[var(--accent-gold)] transition-colors">
                <Upload className="w-8 h-8 text-[var(--accent-gold)] mx-auto" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    拖曳或選擇字幕檔案 (.LRC / .SRT / .TXT)
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    若為標準 LRC 或 SRT，系統將直接讀取毫秒級時間碼，0 手動輸入即可載入！
                  </p>
                </div>
                <div>
                  <label className="ui-btn px-4 py-2 bg-[var(--accent-gold)] text-black font-bold text-xs cursor-pointer inline-flex items-center gap-2 hover:brightness-110">
                    <FileText className="w-4 h-4" />
                    <span>選擇電腦中的檔案</span>
                    <input
                      type="file"
                      accept=".lrc,.srt,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Explanations on where to get LRC without typing */}
              <div className="bg-[var(--bg-elevated)] p-4 border border-[var(--border-subtle)] space-y-2.5">
                <h4 className="font-bold text-[var(--accent-gold)] flex items-center gap-1.5 text-xs">
                  <HelpCircle className="w-4 h-4" />
                  <span>完全不想手動打字？如何 1 秒取得現成 LRC 動態歌詞檔：</span>
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-[var(--text-secondary)] leading-relaxed">
                  <li>
                    <strong>各大音樂播放器一鍵匯出</strong>：QQ音樂、網易雲、Kugou 或 YouTube 歌詞抓取外掛（如 LRC-Get），搜尋歌名後點擊「複製/匯出 LRC 歌詞」即可存為 <code className="text-[var(--accent-gold)]">.lrc</code>。
                  </li>
                  <li>
                    <strong>線上免費 LRC 歌詞庫</strong>：如 lrc-lyrics.com、Rentanadviser、MegaLRC，收錄全球音樂劇與經典名曲的精確對位時間軸。
                  </li>
                  <li>
                    <strong>AI 語音轉字幕工具</strong>：利用剪映 (CapCut)、Whisper Web 或各大 AI 工具直接將音訊丟入自動生成 <code className="text-[var(--accent-gold)]">.srt</code> 字幕檔，直接拖曳到上方即可讀取！
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Generated Cues Final Preview */}
          {generatedCues.length > 0 && (
            <div className="border border-[var(--accent-gold-border)]/50 bg-[var(--bg-surface)] p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[var(--accent-gold)] flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>即將套用的時間軸預覽（共 {generatedCues.length} 個標記點）</span>
                </span>
                <button
                  type="button"
                  onClick={handleExportLrc}
                  className="px-2 py-1 text-xs border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] text-[var(--text-muted)] hover:text-white inline-flex items-center gap-1 font-mono"
                  title="將當前排好的時間軸導出為標準 .lrc 檔案保存"
                >
                  <Download className="w-3 h-3" />
                  <span>導出 .lrc 備份</span>
                </button>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 text-xs font-mono">
                {generatedCues.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)]/50 text-[11px]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[var(--accent-gold)] font-bold">{c.timeFormatted}</span>
                      <span className="text-[var(--text-muted)] truncate max-w-[120px]">{c.characterFocus}</span>
                      <span className="text-[var(--text-primary)] truncate">{c.sectionTitle}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[var(--text-muted)]">
            {generatedCues.length > 0 ? (
              <span className="text-emerald-400 font-semibold">
                ✓ 已就緒 {generatedCues.length} 個時間戳記，點擊右側按鈕立即同步至排練室
              </span>
            ) : (
              <span>貼上文字後點選「一鍵均分」或使用「空白鍵打點」即可生成時間軸</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={generatedCues.length === 0}
              className={`ui-btn px-4 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 ${
                generatedCues.length > 0
                  ? 'bg-[var(--accent-gold)] text-black hover:brightness-110 shadow-md'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)] cursor-not-allowed'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>套用並儲存至本曲排練室</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
