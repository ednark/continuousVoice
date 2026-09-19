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

The service automatically *detects* on-device (offline) recognition capability using `SpeechRecognition.available()`. It never downloads anything on its own — when the status is `'downloadable'`, install the language pack explicitly, ideally from a click handler so the browser allows it:

```js
const voice = new ContinuousVoiceService('en-US', { preferOnDevice: false }); // opt out entirely

button.addEventListener('click', async () => {
    if (await voice.enableOnDevice()) {
        // recognition now runs locally: offline, audio never leaves the device
    }
});
```

The current status is available on `ContinuousVoice.onDeviceStatus` (`'unsupported'`, `'unavailable'`, `'downloadable'`, `'downloading'`, `'ready'`) and as `'onDeviceStatus'` custom events. Unsupported browsers silently continue using cloud recognition.

## Playback guard

If the page itself speaks (speech synthesis, sound effects), its own audio can be picked up by the microphone and transcribed. Suspend recognition while audio plays and resume it afterward — recognition restarts automatically after a short settle delay:

```js
utterance.onstart = () => ContinuousVoice.suspendForPlayback();
utterance.onend   = () => ContinuousVoice.resumeAfterPlayback();
```

An explicit `ContinuousVoice.stopListening()` always wins and cancels any pending resume.

## Pattern commands

`continuousCommandsRegex.js` adds configurable triggers on top of `ContinuousCommands`. Commands are authored as readable patterns instead of literal word lists — literal words match phonetically, so misheard words still trigger:

```html
<script src="./continuousVoice.js"></script>
<script src="./continuousCommands.js"></script>
<script src="./continuousCommandsRegex.js"></script>
```

```js
const commands = new ContinuousRegexCommandsService();

commands.addRegexCommand('say hello (to)? $who', (params) => {
    return `Hello, ${params.who}!`;
});
commands.addRegexCommand('go (to|towards) the kitchen', () => {
    return 'Off to the kitchen.';
});
commands.addRegexCommand('(please)? move *direction', (params) => {
    return `Moving ${params.direction}`;
});
```

| Token | Meaning |
| :--- | :--- |
| `word` | matched phonetically |
| `(word)?` | optional word or group |
| `(a\|b)` / `(a\|b)?` | required / optional choice |
| `$name` | captures one word as `params.name` |
| `*name` | captures all remaining words as `params.name` |

Patterns compile once into regexes with named capture groups keeping the author's parameter names, and matches are mapped back to the original spoken words. See [pattern-commands.html](https://ednark.github.io/continuousVoice/pattern-commands.html) for a live workspace with a no-microphone phrase tester.

Several usage examples are included starting from the main index.html.

Browser support for the Web Speech API has not been as broad as could be, and only Chrome works for all the examples on all the systems.
