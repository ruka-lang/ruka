/*
 *  @author: dwclake
 */

#include "../../includes/scanner.h"
#include "../../includes/compiler.h"

/* Predicate macros */
#define IS_DIGIT(c) c >= '0' && c <= '9'
#define IS_NUMERIC(c) IS_DIGIT(c) || c == '.'
#define IS_ALPHABETICAL(c) c >= 'a' && c <= 'z' || \
                           c >= 'A' && c <= 'Z'
#define IS_ALPHANUMERIC(c) IS_DIGIT(c) || IS_ALPHABETICAL(c) || \
                           c == '_' || c == '?' || c == '!'

/* Switch case macros */
#define DIGIT_CASE \
    case '0':        \
    case '1':        \
    case '2':        \
    case '3':        \
    case '4':        \
    case '5':        \
    case '6':        \
    case '7':        \
    case '8':        \
    case '9'

#define NUMERIC_CASE \
    case '0':        \
    case '1':        \
    case '2':        \
    case '3':        \
    case '4':        \
    case '5':        \
    case '6':        \
    case '7':        \
    case '8':        \
    case '9':        \
    case '.'

#define ALPHABETICAL_CASE \
    case 'a':             \
    case 'b':             \
    case 'c':             \
    case 'd':             \
    case 'e':             \
    case 'f':             \
    case 'g':             \
    case 'h':             \
    case 'i':             \
    case 'j':             \
    case 'k':             \
    case 'l':             \
    case 'm':             \
    case 'n':             \
    case 'o':             \
    case 'p':             \
    case 'q':             \
    case 'r':             \
    case 's':             \
    case 't':             \
    case 'u':             \
    case 'v':             \
    case 'w':             \
    case 'x':             \
    case 'y':             \
    case 'z':             \
    case 'A':             \
    case 'B':             \
    case 'C':             \
    case 'D':             \
    case 'E':             \
    case 'F':             \
    case 'G':             \
    case 'H':             \
    case 'I':             \
    case 'J':             \
    case 'K':             \
    case 'L':             \
    case 'M':             \
    case 'N':             \
    case 'O':             \
    case 'P':             \
    case 'Q':             \
    case 'R':             \
    case 'S':             \
    case 'T':             \
    case 'U':             \
    case 'V':             \
    case 'W':             \
    case 'X':             \
    case 'Y':             \
    case 'Z'

#define SYMBOL_CASE \
    case '!':       \
    case '@':       \
    case '#':       \
    case '$':       \
    case '%':       \
    case '^':       \
    case '&':       \
    case '*':       \
    case '(':       \
    case ')':       \
    case '-':       \
    case '\\':      \
    case '|':       \
    case '=':       \
    case '+':       \
    case '[':       \
    case ']':       \
    case '{':       \
    case '}':       \
    case '<':       \
    case '>':       \
    case ',':       \
    case '.':       \
    case '/':       \
    case '?':       \
    case '`':       \
    case '~':       \
    case ':':       \
    case ';':       \
    case '"':       \
    case '\''

#define WHITESPACE_CASE \
    case ' ':           \
    case '\t':          \
    case '\r':          \
    case '\n'

#define ALPHANUMERICAL_CASE \
    DIGIT_CASE:             \
    ALPHABETICAL_CASE

/* Keywords */
#define NUM_KEYWORDS 29
const char* KEYWORDS[NUM_KEYWORDS] = {
    "const",
    "let",
    "return",
    "fn",
    "record",
    "union",
    "trait",
    "module",
    "defer",
    "when",
    "inline",
    "true",
    "false",
    "for",
    "while",
    "break",
    "continue",
    "match",
    "if",
    "else",
    "as",
    "and",
    "or",
    "any",
    "use",
    "mut",
    "mov",
    "loc",
    "ctime"
};

/* Macro that writes characters from in_file to buffer while exp returns true
 * @param process The scanner process to get characters from
 * @param buffer The buffer to write the characters to
 * @param c The variable to store the current character in
 * @param exp The expression to determine when to stop looping
 * @return The return value is stored in buffer
 */
#define SCAN_GETC_IF(process, buffer, c, exp)               \
    for (c = peekc(process); exp; c = peekc(process)) {     \
        buffer_write(buffer, c);                            \
        nextc(process);                                     \
    }                                                       \

/* Gets the next character from the scanner process, advancing the read position
 * @param process The scanner process to get a character from
 * @return The next character in the scanner process
 */
