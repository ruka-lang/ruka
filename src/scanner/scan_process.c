/*
 *  @author: dwclake
 */

#include <stdlib.h>
#include "../../includes/scanner.h"
#include "../../includes/compiler.h"

/* Creates a new scanner process
 * @param compiler The compiler process the scanner will belong to
 * @param functions The functions the scanner will use
 * @param private_data The private data only the caller understands
 * @return A pointer to a new Scanner or NULL
 */
scanner_t* new_scanner(
        compiler_t* compiler, 
        struct scanner_functions_t* functions, 
        void* private_data
) {
    scanner_t* process = (scanner_t*) malloc(sizeof(scanner_t)); 

    process->read_pos = 0;
    process->curr_pos = compiler->pos;
    process->token_pos = compiler->pos;
    process->parenthesis = NULL;
    process->compiler = compiler;
    process->function = functions;
    process->private_data = private_data;
    process->current_expression_count = 0;
    process->tokens = new_vector(sizeof(token_t));

    return process;
}

/*
 *
 *
 */
void free_tokens(void* token) {
    free_token((token_t*) token);
}

/* Frees a scanner process from memory
 * @param process The scanner process to be freed
 * @return void
 */
void free_scanner(scanner_t* process) {
    if (!process) return;

    free_vector(process->tokens, free_tokens);
    free(process);
}

/* Retrieves scanner's private data
 * @param process The scanner whose private data is being retrieved
 * @return void
 */
void* scanner_private(scanner_t* process) {
    return process->private_data;
}

/* Retrieves scanner's tokens vector
 * @param process The scanner whose tokens vector is being retrieved
 * @return Pointer to the Token Vector
 */
vector_t* scan_process_tokens(scanner_t* process) {
    return process->tokens;
}

/* Retrieves the next char from the scanner, advancing the read position
 * @param process The process to retrieve the next char from
 * @return The next char in the file
 */
char scanner_next_char(scanner_t* process) {
    compiler_t* compiler = process->compiler;

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
char scanner_peek_char(scanner_t* process) {
    compiler_t* compiler = process->compiler;

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
void scanner_push_char(scanner_t* process, char c) {
    compiler_t* compiler = process->compiler;

    //ungetc(c, compiler->in_file.fp);
}
