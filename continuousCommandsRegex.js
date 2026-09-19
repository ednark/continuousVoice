// continuousCommandsRegex.js
//
// Adds configurable, pattern-based commands on top of ContinuousCommands.
// Triggers are authored as readable patterns instead of literal word lists:
//
//   'say hello (to)? $who'      optional words in ( ... )?
//   'go (to|towards) the $place' alternatives inside ( ... | ... )
//   '$name'                      single-word parameter
//   '*name'                      multi-word (greedy) parameter
//
// Literal words are matched phonetically (metaphone), so misheard words
// still match. Patterns are compiled once into real RegExps with named
// capture groups that keep the author's original parameter names, and a
// char-to-token map is kept so match positions in the phonetic string
// can be translated back to the original spoken words.

class ContinuousRegexCommandsService extends ContinuousCommandsService {

    constructor() {
        super();
        this.regexCommands = [];
        this.regexCommandCounter = 0;
    }

    // register a pattern-based command.
    //   pattern - see the syntax documented in the file header
    //   action  - function(params) called when the pattern is heard;
    //             params keys are the $/* names, values are the words heard
    addRegexCommand(pattern, action) {
        const compiled = this.compileCommandPattern(pattern);
        const command = {
            id: 'regex-' + this.regexCommandCounter++,
            pattern: pattern,
            regex: compiled.regex,
            hasRequiredPiece: compiled.hasRequiredPiece,
            action: action
        };
        this.regexCommands.push(command);
        return command;
    }

    // ---- pattern compilation ------------------------------------------------

    // parse a pattern into an ordered list of pieces:
    //   { type: 'literal', words: [...] }
    //   { type: 'optional', alternatives: [ [words...], ... ] }
    //   { type: 'param', name }
    //   { type: 'splat', name }
    parseCommandPattern(pattern) {
        const pieces = [];
        const scanner = /\(([^()]+)\)(\?)?|(\$\w+)|(\*\w+)|(\s+)|([^\s$*()]+)/g;
        let match;
        while ((match = scanner.exec(pattern)) !== null) {
            if (match[1] !== undefined) {
                const alternatives = match[1].split('|').map(alt =>
                    alt.trim().split(/\s+/).filter(word => word.length > 0)
                );
                // ( ... )?  = optional choice, ( ... ) = required choice
                const type = (match[2] === undefined) ? 'choice' : 'optional';
                pieces.push({ type: type, alternatives: alternatives });
            } else if (match[3] !== undefined) {
                pieces.push({ type: 'param', name: match[3].slice(1) });
            } else if (match[4] !== undefined) {
                pieces.push({ type: 'splat', name: match[4].slice(1) });
            } else if (match[6] !== undefined) {
                pieces.push({ type: 'literal', words: [match[6]] });
            }
            // whitespace (match[5]) is dropped; pieces are joined flexibly
        }
        return pieces;
    }

    escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // compile a pattern into a RegExp over the metaphone transcript.
    // named groups keep the author's parameter names. the 'd' flag exposes
    // match indices so groups can be mapped back to original spoken words.
    compileCommandPattern(pattern) {
        const pieces = this.parseCommandPattern(pattern);
        let hasRequiredPiece = false;

        const sources = pieces.map(piece => {
            if (piece.type === 'literal') {
                hasRequiredPiece = true;
                return piece.words.map(word =>
                    '\\b' + (this.metaphone(word) || this.escapeRegex(word)) + '\\b'
                ).join('\\s*');
            }
            if (piece.type === 'choice') {
                hasRequiredPiece = true;
            }
            if (piece.type === 'optional' || piece.type === 'choice') {
                const alternatives = piece.alternatives.map(words =>
                    words.map(word => '\\b' + (this.metaphone(word) || this.escapeRegex(word)) + '\\b').join('\\s*')
                );
                return '(?:' + alternatives.join('|') + ')' + (piece.type === 'optional' ? '?' : '');
            }
            if (piece.type === 'param') {
                hasRequiredPiece = true;
                return '(?<' + piece.name + '>\\S+)';
            }
            // splat
            hasRequiredPiece = true;
            return '(?<' + piece.name + '>[\\s\\S]*)';
        });

        // anchor each match to whole tokens so short metaphones cannot match
        // inside longer words (e.g. T inside THREE)
        const source = '(?:^|\\s)(?:' + sources.join('\\s*') + ')(?=\\s|$)';
        return { regex: new RegExp(source, 'gd'), hasRequiredPiece: hasRequiredPiece };
    }

    // ---- matching -----------------------------------------------------------

    // convert speech text into a phonetic string plus a char->token map,
    // so regex matches can be translated back into original words
    buildPhoneticTranscript(text) {
        const tokens = text.trim().split(/\s+/).filter(token => token.length > 0);
        let phonetic = '';
        const ranges = [];
        tokens.forEach((token, tokenIndex) => {
            const start = phonetic.length;
            phonetic += this.metaphone(token);
            ranges.push({ start: start, end: phonetic.length, tokenIndex: tokenIndex });
            phonetic += ' ';
        });
        const tokenAt = (charIndex) => {
            for (const range of ranges) {
                if (charIndex >= range.start && charIndex < range.end) {
                    return range.tokenIndex;
                }
            }
            return null;
        };
        // token indexes covered by a char span [start, end)
        const tokensInSpan = (start, end) => {
            const indexes = [];
            for (const range of ranges) {
                if (range.end > start && range.start < end) {
                    indexes.push(range.tokenIndex);
                }
            }
            return indexes;
        };
        return { tokens, phonetic, tokenAt, tokensInSpan };
    }

    findRegexCommandsInText(text) {
        if (this.regexCommands.length === 0 || typeof text !== 'string' || !text.trim()) {
            return [];
        }
        const transcript = this.buildPhoneticTranscript(text);
        if (!transcript.phonetic) {
            return [];
        }

        const found = [];
        for (const command of this.regexCommands) {
            if (!command.hasRequiredPiece) {
                // a pattern made only of optional pieces would match anywhere
                continue;
            }
            for (const match of transcript.phonetic.matchAll(command.regex)) {
                if (match[0].trim() === '') {
                    continue;
                }
                const spanStart = match.index;
                const spanEnd = match.index + match[0].length;
                const spanTokens = transcript.tokensInSpan(spanStart, spanEnd);
                if (spanTokens.length === 0) {
                    continue;
                }

                // translate each named capture group back into spoken words
                const params = {};
                const groupIndices = match.indices && match.indices.groups ? match.indices.groups : {};
                for (const name in groupIndices) {
                    const groupSpan = groupIndices[name];
                    if (!groupSpan) {
                        params[name] = '';
                        continue;
                    }
                    const groupTokens = transcript.tokensInSpan(groupSpan[0], groupSpan[1]);
                    params[name] = groupTokens.map(i => transcript.tokens[i]).join(' ');
                }

                found.push({
                    command: command,
                    text: command.pattern,
                    startTokenIndex: spanTokens[0],
                    endTokenIndex: spanTokens[spanTokens.length - 1] + 1,
                    params: params
                });
            }
        }
        return found;
    }

    // extend the literal-word matcher with pattern-based matches
    findCommandsInText(text) {
        const literalMatches = super.findCommandsInText(text);
        const regexMatches = this.findRegexCommandsInText(text);
        if (regexMatches.length === 0) {
            return literalMatches;
        }
        return literalMatches.concat(regexMatches)
            .sort((a, b) => a.startTokenIndex - b.startTokenIndex);
    }
}
