// continuousVoice.js

class ContinuousVoiceService {

    // errors that mean listening can never succeed in this context;
    // restarting after these would just spin forever
    static FATAL_ERRORS = ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'];

    constructor(lang = 'en-US', { preferOnDevice = true } = {}) {
        this.active = false;
        this.fatalError = false;

        // playback guard: while a page speaks (TTS), its own audio can be
        // picked up by the microphone and recognized as speech
        this.playbackGuard = false;
        this.wasListeningBeforePlayback = false;
        this.resumeTimer = null;
        this.playbackSettleMs = 300;

        // Chrome 139+ on-device (offline) recognition
        this.preferOnDevice = preferOnDevice;
        this.onDeviceStatus = 'unknown'; // 'unsupported' | 'unavailable' | 'downloading' | 'ready'

        this.recognition = null;
        this.lang = lang;

        this.lastStable = '';
        this.lastNewStable = '';

        this.lastInterim = '';
        this.lastNewInterim = '';

        this.currentTranscriptId = 0;
        this.lastTranscriptId = 0;

        this.lastRecognitionEvent = null;

        this.audio = {
            stream: null,
            context: null,
            source: null,
            isListeningForSound: false,
            isHearingSound: false,
            smoothingTimeConstant: 0.1,
            pollingInterval: 100,
            volumeThreshold: 10,
            silenceWindowSeconds: 2,
            silenceWindowIntervals: 10,
            history: new Array(10).fill(0),
            fftBins: new Float32Array(),
            byteTimeDomainData: new Uint8Array(),
            analyser: null,
            intervalFunction: null
        };

        if (this.speechRecognitionSupported()) {
            this.initRecognition();
            this.checkOnDevice();
        } else {
            console.log('Nope, no speech support');
            this.onDeviceStatus = 'unsupported';
        }
    }

    speechRecognitionSupported() {
        return typeof SpeechRecognition === 'function' || 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    }

    /* start on-device recognition : chrome 139+ can process speech locally,
       keeping audio private and working offline. unsupported browsers
       silently continue using the cloud recognition service. the language
       pack is never downloaded automatically - check onDeviceStatus and
       call enableOnDevice() (ideally from a user gesture) to install it. */
    onDeviceSupported() {
        return typeof SpeechRecognition === 'function' && typeof SpeechRecognition.available === 'function';
    }

    // passive check only: never downloads anything
    async checkOnDevice() {
        if (!this.preferOnDevice || !this.onDeviceSupported()) {
            this.onDeviceStatus = 'unsupported';
            this.dispatchEvent('onDeviceStatus', { status: this.onDeviceStatus });
            return this.onDeviceStatus;
        }
        const options = { langs: [this.lang || 'en-US'], processLocally: true };
        try {
            let status = await SpeechRecognition.available(options);
            if (status === 'available' || status === 'downloaded') {
                this.onDeviceStatus = 'ready';
                // read at start() time, so it is safe to set while not listening
                try {
                    this.recognition.processLocally = true;
                } catch (ex) { }
            } else if (status === 'downloadable') {
                this.onDeviceStatus = 'downloadable';
            } else {
                this.onDeviceStatus = 'unavailable';
            }
        } catch (ex) {
            // the API exists but the check failed this time;
            // the cloud path still works either way
            this.onDeviceStatus = 'unavailable';
        }
        this.dispatchEvent('onDeviceStatus', { status: this.onDeviceStatus });
        return this.onDeviceStatus;
    }

