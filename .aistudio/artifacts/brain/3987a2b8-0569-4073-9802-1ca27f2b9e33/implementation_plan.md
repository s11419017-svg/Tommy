# 即時麥克風降噪與人聲增益引擎 (Real-time Voice Clarity & Noise Suppression)

本計畫為排練工作室的「跟唱練習室與自錄檢聽模組」導入純前端、零伺服器延遲的開源音訊強化處理鏈，有效消除環境背景雜音、電流底噪與冷氣嗡鳴，並針對音樂劇人聲頻段進行清晰度增益。

### User Review & Critical Decisions

> [!IMPORTANT]
> 本功能已依據使用者在 Phase 1 的問卷回饋進行定向規劃：優先實作「即時麥克風降噪與人聲增益 (RNNoise/WebAudio)」，無須依賴額外付費雲端 API，完全在使用者本機瀏覽器端即時運算。

- **Confirmed Decision 1**: 優先導入「即時麥克風降噪與人聲增益 (RNNoise/WebAudio)」，聚焦於跟唱試錄音質提升與音準判讀抗噪。
- **Confirmed Decision 2**: 採用 Web Audio API 鏈結原生 DSP（高通濾波、自適應噪音門檻 Noise Gate、3kHz 歌唱明亮度 Peaking EQ、動態防破音壓限器 DynamicsCompressor），確保 100% 跨平台相容性與極低延遲（< 15ms）。

---

### 1. Overview & Core Concept

- **What It Does**:
  在使用者啟用麥克風進行「即時音準判讀」或「15 秒跟唱試錄」時，自動介入即時音訊濾波鏈：
  1. 濾除 80Hz 以下低頻空調/機械振動聲（High-pass Filter）。
  2. 動態抑制靜音間隔的背景環境噪聲（Adaptive Noise Gate）。
  3. 強化 2.5kHz - 3.5kHz 劇院歌唱人聲頻段（Vocal Presence & Clarity Boost）。
  4. 壓限平滑處理防止爆音（Dynamics Compressor），並提供降噪前／降噪後即時監聽與頻譜指示。
- **Target Audience / Persona**:
  音樂劇演員、排練合唱隊員與聲樂指導。在日常居家、琴房或非專業隔音環境下，能錄出乾淨清晰的 15 秒跟唱試聽檔，並大幅減少環境噪聲對音準檢測的干擾。
- **Key Value**:
  免去演員手動後製或匯入 DAW 降噪的麻煩，在網頁內即可享受廣播級乾淨人聲與高穩定度音準回饋。

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. 演員在排練舞台開啟「音準與試錄」抽屜。
  2. 抽屜頂部新增「即時麥克風強化」儀表板，顯示降噪狀態（已啟用 / 旁通原音）。
  3. 演員可透過滑桿微調「降噪深度 (Noise Gate)」與「人聲亮化 (Clarity Boost)」，即時看見輸入音量與降噪壓縮量（Gain Reduction）動態電平。
  4. 點擊「錄製 15 秒跟唱」，錄製出來的音檔自動套用音訊增益，回放試聽無環境底噪，人聲飽滿自然。
- **Visual Identity & Theme**:
  - *風格調性*：延續《悲慘世界》劇院暗金與專業音控台的古典典雅風格，採用金色刻度（`--accent-gold`）、翡翠綠指示燈（`--status-sage`）與深色金屬面板。
  - *互動微回饋*：降噪門檻觸發時，狀態燈即時切換「講話／過濾」，給予演職人員直覺回饋。

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: 原生 Web Audio API 混合 DSP 鏈 vs. 重型 ONNX 神經網路模型**
  - *Chosen Approach*: 採用 Web Audio API 高速原生節點組合（BiquadFilter + ScriptProcessor/AudioWorklet Noise Gate + DynamicsCompressor）。
  - *Why*: 零秒載入、不需要下載幾十 MB 的深度學習權重檔，CPU 佔用率低於 1%，在手機與低配筆電上完全不卡頓。
  - *Alternatives Considered*: 瀏覽器端 WebAssembly RNNoise 雖然對非平穩噪音抑制極強，但模型下載約 2MB 且需載入外部 WASM 執行緒，故設計為核心原生 DSP 優先，保留無縫升級介面。

- **Decision 2: 降噪是否影響自錄音檔存檔**
  - *Chosen Approach*: 試錄音檔直接錄製「強化後音訊」，讓演員下載與回放皆為乾淨成品，同時提供「一鍵旁通 (Bypass)」隨時切回麥克風原音。

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    User Microphone Input                    │
│                      (navigator.mediaDevices)               │
└──────────────────────────────┬──────────────────────────────┘
                               │ MediaStream
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             Web Audio Enhancement Pipeline Graph            │
│                                                             │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │ 80Hz HighPass    ├────►│ Noise Gate       │              │
│  │ (Rumble Filter)  │     │ (Threshold Suppr)│              │
│  └──────────────────┘     └─────────┬────────┘              │
│                                     │                       │
│  ┌──────────────────┐     ┌─────────▼────────┐              │
│  │ DynamicsCompress ◄─────┤ 3.2kHz Peaking EQ│              │
│  │ (De-clip & Level)│     │ (Presence Boost) │              │
│  └────────┬─────────┘     └──────────────────┘              │
└───────────┼─────────────────────────────────────────────────┘
            │ Enhanced Audio Stream
      ┌─────┴─────────────────────────┐
      ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│ Pitch Autocorrelation   │     │ MediaRecorder (15s Take)    │
│ (Stable & Clean Freq)   │     │ (Clean, Studio-grade WebM)  │
└─────────────────────────┘     └─────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - `isEnhancedMicActive`: 控制是否穿透濾波鏈或旁通。
  - `noiseGateThreshold`: 調整靜音底噪過濾閥值（-60dB 至 -30dB）。
  - `clarityBoostGain`: 人聲 3kHz 增益量（0dB 至 +6dB）。
  - `enhancedStream`: 提供給 `MediaRecorder` 與 `AnalyserNode` 作為音準偵測與錄音資料來源。
