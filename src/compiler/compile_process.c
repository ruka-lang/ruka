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
char* read_to_string(struct Compiler* process, FILE* file) {
    fseek(file, 0, SEEK_END);
    int len = ftell(file);
    fseek(file, 0, SEEK_SET);

    char* contents = (char*) calloc(len + 1, sizeof(char));

    char c;
    int i = 0;
    for (c = fgetc(file); c != EOF; c = fgetc(file)) {
       contents[i] = c;
       i++;
    }
    contents[i] = '\0';

    process->in_file.len = len;

    return contents;
}

/* Creates a new compiler process
 * @param in_filename The file to compile
 * @param out_filename The name for the output file
 * @param flags Flags involving in file compilation
 * @return A new Compiler pointer or NULL
 */
struct Compiler* create_compiler(
        const char* in_filename, 
        const char* out_filename, 
        int flags
) {
    FILE* in_file = fopen(in_filename, "r");
    if (!in_file) return NULL;

    FILE* out_file = NULL;
    if (out_filename) {
        out_file = fopen(out_filename, "w");
        if (!out_file) return NULL;
    }

    // Create compiler
    struct Compiler* process = (struct Compiler*) malloc(sizeof(struct Compiler));

    process->flags = flags;
    process->pos.line = 1;
    process->pos.col = 1;
    process->pos.filename = in_filename;
    process->in_file.contents = read_to_string(process, in_file);
    process->in_file.path = in_filename;
    process->out_file.fp = out_file;
    process->out_file.path = out_filename;

    fclose(in_file);

    return process;
}


/* Free's the compiler from memory
 * @param process The compiler process to be freed
 * @return void
 */
void free_compiler(struct Compiler* process) {
    if (process->out_file.fp) {
        fclose(process->out_file.fp);
    }

    free(process->in_file.contents);
    free(process);
}