    // download the language pack and switch to local processing.
    // call from a user gesture (click/tap) so the browser allows the install.
    async enableOnDevice() {
        if (!this.onDeviceSupported()) {
            this.onDeviceStatus = 'unsupported';
            this.dispatchEvent('onDeviceStatus', { status: this.onDeviceStatus });
            return false;
        }
        const options = { langs: [this.lang || 'en-US'], processLocally: true };
        try {
            if (this.onDeviceStatus !== 'ready') {
                let status = await SpeechRecognition.available(options);
                if (status === 'downloadable' || status === 'downloading') {
                    this.onDeviceStatus = 'downloading';
                    this.dispatchEvent('onDeviceStatus', { status: this.onDeviceStatus });
                    const installed = await SpeechRecognition.install(options);
                    status = installed ? 'downloaded' : 'unavailable';
                }
                if (status === 'downloaded' || status === 'available') {
                    this.onDeviceStatus = 'ready';
                } else {
                    this.onDeviceStatus = 'unavailable';
                }
            }
            if (this.onDeviceStatus === 'ready') {
                try {
                    this.recognition.processLocally = true;
                } catch (ex) { }
                this.dispatchEvent('onDeviceStatus', { status: this.onDeviceStatus });
                return true;
            }
            this.dispatchEvent('onDeviceStatus', { status: this.onDeviceStatus });
            return false;
        } catch (ex) {
            this.onDeviceStatus = 'unavailable';
            this.dispatchEvent('onDeviceStatus', { status: this.onDeviceStatus });
            return false;
        }
    }
    /* end on-device recognition */

    /* start playback guard : call suspendForPlayback() when the page begins
       speaking (speech synthesis, soundboard, etc.) and resumeAfterPlayback()
       when it ends. recognition is suspended so the microphone does not
       transcribe the page's own voice, and resumes after a short settle delay
       so trailing audio is not caught either. */
    suspendForPlayback() {
        this.playbackGuard = true;
        if (this.resumeTimer) {
            clearTimeout(this.resumeTimer);
            this.resumeTimer = null;
        }
        if (this.active && !this.wasListeningBeforePlayback) {
            this.wasListeningBeforePlayback = true;
            try {
                // the native end event fires but restartListening ignores it
                // while the playback guard is active
                this.recognition.abort();
            } catch (ex) { }
        }
        return this.wasListeningBeforePlayback;
    }

    resumeAfterPlayback() {
        if (this.resumeTimer) {
            clearTimeout(this.resumeTimer);
        }
        this.resumeTimer = setTimeout(() => {
            this.resumeTimer = null;
            this.playbackGuard = false;
            if (this.wasListeningBeforePlayback) {
                this.wasListeningBeforePlayback = false;
                this.startListening();
            }
        }, this.playbackSettleMs);
    }
    /* end playback guard */

    initRecognition() {
        this.recognition = null;
        if (typeof SpeechRecognition === 'function') {
            this.recognition = new SpeechRecognition();
        } else if ('SpeechRecognition' in window) {
            this.recognition = new window.SpeechRecognition();
        } else if ('webkitSpeechRecognition' in window) {
            this.recognition = new window.webkitSpeechRecognition();
        } else {
            console.error('Speech Recognition not supported.');
            return;
        }
        if (!this.recognition) {
            console.error('Speech Recognition not found.');
            return;
        }

        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.lang || 'en-US';
        this.recognition.maxAlternatives = 1;

        this.recognition.onresult = this.handleResult.bind(this);

        this.recognition.addEventListener('error', (event) => {
            if (event.error === 'language-not-supported') {
                this.active = false;
                this.fatalError = true;
                this.stopMonitoringAudio();
                this.recognition.abort();
                return;
            }
            if (ContinuousVoiceService.FATAL_ERRORS.includes(event.error)) {
                // permission or hardware problems: stop cleanly, do not restart
                this.fatalError = true;
                this.stopListening(event);
            }
        });

        this.recognition.addEventListener('end', (event) => {
            this.restartListening(event);
        });

        // any interim result counts as "hearing sound" for silence detection
        this.recognition.addEventListener('interimResult', () => {
            this.audio.isHearingSound = true;
        });
    }

    addEventListener(name, func) {
        this.recognition.addEventListener(name, func);
    }

    removeEventListener(name, func) {
        this.recognition.removeEventListener(name, func);
    }

    async startListening(event = null) {
        try {
            this.fatalError = false;
            if (!this.active) {
                this.active = true;
                this.dispatchEvent('listenStart', this.lastRecognitionEvent);
            }
            this.recognition.start();
            await this.startMonitoringAudio();
        } catch (ex) { }
    }

