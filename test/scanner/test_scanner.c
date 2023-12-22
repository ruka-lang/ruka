/*  
 *  @author: dwclake
 */

#include "test_scanner.h"

/* Functions for the scanner to use */
struct scanner_functions_t test_scan_functions = {
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
    compiler->pos.filename = filename;

    return compiler;
}

/*
 *
 *
 */
int token_compare(token_t* lhs, token_t rhs) {
    switch (lhs->type) {
        case INTEGER:
            if (
                lhs->type != rhs.type ||
                lhs->flags != rhs.flags ||
                lhs->data.llnum != rhs.data.llnum ||
                lhs->between_brackets != rhs.between_brackets ||
                lhs->whitespace != rhs.whitespace ||
                lhs->pos.col != rhs.pos.col ||
                lhs->pos.line != rhs.pos.line ||
                strncmp(lhs->pos.filename, rhs.pos.filename, strlen(lhs->pos.filename)) != 0
            ) {
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
int test_next_token() {
    int result = 0;
    char* filename = "test";
    char* source = "123 let x = 12;";

    compiler_t* compiler = test_compiler(source, filename);
    if (!compiler) return -1;

    scanner_t* scanner = create_scanner(compiler, &test_scan_functions, NULL);
    if (!scanner) {
        result = -1;
        goto test_exit;
    }

    token_t* token = read_next_token(scanner);
    result = token_compare(token, (token_t){
        .type = INTEGER,
        .pos.col = 1,
        .pos.line = 1,
        .pos.filename = filename,
        .flags = 0,
        .whitespace = false,
        .between_brackets = NULL,
        .data.llnum = 123
    });

    printf("%s\n", token->pos.filename);
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
    if (strcmp(test, "next_token") == 0) {
        return test_next_token();
    } else if (strcmp(test, "identifiers") == 0) {
        return test_identifiers();
    }

    return -1;
}
