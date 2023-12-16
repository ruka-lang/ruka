/*
 *  @author: dwclake
 */

#ifndef SCANNER_H
#define SCANNER_H

#include <stdbool.h>
#include "../helpers/position.h"

struct compile_process;

enum {
    SCAN_ALL_OK,
    SCAN_INPUT_ERROR
};

enum {
    TT_IDENTIFIER,
    TT_KEYWORD,
    TT_OPERATOR,
    TT_SYMBOL,
    TT_NUMBER,
    TT_STRING,
    TT_COMMENT,
    TT_NEWLINE
};

struct token {
    int type;
    int flags;

    /* Types for various tokens */
    union {
        char cval;
        const char* sval;
        unsigned int inum;
        unsigned long lnum;
        unsigned long long llnum;
        void* any;
    };

    bool whitespace;
    const char* between_brackets;

    struct pos file_pos;
};

struct scan_process {
    struct pos pos;
    struct vector* tokens;
    struct compile_process* compiler;

    int current_expression_count;
    struct buffer* parenthesis;
    struct scan_process_functions* function;

    void* private_data;
};

int scan(struct scan_process* process);

struct scan_process* scan_process_create(struct compile_process* compiler, struct scan_process_functions* functions, void* private_data);
void scan_process_free(struct scan_process* process);
void* scan_process_private(struct scan_process* process);
struct vector* scan_process_tokens(struct scan_process* process);

/* Function pointers to abstract scanning utilities */
typedef char (*SCAN_PROCESS_NEXT_CHAR)(struct scan_process* process);
typedef char (*SCAN_PROCESS_PEEK_CHAR)(struct scan_process* process);
typedef void (*SCAN_PROCESS_PUSH_CHAR)(struct scan_process* process, char c);

struct scan_process_functions {
    SCAN_PROCESS_NEXT_CHAR next_char;
    SCAN_PROCESS_PEEK_CHAR peek_char;
    SCAN_PROCESS_PUSH_CHAR push_char;
};

char scan_process_next_char(struct scan_process* scan_process);
char scan_process_peek_char(struct scan_process* scan_process);
void scan_process_push_char(struct scan_process* scan_process, char c);

#endif