    stopListening(event = null) {
        try {
            // an explicit stop cancels any pending playback-guard resume
            this.playbackGuard = false;
            this.wasListeningBeforePlayback = false;
            if (this.resumeTimer) {
                clearTimeout(this.resumeTimer);
                this.resumeTimer = null;
            }
            this.lastRecognitionEvent = this.recognition.stop();
            if (this.lastRecognitionEvent) {
                this.finalize(event);
                this.handleResult(this.lastRecognitionEvent);
            }
            if (this.active) {
                this.active = false;
                this.stopMonitoringAudio();
                this.dispatchEvent('listenStop', this.lastRecognitionEvent);
            }
        } catch (ex) {
            if (this.active) {
                this.active = false;
                this.stopMonitoringAudio();
                this.dispatchEvent('listenStop', this.lastRecognitionEvent);
            }
        }
    }

    restartListening(event) {
        if (!this.active || this.fatalError || this.playbackGuard) {
            return false;
        }
        this.startListening(event);
        return true;
    }

    rolloverTranscriptId() {
        // transcript is attached to a global instance of a listener
        // so no matter what is going on internally with the speech recognition
        //  this service will be tracking a single transcript at a time between starts and stops
        this.currentTranscriptId++;
        return this.currentTranscriptId;
    }

    finalize(event = null) {
        try {
            this.lastRecognitionEvent = this.recognition.stop();
            if (this.lastRecognitionEvent) {
                this.handleResult(this.lastRecognitionEvent);
            }
        } catch (ex) { }
    }

    // return the part of `current` that comes after `previous`,
    // or all of `current` when it does not continue `previous`
    diffSuffix(previous, current) {
        if (previous && current.startsWith(previous)) {
            return current.slice(previous.length).trim();
        }
        return current;
    }

    handleResult(event) {
        let isFinal = false;

        // categorize into stable and unstable/interim
        let currInterim = [];
        let currStable = [];
        for (let r = 0; r < event.results.length; r++) {
            isFinal = isFinal || event.results[r].isFinal;
            currStable.push(event.results[r][0].transcript.trim());
        }

        // scrub listener of this data
        if (isFinal) {
            // this causes a small downtime in listening
            try {
                this.recognition.abort();
            } catch (ex) { }
        }

        /// convert to strings
        if (isFinal) {
            currInterim = '';
        } else {
            currInterim = currStable.pop().trim();
        }
        currStable = currStable.join(' ').trim();

        let newInterim = this.diffSuffix(this.lastInterim, currInterim);
        let newStable = this.diffSuffix(this.lastStable, currStable);
        let currFull = (currStable + ' ' + currInterim).trim();
        let lastFull = (this.lastStable + ' ' + this.lastInterim).trim();

        // determine which events need to be dispatched
        if (currInterim && currFull !== lastFull) {
            this.dispatchEvent('interimResult', { transcript: currFull, stable: currStable, interim: currInterim, new: newInterim, id: this.currentTranscriptId, isInterim: true, isStable: false, isFinal: false });
        }
        if (currStable && currStable !== this.lastStable) {
            this.dispatchEvent('stableResult', { transcript: currStable, stable: currStable, interim: currInterim, new: newStable, id: this.currentTranscriptId, isInterim: false, isStable: true, isFinal: false });
        }
        if (isFinal) {
            this.dispatchEvent('finalResult', { transcript: currFull, stable: currFull, interim: currFull, new: currFull, id: this.currentTranscriptId, isInterim: false, isStable: false, isFinal: true });
        }

        // cleanup
        this.lastTranscriptId = this.currentTranscriptId;
        if (isFinal) {
            this.lastInterim = '';
            this.lastNewInterim = '';
            this.lastStable = '';
            this.lastNewStable = '';
            this.rolloverTranscriptId();
        } else {
            this.lastInterim = currInterim;
            this.lastNewInterim = newInterim;
            this.lastStable = currStable;
            this.lastNewStable = newStable;
        }
        this.lastRecognitionEvent = event;
    }

