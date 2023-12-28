/*  
 *  @author: dwclake
 */

#include "test_scanner.h"
#include <string.h>

/* Functions for the scanner to use */
scanner_functions_t test_scan_functions = {
    .next_char = scanner_next_char,
    .peek_char = scanner_peek_char,
    .push_char = scanner_push_char
};

/*
 *
 *
 */
compiler_t* test_compiler(char* source, const char* filename) {
    compiler_t* compiler = (compiler_t*) malloc(sizeof(compiler_t));

    size_t len = strlen(source);

    compiler->in_file.contents = (char*) calloc(len, sizeof(char));
    memcpy(compiler->in_file.contents, source, len);

    compiler->in_file.len = len;
    compiler->in_file.path = filename;

    compiler->out_file.path = NULL;
    compiler->out_file.path = NULL;

    compiler->flags = 0;
    compiler->pos.col = 1;
    compiler->pos.line = 1;
    compiler->pos.path = filename;

    return compiler;
}

/*
 *
 *
 */
int token_compare(token_t* lhs, token_t* rhs) {
    if (
        lhs->type != rhs->type ||
        lhs->flags != rhs->flags ||
        lhs->pos.col != rhs->pos.col ||
        lhs->pos.line != rhs->pos.line ||
        strncmp(lhs->pos.path, rhs->pos.path, strlen(lhs->pos.path)) != 0
    ) {
        return -1;
    }

    switch (lhs->type) {
        case INTEGER:
            if (lhs->data.inum != rhs->data.inum) return -1;
            break;
        case IDENTIFIER:
        case KEYWORD:
            if (strncmp(lhs->data.sval, rhs->data.sval, strlen(lhs->data.sval)) != 0) {
                return -1;
            }
            break;
        case SYMBOL:
            if (lhs->data.cval != rhs->data.cval) return -1;
            break;
        default:
            return -1;
            break;
    }

    return 0;
}

/*
 *
 *
 */
int tokens_compare(scanner_t* scanner, token_t** expected_tokens, int expected) {
    int result = 0;

    for (int i = 0; i < expected; i++) {
        result = token_compare(vector_at(scanner->tokens, i), expected_tokens[i]);
        if (result != 0) return result;
    }

    return result;
}

/*
 *
 *
 */
int test(char* source, token_t* expected[], size_t count) {
    int result = 0;
    const char* filename = "test";

    /* Compiler and scanner creation */
    compiler_t* compiler = test_compiler(source, filename);
    if (!compiler) return -1;

    scanner_t* scanner = new_scanner(compiler, &test_scan_functions, NULL);
    if (!scanner) {
        result = -1;
        goto test_exit;
    }

    result = scan(scanner);
    if (
        result != SCANNER_FILE_SCANNED_OK || 
        scanner->tokens->elements != count
    ) {
        result = 1;
        goto test_exit;
    }

    tokens_compare(scanner, expected, count);

    test_exit:
        free_scanner(scanner);
        free_compiler(compiler);

        return result;
}


/*
 *
 *
 */
int test_next_token() {
    char* source = "123 let x = 12;";

    /* Expected tokens and values from the source */
    uint64_t ival[] = {123, 12};
    char cval[] = {'=', ';'};
    char* sval[] = {"let", "x"};

    int expected_count = 6;
    token_t* expected_tokens[] = {
        new_token_with_all(INTEGER,    &ival[0], 0, new_pos(1,  1, "test"), 0),
        new_token_with_all(KEYWORD,    &sval[0], 4, new_pos(1,  5, "test"), 0),
        new_token_with_all(IDENTIFIER, &sval[1], 2, new_pos(1,  9, "test"), 0),
        new_token_with_all(SYMBOL,     &cval[0], 0, new_pos(1, 11, "test"), 0),
        new_token_with_all(INTEGER,    &ival[1], 0, new_pos(1, 13, "test"), 0),
        new_token_with_all(SYMBOL,     &cval[1], 0, new_pos(1, 15, "test"), 0)
    };

    return test(source, expected_tokens, expected_count);
}

/*
 *
 *
 */
