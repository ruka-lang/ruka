/*  
 *  @author: dwclake
 */

#include "test_scanner.h"

/* Functions for the scanner to use */
struct ScannerFunctions test_scan_functions = {
    .next_char = scanner_next_char,
    .peek_char = scanner_peek_char,
    .push_char = scanner_push_char
};

/*
 *
 *
 */
struct Compiler* test_compiler(char* source, char* filename) {
    struct Compiler* compiler = malloc(sizeof(struct Compiler));

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
int token_compare(struct Token* lhs, struct Token rhs) {
    /* switch (lhs->type) {
        case INTEGER:
            if (
                lhs->type != rhs.type ||
                lhs->flags != rhs.flags ||
                lhs->data.llnum != rhs.data.llnum ||
                lhs->between_brackets != rhs.between_brackets ||
                lhs->whitespace != rhs.whitespace ||
                lhs->pos.col != rhs.pos.col ||
                lhs->pos.line != rhs.pos.line ||
                lhs->pos.col != rhs.pos.col ||
                strcmp(lhs->pos.filename, rhs.pos.filename) != 0
            ) {
                return -1;
            }

            break;
        default:
            return -1;
            break;
    }

    return 0; */
    return memcmp(lhs, &rhs, sizeof(struct Token));
}

/*
 *
 *
 */
int test_next_token() {
    int result = 0;
    char* source = "123 let x = 12;";

    struct Compiler* compiler = test_compiler(source, "test");
    if (!compiler) return -1;

    struct Scanner* scanner = create_scanner(compiler, &test_scan_functions, NULL);
    if (!scanner) {
        result = -1;
        goto test_exit;
    }

    struct Token* token = read_next_token(scanner);
    result = token_compare(token, (struct Token){
        .type = INTEGER,
        .pos.col = 1,
        .pos.line = 1,
        .pos.filename = "",
        .flags = 0,
        .whitespace = false,
        .between_brackets = NULL,
        .data.llnum = 123
    });

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
