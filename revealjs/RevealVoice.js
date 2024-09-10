// Global Reveal Object
var RevealVoice = {
    recognition: ContinuousVoice,
    commands: {},
    longestCommand: 0,
    liveTranscript: [],
    currTranscriptIndex: 0,
    previouslyRunTranscriptCommands: [],
    numberMapping: {
        "0": ["zero", "oh", "naught", "nil"],
        "1": ["one", "won"],
        "2": ["two", "to", "too"],
        "3": ["three", "tree"],
        "4": ["four", "for", "fore"],
        "5": ["five", "fife"],
        "6": ["six", "sics"],
        "7": ["seven", "sevin"],
        "8": ["eight", "ate"],
        "9": ["nine", "nein", "niner"],
        "10": ["ten", "tin"],
        "11": ["eleven", "elven", "levin"],
        "12": ["twelve", "twelv", "twelf"],
        "13": ["thirteen", "thirtean", "third teen"],
        "14": ["fourteen", "forteen", "fourth teen"],
        "15": ["fifteen", "fiften", "fifth teen"],
        "16": ["sixteen", "sicsteen", "sixth teen"],
        "17": ["seventeen", "sevinteen", "seventh teen"],
        "18": ["eighteen", "ateen", "eighth teen"],
        "19": ["nineteen", "ninetine", "ninth teen"],
        "20": ["twenty", "twenny", "twenti"],
        "21": ["twenty-one", "twenny-one"],
        "22": ["twenty-two", "twenny-two"],
        "23": ["twenty-three", "twenny-three"],
        "24": ["twenty-four", "twenny-four"],
        "25": ["twenty-five", "twenny-five"],
        "26": ["twenty-six", "twenny-six"],
        "27": ["twenty-seven", "twenny-seven"],
        "28": ["twenty-eight", "twenny-eight"],
        "29": ["twenty-nine", "twenny-nine"],
        "30": ["thirty", "thirty"],
        "31": ["thirty-one"],
        "32": ["thirty-two"],
        "33": ["thirty-three"],
        "34": ["thirty-four"],
        "35": ["thirty-five"],
        "36": ["thirty-six"],
        "37": ["thirty-seven"],
        "38": ["thirty-eight"],
        "39": ["thirty-nine"],
        "40": ["forty", "fourty"],
        "41": ["forty-one"],
        "42": ["forty-two"],
        "43": ["forty-three"],
        "44": ["forty-four"],
        "45": ["forty-five"],
        "46": ["forty-six"],
        "47": ["forty-seven"],
        "48": ["forty-eight"],
        "49": ["forty-nine"],
        "50": ["fifty", "fivety"],
        "51": ["fifty-one"],
        "52": ["fifty-two"],
        "53": ["fifty-three"],
        "54": ["fifty-four"],
        "55": ["fifty-five"],
        "56": ["fifty-six"],
        "57": ["fifty-seven"],
        "58": ["fifty-eight"],
        "59": ["fifty-nine"],
        "60": ["sixty"],
        "61": ["sixty-one"],
        "62": ["sixty-two"],
        "63": ["sixty-three"],
        "64": ["sixty-four"],
        "65": ["sixty-five"],
        "66": ["sixty-six"],
        "67": ["sixty-seven"],
        "68": ["sixty-eight"],
        "69": ["sixty-nine"],
        "70": ["seventy"],
        "71": ["seventy-one"],
        "72": ["seventy-two"],
        "73": ["seventy-three"],
        "74": ["seventy-four"],
        "75": ["seventy-five"],
        "76": ["seventy-six"],
        "77": ["seventy-seven"],
        "78": ["seventy-eight"],
        "79": ["seventy-nine"],
        "80": ["eighty"],
        "81": ["eighty-one"],
        "82": ["eighty-two"],
        "83": ["eighty-three"],
        "84": ["eighty-four"],
        "85": ["eighty-five"],
        "86": ["eighty-six"],
        "87": ["eighty-seven"],
        "88": ["eighty-eight"],
        "89": ["eighty-nine"],
        "90": ["ninety"],
        "91": ["ninety-one"],
        "92": ["ninety-two"],
        "93": ["ninety-three"],
        "94": ["ninety-four"],
        "95": ["ninety-five"],
        "96": ["ninety-six"],
        "97": ["ninety-seven"],
        "98": ["ninety-eight"],
        "99": ["ninety-nine"],
        "100": ["hundred", "one hundred"]
    },
    simulateKey: (key, code, keyCode) => {
        document.dispatchEvent(new KeyboardEvent("keydown", {
            key: key,
            code: code,
            keyCode: keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true
        }));
        document.dispatchEvent(new KeyboardEvent("keyup", {
            key: key,
            code: key,
            keyCode: keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true
        }));
    },
    startListening: () => {
        ContinuousVoice.addEventListener('stableResult',RevealVoice.updateLiveTranscript);
        ContinuousVoice.addEventListener('finalResult',RevealVoice.finalizeLiveTranscript);
        ContinuousVoice.startListening();
    },
    addEventListener: (name,func) => {
        ContinuousVoice.addEventListener(name,func)
    },
    removeEventListener: (name,func) => {
        ContinuousVoice.removeEventListener(name,func)
    },
    updateLiveTranscript: (event) => {
        RevealVoice.liveTranscript[RevealVoice.currTranscriptIndex] = {'event':event,'date':Date.now()}
        RevealVoice.checkForCommandsInSpeechEvent(RevealVoice.currTranscriptIndex, event.detail.stable);
    },
    finalizeLiveTranscript: (event) => {
        RevealVoice.checkForCommandsInSpeechEvent(RevealVoice.currTranscriptIndex, event.detail.transcript);        
        RevealVoice.currTranscriptIndex=RevealVoice.liveTranscript.length
    },
    addCommand: (commandTexts, action) => {
        if (!Array.isArray(commandTexts)) {
            commandTexts = [commandTexts];
        }
        for ( let c in commandTexts ) {
            let _text = commandTexts[c]
            let _tokens = commandTexts[c].split(' ')
            let _metaphoneTokens = _tokens.map(token => token[0] === '$' ? token : RevealVoice.metaphone(token));
            let _metaphone = _metaphoneTokens.join(' ') || ""
            if (_metaphoneTokens.length) {
                RevealVoice.commands[_text] = {
                    text: _text,
                    tokens: _tokens,
                    metaphone: _metaphone,
                    metaphoneTokens: _metaphoneTokens,
                    action: action
                };
                if (_metaphoneTokens.length > RevealVoice.longestCommand) {
                    RevealVoice.longestCommand = _metaphoneTokens.length;
                }
            }
        }
        let sortedCommands = Object.entries(RevealVoice.commands).sort((a, b) =>
            b[1].metaphoneTokens.length - a[1].metaphoneTokens.length
        );
        RevealVoice.commands = Object.fromEntries(sortedCommands);
    },
    findCommandsIn: (phrase) => {
        let processedPhrase;
        if (typeof phrase === 'string') {
            let _tokens = phrase.split(' ');
            let _metaphoneTokens = _tokens.map(token => token[0] === '$' ? token : RevealVoice.metaphone(token));
            processedPhrase = {
                text: phrase,
                tokens: _tokens,
                metaphone: _metaphoneTokens.join(' '),
                metaphoneTokens: _metaphoneTokens
            };
        } else {
            processedPhrase = phrase;
        }
    
        if (!('metaphoneTokens' in processedPhrase) || !processedPhrase.metaphone || processedPhrase.metaphone.length <= 0) {
            return [];
        }
    
        let foundCommands = [];
        let usedTokens = new Set();
    
        // Sort commands by length (longest first) to prioritize longer matches
        let sortedCommands = Object.values(RevealVoice.commands).sort((a, b) => 
            b.metaphoneTokens.length - a.metaphoneTokens.length
        );
        for (let command of sortedCommands) {
            let startTokenIndex = 0;
            while (startTokenIndex < processedPhrase.metaphoneTokens.length) {
                let matchIndex = RevealVoice.searchSet(command.metaphoneTokens, processedPhrase.metaphoneTokens, startTokenIndex);
                if (matchIndex === -1) break;
    
                let endTokenIndex = matchIndex + command.tokens.length;
                
                // Check if any of the tokens in this match have already been used
                let overlap = false;
                for (let i = matchIndex; i < endTokenIndex; i++) {
                    if (usedTokens.has(i)) {
                        overlap = true;
                        break;
                    }
                }
    
                if (!overlap) {
                    let startCharIndex = processedPhrase.tokens.slice(0, matchIndex).join(' ').length;
                    let endCharIndex = processedPhrase.tokens.slice(0, endTokenIndex).join(' ').length;
                    let params = {}
                    for (let p=matchIndex, c=0; p < endTokenIndex; p++, c++) {
                        if (command.tokens[c] && command.tokens[c][0] === '$') {
                            params[command.tokens[c]] = processedPhrase.tokens[p];
                        }
                    }
                    foundCommands.push({
                        command: command,
                        startTokenIndex: matchIndex,
                        endTokenIndex: endTokenIndex,
                        startCharIndex: startCharIndex,
                        endCharIndex: endCharIndex,
                        params: params
                    });
                    // Mark these tokens as used
                    for (let i = matchIndex; i < endTokenIndex; i++) {
                        usedTokens.add(i);
                    }
                }
    
                // Move to the next token, allowing for potential overlapping commands
                startTokenIndex = matchIndex + 1;
            }
        }
    
        // Sort found commands by their start index
        foundCommands.sort((a, b) => a.startTokenIndex - b.startTokenIndex);
    
        return foundCommands;
    },
    searchSet: ( subset, set, startIndex=0 ) => {
        let foundAt = -1;
        let maxIndex = set.length - subset.length;
        for (let i = startIndex; i <= maxIndex; i++) {
            if (set.slice(i, i + subset.length).every((val, index) => 
                (val === subset[index] || subset[index][0] === '$') 
            )) {
                foundAt = i;
                break;
            }
        }
        return foundAt;
    },
    checkForCommandsInSpeechEvent: (transcriptPosition, stableText) => {
        // Get commands from the stable text
        const extractedCommands = RevealVoice.findCommandsIn(stableText);
        // Ensure we track previously run commands at this transcript position
        if (!RevealVoice.previouslyRunTranscriptCommands[transcriptPosition]) {
            RevealVoice.previouslyRunTranscriptCommands[transcriptPosition] = [];
        }
        // Process each command
        for (let extractedCommand of extractedCommands) {
            if (!RevealVoice.previouslyRunTranscriptCommands[transcriptPosition].includes(extractedCommand.startTokenIndex)) {
                // Execute the command
                RevealVoice.executeCommand(extractedCommand);
                // Remember that we executed this command for this transcript position
                RevealVoice.previouslyRunTranscriptCommands[transcriptPosition].push(extractedCommand.startTokenIndex);
            }
        }
    },
    executeCommand: (command) => {
        // console.log(`Executing:`, command.command.text,",",command.command);
        if ( typeof command.command.action === 'function' ) {
            command.command.action(command.params)            
        }
    },
    wordToNumber: (word) => {
        if ( typeof word === 'number' ) return word;
        if (!word) return null;
        if ( typeof word !== 'string' ) return null;
        floatWord = parseFloat(word)
        if (!isNaN(floatWord)) {
            if (typeof floatWord === 'number') {
                return floatWord.toString();
            }
            return `${floatWord}`
        }
        word = word.toLowerCase().trim()
        if ( word === "" ) return null;
        for (let key in RevealVoice.numberMapping) {
            if (RevealVoice.numberMapping[key].includes(word)) {
                return key;
            }
        }
        return null; // Return null if no match is found
    },
    metaphone: (e) => {var a="X",r="0";return function(e){var i,b,k,o,f="",H=0;function S(e){f+=e}function A(a){return e.charAt(H+a).toUpperCase()}function C(e){return function(){return A(e)}}if(!(e=String(e||"")))return"";b=C(1),k=C(0),o=C(-1);for(;!u(k());){if(!k())return"";H++}switch(k()){case"A":"E"===b()?(S("E"),H+=2):(S("A"),H++);break;case"G":case"K":case"P":"N"===b()&&(S("N"),H+=2);break;case"W":"R"===b()?(S(b()),H+=2):"H"===b()?(S(k()),H+=2):t(b())&&(S("W"),H+=2);break;case"X":S("S"),H++;break;case"E":case"I":case"O":case"U":S(k()),H++}for(;k();)if(i=1,!u(k())||k()===o()&&"C"!==k())H+=i;else{switch(k()){case"B":"M"!==o()&&S("B");break;case"C":n(b())?"I"===b()&&"A"===A(2)?S(a):"S"!==o()&&S("S"):"H"===b()?(S(a),i++):S("K");break;case"D":"G"===b()&&n(A(2))?(S("J"),i++):S("T");break;case"G":"H"===b()?c(A(-3))||"H"===A(-4)||(S("F"),i++):"N"===b()?!u(A(2))||"E"===A(2)&&"D"===A(3)||S("K"):n(b())&&"G"!==o()?S("J"):S("K");break;case"H":t(b())&&!s(o())&&S("H");break;case"K":"C"!==o()&&S("K");break;case"P":"H"===b()?S("F"):S("P");break;case"Q":S("K");break;case"S":"I"!==b()||"O"!==A(2)&&"A"!==A(2)?"H"===b()?(S(a),i++):S("S"):S(a);break;case"T":"I"!==b()||"O"!==A(2)&&"A"!==A(2)?"H"===b()?(S(r),i++):"C"===b()&&"H"===A(2)||S("T"):S(a);break;case"V":S("F");break;case"W":t(b())&&S("W");break;case"X":S("KS");break;case"Y":t(b())&&S("Y");break;case"Z":S("S");break;case"F":case"J":case"L":case"M":case"N":case"R":S(k())}H+=i}return f}(e);function c(e){return"B"===(e=i(e))||"D"===e||"H"===e}function n(e){return"E"===(e=i(e))||"I"===e||"Y"===e}function t(e){return"A"===(e=i(e))||"E"===e||"I"===e||"O"===e||"U"===e}function s(e){return"C"===(e=i(e))||"G"===e||"P"===e||"S"===e||"T"===e}function u(e){var a=function(e){return i(e).charCodeAt(0)}(e);return a>=65&&a<=90}function i(e){return String(e).charAt(0).toUpperCase()}},
};

