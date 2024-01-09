/*
 *  @author: dwclake
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/errno.h>
#include "../includes/compiler.h"

const char* prompt = "Ghoose compiler\n"
                     "version: 0.1.0\n"
                     "\n"
                     "Usage: ghoose-c [options] source\n";

int main(int argc, const char** argv) {
    /* Check if first argument was provided (required) */
    if (argv[1]) {
        const char* input = argv[1];
        const char* output = NULL;
        
        /* Check if second argument was provided (optional) */
        if (argv[2]) {
            /* Check if output path is the same as the input path */
            if (strncmp(input, argv[2], strnlen(input, 150)) == 0) {
                printf("Warning: Input file and output file must be different, ignoring output\n");
            } else {
                output = argv[2];
            }
        }

        int result = compile(input, output, 0);
        switch (result) {
            case COMPILER_FILE_COMPILED_OK:
                printf("Compiled successfully\n");
                break;
            case COMPILER_FAILED_WITH_ERRORS:
                printf("Compilation failed with errors\n");
                break;
            //case COMPILER_FAILED_SOURCE_NOT_FOUND:
            //    printf("Compilation failed. File not found: %s\n", argv[1]);
            //    return ENOENT;
            //    break;
            default: 
                printf("File compiled with unknown response\n");
                break;
        }
    } else {
        printf("%s", prompt);
    }
    
    return EXIT_SUCCESS;
}
