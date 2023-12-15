/*
 *
 */

#include "./compiler.h"

/* Compiles file at filename to out_filename with flags */
int compile_file(const char* filename, const char* out_filename, int flags) {
    struct compile_process* process = compile_process_create(filename, out_filename, flags); 
    
    if (!process) return COMPILER_FAILED_WITH_ERRORS;

    // Scan
    
    // Parse

    // Code generation
    
    return COMPILER_FILE_COMPILED_OK;
}
