/*
 *  @author: dwclake
 */

#include <stdlib.h>
#include "../compiler/compiler.h"

/* Creates a new scanner process */
struct Scanner* create_scanner(
        struct Compiler* compiler, 
        struct ScannerFunctions* functions, 
        void* private_data
) {
    struct Scanner* process = calloc(1, sizeof(struct Scanner)); 

    (*process).pos.col = 1;
    (*process).pos.line = 1;
    (*process).parenthesis = NULL;
    (*process).compiler = compiler;
    (*process).function = functions;
    (*process).private_data = private_data;
    (*process).current_expression_count = 0;
    (*process).tokens = create_vector(sizeof(struct Token));

    return process;
}

/* Frees a scanner process from memory */
void free_scanner(struct Scanner* process) {
    free_vector( (*process).tokens );
    free(process);
}

/* Retrieves scanner's private data */
void* scanner_private(struct Scanner* process) {
    return (*process).private_data;
}

/* Retrieves scanner's tokens vector */
struct Vector* scan_process_tokens(struct Scanner* process) {
    return (*process).tokens;
}

/* Retrieves the next char from the scanner */
char scanner_next_char(struct Scanner* process) {
    struct Compiler* compiler = (*process).compiler;
    (*compiler).pos.col += 1;

    char c = getc( (*compiler).out_file.fp );

    if (c == '\n') {
        (*compiler).pos.line += 1;
        (*compiler).pos.col = 1;
    }

    return c;
}

/* Retrieves the next char from the scanner preserving the file stream */
char scanner_peek_char(struct Scanner* process) {
    struct Compiler* compiler = (*process).compiler;

    char c = getc( (*compiler).out_file.fp );
    ungetc(c, (*compiler).out_file.fp);

    return c;
}

/* Pushes c onto the file buffer */
void scanner_push_char(struct Scanner* process, char c) {
    struct Compiler* compiler = (*process).compiler;

    ungetc(c, (*compiler).out_file.fp);
}
