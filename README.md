# ContinuousVoice.js 

A JavaScript Library that use Web Speech API to continuously listen for events. Just include the library directly in the head of you html document and attach a listener.

Visit the [Index page](https://ednark.github.io/continuousVoice/) to see some cool example usage.

```html
<html>
<head>
    <script src="./continuousVoice.js"></script>
</head>
<body>
    <p id="content">speech</p>
    <script>

        ContinuousVoice.addEventListener('interimResult',(speechEvent) => {
            document.getElementById('content').innerHTML = speechEvent.detail.transcript;
        })

    </script>
</body>
</html>
```

ContinuousVoice is a thin wrapper around the Web Speech API's speech recognition events. It exposes three new custom events: interimResults, stableResults, and finalResults. You can listen for these events and use them to trigger different behaviors.

There are other nice libraries like [Annyang](https://www.talater.com/annyang/) that make voice integration easy, but they are not targeted towards handling immediate commands found during ongoing continuous speech. They usually have to wait for the speech to stop in order to properly process things. This library is an attempt to handle the special continuous listening case.

## On-device recognition (Chrome 139+)

On supported browsers the service automatically checks for on-device (offline) recognition using `SpeechRecognition.available()`, installs the language pack if needed, and switches the recognizer to local processing so audio never leaves the device. It can be disabled with:

```js
const voice = new ContinuousVoiceService('en-US', { preferOnDevice: false });
```

The current status is available on `ContinuousVoice.onDeviceStatus` (`'unsupported'`, `'unavailable'`, `'downloading'`, `'ready'`) and as `'onDeviceStatus'` custom events. Unsupported browsers silently continue using cloud recognition.

## Playback guard

If the page itself speaks (speech synthesis, sound effects), its own audio can be picked up by the microphone and transcribed. Suspend recognition while audio plays and resume it afterward — recognition restarts automatically after a short settle delay:

```js
utterance.onstart = () => ContinuousVoice.suspendForPlayback();
utterance.onend   = () => ContinuousVoice.resumeAfterPlayback();
```

An explicit `ContinuousVoice.stopListening()` always wins and cancels any pending resume.

Several usage examples are included starting from the main index.html.

Browser support for the Web Speech API has not been as broad as could be, and only Chrome works for all the examples on all the systems.
