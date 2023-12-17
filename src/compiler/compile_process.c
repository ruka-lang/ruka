/*
 *  @author: dwclake
 */

#include <stdio.h>
#include <stdlib.h>
#include "compiler.h"

/* Creates a new compile process */
struct compile_process* compile_process_create(const char* in_filename, const char* out_filename, int flags) {
    FILE* file = fopen(in_filename, "r");

    if (!file) return NULL;

    FILE* out_file = NULL;
    if (out_filename) {
        out_file = fopen(out_filename, "w");
        if (!out_file) return NULL;
    }

    struct compile_process* process = calloc(1, sizeof(struct compile_process));

    (*process).flags = flags;
    (*process).in_file.fp = file;
    (*process).in_file.path = in_filename;
    (*process).out_file.fp = out_file;
    (*process).out_file.path = out_filename;

    return process;
}

/* Frees a compile process */
void compile_process_free(struct compile_process* process) {
    fclose( (*process).in_file.fp );
    if ( (*process).out_file.fp ) {
        fclose( (*process).out_file.fp );
    }
    free(process);
}
