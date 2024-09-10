// continuousVoice.js

var lastT = new Date().getTime();
function tdiff() {
    let t = new Date().getTime();
    let diff = t - lastT;
    lastT = t;
    return diff;
}

class ContinuousVoiceService {
    constructor(lang='en-US') {
        this.active = false;

        this.recognition = null;
        this.lang = lang;
        
        this.lastStable = "";
        this.lastNewStable = "";
        
        this.lastInterim = "";
        this.lastNewInterim = "";

        this.currentTranscriptId = 0;
        this.lastTranscriptId = 0;

        this.lastRecognitionEvent = null;

        this.audio = {
            stream: null,
            context: null,
            source: null,
            isListeningForSound: false,
            isHearingSound:false,
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
        }

        if ( this.speechRecognitionSupported() ) {
            this.initRecognition();
        } else {
            console.log('Nope, no speech support')
        }

    }

    speechRecognitionSupported() {
        return typeof SpeechRecognition === 'function' || 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    }
    initRecognition() {
        this.recognition = null
        if ( typeof SpeechRecognition === 'function' ) {
            this.recognition = new SpeechRecognition();
        } else if ( 'SpeechRecognition' in window ) {
            this.recognition = new window.SpeechRecognition();
        } else if ( 'webkitSpeechRecognition' in window ) {
            this.recognition = new window.webkitSpeechRecognition();
        } else {
            console.error('Speech Recognition not supported.');
            return;
        }
        if ( ! this.recognition ) { 
            console.error('Speech Recognition not found.');
            return; 
        }
        
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        // this.recognition.lang = this.lang || 'en-US';
        this.recognition.maxAlternatives = 1;

        this.recognition.onresult = this.handleResult.bind(this);
        
        this.recognition.addEventListener("error",(ee) => {
            if ( ee.error === 'language-not-supported' ) {
                this.active = false;
                this.stopMonitoringAudio();
                this.recognition.abort();
            }
        })

        this.recognition.addEventListener("end",(ee) => {
            ContinuousVoice.restartListening(ee);
        })

    }
    addEventListener(name,func) {
        this.recognition.addEventListener(name,func);
    }
    removeEventListener(name,func) {
        this.recognition.removeEventListener(name,func);
    }
    async startListening(ee) {
        // console.log('startListening',ee)
        try {
            if (!this.active) {
                this.active = true
                this.dispatchEvent('listenStart', this.lastRecognitionEvent );     
            }
            this.recognition.start();
            await this.startMonitoringAudio();
        } catch (ex) { }
    }
    stopListening(ee) {
        try {
            this.lastRecognitionEvent = this.recognition.stop();
            if ( this.lastRecognitionEvent ) {
                this.finalize(ee)
                this.handleResult(this.lastRecognitionEvent)
            }
            if (this.active) {
                this.active = false;
                this.stopMonitoringAudio();
                this.dispatchEvent('listenStop', this.lastRecognitionEvent );     
            }
        } catch (ex) {
            if (this.active) {
                this.active = false;
                this.stopMonitoringAudio();
                this.dispatchEvent('listenStop', this.lastRecognitionEvent );     
            }
        }
    }
    restartListening(ee) {
        if (!this.active) {
            return
        }
        try {
            if ( ee.type === 'error' ) {
                if ( ee.error === 'end' ) {
                    this.startListening(ee);
                    return true;
                }
            }
            if ( ee.type === 'end' ) {
                this.startListening(ee);
                return true;
            }
        } catch (ex) { }
        return false;
    }
    rolloverTranscriptId() {
        // transcript is attached to a global instance of a listener
        // so no matter what is going on internally with the speech recognition
        //  this service will be tracking a single transcript at a time between starts and stops
        this.currentTranscriptId++;
        return this.currentTranscriptId;
    }
    finalize(ee=null) {
        try {
            this.lastRecognitionEvent = this.recognition.stop();
            if ( this.lastRecognitionEvent ) {
                this.handleResult(this.lastRecognitionEvent)
            }
        } catch (ex) { }
    }
    handleResult(event) {
        let isFinal = false

        // categorize into stable and unstable/interim
        let currInterim = []
        let currStable = []
        for (let r = 0; r < event.results.length; r++) {
            isFinal = isFinal || event.results[r].isFinal;
            currStable.push(event.results[r][0].transcript.trim());
        }

        // scrub listener of this data 
        if ( isFinal ) {
            // this causes a small downtime in listening
            try {
                this.recognition.abort();
            } catch (ex) { }
        }

        /// convert to strings
        if ( isFinal ) {
            currInterim = "";
        } else {
            currInterim = currStable.pop().trim();
        }
        currStable = currStable.join(" ").trim();
        let newInterim = currInterim.trim().replace(new RegExp('^' + this.lastInterim.trim()), '').trim();
        let newStable = currStable.trim().replace(new RegExp('^' + this.lastStable.trim()), '').trim();
        let currFull = (currStable + ' ' + currInterim).trim();
        let lastFull = (this.lastStable + ' ' + this.lastInterim).trim();

        // determine which events need to be dispatched
        if (currInterim && currFull !== lastFull) {
            this.dispatchEvent('interimResult', { transcript: currFull, stable: currStable, interim: currInterim, new: newInterim, id: this.currentTranscriptId, isInterim:true, isStable:false, isFinal:false });
        }
        if (currStable && currStable !== this.lastStable) {
            this.dispatchEvent('stableResult', { transcript: currStable, stable: currStable, interim: currInterim, new: newStable, id: this.currentTranscriptId, isInterim:false, isStable:true, isFinal:false });
        }
        if (isFinal) {
            this.dispatchEvent('finalResult', { transcript: currFull, stable: currFull, interim: currFull, new: currFull, id: this.currentTranscriptId, isInterim:false, isStable:false, isFinal:true });
        }

        // cleanup
        this.lastTranscriptId = this.currentTranscriptId
        if (isFinal) {
            this.lastInterim = "";
            this.lastNewInterim = "";
            this.lastStable = "";
            this.lastNewStable = "";
            this.rolloverTranscriptId()
        } else {
            this.lastInterim = currInterim; 
            this.lastNewInterim = newInterim;
            this.lastStable = currStable;
            this.lastNewStable = newStable;
        }
        this.lastRecognitionEvent = event
    }
    dispatchEvent(eventName, detail) {
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
            if ( 'AudioContext' in window ) {
                audioContextConstructor = window.AudioContext;
            } else if ( 'webkitAudioContext' in window ) {
                audioContextConstructor = window.webkitAudioContext;
            }
            if (!audioContextConstructor) { 
                return false; 
            }

            this.audio.context = new audioContextConstructor();
            if (!this.audio.context) { 
                return false; 
            }

            if ( this.audio.context && 'state' in this.audio.context &&  this.audio.context.state !== 'closed' ) {
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
        let floatTimeDomainData = new Float32Array(this.audio.analyser.fftSize);
        return this.rms(floatTimeDomainData) * 1000;
    }
    async startMonitoringAudio() {
        let needsEndEventFix = false
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.indexOf('safari') > -1 && userAgent.indexOf('macintosh') > -1) {
            if (!(userAgent.indexOf('chrome') > -1)) {
                needsEndEventFix = true
            }
        }
        // if ( !needsEndEventFix ) { return; }

        await this.initializeAudioMonitoring();
        clearInterval(this.audio.intervalFunction)
        this.audio.intervalFunction = setInterval( 
            this.checkSoundLevel.bind(this), 
            this.audio.pollingInterval
        );

        this.recognition.addEventListener('interimResult',(ee) => {
            this.audio.isHearingSound = true;
        })
    }
    stopMonitoringAudio() {
        this.audio.isHearingSound = false;
        clearInterval( this.audio.intervalFunction );
        this.audio.intervalFunction = null;
        // maybe also send audioEnd and speechEnd?
        this.recognition.dispatchEvent(new CustomEvent(
            'end', { detail: { message: 'stopped' }, bubbles: true, cancelable: true }
        ));
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
        let immediateIntervals = Math.floor(this.audio.silenceWindowIntervals/2);
        let immediateSoundCount = this.audio.history.slice(-immediateIntervals).reduce((a, b) => a + b, 0);
        let recentSoundCount = this.audio.history.reduce((a, b) => a + b, 0);

        if ( this.audio.isHearingSound && immediateSoundCount == 0 && recentSoundCount <= 2 ) {
            this.audio.isHearingSound = false;
            this.recognition.dispatchEvent(new CustomEvent(
                'end', { detail: { message: 'silence' }, bubbles: true, cancelable: true }
            ));
        }
    }
    /* end direct audio monitoring */    
}
var ContinuousVoice = new ContinuousVoiceService();