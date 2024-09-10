// continuousVoice.js


class ContinuousCommandsService extends ContinuousVoiceService {
    constructor() {
        super()
        this.commandCounter = 0
        this.commands = []
        this.longestTrigger = 0
        this.previouslyRunTranscriptCommands = []
    }

    metaphone(e){var a="X",r="0";return function(e){var i,b,k,o,f="",H=0;function S(e){f+=e}function A(a){return e.charAt(H+a).toUpperCase()}function C(e){return function(){return A(e)}}if(!(e=String(e||"")))return"";b=C(1),k=C(0),o=C(-1);for(;!u(k());){if(!k())return"";H++}switch(k()){case"A":"E"===b()?(S("E"),H+=2):(S("A"),H++);break;case"G":case"K":case"P":"N"===b()&&(S("N"),H+=2);break;case"W":"R"===b()?(S(b()),H+=2):"H"===b()?(S(k()),H+=2):t(b())&&(S("W"),H+=2);break;case"X":S("S"),H++;break;case"E":case"I":case"O":case"U":S(k()),H++}for(;k();)if(i=1,!u(k())||k()===o()&&"C"!==k())H+=i;else{switch(k()){case"B":"M"!==o()&&S("B");break;case"C":n(b())?"I"===b()&&"A"===A(2)?S(a):"S"!==o()&&S("S"):"H"===b()?(S(a),i++):S("K");break;case"D":"G"===b()&&n(A(2))?(S("J"),i++):S("T");break;case"G":"H"===b()?c(A(-3))||"H"===A(-4)||(S("F"),i++):"N"===b()?!u(A(2))||"E"===A(2)&&"D"===A(3)||S("K"):n(b())&&"G"!==o()?S("J"):S("K");break;case"H":t(b())&&!s(o())&&S("H");break;case"K":"C"!==o()&&S("K");break;case"P":"H"===b()?S("F"):S("P");break;case"Q":S("K");break;case"S":"I"!==b()||"O"!==A(2)&&"A"!==A(2)?"H"===b()?(S(a),i++):S("S"):S(a);break;case"T":"I"!==b()||"O"!==A(2)&&"A"!==A(2)?"H"===b()?(S(r),i++):"C"===b()&&"H"===A(2)||S("T"):S(a);break;case"V":S("F");break;case"W":t(b())&&S("W");break;case"X":S("KS");break;case"Y":t(b())&&S("Y");break;case"Z":S("S");break;case"F":case"J":case"L":case"M":case"N":case"R":S(k())}H+=i}return f}(e);function c(e){return"B"===(e=i(e))||"D"===e||"H"===e}function n(e){return"E"===(e=i(e))||"I"===e||"Y"===e}function t(e){return"A"===(e=i(e))||"E"===e||"I"===e||"O"===e||"U"===e}function s(e){return"C"===(e=i(e))||"G"===e||"P"===e||"S"===e||"T"===e}function u(e){var a=function(e){return i(e).charCodeAt(0)}(e);return a>=65&&a<=90}function i(e){return String(e).charAt(0).toUpperCase()}};

    addCommand(triggerTexts, action) {
        if (!Array.isArray(triggerTexts)) {
            triggerTexts = [triggerTexts];
        }
        let commandId = this.commandCounter++
        let longestTrigger = 0
        let triggers = []
        for ( let c in triggerTexts ) {
            let _text = triggerTexts[c]
            let _tokens = triggerTexts[c].split(' ')
            let _metaphoneTokens = _tokens.map(token => token[0] === '$' ? token : this.metaphone(token));
            triggers.push({
                text: _text,
                tokens: _tokens,
                metaphone: _metaphoneTokens.join(' '),
                metaphoneTokens: _metaphoneTokens
            })
            if (_tokens.length) {
                if (_tokens.length > longestTrigger) {
                    longestTrigger = _tokens.length;
                }
                if (_tokens.length > this.longestTrigger) {
                    this.longestTrigger = _tokens.length;
                }
            }
        }
        let sortedTriggers = triggers.sort((a, b) =>
            b.tokens.length - a.tokens.length
        );
        this.commands.push({
            id: commandId,
            triggers: sortedTriggers,
            action: action,
            longestTrigger: longestTrigger,
        });
        let sortedCommands = this.commands.sort((a, b) =>
            b.longestTrigger - a.longestTrigger
        );
        this.commands = sortedCommands;
    }
    
