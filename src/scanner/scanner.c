/*
 *  @author: dwclake
 */

#include "scanner.h"

#include "../compiler/compiler.h"

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

    process->pos.col += 1;
    if (c == '\n') {
        process->pos.line += 1;
        process->pos.col = 1;
    }

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

/* Creates a token struct by copying the passed in _token and modifying the copy
 * @param
 * @return
 */
struct Token* token_create(struct Scanner* process, struct Token* _token) {
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

/* Reads the next token from the scanner process
 * @param process The scanner process to read from
 * @return The next token in the input file
 */
struct Token* read_next_token(struct Scanner* process) {
    struct Token* token = NULL;

    char c = peekc(process);
    switch (c) {
        DIGIT_CASE:
            token = token_make_number(process);
            break;
        case ' ': 
        case '\t':
            token = skip_whitespace(process);
            break;
        case EOF:
            /* We have finished scanning the file */
            break;
        default: 
            /* Unsupported character */
            compiler_error(process->compiler, "Unexpected token");
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
