import React, { useRef, useState } from 'react';
import {
  Download,
  Edit3,
  FileAudio,
  FolderUp,
  Plus,
  Save,
  Trash2,
  Upload,
  Cloud,
  CheckCircle2,
  RefreshCw,
  Info,
  Globe,
} from 'lucide-react';
import { LesMisTrackItem } from '../../data/lesMisTracks';
import { TrackStemFiles } from '../../types/rehearsal';

interface MasterCatalogViewProps {
  tracks: LesMisTrackItem[];
  localAudioBlobs: Record<string, { url: string; fileName: string }>;
  trackStemsMap: Record<string, TrackStemFiles>;
  onSelectTrack: (trackId: string) => void;
  onGoToRehearsal: (trackId: string) => void;
  onUploadSingleFile: (trackId: string, file: File | null) => void;
  onUpdateTrackStem: (
    trackId: string,
    stemType: 'backing' | 'vocal' | 'drumBass',
    file: File | null
  ) => void;
  onRemoveTrackAudio?: (
    trackId: string,
    slot?: 'main' | 'backing' | 'vocal' | 'drumBass' | 'all'
  ) => void;
  onImportLrcForTrack: (trackId: string, file: File | null) => void;
  onUpdateTrackData: (updatedTrack: LesMisTrackItem) => void;
  onBatchFolderImport: (fileList: FileList | null) => void;
  onBatchFilesImport?: (fileList: FileList | File[] | null) => void;
  onExportProductionConfig: () => void;
  onImportProductionConfig: (file: File | null) => void;
  toggleTrackInTodayCall: (trackId: string) => void;
  calledTrackIds: string[];
  onCacheRemoteTrack?: (trackId: string, remoteUrl: string, label?: string) => void;
  cachingTrackIds?: Record<string, boolean>;
  onSyncAllTracksToCloud?: () => void;
  isSyncingToCloud?: boolean;
  isSignedIn?: boolean;
}