    findCommandsInText(text) {
        let processedText;
        if (typeof text === 'string') {
            let _tokens = text.split(' ');
            let _metaphoneTokens = _tokens.map(token => token[0] === '$' ? token : this.metaphone(token));
            processedText = {
                text: text,
                tokens: _tokens,
                metaphone: _metaphoneTokens.join(' '),
                metaphoneTokens: _metaphoneTokens
            };
        } else {
            processedText = text; // maybe this is already been processed
        }
        if (!('metaphoneTokens' in processedText) || !processedText.metaphone || processedText.metaphone.length <= 0) {
            return [];
        }

        let foundCommands = [];
        let usedTokens = new Set();

        for (let command of this.commands) {
            // text must be at least as long as the longest command trigger
            for (let trigger of command.triggers) {

                // if we start matching at the end of the string, and more words might possibly continue the match
                // then we should not bother trying to match any shorter triggers and just wait for more speech

                // find trigger within text
                let matchIndexes = this.searchSet(trigger.metaphoneTokens, processedText.metaphoneTokens);
                if ( !matchIndexes.length ) {
                    continue;
                }

                for ( let matchIndex of matchIndexes ) {
                    // ignore matches containing tokens that are part of other commands
                    let tokensInUse = false;
                    let endTokenIndex = matchIndex + trigger.tokens.length;
                    for (let i = matchIndex; i < endTokenIndex; i++) {
                        if (usedTokens.has(i)) {
                            tokensInUse = true;
                        }
                    }    
                    if (tokensInUse) {
                        continue;
                    }
                    // calculate char and token indexes
                    let startCharIndex = processedText.tokens.slice(0, matchIndex).join(' ').length;
                    let endCharIndex = processedText.tokens.slice(0, endTokenIndex).join(' ').length;
                    
                    // identify parameters
                    let params = {}
                    for (let p=matchIndex, c=0; p < endTokenIndex; p++, c++) {
                        if (trigger.tokens[c] && trigger.tokens[c][0] === '$') {
                            params[trigger.tokens[c]] = processedText.tokens[p];
                        }
                    }
                    
                    // register command as found
                    foundCommands.push({
                        command: command,
                        startTokenIndex: matchIndex,
                        endTokenIndex: endTokenIndex,
                        startCharIndex: startCharIndex,
                        endCharIndex: endCharIndex,
                        params: params
                    });
    
                    // Mark matched tokens as used
                    for (let i = matchIndex; i < endTokenIndex; i++) {
                        usedTokens.add(i);
                    }    
                }
            }
        }
    
        // Sort found commands by their start index
        foundCommands.sort((a, b) => a.startTokenIndex - b.startTokenIndex);
    
        return foundCommands;
    }
    searchSet( subset, set, startIndex=0 ) {
        if ( !subset || !set) {
            return [];
        }
        let foundAt = [];
        let maxIndex = set.length - subset.length;
        for (let i = startIndex; i <= maxIndex; i++) {
            if (set.slice(i, i + subset.length).every((val, index) => 
                (val === subset[index] || subset[index][0] === '$') 
            )) {
                foundAt.push(i);
                i += subset.length - 1;
            }
        }
        return foundAt;
    }
    runCommandsInText(text) {
        // Get commands from the stable text
        const extractedCommands = this.findCommandsInText( text );
        if (extractedCommands.length === 0) {
            return [];
        }

        // Ensure we track previously run commands at this transcript position
        let previouslyRunTranscriptCommands = [];

        // Process each command
        let commandResults = [];
        for (let extractedCommand of extractedCommands) {
            if (!previouslyRunTranscriptCommands.includes(extractedCommand.startTokenIndex)) {
                // Execute the command
                commandResults.push({ 
                    command:extractedCommand.text, 
                    result:this.executeCommand(extractedCommand) 
                });
                // Remember that we executed this command for this transcript position
                previouslyRunTranscriptCommands.push(extractedCommand.startTokenIndex);
            }
        }
        return commandResults
    }
    runCommandsInSpeechEvent(event) {
        // Get commands from the stable text
        let source = event.detail.transcript;
        const extractedCommands = this.findCommandsInText( source );
        if (extractedCommands.length === 0) {
            return [];
        }

        // Ensure we track previously run commands in this transcript id
        if (!this.previouslyRunTranscriptCommands[event.detail.id]) {
            this.previouslyRunTranscriptCommands[event.detail.id] = new Set();
        }
        // Process each command
        let commandResults = [];
        for (let extractedCommand of extractedCommands) {
            if (!this.previouslyRunTranscriptCommands[event.detail.id].has(extractedCommand.startTokenIndex)) {
                // Execute the command
                commandResults.push({ 
                    command:extractedCommand.text, 
                    result:this.executeCommand(extractedCommand) 
                });
                // Remember that we executed this command for this transcript position
                this.previouslyRunTranscriptCommands[event.detail.id].add(extractedCommand.startTokenIndex);
            }
        }
        return commandResults
    }
    executeCommand(command) {
        if ( typeof command.command.action === 'function' ) {
            return command.command.action(command.params)
        }
        return null
    }
}


var ContinuousCommands = new ContinuousCommandsService();