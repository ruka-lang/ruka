/*
 *  @author: dwclake
 */

#ifndef COMPILER_H
#define COMPILER_H

#include <stdio.h>
#include <stdarg.h>
#include <stdlib.h>
#include <sys/errno.h>
#include "helpers/position.h"

/* Compiler messages */
enum {
    COMPILER_FILE_COMPILED_OK, 
    COMPILER_FAILED_WITH_ERRORS
};

/* State for compilation process */
typedef struct compiler_t {
    /* The flags in regards to how this file should be compiled */
    int flags;
    pos_t pos;

    /* File to be compiled */
    struct InputFile {
        char* contents; 
        size_t len;
        const char* path;
    } in_file;
    
    /* File to be compiled */
    struct OutputFile {
        FILE* fp; 
        const char* path;
    } out_file;
} compiler_t;

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
void compiler_error(compiler_t* compiler, const char* msg, ...);

/* Prints a compiler warning to the terminal
 * @param compiler The compiler process the warning occured in
 * @param msg The format string containing the warning message
 * @param ... The format arguments for the msg
 * @return void
 */
void compiler_warning(compiler_t* compiler, const char* msg, ...);

/* Creates a new compiler process
 * @param in_filename The file to compile
 * @param out_filename The name for the output file
 * @param flags Flags involving in file compilation
 * @return A new Compiler pointer or NULL
 */
compiler_t* create_compiler(const char* in_filename, 
                            const char* out_filename, 
                            int flags
                            );

/* Free's the compiler from memory
 * @param process The compiler process to be freed
 * @return void
 */
void free_compiler(compiler_t* process);

#endif
