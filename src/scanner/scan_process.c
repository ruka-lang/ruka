/*
 *  @author: dwclake
 */

#include <stdlib.h>
#include "../compiler/compiler.h"

/* Creates a new scanner process
 * @param compiler The compiler process the scanner will belong to
 * @param functions The functions the scanner will use
 * @param private_data The private data only the caller understands
 * @return A pointer to a new Scanner or NULL
 */
struct Scanner* create_scanner(
        struct Compiler* compiler, 
        struct ScannerFunctions* functions, 
        void* private_data
) {
    struct Scanner* process = malloc(sizeof(struct Scanner)); 

    process->pos.col = 1;
    process->pos.line = 1;
    process->parenthesis = NULL;
    process->compiler = compiler;
    process->function = functions;
    process->private_data = private_data;
    process->current_expression_count = 0;
    process->tokens = create_vector(sizeof(struct Token));

    return process;
}

/* Frees a scanner process from memory
 * @param process The scanner process to be freed
 * @return void
 */
void free_scanner(struct Scanner* process) {
    free_vector(process->tokens);
    free(process);
}

/* Retrieves scanner's private data
 * @param process The scanner whose private data is being retrieved
 * @return void
 */
void* scanner_private(struct Scanner* process) {
    return process->private_data;
}

/* Retrieves scanner's tokens vector
 * @param process The scanner whose tokens vector is being retrieved
 * @return Pointer to the Token Vector
 */
struct Vector* scan_process_tokens(struct Scanner* process) {
    return process->tokens;
}

/* Retrieves the next char from the scanner
 * @param process The process to retrieve the next char from
 * @return The next char in the file buffer
 */
char scanner_next_char(struct Scanner* process) {
    struct Compiler* compiler = process->compiler;
    compiler->pos.col += 1;

    char c = getc(compiler->in_file.fp);

    if (c == '\n') {
        compiler->pos.line += 1;
        compiler->pos.col = 1;
    }

    return c;
}

/* Retrieves the next char from the scanner preserving the file stream
 * @param process The process to peek the next char from
 * @return The next char in the file buffer
 */
char scanner_peek_char(struct Scanner* process) {
    struct Compiler* compiler = process->compiler;

    char c = getc(compiler->in_file.fp);
    ungetc(c, compiler->in_file.fp);

    return c;
}

/* Pushes c onto the file buffer
 * @param process The scanner containing the file buffer to push the char onto
 * @param c The char to push onto the file buffer
 * @return void
 */
void scanner_push_char(struct Scanner* process, char c) {
    struct Compiler* compiler = process->compiler;

    ungetc(c, compiler->in_file.fp);
}
