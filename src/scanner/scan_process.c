/*
 *  @author: dwclake
 */

#include <stdlib.h>
#include "../compiler/compiler.h"

/* Create a new scan process */
struct scan_process* scan_process_create(
        struct compile_process* compiler, 
        struct scan_process_functions* functions, 
        void* private_data
) {
    struct scan_process* process = calloc(1, sizeof(struct scan_process)); 

    (*process).pos.col = 1;
    (*process).pos.line = 1;
    (*process).parenthesis = NULL;
    (*process).compiler = compiler;
    (*process).function = functions;
    (*process).private_data = private_data;
    (*process).current_expression_count = 0;
    (*process).tokens = vector_create(sizeof(struct token));

    return process;
}

/* Frees a scan process */
void scan_process_free(struct scan_process* process) {
    vector_free( (*process).tokens );
    free(process);
}

/* Gets a pointer to the private data of the scan process */
void* scan_process_private(struct scan_process* process) {
    return (*process).private_data;
}

/* Gets a pointer to the tokens vector of the scan process */
struct vector* scan_process_tokens(struct scan_process* process) {
    return (*process).tokens;
}

/* Gets the next char from the scan process, pops it from the file being compiled */
char scan_process_next_char(struct scan_process* scan_process) {
    struct compile_process* compiler = (*scan_process).compiler;
    (*compiler).pos.col += 1;

    char c = getc( (*compiler).out_file.fp );

    if (c == '\n') {
        (*compiler).pos.line += 1;
        (*compiler).pos.col = 1;
    }

    return c;
}

/* Gets the next char from the scan process without popping it */
char scan_process_peek_char(struct scan_process* scan_process) {
    struct compile_process* compiler = (*scan_process).compiler;

    char c = getc( (*compiler).out_file.fp );
    ungetc(c, (*compiler).out_file.fp);

    return c;
}

/* Pushes char c onto the file being compiled */
void scan_process_push_char(struct scan_process* scan_process, char c) {
    struct compile_process* compiler = (*scan_process).compiler;

    ungetc(c, (*compiler).out_file.fp);
}
