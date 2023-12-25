/*  
 *  @author: dwclake
 */

#include "test_scanner.h"

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
compiler_t* test_compiler(char* source, char* filename) {
    compiler_t* compiler = malloc(sizeof(compiler_t));

    compiler->in_file.contents = source;
    compiler->in_file.len = strlen(source);
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
        lhs->whitespace != rhs->whitespace ||
        lhs->pos.col != rhs->pos.col ||
        lhs->pos.line != rhs->pos.line ||
        strncmp(lhs->pos.path, rhs->pos.path, strlen(lhs->pos.path)) != 0
    ) {
        return -1;
    }

    switch (lhs->type) {
        case INTEGER:
            if (lhs->data.inum != rhs->data.inum) {
                return -1;
            }

            break;
        case IDENTIFIER:
        case KEYWORD:
            if (strncmp(lhs->data.sval, rhs->data.sval, strlen(lhs->data.sval)) != 0) {
                return -1;
            }

            break;
        case SYMBOL:
            if (lhs->data.cval != rhs->data.cval) {
                return -1;
            }

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
int test_next_token() {
    int result = 0;
    char* filename = "test";
    char* source = "123 let x = 12;";

    compiler_t* compiler = test_compiler(source, filename);
    if (!compiler) return -1;

    scanner_t* scanner = new_scanner(compiler, &test_scan_functions, NULL);
    if (!scanner) {
        result = -1;
        goto test_exit;
    }

    uint64_t ival1 = 123;
    uint64_t ival2 = 12;
    char cval1 = '=';
    char cval2 = ';';
    char* sval1 = "let";
    char* sval2 = "x";

    int expected_count = 6;
    token_t* expected_tokens[] = {
        new_token_with_all(scanner, INTEGER, &ival1, 0, new_pos(1, 1, filename), true),
        new_token_with_all(scanner, KEYWORD, &sval1, 4, new_pos(1, 5, filename), true),
        new_token_with_all(scanner, IDENTIFIER, &sval2, 2, new_pos(1, 9, filename), true),
        new_token_with_all(scanner, SYMBOL, &cval1, 0, new_pos(1, 11, filename), true),
        new_token_with_all(scanner, INTEGER, &ival2, 0, new_pos(1, 13, filename), false),
        new_token_with_all(scanner, SYMBOL, &cval2, 0, new_pos(1, 15, filename), false),
    };

    result = scan(scanner);
    if (
        result != SCANNER_FILE_SCANNED_OK || 
        scanner->tokens->elements != expected_count
    ) {
        result = 1;
        goto test_exit;
    }

    tokens_compare(scanner, expected_tokens, expected_count);

    test_exit:
        free(scanner);
        free(compiler);

        return result;
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
    if (strncmp(test, "next_token", 11) == 0) {
        return test_next_token();
    } else if (strncmp(test, "identifiers", 12) == 0) {
        return test_identifiers();
    }

    return -1;
}
