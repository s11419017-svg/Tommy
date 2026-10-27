/**
 * Web Audio Real-Time Vocal Enhancement & Noise Suppression Engine
 * 
 * Provides studio-grade, zero-latency real-time voice processing:
 * 1. 80Hz High-pass Rumble Filter: eliminates air conditioner hum, desk vibrations, sub-bass thumps.
 * 2. Adaptive Noise Gate: smoothly attenuates background hiss & room noise during silences with fast attack & natural release.
 * 3. 3.2kHz Peaking EQ Presence Boost: highlights musical theater vocal projection, articulation, and clarity.
 * 4. Dynamics Compressor & De-clipper: smooths vocal dynamics, prevents harsh clipping spikes, and stabilizes pitch tracking.
 * 5. MediaStream Output: directly feedable to MediaRecorder and pitch Autocorrelation Analysers.
 */

export interface AudioEnhancementConfig {
  enabled: boolean;
  noiseGateThresholdDb: number; // e.g. -50 to -25 dB, default -42 dB
  clarityBoostDb: number;       // e.g. 0 to +8 dB, default +4 dB
  highpassCutoffHz: number;     // e.g. 60 to 120 Hz, default 80 Hz
  noiseGateFloorGain: number;   // minimum gain when gate is closed, default 0.02 (-34dB)
}

export interface AudioPipelineMetrics {
  inputDb: number;
  inputRms: number;
  outputRms: number;
  isGateOpen: boolean;
  reductionDb: number;
}

export interface AudioEnhancementPipeline {
  enhancedStream: MediaStream;
  outputAnalyser: AnalyserNode;
  inputAnalyser: AnalyserNode;
  updateConfig: (patch: Partial<AudioEnhancementConfig>) => void;
  getMetrics: () => AudioPipelineMetrics;
  destroy: () => void;
}

export const DEFAULT_ENHANCEMENT_CONFIG: AudioEnhancementConfig = {
  enabled: true,
  noiseGateThresholdDb: -42,
  clarityBoostDb: 4.0,
  highpassCutoffHz: 80,
  noiseGateFloorGain: 0.03, // approx -30dB attenuation when gate is closed
};

/**
 * Creates an in-browser zero-latency DSP enhancement chain for microphone input.
 */
