/*
 *  @author: dwclake
 */

#include "./compiler.h"

/* Functions for the scanner to use */
struct ScannerFunctions scan_functions = {
    .next_char = scanner_next_char,
    .peek_char = scanner_peek_char,
    .push_char = scanner_push_char
};

/*
 *
 *
 *
 */
void compiler_error(struct Compiler* compiler, const char* msg, ...) {
    va_list args;

    va_start(args, msg);
    fprintf(stderr, "Error: ");
    vfprintf(stderr, msg, args);
    va_end(args);

    fprintf(stderr, " on line: %i, col: %i, in file: %s\n", 
            compiler->pos.line, 
            compiler->pos.col, 
            compiler->pos.filename
            );

    exit(-1);
}

/*
 *
 *
 *
 */
void compiler_warning(struct Compiler* compiler, const char* msg, ...) {
    va_list args;

    va_start(args, msg);
    fprintf(stderr, "Warning: ");
    vfprintf(stderr, msg, args);
    va_end(args);

    fprintf(stderr, " on line: %i, col: %i, in file: %s\n", 
            compiler->pos.line, 
            compiler->pos.col, 
            compiler->pos.filename
            );
}

/* Compiles the file specified into the specified output using flags
 * @param in_filename The file to compile
 * @param out_filename The name for the output file
 * @param flags Flags involving in file compilation
 * @return A integer signaling the compilation result
 */
int compile(const char* in_filename, const char* out_filename, int flags) {
    struct Compiler* process = create_compiler(in_filename, out_filename, flags); 
    if (!process) return ENOENT;

    /* Scan */
    struct Scanner* scanner = create_scanner(process, &scan_functions, NULL);
    if (!scanner) return COMPILER_FAILED_WITH_ERRORS;

    int scan_result = scan(scanner);
    if (scan_result != SCANNER_FILE_SCANNED_OK) {
        return COMPILER_FAILED_WITH_ERRORS;
    }
    
    /* Parse */

    /* Code generation */

    /* Cleanup */
    free_scanner(scanner);
    free_compiler(process);
    
    return COMPILER_FILE_COMPILED_OK;
}