char nextc(scanner_t* process) {
    char c = process->function->next_char(process);

    return c;
}

/* Gets the next character from the scanner process, without advancing the read position
 * @param process The scanner process to peek a character from
 * @return The next character in the scanner process
 */
char peekc(scanner_t* process) {
    return process->function->peek_char(process);
}

/* Pushes a character onto the file in the scanner process
 * @param process The scanner process to push the character to
 * @param c The character to push onto the file
 * @return void
 */
void pushc(scanner_t* process, char c) {
    process->function->push_char(process, c);
}

/* Gets the last token from the scanner process
 * @param process The scanner process to get the last token from
 * @return The last token stored in the scanner's token vector
 */
token_t* scanner_last_token(scanner_t* process) {
    return vector_peek(process->tokens);
}

token_t* read_next_token(scanner_t* process);
/* Skips whitespace characters from the file
 * @param process The scanner process to skip whitespace characters in
 * @return The token after the whitespace character
 */
token_t* skip_whitespace(scanner_t* process) {
    token_t* last_token = scanner_last_token(process);

    nextc(process);

    process->token_pos = process->curr_pos;
    return read_next_token(process);
}

/* Skips comments from the file
 * @param process The scanner process to skip comments in
 * @return The token after the comment
 */
token_t* skip_comment(scanner_t* process) {
    char c = nextc(process);
    char next;

    switch (c) {
        case '/':
            for (;c != '\n' && c != EOF; c = peekc(process)) {
                nextc(process);
            }

            nextc(process);
            break;
        case '*':
            for (; c != '/' && c != EOF; c = nextc(process)) {
                if (c == '*') {
                    next = peekc(process);
                    if (next == '/') {
                        continue;
                    }
                }
            }

            nextc(process);
            break;
    }

    process->token_pos = process->curr_pos;
    return read_next_token(process);
}

/* Creates a token struct by copying the passed in _token and modifying the copy
 * @param process The scanner process the token belongs to
 * @param _token The token struct to copy
 * @return The token
 */
token_t* token_create(scanner_t* process, token_t* restrict _token) {
    token_t* token = (token_t*) malloc(sizeof(token_t));
    memcpy(token, _token, sizeof(token_t));

    token->pos = process->token_pos;
    token->flags = 0;

    return token;
}

/* Reads a number from the in_file into a string
 * @param process The scanner process to read from
 * @param buffer The buffer to write to
 * @return The string representing the number literal
 */
const char* read_number_string(scanner_t* process, buffer_t* buffer) {
    char c = peekc(process);

    SCAN_GETC_IF(process, buffer, c, IS_DIGIT(c));

    buffer_write(buffer, '\0');
    return buffer_ptr(buffer);
}

/* Converts a buffer into a unsigned long
 * @param process The process the token belongs to
 * @param buffer The buffer storing the numbers string representation
 * @return The usigned long value of the buffer
 */
unsigned long read_number(scanner_t* process, buffer_t* buffer) {
    const char* s = read_number_string(process, buffer);
    return atoll(s);
}

/* Creates a number token from a unsigned long
 * @param process The scanner process the token belongs to
 * @param number The number value the token represents
 * @return The number token
 */
token_t* token_make_number_for_value(scanner_t* process, uint64_t number) {
    return token_create(process, &(token_t){
        .type=INTEGER,
        .data.inum=number
    }); 
}

/* Creates a number token
 * @param process The scanner process the token belongs to
 * @return The number token
 */
token_t* token_make_number(scanner_t* process) {
    buffer_t* buffer = new_buffer();
    token_t* token = token_make_number_for_value(process, read_number(process, buffer));

    free_buffer(buffer);
    return token;
}

/* Reads a number from the in_file into a string
 * @param process The scanner process to read from
 * @param buffer The buffer to write to
 * @return The string representing the number literal
 */
buffer_t* read_identifier(scanner_t* process, buffer_t* buffer) {
    char c = peekc(process);

    SCAN_GETC_IF(process, buffer, c, IS_ALPHANUMERIC(c));

    buffer_write(buffer, '\0');
    return buffer;
}

/* Checks if string matches a keyword
 * @param string The string to check against the keywords
 * @return True if string matches a keyword
 */
