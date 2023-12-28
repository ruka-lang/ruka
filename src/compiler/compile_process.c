/*
 *  @author: dwclake
 */

#include <stdio.h>
#include <stdlib.h>
#include "../../includes/compiler.h"

/* Read a file stream into a char*
 * @param file The file to read to string
 * @return Char* containing the file contents
 */
char* read_to_string(compiler_t* process, const char* filename) {
    FILE* file = fopen(filename, "rb");
    if (!file) return NULL;

    fseek(file, 0, SEEK_END);
    size_t len = ftell(file);
    fseek(file, 0, SEEK_SET);

    char* contents = (char*) calloc(len + 1, sizeof(char));

    int read_res = fread(contents, sizeof(char), len, file);
    if (read_res != len) {
        free(contents);
        fclose(file);
        return NULL;
    }

    contents[len] = '\0';

    process->in_file.len = len;

    fclose(file);
    return contents;
}

/* Creates a new compiler process
 * @param in_filename The file to compile
 * @param out_filename The name for the output file
 * @param flags Flags involving in file compilation
 * @return A new Compiler pointer or NULL
 */
compiler_t* new_compiler(
        const char* in_filename, 
        const char* out_filename, 
        int flags
) {
    FILE* out_file = NULL;
    if (out_filename) {
        out_file = fopen(out_filename, "w");
        if (!out_file) return NULL;
    }

    // Create compiler
    compiler_t* process = (compiler_t*) malloc(sizeof(compiler_t));
    char* contents = read_to_string(process, in_filename);

    if (!contents) {
        free_compiler(process);

        process = NULL;
        goto exit;
    }

    process->flags = flags;
    process->pos.line = 1;
    process->pos.col = 1;
    process->pos.path = in_filename;
    process->in_file.path = in_filename;
    process->in_file.contents = contents;
    process->out_file.fp = out_file;
    process->out_file.path = out_filename;

exit:

    return process;
}


/* Free's the compiler from memory
 * @param process The compiler process to be freed
 * @return void
 */
void free_compiler(compiler_t* process) {
    if (!process) return;

    if (process->out_file.fp) {
        fclose(process->out_file.fp);
    }

    free(process->in_file.contents);
    free(process);
}
