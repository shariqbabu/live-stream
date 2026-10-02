/**
 * ===================================================================
 * CINEFLIX OTT ENGINE - PRODUCTION CORE JAVASCRIPT
 * Features: Adaptive HLS (.m3u8), DASH (.mpd), MP4, MKV, HEVC / H.265
 * Controls: Quality, Multi-Audio, Subs, Speed, Aspect, Resume Playback
 * TMA Integration: Telegram WebApp SDK v7.0+, BackButton, Haptics
 * ===================================================================
 */

(function () {
  'use strict';

  // --- Telegram WebApp SDK Initialization ---
  const tg = window.Telegram?.WebApp;
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (typeof tg.enableClosingConfirmation === 'function') {
        tg.enableClosingConfirmation();
      }
    } catch (e) {
      console.warn('Telegram SDK initialization note:', e);
    }
  }

  // --- DOM Elements ---
  const elements = {
    container: document.getElementById('exo-player-container'),
    video: document.getElementById('exo-video'),
    controls: document.getElementById('exo-controls'),
    buffering: document.getElementById('exo-buffering'),
    errorOverlay: document.getElementById('error-overlay'),
    errorTitle: document.getElementById('error-title'),
    errorMessage: document.getElementById('error-message'),
    btnRetryStream: document.getElementById('btn-retry-stream'),
    btnDismissError: document.getElementById('btn-dismiss-error'),
    toast: document.getElementById('exo-toast'),
    streamTitle: document.getElementById('stream-title'),
    badgeCodec: document.getElementById('video-stream-badge'),
    badgeRes: document.getElementById('video-resolution-badge'),

    // Resume Overlay
    resumeOverlay: document.getElementById('resume-overlay'),
    resumeTimestamp: document.getElementById('resume-timestamp'),
    btnResumePlay: document.getElementById('btn-resume-play'),
    btnResumeRestart: document.getElementById('btn-resume-restart'),

    // Center Buttons
    btnPlayPause: document.getElementById('btn-play-pause'),
    iconPlay: document.getElementById('icon-play'),
    iconPause: document.getElementById('icon-pause'),
    btnRewind: document.getElementById('btn-rewind'),
    btnForward: document.getElementById('btn-forward'),

    // Mini Controls & Times
    btnPlayMini: document.getElementById('btn-play-mini'),
    iconPlayMini: document.getElementById('icon-play-mini'),
    iconPauseMini: document.getElementById('icon-pause-mini'),
    timeCurrent: document.getElementById('time-current'),
    timeDuration: document.getElementById('time-duration'),
    liveIndicator: document.getElementById('live-indicator'),

    // Scrub Bar
    scrubContainer: document.querySelector('.scrub-container'),
    scrubBar: document.getElementById('scrub-bar'),
    scrubProgress: document.getElementById('scrub-progress'),
    scrubBuffered: document.getElementById('scrub-buffered'),
    scrubHandle: document.getElementById('scrub-handle'),
    scrubTooltip: document.getElementById('scrub-time-tooltip'),

    // Player Action Controls
    btnResizeMode: document.getElementById('btn-resize-mode'),
    btnLock: document.getElementById('btn-lock'),
    btnUnlock: document.getElementById('btn-unlock'),
    lockOverlay: document.getElementById('lock-overlay'),
    btnSettings: document.getElementById('btn-settings'),
    btnAudioTracks: document.getElementById('btn-audio-tracks'),
    btnSubtitles: document.getElementById('btn-subtitles'),
    btnPip: document.getElementById('btn-pip'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    iconFsEnter: document.getElementById('icon-fs-enter'),
    iconFsExit: document.getElementById('icon-fs-exit'),

    // Gestures
    gestureLayer: document.querySelector('.gesture-layer'),
    gestureLeft: document.getElementById('gesture-left'),
    gestureCenter: document.getElementById('gesture-center'),
    gestureRight: document.getElementById('gesture-right'),
    rewindFeedback: document.getElementById('rewind-feedback'),
    forwardFeedback: document.getElementById('forward-feedback'),
    gestureHud: document.getElementById('gesture-hud'),
    hudIcon: document.getElementById('hud-icon'),
    hudLevel: document.getElementById('hud-level'),
    hudText: document.getElementById('hud-text'),

    // Modals & Settings
    modalSettings: document.getElementById('modal-settings'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    modalBackdrop: document.querySelector('.modal-backdrop'),
    modalContentMain: document.getElementById('modal-content-main'),
    modalContentSub: document.getElementById('modal-content-sub'),
    modalTitle: document.getElementById('modal-title'),
    btnSubBack: document.getElementById('btn-sub-back'),
    subTitle: document.getElementById('sub-title'),
    subOptionsList: document.getElementById('sub-options-list'),

    // Labels
    currentQualityLabel: document.getElementById('current-quality-label'),
    currentAudioLabel: document.getElementById('current-audio-label'),
    currentSubtitlesLabel: document.getElementById('current-subtitles-label'),
    currentSpeedLabel: document.getElementById('current-speed-label'),
    currentAspectLabel: document.getElementById('current-aspect-label'),
    toggleHaptics: document.getElementById('toggle-haptics'),

    // Header & Stats
    btnBackHeader: document.getElementById('btn-back'),
    btnStats: document.getElementById('btn-stats'),
    statsOverlay: document.getElementById('stats-overlay'),
    btnCloseStats: document.getElementById('btn-close-stats'),
    statEngine: document.getElementById('stat-engine'),
    statCodec: document.getElementById('stat-codec'),
    statRes: document.getElementById('stat-res'),
    statBitrate: document.getElementById('stat-bitrate'),
    statBuffer: document.getElementById('stat-buffer'),
    statDropped: document.getElementById('stat-dropped'),
    statTgVersion: document.getElementById('stat-tg-version'),

    // OTT Movie Details Card
    ottMovieTitle: document.getElementById('ott-movie-title'),
    ottMovieDesc: document.getElementById('ott-movie-desc')
  };

  // --- Player State ---
  const state = {
    hlsInstance: null,
    dashInstance: null,
    currentUrl: '',
    currentRawTitle: 'CineFlix Stream',
    currentType: 'm3u8',
    isLive: false,
    controlsTimeout: null,
    loadingTimeout: null,
    resumeTimer: null,
    savedResumeTime: 0,
    isScrubbing: false,
    isLocked: false,
    brightness: 1,
    volume: 1,
    hapticsEnabled: true,
    resizeModes: ['resize-fit', 'resize-fill', 'resize-stretch', 'resize-16-9', 'resize-4-3'],
    resizeModeNames: {
      'resize-fit': 'Fit (Original)',
      'resize-fill': 'Fill (Zoom)',
      'resize-stretch': 'Stretch',
      'resize-16-9': '16:9 Aspect',
      'resize-4-3': '4:3 Aspect'
    },
    currentResizeIndex: 0,
    currentQualityIndex: -1,
    currentAudioIndex: 0,
    currentSubtitleIndex: -1,
    hlsLevels: [],
    hlsAudioTracks: [],
    hlsSubtitleTracks: [],
    playbackSpeeds: [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]
  };

  // --- Toast Notification Helper ---
  let toastTimer = null;
  function showToast(text) {
    if (!elements.toast) return;
    elements.toast.textContent = text;
    elements.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      elements.toast.classList.add('hidden');
    }, 2400);
  }

  // --- Telegram Haptic Feedback Helper ---
  function triggerHaptic(type = 'light') {
    if (!state.hapticsEnabled) return;
    if (tg?.HapticFeedback) {
      try {
        if (type === 'selection') {
          tg.HapticFeedback.selectionChanged();
        } else if (type === 'success' || type === 'error' || type === 'warning') {
          tg.HapticFeedback.notificationOccurred(type);
        } else {
          tg.HapticFeedback.impactOccurred(type);
        }
      } catch (e) {}
    } else if (navigator.vibrate) {
      const duration = type === 'heavy' ? 40 : (type === 'medium' ? 25 : 12);
      navigator.vibrate(duration);
    }
  }

  // --- Format / Stream Type Detector ---
  function determineStreamType(url) {
    if (!url) return 'm3u8';
    const cleanUrl = url.split('?')[0].toLowerCase();
    if (cleanUrl.endsWith('.m3u8')) return 'm3u8';
    if (cleanUrl.endsWith('.mpd')) return 'mpd';
    if (cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.m4v')) return 'mp4';
    if (cleanUrl.endsWith('.mkv') || cleanUrl.endsWith('.webm')) return 'mkv';
    return 'm3u8';
  }

  // --- Resume Progress Manager (localStorage) ---
  function getResumeKey(url, title) {
    const raw = (title || '') + '_' + (url || '');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return `cineflix_resume_${Math.abs(hash)}`;
  }

  function saveProgress() {
    if (!elements.video || !state.currentUrl || state.isLive) return;
    const current = elements.video.currentTime;
    const duration = elements.video.duration;
    if (!duration || duration <= 0 || current < 5) return;

    const key = getResumeKey(state.currentUrl, state.currentRawTitle);
    // If watched more than 95%, reset
    if (current > duration * 0.95) {
      localStorage.removeItem(key);
      return;
    }

    try {
      localStorage.setItem(key, JSON.stringify({
        time: Math.floor(current),
        duration: Math.floor(duration),
        title: state.currentRawTitle,
        updatedAt: Date.now()
      }));
    } catch (e) {}
  }

  function checkResumeProgress(url, title) {
    const key = getResumeKey(url, title);
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (data && data.time > 10 && data.duration > 30 && data.time < data.duration * 0.95) {
        return data.time;
      }
    } catch (e) {}
    return 0;
  }

  function hideResumeOverlay() {
    if (elements.resumeOverlay) {
      elements.resumeOverlay.classList.add('hidden');
    }
    clearTimeout(state.resumeTimer);
  }

  function promptResume(savedTime) {
    state.savedResumeTime = savedTime;
    if (!elements.resumeOverlay || !elements.resumeTimestamp) return;

    elements.resumeTimestamp.textContent = formatTime(savedTime);
    elements.resumeOverlay.classList.remove('hidden');

    // Auto-dismiss after 9 seconds if user ignores
    clearTimeout(state.resumeTimer);
    state.resumeTimer = setTimeout(() => {
      hideResumeOverlay();
    }, 9000);
  }

  // --- Smart URL and Metadata Parser ---
  function parseInputString(rawInput) {
    if (!rawInput) return { url: '', title: 'CineFlix Stream', type: 'm3u8' };
    let trimmed = rawInput.trim();

    if (/^[A-Za-z0-9+/=_-]{16,}$/.test(trimmed) && !trimmed.startsWith('http')) {
      try {
        const b64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = decodeURIComponent(escape(atob(b64)));
        if (decoded.includes('http') || decoded.includes('.m3u8') || decoded.includes('.mp4')) {
          trimmed = decoded;
        }
      } catch (e) {}
    }

    const urlMatch = trimmed.match(/https?:\/\/[^\s"'<>|]+|ftp:\/\/[^\s"'<>|]+/i);
    let streamUrl = urlMatch ? urlMatch[0].trim() : trimmed;

    if (!urlMatch) {
      if (streamUrl.startsWith('//')) {
        streamUrl = 'https:' + streamUrl;
      } else if (/^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/.*)?$/.test(streamUrl)) {
        streamUrl = 'https://' + streamUrl;
      } else if (streamUrl.includes('.m3u8') || streamUrl.includes('.mpd') || streamUrl.includes('.mp4') || streamUrl.includes('.mkv') || streamUrl.includes('.webm')) {
        if (!streamUrl.startsWith('http://') && !streamUrl.startsWith('https://')) {
          streamUrl = 'https://' + streamUrl.replace(/^\/+/, '');
        }
      }
    }

    let title = 'CineFlix Stream';
    if (urlMatch) {
      let textWithoutUrl = trimmed.replace(urlMatch[0], '').trim();
      if (textWithoutUrl) {
        let cleanTitle = textWithoutUrl
          .replace(/^[🎥🎬🍿📺\s|:,-]+/, '')
          .replace(/\s*[|⭐].*$/, '')
          .replace(/Codec:\s*.*$/i, '')
          .replace(/Rating:\s*.*$/i, '')
          .replace(/Quality:\s*.*$/i, '')
          .trim();
        if (cleanTitle.length > 1) {
          title = cleanTitle;
        }
      }
    }

    return {
      url: streamUrl,
      title: title,
      type: determineStreamType(streamUrl)
    };
  }

  // --- Error Overlay Handling ---
  function showError(title, message) {
    showBuffering(false);
    if (elements.errorOverlay) {
      if (elements.errorTitle) elements.errorTitle.textContent = title || 'Playback Error';
      if (elements.errorMessage) elements.errorMessage.textContent = message || 'Could not load this video stream.';
      elements.errorOverlay.classList.remove('hidden');
    }
    triggerHaptic('error');
  }

  function hideError() {
    if (elements.errorOverlay) {
      elements.errorOverlay.classList.add('hidden');
    }
  }

  // --- Player Core: Load and Play URL ---
  function loadSource(url, title = 'CineFlix Stream', type = null) {
    if (!url) return;
    hideError();
    hideResumeOverlay();
    clearTimeout(state.loadingTimeout);

    const parsed = parseInputString(url);
    const targetUrl = parsed.url;
    const streamTitle = (title && title !== 'Stream' && title !== 'Custom Stream' && title !== 'CineFlix Stream') ? title : parsed.title;
    const streamType = type || parsed.type || determineStreamType(targetUrl);

    state.currentUrl = targetUrl;
    state.currentRawTitle = streamTitle;
    state.currentType = streamType;

    // Update Header Movie Title & OTT Card
    if (elements.streamTitle) elements.streamTitle.textContent = streamTitle;
    if (elements.ottMovieTitle) elements.ottMovieTitle.textContent = streamTitle;
    if (elements.badgeCodec) elements.badgeCodec.textContent = streamType ? streamType.toUpperCase() : 'HLS';

    // Reset Engine instances
    if (state.hlsInstance) {
      try { state.hlsInstance.destroy(); } catch (e) {}
      state.hlsInstance = null;
    }
    if (state.dashInstance) {
      try { state.dashInstance.reset(); } catch (e) {}
      state.dashInstance = null;
    }

    state.hlsLevels = [];
    state.hlsAudioTracks = [];
    state.hlsSubtitleTracks = [];
    state.currentQualityIndex = -1;
    if (elements.currentQualityLabel) elements.currentQualityLabel.textContent = 'Auto';
    if (elements.currentAudioLabel) elements.currentAudioLabel.textContent = 'Default';
    if (elements.currentSubtitlesLabel) elements.currentSubtitlesLabel.textContent = 'Off';

    elements.video.removeAttribute('src');
    elements.video.load();
    showBuffering(true);

    // Watchdog loading timeout (8s)
    state.loadingTimeout = setTimeout(() => {
      if (elements.video.readyState < 2 && elements.video.paused) {
        showBuffering(false);
        showControls();
        showError('Connection Timeout', 'The video stream is taking too long to respond. Please retry or check network.');
      }
    }, 8000);

    // 1. HLS Stream (.m3u8)
    if (state.currentType === 'm3u8') {
      if (window.Hls && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 600,
          progressive: true,
          capLevelToPlayerSize: false
        });

        let networkRetryCount = 0;

        hls.loadSource(targetUrl);
        hls.attachMedia(elements.video);

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          clearTimeout(state.loadingTimeout);
          state.hlsLevels = data.levels || [];
          if (state.hlsLevels.length > 0) {
            const highest = state.hlsLevels[state.hlsLevels.length - 1];
            if (elements.badgeRes && highest.height) {
              elements.badgeRes.textContent = `${highest.height}p`;
            }
          }

          // Check Resume progress
          const savedTime = checkResumeProgress(targetUrl, streamTitle);
          if (savedTime > 0) {
            promptResume(savedTime);
          }

          playVideo();
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          const level = state.hlsLevels[data.level];
          if (level && elements.badgeRes && level.height) {
            elements.badgeRes.textContent = `${level.height}p`;
          }
        });

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (event, data) => {
          state.hlsAudioTracks = data.audioTracks || [];
        });

        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (event, data) => {
          state.hlsSubtitleTracks = data.subtitleTracks || [];
        });

        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          if (!elements.video.paused) {
            showBuffering(false);
          }
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                networkRetryCount++;
                if (networkRetryCount <= 3) {
                  showToast(`Reconnecting stream (${networkRetryCount}/3)...`);
                  hls.startLoad();
                } else {
                  showError('Network Stream Error', 'Stream server is offline or blocking connections.');
                  hls.destroy();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                showToast('Recovering media codec...');
                hls.recoverMediaError();
                break;
              default:
                showError('Streaming Error', data.details || 'Cannot decode stream.');
                hls.destroy();
                break;
            }
          }
        });

        state.hlsInstance = hls;
      } else if (elements.video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native Apple HLS
        elements.video.src = targetUrl;
        const savedTime = checkResumeProgress(targetUrl, streamTitle);
        if (savedTime > 0) promptResume(savedTime);
        playVideo();
      } else {
        showError('Codec Unsupported', 'Your browser cannot play HLS streams.');
      }
    }
    // 2. DASH Stream (.mpd)
    else if (state.currentType === 'mpd') {
      if (window.dashjs) {
        const player = dashjs.MediaPlayer().create();
        player.initialize(elements.video, targetUrl, true);
        player.updateSettings({
          streaming: {
            lowLatencyEnabled: true,
            buffer: { stableBufferTime: 12, bufferTimeAtTopQuality: 20 }
          }
        });
        state.dashInstance = player;
        const savedTime = checkResumeProgress(targetUrl, streamTitle);
        if (savedTime > 0) promptResume(savedTime);
      } else {
        elements.video.src = targetUrl;
        playVideo();
      }
    }
    // 3. Direct MP4 / MKV / WebM
    else {
      elements.video.src = targetUrl;
      const savedTime = checkResumeProgress(targetUrl, streamTitle);
      if (savedTime > 0) promptResume(savedTime);
      playVideo();
    }

    if (elements.statCodec) {
      elements.statCodec.textContent = state.currentType === 'm3u8' ? 'HEVC / H.264 (HLS)' : state.currentType.toUpperCase();
    }

    triggerHaptic('medium');
  }

  function playVideo() {
    clearTimeout(state.loadingTimeout);
    const playPromise = elements.video.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        clearTimeout(state.loadingTimeout);
        updatePlayIcons(true);
        hideError();
      }).catch((err) => {
        console.warn('Auto-play prevented:', err);
        updatePlayIcons(false);
        showBuffering(false);
        showControls();
      });
    }
  }

  function pauseVideo() {
    elements.video.pause();
    saveProgress();
    updatePlayIcons(false);
    showControls();
  }

  function togglePlayPause() {
    if (elements.video.paused) {
      playVideo();
      triggerHaptic('light');
    } else {
      pauseVideo();
      triggerHaptic('light');
    }
  }

  function updatePlayIcons(isPlaying) {
    if (isPlaying) {
      elements.iconPlay.classList.add('hidden');
      elements.iconPause.classList.remove('hidden');
      elements.iconPlayMini.classList.add('hidden');
      elements.iconPauseMini.classList.remove('hidden');
    } else {
      elements.iconPlay.classList.remove('hidden');
      elements.iconPause.classList.add('hidden');
      elements.iconPlayMini.classList.remove('hidden');
      elements.iconPauseMini.classList.add('hidden');
    }
  }

  function showBuffering(show) {
    if (show) {
      elements.buffering.classList.add('visible');
    } else {
      elements.buffering.classList.remove('visible');
    }
  }

  // --- Controls Overlay Management ---
  function showControls() {
    if (state.isLocked) return;
    elements.controls.classList.remove('controls-hidden');
    resetControlsTimeout();
  }

  function hideControls() {
    if (!elements.video.paused && !state.isScrubbing) {
      elements.controls.classList.add('controls-hidden');
    }
  }

  function resetControlsTimeout() {
    clearTimeout(state.controlsTimeout);
    if (!elements.video.paused) {
      state.controlsTimeout = setTimeout(() => {
        hideControls();
      }, 3500);
    }
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // --- Scrub Bar & Progress ---
  function updateProgress() {
    if (state.isScrubbing) return;
    const current = elements.video.currentTime;
    const duration = elements.video.duration;

    if (current > 0 && !elements.video.paused && !elements.video.seeking) {
      showBuffering(false);
    }

    if (duration && isFinite(duration) && duration > 0) {
      const pct = (current / duration) * 100;
      elements.scrubProgress.style.width = `${pct}%`;
      elements.scrubHandle.style.left = `${pct}%`;
      elements.timeCurrent.textContent = formatTime(current);
      elements.timeDuration.textContent = formatTime(duration);
      elements.liveIndicator.classList.add('hidden');
      elements.timeDuration.classList.remove('hidden');
    } else {
      elements.scrubProgress.style.width = '100%';
      elements.scrubHandle.style.left = '100%';
      elements.timeCurrent.textContent = formatTime(current);
      elements.liveIndicator.classList.remove('hidden');
      elements.timeDuration.classList.add('hidden');
    }

    // Update buffered bar
    if (elements.video.buffered && elements.video.buffered.length > 0 && duration > 0) {
      try {
        const bufferedEnd = elements.video.buffered.end(elements.video.buffered.length - 1);
        const bufPct = (bufferedEnd / duration) * 100;
        elements.scrubBuffered.style.width = `${Math.min(bufPct, 100)}%`;
      } catch (e) {}
    }
  }

  function seekRelative(offsetSeconds) {
    const duration = elements.video.duration || 0;
    const target = Math.max(0, Math.min(duration, elements.video.currentTime + offsetSeconds));
    elements.video.currentTime = target;
    updateProgress();
    showToast(`${offsetSeconds > 0 ? '+' : ''}${offsetSeconds}s`);
    triggerHaptic('light');
  }

  function initScrubEvents() {
    const bar = elements.scrubContainer;
    if (!bar) return;

    function handleScrub(e) {
      const rect = elements.scrubBar.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const duration = elements.video.duration || 0;

      elements.scrubProgress.style.width = `${pos * 100}%`;
      elements.scrubHandle.style.left = `${pos * 100}%`;

      const targetTime = pos * duration;
      elements.scrubTooltip.textContent = formatTime(targetTime);
      elements.scrubTooltip.style.left = `${pos * 100}%`;
      elements.scrubTooltip.classList.add('visible');

      return targetTime;
    }

    bar.addEventListener('mousedown', (e) => {
      state.isScrubbing = true;
      bar.classList.add('scrubbing');
      const time = handleScrub(e);
      function onMouseMove(ev) {
        handleScrub(ev);
      }
      function onMouseUp(ev) {
        state.isScrubbing = false;
        bar.classList.remove('scrubbing');
        elements.scrubTooltip.classList.remove('visible');
        const finalTime = handleScrub(ev);
        elements.video.currentTime = finalTime;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    bar.addEventListener('touchstart', (e) => {
      state.isScrubbing = true;
      bar.classList.add('scrubbing');
      handleScrub(e);
    }, { passive: true });

    bar.addEventListener('touchmove', (e) => {
      if (state.isScrubbing) {
        handleScrub(e);
      }
    }, { passive: true });

    bar.addEventListener('touchend', (e) => {
      if (state.isScrubbing) {
        state.isScrubbing = false;
        bar.classList.remove('scrubbing');
        elements.scrubTooltip.classList.remove('visible');
        const rect = elements.scrubBar.getBoundingClientRect();
        const clientX = e.changedTouches[0].clientX;
        const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        elements.video.currentTime = pos * (elements.video.duration || 0);
        triggerHaptic('medium');
      }
    });
  }

  // --- Gesture Layer (Swipe Brightness/Volume + Double-Tap Seek) ---
  function initGestureLayer() {
    let touchStartX = 0;
    let touchStartY = 0;
    let lastTapTime = 0;
    let gestureType = null;
    let initialVal = 0;
    let hasMoved = false;

    const layer = elements.gestureLayer;
    if (!layer) return;

    layer.addEventListener('touchstart', (e) => {
      if (state.isLocked) return;
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      gestureType = null;
      hasMoved = false;

      const rect = layer.getBoundingClientRect();
      const touchXRatio = (touchStartX - rect.left) / rect.width;

      if (touchXRatio < 0.4) {
        gestureType = 'brightness';
        initialVal = state.brightness;
      } else if (touchXRatio > 0.6) {
        gestureType = 'volume';
        initialVal = state.volume;
      }

      // Check Double Tap
      const now = Date.now();
      if (now - lastTapTime < 300) {
        if (touchXRatio < 0.4) {
          seekRelative(-10);
          showDoubleTapFeedback(elements.rewindFeedback);
        } else if (touchXRatio > 0.6) {
          seekRelative(10);
          showDoubleTapFeedback(elements.forwardFeedback);
        } else {
          togglePlayPause();
        }
        lastTapTime = 0;
        gestureType = null;
      } else {
        lastTapTime = now;
      }
    }, { passive: true });

    layer.addEventListener('touchmove', (e) => {
      if (state.isLocked || !gestureType) return;
      const touch = e.touches[0];
      const deltaY = touchStartY - touch.clientY;

      if (Math.abs(deltaY) > 12) {
        hasMoved = true;
        const change = deltaY / 180;

        if (gestureType === 'brightness') {
          state.brightness = Math.max(0.2, Math.min(1.5, initialVal + change));
          elements.video.style.filter = `brightness(${state.brightness})`;
          showGestureHud('brightness', Math.round(((state.brightness - 0.2) / 1.3) * 100));
        } else if (gestureType === 'volume') {
          state.volume = Math.max(0, Math.min(1, initialVal + change));
          elements.video.volume = state.volume;
          showGestureHud('volume', Math.round(state.volume * 100));
        }
      }
    }, { passive: true });

    layer.addEventListener('touchend', () => {
      hideGestureHud();
      if (!hasMoved && Date.now() - lastTapTime >= 280) {
        if (elements.controls.classList.contains('controls-hidden')) {
          showControls();
        } else {
          hideControls();
        }
      }
    }, { passive: true });

    layer.addEventListener('click', () => {
      if (state.isLocked) return;
      if (elements.controls.classList.contains('controls-hidden')) {
        showControls();
      } else {
        hideControls();
      }
    });
  }

  function showDoubleTapFeedback(elem) {
    if (!elem) return;
    elem.classList.add('animate');
    setTimeout(() => elem.classList.remove('animate'), 500);
  }

  let hudTimeout = null;
  function showGestureHud(type, percentage) {
    if (!elements.gestureHud) return;
    elements.gestureHud.classList.add('visible');
    elements.hudLevel.style.width = `${percentage}%`;
    elements.hudText.textContent = `${percentage}%`;

    const brightnessSvg = '<svg viewBox="0 0 24 24"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/></svg>';
    const volumeSvg = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';

    elements.hudIcon.innerHTML = type === 'brightness' ? brightnessSvg : volumeSvg;
  }

  function hideGestureHud() {
    clearTimeout(hudTimeout);
    hudTimeout = setTimeout(() => {
      if (elements.gestureHud) elements.gestureHud.classList.remove('visible');
    }, 400);
  }

  // --- Fullscreen & Aspect Ratio ---
  function toggleFullscreen() {
    const c = elements.container;
    if (!document.fullscreenElement && !c.classList.contains('is-fullscreen')) {
      if (c.requestFullscreen) {
        c.requestFullscreen().catch(() => {
          c.classList.add('is-fullscreen');
        });
      } else {
        c.classList.add('is-fullscreen');
      }
      elements.iconFsEnter.classList.add('hidden');
      elements.iconFsExit.classList.remove('hidden');
      showToast('Fullscreen Mode');
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      c.classList.remove('is-fullscreen');
      elements.iconFsEnter.classList.remove('hidden');
      elements.iconFsExit.classList.add('hidden');
    }
    triggerHaptic('medium');
  }

  function cycleResizeMode() {
    state.currentResizeIndex = (state.currentResizeIndex + 1) % state.resizeModes.length;
    const mode = state.resizeModes[state.currentResizeIndex];

    state.resizeModes.forEach((m) => elements.container.classList.remove(m));
    elements.container.classList.add(mode);

    const name = state.resizeModeNames[mode];
    if (elements.currentAspectLabel) elements.currentAspectLabel.textContent = name;
    showToast(`Aspect Ratio: ${name}`);
    triggerHaptic('selection');
  }

  // --- Settings Bottom Sheet Modal ---
  function openSettings() {
    elements.modalSettings.classList.remove('hidden');
    showSettingsMain();
    triggerHaptic('medium');
  }

  function closeSettings() {
    elements.modalSettings.classList.add('hidden');
  }

  function showSettingsMain() {
    elements.modalContentMain.classList.remove('hidden');
    elements.modalContentSub.classList.add('hidden');
    elements.modalTitle.textContent = 'Playback Settings';
  }

  function openSubMenu(menuType) {
    elements.modalContentMain.classList.add('hidden');
    elements.modalContentSub.classList.remove('hidden');
    elements.subOptionsList.innerHTML = '';

    if (menuType === 'quality') {
      elements.subTitle.textContent = 'Stream Quality';
      const autoOption = document.createElement('div');
      autoOption.className = `option-item ${state.currentQualityIndex === -1 ? 'selected' : ''}`;
      autoOption.textContent = 'Auto (Adaptive Multi-Bitrate)';
      autoOption.onclick = () => {
        if (state.hlsInstance) state.hlsInstance.currentLevel = -1;
        state.currentQualityIndex = -1;
        elements.currentQualityLabel.textContent = 'Auto';
        showToast('Quality set to Auto');
        closeSettings();
        triggerHaptic('selection');
      };
      elements.subOptionsList.appendChild(autoOption);

      if (state.hlsLevels && state.hlsLevels.length > 0) {
        state.hlsLevels.forEach((level, idx) => {
          const opt = document.createElement('div');
          opt.className = `option-item ${state.currentQualityIndex === idx ? 'selected' : ''}`;
          const bitrate = level.bitrate ? ` (${Math.round(level.bitrate / 1000)} kbps)` : '';
          opt.textContent = `${level.height || 'Custom'}p${bitrate}`;
          opt.onclick = () => {
            if (state.hlsInstance) state.hlsInstance.currentLevel = idx;
            state.currentQualityIndex = idx;
            elements.currentQualityLabel.textContent = `${level.height}p`;
            showToast(`Quality: ${level.height}p`);
            closeSettings();
            triggerHaptic('selection');
          };
          elements.subOptionsList.appendChild(opt);
        });
      }
    } else if (menuType === 'audio') {
      elements.subTitle.textContent = 'Audio Track';
      if (state.hlsAudioTracks && state.hlsAudioTracks.length > 0) {
        state.hlsAudioTracks.forEach((track, idx) => {
          const opt = document.createElement('div');
          opt.className = `option-item ${state.currentAudioIndex === idx ? 'selected' : ''}`;
          opt.textContent = track.name || track.lang || `Track ${idx + 1}`;
          opt.onclick = () => {
            if (state.hlsInstance) state.hlsInstance.audioTrack = idx;
            state.currentAudioIndex = idx;
            elements.currentAudioLabel.textContent = opt.textContent;
            showToast(`Audio: ${opt.textContent}`);
            closeSettings();
            triggerHaptic('selection');
          };
          elements.subOptionsList.appendChild(opt);
        });
      } else {
        const opt = document.createElement('div');
        opt.className = 'option-item selected';
        opt.textContent = 'Default Track (Hindi / Stereo)';
        elements.subOptionsList.appendChild(opt);
      }
    } else if (menuType === 'subtitles') {
      elements.subTitle.textContent = 'Subtitles / Closed Captions';
      const offOpt = document.createElement('div');
      offOpt.className = `option-item ${state.currentSubtitleIndex === -1 ? 'selected' : ''}`;
      offOpt.textContent = 'Off';
      offOpt.onclick = () => {
        if (state.hlsInstance) state.hlsInstance.subtitleTrack = -1;
        state.currentSubtitleIndex = -1;
        elements.currentSubtitlesLabel.textContent = 'Off';
        closeSettings();
        triggerHaptic('selection');
      };
      elements.subOptionsList.appendChild(offOpt);

      if (state.hlsSubtitleTracks && state.hlsSubtitleTracks.length > 0) {
        state.hlsSubtitleTracks.forEach((track, idx) => {
          const opt = document.createElement('div');
          opt.className = `option-item ${state.currentSubtitleIndex === idx ? 'selected' : ''}`;
          opt.textContent = track.name || track.lang || `Subtitle ${idx + 1}`;
          opt.onclick = () => {
            if (state.hlsInstance) state.hlsInstance.subtitleTrack = idx;
            state.currentSubtitleIndex = idx;
            elements.currentSubtitlesLabel.textContent = opt.textContent;
            showToast(`Subtitles: ${opt.textContent}`);
            closeSettings();
            triggerHaptic('selection');
          };
          elements.subOptionsList.appendChild(opt);
        });
      }
    } else if (menuType === 'speed') {
      elements.subTitle.textContent = 'Playback Speed';
      state.playbackSpeeds.forEach((speed) => {
        const opt = document.createElement('div');
        opt.className = `option-item ${elements.video.playbackRate === speed ? 'selected' : ''}`;
        opt.textContent = speed === 1.0 ? 'Normal (1x)' : `${speed}x`;
        opt.onclick = () => {
          elements.video.playbackRate = speed;
          elements.currentSpeedLabel.textContent = opt.textContent;
          showToast(`Speed: ${opt.textContent}`);
          closeSettings();
          triggerHaptic('selection');
        };
        elements.subOptionsList.appendChild(opt);
      });
    } else if (menuType === 'aspect') {
      elements.subTitle.textContent = 'Resize Mode (Aspect Ratio)';
      state.resizeModes.forEach((mode, idx) => {
        const opt = document.createElement('div');
        opt.className = `option-item ${state.currentResizeIndex === idx ? 'selected' : ''}`;
        opt.textContent = state.resizeModeNames[mode];
        opt.onclick = () => {
          state.currentResizeIndex = idx;
          state.resizeModes.forEach((m) => elements.container.classList.remove(m));
          elements.container.classList.add(mode);
          elements.currentAspectLabel.textContent = state.resizeModeNames[mode];
          showToast(`Aspect Ratio: ${state.resizeModeNames[mode]}`);
          closeSettings();
          triggerHaptic('selection');
        };
        elements.subOptionsList.appendChild(opt);
      });
    }
  }

  // --- Attach Event Listeners ---
  function initEvents() {
    // Play / Pause
    elements.btnPlayPause?.addEventListener('click', togglePlayPause);
    elements.btnPlayMini?.addEventListener('click', togglePlayPause);

    // Fast Rewind / Forward 10s
    elements.btnRewind?.addEventListener('click', () => seekRelative(-10));
    elements.btnForward?.addEventListener('click', () => seekRelative(10));

    // Fullscreen
    elements.btnFullscreen?.addEventListener('click', toggleFullscreen);

    // PiP
    elements.btnPip?.addEventListener('click', () => {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      } else if (elements.video.requestPictureInPicture) {
        elements.video.requestPictureInPicture().catch(() => {
          showToast('PiP not supported in this browser');
        });
      }
    });

    // Resize Mode
    elements.btnResizeMode?.addEventListener('click', cycleResizeMode);

    // Screen Lock
    elements.btnLock?.addEventListener('click', () => {
      state.isLocked = true;
      elements.lockOverlay.classList.remove('hidden');
      elements.controls.classList.add('controls-hidden');
      showToast('Screen Locked');
      triggerHaptic('medium');
    });

    elements.btnUnlock?.addEventListener('click', () => {
      state.isLocked = false;
      elements.lockOverlay.classList.add('hidden');
      showControls();
      showToast('Screen Unlocked');
      triggerHaptic('success');
    });

    // Resume Overlay Buttons
    elements.btnResumePlay?.addEventListener('click', () => {
      if (state.savedResumeTime > 0) {
        elements.video.currentTime = state.savedResumeTime;
        showToast(`Resumed from ${formatTime(state.savedResumeTime)}`);
      }
      hideResumeOverlay();
      playVideo();
      triggerHaptic('success');
    });

    elements.btnResumeRestart?.addEventListener('click', () => {
      elements.video.currentTime = 0;
      const key = getResumeKey(state.currentUrl, state.currentRawTitle);
      try { localStorage.removeItem(key); } catch (e) {}
      hideResumeOverlay();
      playVideo();
      showToast('Playing from beginning');
      triggerHaptic('medium');
    });

    // Settings Modal
    elements.btnSettings?.addEventListener('click', openSettings);
    elements.btnAudioTracks?.addEventListener('click', () => {
      openSettings();
      openSubMenu('audio');
    });
    elements.btnSubtitles?.addEventListener('click', () => {
      openSettings();
      openSubMenu('subtitles');
    });
    elements.btnCloseModal?.addEventListener('click', closeSettings);
    elements.modalBackdrop?.addEventListener('click', closeSettings);
    elements.btnSubBack?.addEventListener('click', showSettingsMain);

    document.querySelectorAll('.settings-item[data-menu]').forEach((item) => {
      item.addEventListener('click', () => {
        const menu = item.dataset.menu;
        if (menu) openSubMenu(menu);
      });
    });

    // Haptics Toggle
    elements.toggleHaptics?.addEventListener('change', (e) => {
      state.hapticsEnabled = e.target.checked;
      showToast(`Haptics ${state.hapticsEnabled ? 'Enabled' : 'Disabled'}`);
    });

    // Stats Diagnostics
    elements.btnStats?.addEventListener('click', () => {
      elements.statsOverlay.classList.toggle('hidden');
      triggerHaptic('selection');
    });
    elements.btnCloseStats?.addEventListener('click', () => {
      elements.statsOverlay.classList.add('hidden');
    });

    // Retry / Error Dismiss
    elements.btnRetryStream?.addEventListener('click', () => {
      hideError();
      loadSource(state.currentUrl, state.currentRawTitle, state.currentType);
    });
    elements.btnDismissError?.addEventListener('click', hideError);

    // Video Events
    elements.video.addEventListener('timeupdate', updateProgress);
    elements.video.addEventListener('play', () => {
      updatePlayIcons(true);
      showBuffering(false);
      resetControlsTimeout();
    });
    elements.video.addEventListener('pause', () => {
      updatePlayIcons(false);
      showControls();
      saveProgress();
    });
    elements.video.addEventListener('waiting', () => showBuffering(true));
    elements.video.addEventListener('playing', () => showBuffering(false));
    elements.video.addEventListener('loadeddata', () => showBuffering(false));
    elements.video.addEventListener('canplay', () => showBuffering(false));
    elements.video.addEventListener('canplaythrough', () => showBuffering(false));
    elements.video.addEventListener('seeked', () => showBuffering(false));

    // Save progress periodically every 4 seconds
    setInterval(saveProgress, 4000);
    window.addEventListener('beforeunload', saveProgress);

    // Telegram BackButton support
    if (tg?.BackButton) {
      tg.BackButton.show();
      tg.BackButton.onClick(() => {
        if (!elements.modalSettings.classList.contains('hidden')) {
          closeSettings();
        } else if (document.fullscreenElement) {
          toggleFullscreen();
        } else {
          saveProgress();
          tg.close();
        }
      });
    }

    // Initialize Scrub & Gestures
    initScrubEvents();
    initGestureLayer();
  }

  // --- Launch Parameter URL Handler (Deep link from Telegram Bot) ---
  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const startParam = tg?.initDataUnsafe?.start_param || params.get('tgWebAppStartParam');
    const rawUrl = params.get('url') || params.get('src') || startParam;
    const title = params.get('title') || 'CineFlix Movie';
    const type = params.get('type');

    // Dynamic metadata from params
    const year = params.get('year') || '2024';
    const rating = params.get('rating') || '8.7';
    const plot = params.get('plot') || params.get('overview') || params.get('desc');
    const dub = params.get('dub') || params.get('audio') || 'Hindi Dubbed';
    const genres = params.get('genres');

    if (elements.ottMovieTitle) elements.ottMovieTitle.textContent = title;
    const yearEl = document.getElementById('ott-movie-year');
    if (yearEl) yearEl.textContent = year;
    const ratingEl = document.getElementById('meta-rating-badge');
    if (ratingEl && rating) ratingEl.textContent = `⭐ ${rating}/10 IMDb`;
    const dubEl = document.getElementById('ott-movie-lang');
    if (dubEl && dub) dubEl.textContent = dub;
    const specAudioEl = document.getElementById('spec-audio');
    if (specAudioEl && dub) specAudioEl.textContent = `${dub} / Stereo`;

    if (plot) {
      const descEl = document.getElementById('ott-movie-desc');
      if (descEl) descEl.textContent = plot;
    }

    if (genres) {
      const genreListEl = document.getElementById('ott-genre-list');
      if (genreListEl) {
        const parts = genres.split(/[,|/]/).map(g => g.trim()).filter(Boolean);
        if (parts.length > 0) {
          genreListEl.innerHTML = parts.map(p => `<span class="genre-pill">${p}</span>`).join('');
        }
      }
    }

    if (rawUrl) {
      const parsed = parseInputString(rawUrl);
      const finalTitle = params.get('title') || parsed.title;
      const finalType = type || parsed.type;
      loadSource(parsed.url, finalTitle, finalType);
    } else {
      // Production Fallback Stream (Adaptive HLS)
      loadSource(
        'https://live.betadda.workers.dev/api/live/proxy.m3u8?url=http://51.75.127.199:3141/starsportskhel/index.m3u8',
        'Star Sports Hindi HD',
        'm3u8'
      );
    }

    if (elements.statTgVersion) {
      elements.statTgVersion.textContent = tg?.version || '7.0+ (TMA)';
    }
  }

  // Initialize CineFlix App
  document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    checkUrlParams();
  });

})();