function formatSeconds(sec: number): string {
  const safe = Math.max(0, Math.floor(sec || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const MasterCatalogView: React.FC<MasterCatalogViewProps> = React.memo(
  ({
    tracks,
    localAudioBlobs,
    trackStemsMap,
    onGoToRehearsal,
    onUploadSingleFile,
    onUpdateTrackStem,
    onRemoveTrackAudio,
    onImportLrcForTrack,
    onUpdateTrackData,
    onBatchFolderImport,
    onBatchFilesImport,
    onExportProductionConfig,
    onImportProductionConfig,
    toggleTrackInTodayCall,
    calledTrackIds,
    onCacheRemoteTrack,
    cachingTrackIds = {},
    onSyncAllTracksToCloud,
    isSyncingToCloud = false,
    isSignedIn = false,
  }) => {
    const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<Partial<LesMisTrackItem>>({});
    const filesInputRef = useRef<HTMLInputElement | null>(null);
    const folderInputRef = useRef<HTMLInputElement | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleFilesPicked = (fl: FileList | null) => {
      if (!fl || fl.length === 0) return;
      if (onBatchFilesImport) {
        onBatchFilesImport(fl);
      } else {
        onBatchFolderImport(fl);
      }
    };

    const startEditingTrack = (track: LesMisTrackItem) => {
      setEditingTrackId(track.trackId);
      setEditDraft({ ...track });
    };

    const handleSaveTrack = () => {
      if (!editingTrackId) return;
      const target = tracks.find((t) => t.trackId === editingTrackId);
      if (!target) return;
      const updated: LesMisTrackItem = {
        ...target,
        ...editDraft,
      } as LesMisTrackItem;
      onUpdateTrackData(updated);
      setEditingTrackId(null);
      setEditDraft({});
    };

    return (
      <div className="max-w-[1760px] 2xl:max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 xl:p-10 pb-24 lg:pb-10 space-y-8">
        {/* Top Header & Batch Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              曲目庫與音訊檔案管理
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
              管理本劇 21 首排練曲目、主伴奏音檔、多音軌 Stems 及 LRC 字幕同步檔。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Multi-Files Batch Picker */}
            <input
              type="file"
              ref={filesInputRef}
              multiple
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus,.m4b"
              className="hidden"
              onChange={(e) => {
                handleFilesPicked(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => filesInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[#FAF8F3] font-semibold transition-colors"
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span>批次匯入音檔 (支援多選)</span>
            </button>

            {/* Batch Folder Input */}
            <input
              type="file"
              ref={folderInputRef}
              // @ts-expect-error webkitdirectory is standard for folder picking
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={(e) => {
                handleFilesPicked(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] text-[var(--text-primary)] bg-[var(--bg-subtle)] font-medium transition-colors"
            >
              <FolderUp className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span>整包資料夾匯入</span>
            </button>

            {/* Export Rehearsal Config */}
            <button
              type="button"
              onClick={onExportProductionConfig}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>匯出排練設定檔 (.json)</span>
            </button>

            {/* Import Rehearsal Config */}
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>匯入設定檔</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) =>
                  onImportProductionConfig(e.target.files?.[0] || null)
                }
              />
            </label>

            {/* Sync All Tracks to Firestore */}
            {isSignedIn && onSyncAllTracksToCloud && (
              <button
                type="button"
                onClick={onSyncAllTracksToCloud}
                disabled={isSyncingToCloud}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--accent-bordeaux)] hover:opacity-90 text-white font-medium transition-opacity disabled:opacity-50"
              >
                <Cloud className={`w-3.5 h-3.5 ${isSyncingToCloud ? 'animate-spin' : ''}`} />
                <span>{isSyncingToCloud ? '雲端同步中...' : '同步曲目至雲端'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 2026 Cross-Device Architecture Callout */}
        <div className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] shrink-0 mt-0.5">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                  2026 劇組跨裝置無縫同步架構（電腦 A ➔ 裝置 B、C）
                </h3>
                <span className="px-2 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  雙軌混合雲 · 零流量帳單
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                <strong className="text-[var(--text-secondary)]">文字、進度與評語：</strong>所有曲目定義、角色聲部、練唱進度與導演評語均全自動經由 Firestore 雲端即時同步。<br />
                <strong className="text-[var(--text-secondary)]">音檔跨裝置播放：</strong>在曲目設定填入 Google Drive / Dropbox 或公開 MP3 網址，各裝置開啟即可隨點隨播；亦可點擊「⚡ 快取至本機」將音檔存入該裝置瀏覽器金庫，離線練習零延遲零流量。
              </p>
            </div>
          </div>
        </div>

        {/* Drag & Drop Audio Upload Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFilesPicked(e.dataTransfer.files);
            }
          }}
          onClick={() => filesInputRef.current?.click()}
          className={`border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
            isDragOver
              ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]'
              : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-gold)]/60 text-[var(--text-muted)]'
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="p-3 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--accent-gold)]">
              <FileAudio className="w-6 h-6" />
            </div>
            <div>
              <p className="font-display text-sm font-bold text-[var(--text-primary)]">
                拖曳任意音檔（MP3 / WAV / M4A）至此，或點擊批次選取
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                系統將全自動根據曲目序號或歌名關鍵字比對掛載；未自動辨識者會彈出直覺指派對照面板，絕不漏接任何檔案。
              </p>
            </div>
          </div>
        </div>

        {/* Tracks List */}
        <div className="space-y-4">
          {tracks.map((track, idx) => {
            const localFile = localAudioBlobs[track.trackId];
            const stems = trackStemsMap[track.trackId];
            const isEditing = editingTrackId === track.trackId;
            const isCalled = calledTrackIds.includes(track.trackId);

            return (
              <div
                key={track.trackId}
                className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Track Info */}
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-[var(--accent-gold)] font-bold tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {track.act}
                      </span>
                      <span className="text-[var(--text-muted)]">·</span>
                      <h2 className="font-display text-base font-bold text-[var(--text-primary)] break-words sm:truncate">
                        {track.title}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
                      <span>角色：{track.characters}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">
                        {formatSeconds(track.durationSec)}
                      </span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">{track.bpm} BPM</span>
                      <span>·</span>
                      {localFile ? (
                        <span className="text-emerald-400 font-medium break-all sm:break-normal">
                          主音檔：{localFile.fileName}
                        </span>
                      ) : track.audioUrl ? (
                        <span className="text-sky-400 font-medium">
                          雲端串流：{track.audioLabel || '已配掛線上音檔'}
                        </span>
                      ) : (
                        <span>未載入主音檔</span>
                      )}
                      {stems?.backingName && (
                        <>
                          <span>·</span>
                          <span className="text-[var(--accent-gold)] font-medium break-all sm:break-normal">
                            伴奏：{stems.backingName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Actions — Mobile Touch Optimized with Explicit Delete Buttons */}
                  <div className="flex flex-wrap items-center gap-2 text-xs pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--border-subtle)]">
                    {/* Load Main Audio */}
                    <label className="ui-btn min-h-[38px] cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-bordeaux)] hover:opacity-90 text-white font-medium transition-opacity whitespace-nowrap">
                      <FileAudio className="w-3.5 h-3.5 shrink-0" />
                      <span>{localFile ? '更換主音檔' : '載入主音檔'}</span>
                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus,.m4b"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          if (f) onUploadSingleFile(track.trackId, f);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    {/* Delete / Clear Loaded Main Audio */}
                    {localFile && onRemoveTrackAudio && (
                      <button
                        type="button"
                        onClick={() => onRemoveTrackAudio(track.trackId, 'main')}
                        title="移除已載入的主音檔"
                        className="ui-btn min-h-[38px] inline-flex items-center gap-1 px-2.5 py-1.5 border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-medium transition-colors whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>移除主音檔</span>
                      </button>
                    )}

                    {/* Quick Cache Button if has remote URL & no local file */}
                    {track.audioUrl && !localFile && (
                      <button
                        type="button"
                        onClick={() =>
                          onCacheRemoteTrack?.(
                            track.trackId,
                            track.audioUrl!,
                            track.audioLabel || track.title
                          )
                        }
                        disabled={cachingTrackIds[track.trackId]}
                        className="ui-btn min-h-[38px] px-3 py-1.5 border border-emerald-500/60 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-medium transition-colors whitespace-nowrap"
                      >
                        {cachingTrackIds[track.trackId]
                          ? '快取下載中...'
                          : '快取至本機'}
                      </button>
                    )}

                    {/* Load Backing Stem */}
                    <label className="ui-btn min-h-[38px] cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] text-[var(--accent-gold)] font-medium transition-colors whitespace-nowrap">
                      <span>
                        {stems?.backingName ? '更換純伴奏' : '掛載純伴奏'}
                      </span>
                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus,.m4b"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          if (f) onUpdateTrackStem(track.trackId, 'backing', f);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    {/* Delete / Clear Loaded Backing Stem */}
                    {stems?.backingName && onRemoveTrackAudio && (
                      <button
                        type="button"
                        onClick={() => onRemoveTrackAudio(track.trackId, 'backing')}
                        title="移除純伴奏音檔"
                        className="ui-btn min-h-[38px] inline-flex items-center gap-1 px-2.5 py-1.5 border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-medium transition-colors whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>移除伴奏</span>
                      </button>
                    )}

                    {/* Import LRC / SRT */}
                    <label className="ui-btn min-h-[38px] cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] transition-colors whitespace-nowrap">
                      <span>匯入字幕 (.lrc)</span>
                      <input
                        type="file"
                        accept=".lrc,.srt,.txt"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          if (f) onImportLrcForTrack(track.trackId, f);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    {/* Toggle Called */}
                    <button
                      type="button"
                      onClick={() => toggleTrackInTodayCall(track.trackId)}
                      className={`ui-btn min-h-[38px] px-3 py-1.5 border transition-colors whitespace-nowrap ${
                        isCalled
                          ? 'border-amber-500/60 text-amber-400 bg-amber-500/10 font-bold'
                          : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      {isCalled ? '已列通告' : '設為通告'}
                    </button>

                    {/* Edit Metadata */}
                    <button
                      type="button"
                      onClick={() =>
                        isEditing
                          ? setEditingTrackId(null)
                          : startEditingTrack(track)
                      }
                      className="ui-btn min-h-[38px] px-3 py-1.5 border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-gold)] transition-colors whitespace-nowrap"
                    >
                      {isEditing ? '收起設定' : '曲目設定'}
                    </button>

                    {/* Go to Rehearsal */}
                    <button
                      type="button"
                      onClick={() => onGoToRehearsal(track.trackId)}
                      className="ui-btn min-h-[38px] px-3.5 py-1.5 bg-[var(--accent-gold)] text-black font-bold hover:opacity-90 transition-opacity whitespace-nowrap ml-auto sm:ml-0"
                    >
                      進入排練 →
                    </button>
                  </div>
                </div>

                {/* Inline Editing Form */}
                {isEditing && (
                  <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[var(--text-muted)] mb-1">
                          曲目完整名稱
                        </label>
                        <input
                          type="text"
                          value={editDraft.title || ''}
                          onChange={(e) =>
                            setEditDraft((p) => ({ ...p, title: e.target.value }))
                          }
                          className="w-full min-h-[38px] px-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <label className="block text-[var(--text-muted)] mb-1">
                          上場角色（以 · 分隔）
                        </label>
                        <input
                          type="text"
                          value={editDraft.characters || ''}
                          onChange={(e) =>
                            setEditDraft((p) => ({
                              ...p,
                              characters: e.target.value,
                            }))
                          }
                          className="w-full min-h-[38px] px-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="w-1/2">
                          <label className="block text-[var(--text-muted)] mb-1">
                            幕次
                          </label>
                          <select
                            value={editDraft.act || 'Act I'}
                            onChange={(e) =>
                              setEditDraft((p) => ({
                                ...p,
                                act: e.target.value as 'Act I' | 'Act II',
                              }))
                            }
                            className="w-full min-h-[38px] px-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                          >
                            <option value="Act I">Act I</option>
                            <option value="Act II">Act II</option>
                          </select>
                        </div>
                        <div className="w-1/2">
                          <label className="block text-[var(--text-muted)] mb-1">
                            節拍 BPM
                          </label>
                          <input
                            type="number"
                            value={editDraft.bpm || 80}
                            onChange={(e) =>
                              setEditDraft((p) => ({
                                ...p,
                                bpm: Number(e.target.value) || 80,
                              }))
                            }
                            className="w-full min-h-[38px] px-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[var(--text-muted)] mb-1">
                          戲劇情境與時代背景
                        </label>
                        <textarea
                          rows={2}
                          value={editDraft.dramaticContext || ''}
                          onChange={(e) =>
                            setEditDraft((p) => ({
                              ...p,
                              dramaticContext: e.target.value,
                            }))
                          }
                          className="w-full p-2 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <label className="block text-[var(--text-muted)] mb-1">
                          唱詞潛台詞與情緒目標
                        </label>
                        <textarea
                          rows={2}
                          value={editDraft.librettoSubtext || ''}
                          onChange={(e) =>
                            setEditDraft((p) => ({
                              ...p,
                              librettoSubtext: e.target.value,
                            }))
                          }
                          className="w-full p-2 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                        />
                      </div>
                    </div>

                    {/* 2026 Cloud Audio Streaming URL & Label */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                      <div className="sm:col-span-2">
                        <label className="block text-[var(--text-muted)] mb-1 font-medium flex flex-wrap items-center justify-between gap-1">
                          <span>雲端音訊直連網址 (MP3 / WAV / Google Drive / Dropbox)</span>
                          {editDraft.audioUrl && (
                            <span className="text-[10px] text-emerald-400 font-mono">
                              {editDraft.audioUrl.includes('drive.google.com')
                                ? '✓ 自動轉為 Google Drive 串流直連'
                                : editDraft.audioUrl.includes('dropbox.com')
                                ? '✓ 自動轉為 Dropbox 串流直連'
                                : '✓ 支援瀏覽器 HTML5 Audio 直接串流'}
                            </span>
                          )}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            placeholder="例如：https://drive.google.com/file/d/... 或 https://.../track.mp3"
                            value={editDraft.audioUrl || ''}
                            onChange={(e) =>
                              setEditDraft((p) => ({ ...p, audioUrl: e.target.value }))
                            }
                            className="flex-1 min-h-[38px] px-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono text-xs"
                          />
                          {editDraft.audioUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setEditDraft((p) => ({
                                  ...p,
                                  audioUrl: '',
                                  audioLabel: '',
                                }))
                              }
                              className="ui-btn min-h-[38px] px-2.5 py-1.5 border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 inline-flex items-center gap-1 whitespace-nowrap"
                              title="清除雲端音訊網址"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>清除網址</span>
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">
                          貼入網址後，電腦 B、C 裝置打開即可隨點隨播；亦可隨時在該裝置點擊「快取至本機」轉為永久離線儲存。
                        </p>
                      </div>
                      <div>
                        <label className="block text-[var(--text-muted)] mb-1 font-medium">
                          雲端音檔標籤
                        </label>
                        <input
                          type="text"
                          placeholder="例如：2026 巴黎劇院原版伴奏"
                          value={editDraft.audioLabel || ''}
                          onChange={(e) =>
                            setEditDraft((p) => ({ ...p, audioLabel: e.target.value }))
                          }
                          className="w-full min-h-[38px] px-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingTrackId(null)}
                        className="ui-btn min-h-[40px] px-4 py-1.5 border border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveTrack}
                        className="ui-btn min-h-[40px] px-5 py-1.5 bg-[var(--accent-gold)] text-black font-bold"
                      >
                        儲存變更
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

MasterCatalogView.displayName = 'MasterCatalogView';