export function createAudioEnhancementPipeline(
  inputStream: MediaStream,
  audioContext: AudioContext,
  initialConfig: Partial<AudioEnhancementConfig> = {}
): AudioEnhancementPipeline {
  const config: AudioEnhancementConfig = {
    ...DEFAULT_ENHANCEMENT_CONFIG,
    ...initialConfig,
  };

  const sourceNode = audioContext.createMediaStreamSource(inputStream);

  // 1. Input Analyser (measures raw microphone input level & envelope)
  const inputAnalyser = audioContext.createAnalyser();
  inputAnalyser.fftSize = 1024;
  inputAnalyser.smoothingTimeConstant = 0.2;
  sourceNode.connect(inputAnalyser);

  // 2. High-pass filter (sub-bass / rumble filter)
  const highpass = audioContext.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.setValueAtTime(config.highpassCutoffHz, audioContext.currentTime);
  highpass.Q.setValueAtTime(0.707, audioContext.currentTime);

  // 3. Noise Gate Gain Node
  const gateGain = audioContext.createGain();
  gateGain.gain.setValueAtTime(config.enabled ? 1.0 : 1.0, audioContext.currentTime);

  // 4. Vocal Presence & Clarity Peaking Filter (3.2 kHz)
  const clarityFilter = audioContext.createBiquadFilter();
  clarityFilter.type = 'peaking';
  clarityFilter.frequency.setValueAtTime(3200, audioContext.currentTime);
  clarityFilter.Q.setValueAtTime(1.2, audioContext.currentTime);
  clarityFilter.gain.setValueAtTime(
    config.enabled ? config.clarityBoostDb : 0,
    audioContext.currentTime
  );

  // 5. Dynamics Compressor (smooth vocal performance & anti-clipping)
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-22, audioContext.currentTime);
  compressor.knee.setValueAtTime(8, audioContext.currentTime);
  compressor.ratio.setValueAtTime(3.8, audioContext.currentTime);
  compressor.attack.setValueAtTime(0.003, audioContext.currentTime); // 3ms fast attack
  compressor.release.setValueAtTime(0.22, audioContext.currentTime); // 220ms release

  // Master processed gain vs bypass gain
  const processedGain = audioContext.createGain();
  processedGain.gain.setValueAtTime(config.enabled ? 1.0 : 0.0, audioContext.currentTime);

  const bypassGain = audioContext.createGain();
  bypassGain.gain.setValueAtTime(config.enabled ? 0.0 : 1.0, audioContext.currentTime);

  // Output Analyser & Destination
  const outputAnalyser = audioContext.createAnalyser();
  outputAnalyser.fftSize = 1024;
  outputAnalyser.smoothingTimeConstant = 0.2;

  const destination = audioContext.createMediaStreamDestination();

  // Connect Processed Chain:
  // source -> highpass -> gateGain -> clarityFilter -> compressor -> processedGain
  sourceNode.connect(highpass);
  highpass.connect(gateGain);
  gateGain.connect(clarityFilter);
  clarityFilter.connect(compressor);
  compressor.connect(processedGain);

  // Connect Bypass Chain:
  // source -> bypassGain
  sourceNode.connect(bypassGain);

  // Merge into destination & outputAnalyser
  processedGain.connect(outputAnalyser);
  bypassGain.connect(outputAnalyser);
  processedGain.connect(destination);
  bypassGain.connect(destination);

  // Internal state for envelope detection & metrics
  const inputBuffer = new Float32Array(inputAnalyser.fftSize);
  const outputBuffer = new Float32Array(outputAnalyser.fftSize);
  let isGateOpen = true;
  let currentReductionDb = 0;
  let animFrameId: number | null = null;
  let destroyed = false;

  const updateGateLoop = () => {
    if (destroyed) return;

    if (!config.enabled) {
      gateGain.gain.setTargetAtTime(1.0, audioContext.currentTime, 0.02);
      isGateOpen = true;
      currentReductionDb = 0;
      animFrameId = requestAnimationFrame(updateGateLoop);
      return;
    }

    inputAnalyser.getFloatTimeDomainData(inputBuffer);
    let sum = 0;
    for (let i = 0; i < inputBuffer.length; i++) {
      const v = inputBuffer[i];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / inputBuffer.length);
    const db = rms > 0.00001 ? 20 * Math.log10(rms) : -100;

    const threshold = config.noiseGateThresholdDb;
    const now = audioContext.currentTime;

    // Hysteresis window (3dB) to prevent gate chattering
    if (db > threshold + 1.5) {
      // Voice detected - open gate swiftly (attack 8ms)
      isGateOpen = true;
      gateGain.gain.setTargetAtTime(1.0, now, 0.008);
      currentReductionDb = 0;
    } else if (db < threshold - 1.5) {
      // Background noise - close gate smoothly (release 100ms)
      isGateOpen = false;
      gateGain.gain.setTargetAtTime(config.noiseGateFloorGain, now, 0.1);
      // Floor gain in dB
      const floorDb = 20 * Math.log10(config.noiseGateFloorGain);
      currentReductionDb = Math.abs(floorDb);
    }

    animFrameId = requestAnimationFrame(updateGateLoop);
  };

  animFrameId = requestAnimationFrame(updateGateLoop);

  const updateConfig = (patch: Partial<AudioEnhancementConfig>) => {
    Object.assign(config, patch);
    const now = audioContext.currentTime;

    if (config.enabled) {
      processedGain.gain.setTargetAtTime(1.0, now, 0.02);
      bypassGain.gain.setTargetAtTime(0.0, now, 0.02);
      clarityFilter.gain.setTargetAtTime(config.clarityBoostDb, now, 0.02);
      highpass.frequency.setTargetAtTime(config.highpassCutoffHz, now, 0.02);
    } else {
      processedGain.gain.setTargetAtTime(0.0, now, 0.02);
      bypassGain.gain.setTargetAtTime(1.0, now, 0.02);
      gateGain.gain.setTargetAtTime(1.0, now, 0.02);
      isGateOpen = true;
      currentReductionDb = 0;
    }
  };

  const getMetrics = (): AudioPipelineMetrics => {
    inputAnalyser.getFloatTimeDomainData(inputBuffer);
    outputAnalyser.getFloatTimeDomainData(outputBuffer);

    let inSum = 0;
    for (let i = 0; i < inputBuffer.length; i++) {
      const v = inputBuffer[i];
      inSum += v * v;
    }
    const inRms = Math.sqrt(inSum / inputBuffer.length);
    const inDb = inRms > 0.00001 ? Math.max(-90, 20 * Math.log10(inRms)) : -90;

    let outSum = 0;
    for (let i = 0; i < outputBuffer.length; i++) {
      const v = outputBuffer[i];
      outSum += v * v;
    }
    const outRms = Math.sqrt(outSum / outputBuffer.length);

    return {
      inputDb: Math.round(inDb * 10) / 10,
      inputRms: inRms,
      outputRms: outRms,
      isGateOpen,
      reductionDb: isGateOpen ? 0 : Math.round(currentReductionDb),
    };
  };

  const destroy = () => {
    destroyed = true;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    try {
      sourceNode.disconnect();
      highpass.disconnect();
      gateGain.disconnect();
      clarityFilter.disconnect();
      compressor.disconnect();
      processedGain.disconnect();
      bypassGain.disconnect();
      inputAnalyser.disconnect();
      outputAnalyser.disconnect();
    } catch {
      // Ignore disconnect errors during teardown
    }
  };

  return {
    enhancedStream: destination.stream,
    outputAnalyser,
    inputAnalyser,
    updateConfig,
    getMetrics,
    destroy,
  };
}
