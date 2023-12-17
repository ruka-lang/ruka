/*
 *  @author: dwclake
 */

#ifndef COMPILER_H
#define COMPILER_H

#include <stdio.h>
#include "../scanner/scanner.h"

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
        FILE* fp; 
        const char* path;
    } in_file;
    
    /* File to be compiled */
    struct CompilerOutputFile {
        FILE* fp; 
        const char* path;
    } out_file;
};

/* Com;iles the file specified into the specified output using flags
 * @param in_filename
 * @param out_filename
 * @param flags
 * @return A integer signaling the compilation result
 */
int compile(const char* in_filename, const char* out_filename, int flags);

/* Creates a new compiler process
 * @param in_filename
 * @param out_filename
 * @param flags
 * @return A new Compiler pointer or NULL
 */
struct Compiler* create_compiler(const char* in_filename, 
                                 const char* out_filename, 
                                 int flags);

/* Free's the compiler from memory
 * @param process
 * @return void
 */
void free_compiler(struct Compiler* process);

#endif