bool check_keyword(char* string) {
    for (int i = 0; i < NUM_KEYWORDS; i++) {
        const char* keyword = KEYWORDS[i];
        size_t keyword_len = strlen(keyword);

        if (strncmp(keyword, string, keyword_len) == 0) {
            return true;
        }
    } 

    return false;
}

/* Creates a identifier token from a string
 * @param process The scanner process the token belongs to
 * @param buffer The the buffer containing the string the token represents
 * @return The identifier token
 */
token_t* token_make_identifier_or_keyword_for_string(scanner_t* process, buffer_t* buffer) {
    char* string = (char*) calloc(buffer->elements, buffer->size);
    strncpy(string, buffer_ptr(buffer), buffer->elements);

    bool is_keyword = check_keyword(string);
    if (is_keyword) {
        return token_create(process, &(token_t){
            .type=KEYWORD,
            .data.sval=string
        }); 
    } else {
        return token_create(process, &(token_t){
            .type=IDENTIFIER,
            .data.sval=string
        }); 
    }
}

/* Creates a identifier or keyword token
 * @param process The scanner process the token belongs to
 * @return The identifier or keyword token
 */
token_t* token_make_identifier_or_keyword(scanner_t* process) {
    buffer_t* buffer = new_buffer();
    token_t* token = token_make_identifier_or_keyword_for_string(
        process, 
        read_identifier(process, buffer)
        );

    free_buffer(buffer);
    return token;
}

/* Creates a symbol token
 * @param process The scanner process the token belongs to
 * @param c The char representing the symbol
 * @return The symbol token
 */
token_t* token_make_symbol(scanner_t* process, char c) {
    return token_create(process, &(token_t){
        .type=SYMBOL,
        .data.cval=c
    }); 
}

/* Reads the next token from the scanner process
 * @param process The scanner process to read from
 * @return The next token in the input file
 */
token_t* read_next_token(scanner_t* process) {
    token_t* token = NULL;

    char c = peekc(process);
    process->token_pos = process->curr_pos;
    char peek;

    switch (c) {
        case '_':
            /* Unused binding */
        ALPHABETICAL_CASE:
            token = token_make_identifier_or_keyword(process);
            break;
        DIGIT_CASE:
            token = token_make_number(process);
            // token = token_make_integer_or_float(process);
            break;
        SYMBOL_CASE:
            c = nextc(process);

            switch (c) {
                /* String literal */
                case '"':
                    //break;
                /* Char literal */
                case '\'':
                    //break;
                /* Regex literal */
                case '\\':
                    //break;
                default:
                    peek = peekc(process);

                    /* Check for comments */
                    if (peek == '/' || peek == '*') {
                        token = skip_comment(process);
                    } else {
                        token = token_make_symbol(process, c);
                    }
                
                    break;
            }

            break;
        WHITESPACE_CASE:
            token = skip_whitespace(process);
            break;
        case EOF:
            /* We have finished scanning the file */
            break;
        default: 
            /* Unsupported character */
            compiler_error(process->compiler, "Unexpected token %d", c);
            break;
    }

    return token;
}

/* Prints out each token in the scanner
 * @param process The process whose tokens will be printed
 * @return void
 */
void scanner_debug(scanner_t* process) {
    const char* msg = "token: %d {\n"
                      "    type: %d,\n"
                      "    pos: line %d, col %d,\n"
                      "    filename: %s,\n"
                      "    %s\n"
                      "}\n\n";

    for (int i = 0; i < process->tokens->elements; i++) {
        token_t* t = vector_at(process->tokens, i);

        char buffer[50];
        switch (t->type) {
            case INTEGER:
                snprintf(buffer, 50, "val: %ld", t->data.inum);
                break;
            case SYMBOL:
                snprintf(buffer, 50, "val: '%c'", t->data.cval);
                break;
            case KEYWORD:
            case IDENTIFIER:
                snprintf(buffer, 50, "val: \"%s\"", t->data.sval);
                break;
        }

        printf(msg, i, t->type, t->pos.line, t->pos.col, t->pos.path, buffer);
    }
}

/* Scans the file in the scan process
 * @param process The scan process to be used in scanning
 * @return A integer signaling the result of the scan
 */
int scan(scanner_t* process) {
    token_t* token = read_next_token(process);
    while(token) {
        vector_push(process->tokens, token);
        // remove and call free_token(token) for each token in vector as part of exit code
        free(token);
        token = read_next_token(process);
    }

    scanner_debug(process);

    return SCANNER_FILE_SCANNED_OK;
}