// Event listeners
window.addEventListener("DOMContentLoaded", (event) => {
    if ( !ContinuousVoice || !RevealVoice ) { return }

    RevealVoice.addCommand(['next slide', 
        'forward one slide','go to the next slide',
        'go on to the next slide',
        'go forward to the next slide',
        'go forward one slide','go forward a slide',

        'keep moving forward', 'lets move forward',
        'keep going forward', 'lets go forward',
        'to be moving on', 'keep moving on', 
        "lets move on",
        "lets continue on",
        'time to move on', 'time to continue on'
    ],() => {
        Reveal.next()
    });
    RevealVoice.addCommand(['previous slide',
        'last slide',
        'back one slide','go to the previous slide',
        'go back to the previous slide',
        'go back one slide','go back a slide', 
        'lets go back', 'lets head back'
    ],() => {
        Reveal.prev()
    });
    RevealVoice.addCommand(['next section', 
        'forward one section','go to the next section',
        'go forward to the next section',
        'go forward one section','go forward a section',
    ],() => {
        Reveal.right()
    });
    RevealVoice.addCommand(['previous section',
        'last section', 
        'back one section','go to the previous section',
        'go back to the previous section',
        'go back one section','go back a section',
    ],() => {
        Reveal.left()
    });
    RevealVoice.addCommand(['down a slide', 
        'keep moving down', 'move down',
        'down one slide', 'go back down', 'move back down'
    ],() => {
        Reveal.down()
    });
    RevealVoice.addCommand(['up a slide', 
        'keep moving up', 'move up',
        'up one slide', 'go back up', 'move back up'
    ],() => {
        Reveal.up()
    });
    RevealVoice.addCommand(['the presentation is over', 'this presentation is over',
        'this concludes the presentation', 'that concludes the presentation', 
        'this concludes our presentation', 'that concludes our presentation', 
        'this ends the presentation', 'that ends the presentation', 
        'this ends our presentation', 'that ends our presentation', 
        'we conclude the presentation', 'we conclude this presentation',
        'we conclude our presentation', 'we conclude our presentation',
        'we end the presentation', 'we end this presentation',
        'we end our presentation', 'we end our presentation',
        'the presentation is finished', 'go to the last slide', 'got to the final slide',
        'our presentation is finished', 'our presentation is over',
        'very last slide'
    ],() => {
        let totalSlides = Reveal.getTotalSlides();
        Reveal.slide(totalSlides);
    });
    RevealVoice.addCommand([
        'begining of the presentation', 'the start of the presentation',
        'restart the presentation'
    ],() => {
        Reveal.slide(0);
    });

    RevealVoice.addCommand(['show more',
        'show next',
        'reveal more', 'reveal next'
    ],() => {
        Reveal.nextFragment()
    });
    RevealVoice.addCommand(['show less',
        'show previous',
        'reveal less', 'reveal previous'
    ],() => {
        Reveal.prevFragment()
    });
    RevealVoice.addCommand(['toggle overview',
        'toggle navigation'
    ],() => {
        Reveal.toggleOverview()
    });

    RevealVoice.addCommand(['key left',
        'press left'
    ],() => {
        RevealVoice.simulateKey("ArrowLeft", "ArrowLeft", 37)        
    });
    RevealVoice.addCommand(['key right',
        'press right'
    ],() => {
        RevealVoice.simulateKey("ArrowRight", "ArrowRight", 39)
    });
    RevealVoice.addCommand(['key up',
        'press up'
    ],() => {
        RevealVoice.simulateKey("ArrowUp", "ArrowUp", 38)
    });
    RevealVoice.addCommand(['key down',
        'press down'
    ],() => {
        RevealVoice.simulateKey("ArrowDown", "ArrowDown", 40)
    });
    RevealVoice.addCommand(['key space',
        'press space'
    ],() => {
        RevealVoice.simulateKey(" ", "Space", 32)
    });

    
    RevealVoice.addCommand(['go to slide $slideNumber',
        'go to slide number $slideNumber'
    ],(params) => {
        slideNumber = RevealVoice.wordToNumber(params['$slideNumber']);
        slideString = `${slideNumber}`
        console.log('params',params,'slideNumber',slideNumber,'slideString',slideString)
        slideFinal = slideNumber
        if ( slideString.includes('-') ) {
            const [firstNum, secondNum] = slideString.split('-').map(num => parseInt(num));
            slideFinal = `${firstNum}/${secondNum}`
        }
        if ( slideString.includes('.') ) {
            const [firstNum, secondNum] = slideString.split('.').map(num => parseInt(num));
            slideFinal = `${firstNum}/${secondNum}`
        }
        if ( slideFinal !== null && slideFinal !== "" ) {
            try {
                Reveal.slide(slideFinal)
            } catch (ex) {
                console.error('Error on Reveal.slide(',slideFinal,'):', ex);
            }
        }
    });

});