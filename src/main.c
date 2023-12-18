/*
 *  @author: dwclake
 */

#include <stdio.h>
#include "compiler/compiler.h"

int main(int argc, const char** argv) {
    int result = compile("test/files/test.rex", NULL, 0);
    switch (result) {
        case COMPILER_FILE_COMPILED_OK:
            printf("Compiled successfully\n");
            break;
        case COMPILER_FAILED_WITH_ERRORS:
            printf("Compilation failed with errors\n");
            break;
        default: 
            printf("File compiled with unknown response\n");
            break;
    }

    return 0;
}
