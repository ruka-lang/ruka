/*  
 *  @author: dwclake
 */

#include "scanner.h"

/*
 *
 *
 */
int test_next_token() {

    return 0;
}

/*
 *
 *
 */
int test_identifiers() {

    return 0;
}

/*
 *
 *
 */
int test_scanner(const char* test) {
    if (strcmp(test, "next_token") == 0) {
        return test_next_token();
    } else if (strcmp(test, "identifiers") == 0) {
        return test_identifiers();
    }

    return -1;
}
