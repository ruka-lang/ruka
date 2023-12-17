/*
 *  @author: dwclake
 */

#include "./compiler.h"

/* Functions for the scanner to use */
struct scan_process_functions compiler_scan_functions = {
    .next_char = scan_process_next_char,
    .peek_char = scan_process_peek_char,
    .push_char = scan_process_push_char
};

/* Compiles file at filename to out_filename with flags */
int compile_file(const char* filename, const char* out_filename, int flags) {
    struct compile_process* process = compile_process_create(filename, out_filename, flags); 
    
    if (!process) return COMPILER_FAILED_WITH_ERRORS;

    /* Scan */
    struct scan_process* scan_process = scan_process_create(process, &compiler_scan_functions, NULL);
    if (!scan_process) return COMPILER_FAILED_WITH_ERRORS;

    int scan_result = scan(scan_process);
    if (scan_result != SCAN_ALL_OK) return COMPILER_FAILED_WITH_ERRORS;
    
    scan_process_free(scan_process);
    /* Parse */

    /* Code generation */

    compile_process_free(process);
    
    return COMPILER_FILE_COMPILED_OK;
}
