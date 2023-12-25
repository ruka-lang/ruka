/*
 *  @author: dwclake
 */

#include "../../includes/compiler.h"
#include "../../includes/scanner.h"

/* Functions for the scanner to use */
scanner_functions_t scan_functions = {
    .next_char = scanner_next_char,
    .peek_char = scanner_peek_char,
    .push_char = scanner_push_char
};

/* Prints a compiler error to the terminal and exits
 * @param compiler The compiler process the error occured in
 * @param msg The format string containing the error message
 * @param ... The format arguments for the msg
 * @return void
 */
void compiler_error(compiler_t* compiler, const char* msg, ...) {
    va_list args;

    va_start(args, msg);
    fprintf(stderr, "Error: ");
    vfprintf(stderr, msg, args);
    va_end(args);

    fprintf(stderr, " on line: %i, col: %i, in file: %s\n", 
            compiler->pos.line, 
            compiler->pos.col, 
            compiler->pos.path
            );

    exit(-1);
}

/* Prints a compiler warning to the terminal
 * @param compiler The compiler process the warning occured in
 * @param msg The format string containing the warning message
 * @param ... The format arguments for the msg
 * @return void
 */
void compiler_warning(compiler_t* compiler, const char* msg, ...) {
    va_list args;

    va_start(args, msg);
    fprintf(stderr, "Warning: ");
    vfprintf(stderr, msg, args);
    va_end(args);

    fprintf(stderr, " on line: %i, col: %i, in file: %s\n", 
            compiler->pos.line, 
            compiler->pos.col, 
            compiler->pos.path
            );
}

/* Compiles the file specified into the specified output using flags
 * @param in_filename The file to compile
 * @param out_filename The name for the output file
 * @param flags Flags involving in file compilation
 * @return A integer signaling the compilation result
 */
int compile(const char* in_filename, const char* out_filename, int flags) {
    compiler_t* process = new_compiler(in_filename, out_filename, flags); 
    if (!process) return ENOENT;

    /* Scan */
    scanner_t* scanner = new_scanner(process, &scan_functions, NULL);
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
