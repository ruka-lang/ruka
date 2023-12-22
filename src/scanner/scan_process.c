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
    struct Scanner* process = (struct Scanner*) malloc(sizeof(struct Scanner)); 

    process->read_pos = 0;
    process->curr_pos = compiler->pos;
    process->token_pos = compiler->pos;
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

/* Retrieves the next char from the scanner, advancing the read position
 * @param process The process to retrieve the next char from
 * @return The next char in the file
 */
char scanner_next_char(struct Scanner* process) {
    struct Compiler* compiler = process->compiler;

    char c;
    if (process->read_pos >= compiler->in_file.len) {
        return EOF;
    } else {
        c = compiler->in_file.contents[process->read_pos]; 
        process->read_pos++;

        process->curr_pos.col += 1;
        if (c == '\n') {
            process->curr_pos.line += 1;
            process->curr_pos.col = 1;
        }
        compiler->pos = process->curr_pos;
    }

    return c;
}

/* Retrieves the next char from the scanner without moving the read position
 * @param process The process to peek the next char from
 * @return The next char in the file
 */
char scanner_peek_char(struct Scanner* process) {
    struct Compiler* compiler = process->compiler;

    char c;
    if (process->read_pos >= compiler->in_file.len) {
        return EOF;
    } else {
        c = compiler->in_file.contents[process->read_pos]; 
    }

    return c;
}

/* Pushes c onto the file
 * @param process The scanner containing the file to push the char onto
 * @param c The char to push onto the file
 * @return void
 */
void scanner_push_char(struct Scanner* process, char c) {
    struct Compiler* compiler = process->compiler;

    //ungetc(c, compiler->in_file.fp);
}
