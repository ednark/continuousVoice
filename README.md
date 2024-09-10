# ContinuousVoice.js 

A JavaScript Library that use Web Speech API to continuously listen for events. Just include the library directly in the head of you html document and attach a listener.

```html
<html>
<head>
    <script src="./continuousVoice.js"></script>
</head>
<body>
    <p id="content">speech</p>
    <script>

        ContinuousVoice.addEventListener('interimResult',(speechEvent) => {
            document.getElementById('speech').innerHTML = speechEvent.detail.transcript;
        })

    </script>
</body>
</html>
```

There are other nice libraries like [Annyang](https://www.talater.com/annyang/) that make voice integration easy, but they are not targeted towards handling immediate commands found during ongoing continuous speech. They usually have to wait for the speech to stop in order to properly process things. This library is an attempt to handle the special continuous listening case.

Several usage examples are included starting from the main index.html.

Browser support for the Web Speech API has not been as broad as could be, and only Chrome works for all the examples on all the systems.
