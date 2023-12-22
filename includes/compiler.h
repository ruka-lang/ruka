/*
 *  @author: dwclake
 */

#ifndef COMPILER_H
#define COMPILER_H

#include <stdio.h>
#include <stdarg.h>
#include <stdlib.h>
#include <sys/errno.h>
#include "scanner.h"

/* Compiler messages */
enum {
    COMPILER_FILE_COMPILED_OK, 
    COMPILER_FAILED_WITH_ERRORS
};

/* State for compilation process */
struct Compiler {
    /* The flags in regards to how this file should be compiled */
    int flags;
    struct Pos pos;

    /* File to be compiled */
    struct CompilerInputFile {
        char* contents; 
        size_t len;
        const char* path;
    } in_file;
    
    /* File to be compiled */
    struct CompilerOutputFile {
        FILE* fp; 
        const char* path;
    } out_file;
};

/* Compiles the file specified into the specified output using flags
 * @param in_filename The file to compile
 * @param out_filename The name for the output file
 * @param flags Flags involving in file compilation
 * @return A integer signaling the compilation result
 */
int compile(const char* in_filename, const char* out_filename, int flags);

/* Prints a compiler error to the terminal and exits
 * @param compiler The compiler process the error occured in
 * @param msg The format string containing the error message
 * @param ... The format arguments for the msg
 * @return void
 */
void compiler_error(struct Compiler* compiler, const char* msg, ...);

/* Prints a compiler warning to the terminal
 * @param compiler The compiler process the warning occured in
 * @param msg The format string containing the warning message
 * @param ... The format arguments for the msg
 * @return void
 */
void compiler_warning(struct Compiler* compiler, const char* msg, ...);

/* Creates a new compiler process
 * @param in_filename The file to compile
 * @param out_filename The name for the output file
 * @param flags Flags involving in file compilation
 * @return A new Compiler pointer or NULL
 */
struct Compiler* create_compiler(const char* in_filename, 
                                 const char* out_filename, 
                                 int flags
                                 );

/* Free's the compiler from memory
 * @param process The compiler process to be freed
 * @return void
 */
void free_compiler(struct Compiler* process);

#endif