    dispatchEvent(eventName, detail) {
        if (!this.recognition) {
            return;
        }
        const event = new CustomEvent(eventName, { detail });
        this.recognition.dispatchEvent(event);
    }

    /* start direct audio monitoring : safari mac doesn't send END events */
    async initializeAudioMonitoring() {
        try {
            if (!this.audio.stream) {
                this.audio.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            if (!this.audio.stream) {
                return false;
            }

            let audioContextConstructor = null;
            if ('AudioContext' in window) {
                audioContextConstructor = window.AudioContext;
            } else if ('webkitAudioContext' in window) {
                audioContextConstructor = window.webkitAudioContext;
            }
            if (!audioContextConstructor) {
                return false;
            }

            this.audio.context = new audioContextConstructor();
            if (!this.audio.context) {
                return false;
            }

            if (this.audio.context && 'state' in this.audio.context && this.audio.context.state !== 'closed') {
                this.audio.analyser = this.audio.context.createAnalyser();
                this.audio.analyser.fftSize = 512;
                this.audio.analyser.smoothingTimeConstant = this.audio.smoothingTimeConstant;
                this.audio.fftBins = new Float32Array(this.audio.analyser.frequencyBinCount);
                this.audio.byteTimeDomainData = new Uint8Array(this.audio.analyser.fftSize);

                this.audio.source = this.audio.context.createMediaStreamSource(this.audio.stream);
                this.audio.source.connect(this.audio.analyser);
            }
        } catch (ex) {
            return false;
        }
        return true;
    }

    rms(dataArray) {
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        return Math.sqrt(sum / dataArray.length);
    }

    getAudioVolume() {
        if (!this.audio.analyser) {
            return 0;
        }
        let floatTimeDomainData = new Float32Array(this.audio.analyser.fftSize);
        this.audio.analyser.getFloatTimeDomainData(floatTimeDomainData);
        return this.rms(floatTimeDomainData) * 1000;
    }

    async startMonitoringAudio() {
        await this.initializeAudioMonitoring();
        clearInterval(this.audio.intervalFunction);
        this.audio.intervalFunction = setInterval(
            this.checkSoundLevel.bind(this),
            this.audio.pollingInterval
        );
    }

    stopMonitoringAudio() {
        this.audio.isHearingSound = false;
        clearInterval(this.audio.intervalFunction);
        this.audio.intervalFunction = null;
        // safari mac does not send a native END event when the recognizer stops,
        // so dispatch a synthetic one so restart logic can run
        if (this.recognition) {
            this.recognition.dispatchEvent(new CustomEvent(
                'end', { detail: { message: 'stopped' }, bubbles: true, cancelable: true }
            ));
        }
        if (this.audio.analyser) this.audio.analyser.disconnect();
        if (this.audio.source) this.audio.source.disconnect();
        if (this.audio.context) this.audio.context.close();
    }

    checkSoundLevel() {
        if (!this.active) return;

        let currentVolume = this.getAudioVolume();

        this.audio.history.push(currentVolume > this.audio.volumeThreshold ? 1 : 0);
        this.audio.history.shift();

        // number of times sound has been detected during the last X intervals
        let immediateIntervals = Math.floor(this.audio.silenceWindowIntervals / 2);
        let immediateSoundCount = this.audio.history.slice(-immediateIntervals).reduce((a, b) => a + b, 0);
        let recentSoundCount = this.audio.history.reduce((a, b) => a + b, 0);

        if (this.audio.isHearingSound && immediateSoundCount == 0 && recentSoundCount <= 2) {
            this.audio.isHearingSound = false;
            this.recognition.dispatchEvent(new CustomEvent(
                'end', { detail: { message: 'silence' }, bubbles: true, cancelable: true }
            ));
        }
    }
    /* end direct audio monitoring */
}

var ContinuousVoice = new ContinuousVoiceService();
