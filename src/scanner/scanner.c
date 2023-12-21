/*
 *  @author: dwclake
 */

#include "scanner.h"

#include "../compiler/compiler.h"

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
    case '\4':          \
    case '\t':          \
    case '\r':          \
    case '\n'

#define ALPHANUMERICAL_CASE \
    DIGIT_CASE:             \
    ALPHABETICAL_CASE

const char* KEYWORDS[] = {
    "const",
    "let",
    "return",
    "fn",
    "record",
    "enum",
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

/* Gets the next character from the scanner process, advancing the stream
 * @param process The scanner process to get a character from
 * @return The next character in the scanner process
 */
char nextc(struct Scanner* process) {
    char c = process->function->next_char(process);

    process->pos = process->compiler->pos;

    return c;
}

/* Gets the next character from the scanner process, without modifying the stream
 * @param process The scanner process to peek a character from
 * @return The next character in the scanner process
 */
char peekc(struct Scanner* process) {
    return process->function->peek_char(process);
}

/* Pushes a character onto the file stream in the scanner process
 * @param process The scanner process to push the character to
 * @param c The character to push onto the file stream
 * @return void
 */
void pushc(struct Scanner* process, char c) {
    process->function->push_char(process, c);
}

/* Gets the last token from the scanner process
 * @param process The scanner process to get the last token from
 * @return The last token stored in the scanner's token vector
 */
struct Token* scanner_last_token(struct Scanner* process) {
    return vector_peek(process->tokens);
}

struct Token* read_next_token(struct Scanner* process);
/* Skips whitespace characters from the file stream
 * @param process The scanner process to skip whitespace characters in
 * @return The token after the whitespace character
 */
struct Token* skip_whitespace(struct Scanner* process) {
    struct Token* last_token = scanner_last_token(process);
    if (last_token) {
        last_token->whitespace = true;
    }

    nextc(process);

    return read_next_token(process);
}

/* Skips comments from the file stream
 * @param process The scanner process to skip comments in
 * @return The token after the comment
 */
struct Token* skip_comment(struct Scanner* process) {
    char c = nextc(process);
    char next;

    switch (c) {
        case '/':
            for (c; c != '\n' && c != EOF; c = peekc(process)) {
                nextc(process);
            }
            nextc(process);
            break;
        case '*':
            for (c; c != EOF && c != '/'; c = nextc(process)) {
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

    return read_next_token(process);
}

/* Creates a token struct by copying the passed in _token and modifying the copy
 * @param process The scanner process the token belongs to
 * @param _token The token struct to copy
 * @return The token
 */
struct Token* token_create(struct Scanner* process, struct Token* restrict _token) {
    struct Token* token = malloc(sizeof(struct Token));
    memcpy(token, _token, sizeof(struct Token));

    token->pos = process->pos;

    return token;
}

/* Reads a number from the in_file into a string
 * @param process The scanner process to read from
 * @param buffer The buffer to write to
 * @return The string representing the number literal
 */
const char* read_number_string(struct Scanner* process, struct Buffer* buffer) {
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
unsigned long read_number(struct Scanner* process, struct Buffer* buffer) {
    const char* s = read_number_string(process, buffer);
    return atoll(s);
}

/* Creates a number token from a unsigned long
 * @param process The scanner process the token belongs to
 * @param number The number value the token represents
 * @return The number token
 */
struct Token* token_make_number_for_value(struct Scanner* process, unsigned long number) {
    return token_create(process, &(struct Token){
        .type=INTEGER,
        .llnum=number
    }); 
}

/* Creates a number token
 * @param process The scanner process the token belongs to
 * @return The number token
 */
struct Token* token_make_number(struct Scanner* process) {
    struct Buffer* buffer = create_buffer();
    struct Token* token = token_make_number_for_value(process, read_number(process, buffer));

    free_buffer(buffer);
    return token;
}

/* Reads a number from the in_file into a string
 * @param process The scanner process to read from
 * @param buffer The buffer to write to
 * @return The string representing the number literal
 */
struct Buffer* read_identifier(struct Scanner* process, struct Buffer* buffer) {
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
    for (int i = 0; i < 28; i++) {
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
struct Token* token_make_identifier_or_keyword_for_string(struct Scanner* process, struct Buffer* buffer) {
    char* string = calloc(buffer->elements, buffer->size);
    strcpy(string, buffer_ptr(buffer));

    bool is_keyword = check_keyword(string);
    if (is_keyword) {
        return token_create(process, &(struct Token){
            .type=KEYWORD,
            .sval=string
        }); 
    } else {
        return token_create(process, &(struct Token){
            .type=IDENTIFIER,
            .sval=string
        }); 
    }
}

/* Creates a identifier or keyword token
 * @param process The scanner process the token belongs to
 * @return The identifier or keyword token
 */
struct Token* token_make_identifier_or_keyword(struct Scanner* process) {
    struct Buffer* buffer = create_buffer();
    struct Token* token = token_make_identifier_or_keyword_for_string(process, 
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
struct Token* token_make_symbol(struct Scanner* process, char c) {
    return token_create(process, &(struct Token){
        .type=SYMBOL,
        .cval=c
    }); 
}

/* Reads the next token from the scanner process
 * @param process The scanner process to read from
 * @return The next token in the input file
 */
struct Token* read_next_token(struct Scanner* process) {
    struct Token* token = NULL;

    char c = peekc(process);
    switch (c) {
        ALPHABETICAL_CASE:
            token = token_make_identifier_or_keyword(process);
            break;
        DIGIT_CASE:
            token = token_make_number(process);
            break;
        SYMBOL_CASE:
            // Check for comment
            c = nextc(process);
            char peek = peekc(process);

            if (peek == '/' || peek == '*') {
                token = skip_comment(process);
            } else {
                token = token_make_symbol(process, c);
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

/* Scans the file in the scan process
 * @param process The scan process to be used in scanning
 * @return A integer signaling the result of the scan
 */
int scan(struct Scanner* process) {
    process->current_expression_count = 0;
    process->parenthesis = NULL;
    process->pos.filename = process->compiler->in_file.path; 

    struct Token* token = read_next_token(process);
    while(token) {
        vector_push(process->tokens, token);
        token = read_next_token(process);
    }

    return SCANNER_FILE_SCANNED_OK;
}
