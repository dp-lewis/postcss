var CssSyntaxError = require('./css-syntax-error');

class Tokenizer {
    constructor(source, opts = { }) {
        this.opts   = opts;
        this.source = source;
        this.tokens = [];

        this.pos    = -1;
        this.line   = 1;
        this.column = 0;

        this.next   = this.source[0];
        this.letter = undefined;
    }

    loop() {
        var step;
        while ( this.move() ) {
            step = this.string() || this.comment() || this.brackets() ||
                   this.atWord() || this.char() || this.space() || this.word();
        }
    }

    string() {
        if ( this.letter != '"' && this.letter != "'" ) return;

        var start   = this.getSource();
        var quote   = this.letter;
        var escape  = false;
        var content = this.letter;
        while ( this.move() ) {
            content += this.letter;
            if ( escape ) {
                escape = false;
            } else if ( this.letter == '\\' ) {
                escape = true;
            } else if ( this.letter == quote ) {
                quote = false;
                break;
            }
        }

        if ( quote ) {
            if ( this.opts.safe ) {
                content += quote;
            } else {
                this.error('Unclosed quote', start);
            }
        }

        this.tokens.push(['string', content, start, this.getSource()]);
        return true;
    }

    comment() {
        if ( this.letter != '/' || this.next != '*' ) return false;

        var ended   = false;
        var start   = this.getSource();
        var content = this.letter + this.next;

        this.move();
        while ( this.move() ) {
            content += this.letter;
            if ( this.letter == '*' && this.next == '/' ) {
                this.move();
                content += this.letter;

                ended = true;
                break;
            }
        }

        if ( !ended ) {
            if ( this.opts.safe ) {
                content += '*/';
            } else {
                this.error('Unclosed comment', start);
            }
        }

        this.tokens.push(['comment', content, start, this.getSource()]);
        return true;
    }

    brackets() {
        if ( this.letter != '(' ) return false;

        var start   = this.getSource();
        var content = '(';
        while ( true ) {
            if ( !this.move() ) this.error('Unclosed bracket', start);
            content += this.letter;
            if ( this.letter == ')' ) break;
        }

        this.tokens.push(['brackets', content, start, this.getSource()]);
        return true;
    }

    atWord() {
        if ( this.letter != '@' ) return false;

        var start   = this.getSource();
        var content = '';
        while ( true ) {
            content += this.letter;
            if ( this.next && this.next.trim() === '' ) break;
            if ( this.next == '{' ) break;
            if ( this.next == '/' ) break;
            if ( !this.move() ) break;
        }

        this.tokens.push(['at-word', content, start]);
        return true;
    }

    char() {
        var letter = this.letter;
        if ( letter == ':' ) {
            this.tokens.push([letter, letter]);
            return true;
        } else if ( letter == '{' || letter == '}' || letter == ';' ) {
            this.tokens.push([letter, letter, this.getSource()]);
            return true;
        } else {
            return false;
        }
    }

    space() {
        if ( this.letter && this.letter.trim() !== '' ) return false;

        var content = '';
        while ( true ) {
            content += this.letter;
            if ( this.next && this.next.trim() !== '' ) break;
            if ( !this.move() ) break;
        }

        this.tokens.push(['space', content]);
        return true;
    }

    word() {
        var start  = this.getSource();
        var end    = start;
        var place  = this.tokens.length;
        var string = '';

        while ( true ) {
            string += this.letter;

            if ( this.next == '!' ) break;
            if ( !this.move() )     break;

            if ( this.string() || this.comment() || this.brackets() ||
                 this.atWord() || this.char()    || this.space() ) {
                break;
            }
            end = this.getSource();
        }

        this.tokens.splice(place, 0, ['word', string, start, end]);
        return true;
    }

    move() {
        this.pos += 1;
        if ( this.pos >= this.source.length ) return false;

        this.column += 1;
        this.letter  = this.next;
        this.next    = this.source[this.pos + 1];

        if ( this.letter == "\n" ) {
            this.line  += 1;
            this.column = 0;
        }

        return true;
    }

    getSource() {
        return { line: this.line, column: this.column };
    }

    error(message, pos) {
        throw new CssSyntaxError(message, this.source, pos, this.opts.from);
    }
}

module.exports = function (source, opts) {
    var tokenizer = new Tokenizer(source, opts);
    tokenizer.loop();
    return tokenizer.tokens;
};