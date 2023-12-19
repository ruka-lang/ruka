/*
 *  @author: dwclake
 */

#include "scanner.h"

#include "../compiler/compiler.h"

/*
 *
 *
 *
 *
 */
#define SCAN_GETC_IF(process, buffer, c, exp)               \
    for (c = peekc(process); exp; c = peekc(process)) {     \
        buffer_write(buffer, c);                            \
        nextc(process);                                     \
    }                                                       \

/*
 *
 *
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

/*
 *
 *
 */
char peekc(struct Scanner* process) {
    return process->function->peek_char(process);
}

/*
 *
 *
 *
 */
void pushc(struct Scanner* process, char c) {
    process->function->push_char(process, c);
}

/*
 *
 *
 */
struct Token* scanner_last_token(struct Scanner* process) {
    return vector_peek(process->tokens);
}

struct Token* read_next_token(struct Scanner* process);
/*
 *
 *
 */
struct Token* skip_whitespace(struct Scanner* process) {
    struct Token* last_token = scanner_last_token(process);
    if (last_token) {
        last_token->whitespace = true;
    }

    nextc(process);

    return read_next_token(process);
}

/*
 *
 *
 */
struct Token* token_create(struct Scanner* process, struct Token* _token) {
    struct Token* token = malloc(sizeof(struct Token));
    memcpy(token, _token, sizeof(struct Token));

    token->pos = process->pos;

    return token;
}

/*
 *
 *
 */
const char* read_number_string(struct Scanner* process) {
    const char* num = NULL;
    struct buffer* buffer = buffer_create();

    char c = peekc(process);

    SCAN_GETC_IF(process, buffer, c, IS_DIGIT(c));

    buffer_write(buffer, 0x00);
    return buffer_ptr(buffer);
}

/*
 *
 *
 */
unsigned long read_number(struct Scanner* process) {
    const char* s = read_number_string(process);
    return atoll(s);
}

/*
 *
 *
 *
 */
struct Token* token_make_number_for_value(struct Scanner* process, unsigned long number) {
    return token_create(process, &(struct Token){
        .type=INTEGER,
        .llnum=number
    }); 
}

/*
 *
 *
 */
struct Token* token_make_number(struct Scanner* process) {
    return token_make_number_for_value(process, read_number(process));
}

/*
 *
 *
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