int test_operators() {
    /* / and * causing early EOF */
    char* source = "+-=<>(){}[]/\\|'\";:?.,!@#$%^&*~`";

    /* Expected tokens and values from the source */
    char cval[] = {
        '+', '-', '=', '<', '>', '(', ')', '{', '}', '[', ']', '/', '\\', '|', '\'', '"', 
        ';', ':', '?', '.', ',', '!', '@', '#', '$', '%', '^', '&', '*', '~', '`'
    };

    int expected_count = 31;
    token_t* expected_tokens[] = {
        new_token_with_all(SYMBOL, &cval[0],  0, new_pos(1,  1, "test"), 0),
        new_token_with_all(SYMBOL, &cval[1],  0, new_pos(1,  2, "test"), 0),
        new_token_with_all(SYMBOL, &cval[2],  0, new_pos(1,  3, "test"), 0),
        new_token_with_all(SYMBOL, &cval[3],  0, new_pos(1,  4, "test"), 0),
        new_token_with_all(SYMBOL, &cval[4],  0, new_pos(1,  5, "test"), 0),
        new_token_with_all(SYMBOL, &cval[5],  0, new_pos(1,  6, "test"), 0),
        new_token_with_all(SYMBOL, &cval[6],  0, new_pos(1,  7, "test"), 0),
        new_token_with_all(SYMBOL, &cval[7],  0, new_pos(1,  8, "test"), 0),
        new_token_with_all(SYMBOL, &cval[8],  0, new_pos(1,  9, "test"), 0),
        new_token_with_all(SYMBOL, &cval[9],  0, new_pos(1, 10, "test"), 0),
        new_token_with_all(SYMBOL, &cval[10], 0, new_pos(1, 11, "test"), 0),
        new_token_with_all(SYMBOL, &cval[11], 0, new_pos(1, 12, "test"), 0),
        new_token_with_all(SYMBOL, &cval[12], 0, new_pos(1, 13, "test"), 0),
        new_token_with_all(SYMBOL, &cval[13], 0, new_pos(1, 14, "test"), 0),
        new_token_with_all(SYMBOL, &cval[14], 0, new_pos(1, 15, "test"), 0),
        new_token_with_all(SYMBOL, &cval[15], 0, new_pos(1, 16, "test"), 0),
        new_token_with_all(SYMBOL, &cval[16], 0, new_pos(1, 17, "test"), 0),
        new_token_with_all(SYMBOL, &cval[17], 0, new_pos(1, 18, "test"), 0),
        new_token_with_all(SYMBOL, &cval[18], 0, new_pos(1, 19, "test"), 0),
        new_token_with_all(SYMBOL, &cval[19], 0, new_pos(1, 20, "test"), 0),
        new_token_with_all(SYMBOL, &cval[20], 0, new_pos(1, 21, "test"), 0),
        new_token_with_all(SYMBOL, &cval[21], 0, new_pos(1, 22, "test"), 0),
        new_token_with_all(SYMBOL, &cval[22], 0, new_pos(1, 23, "test"), 0),
        new_token_with_all(SYMBOL, &cval[23], 0, new_pos(1, 24, "test"), 0),
        new_token_with_all(SYMBOL, &cval[24], 0, new_pos(1, 25, "test"), 0),
        new_token_with_all(SYMBOL, &cval[25], 0, new_pos(1, 26, "test"), 0),
        new_token_with_all(SYMBOL, &cval[26], 0, new_pos(1, 27, "test"), 0),
        new_token_with_all(SYMBOL, &cval[27], 0, new_pos(1, 28, "test"), 0),
        new_token_with_all(SYMBOL, &cval[28], 0, new_pos(1, 29, "test"), 0),
        new_token_with_all(SYMBOL, &cval[29], 0, new_pos(1, 30, "test"), 0),
        new_token_with_all(SYMBOL, &cval[30], 0, new_pos(1, 31, "test"), 0),
    };

    return test(source, expected_tokens, expected_count);
}

/* Wrapper around scanner tests
 * @param test The name of the test to run
 * @return Returns the result of the test, 0 - passing, -1 - failing
 */
int test_scanner(const char* test) {
    if (strncmp(test, "next_token", 11) == 0) {
        return test_next_token();
    } else if (strncmp(test, "operators", 10) == 0) {
        return test_operators();
    }

    return -1;
}
