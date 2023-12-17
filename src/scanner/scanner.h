/*
 *  @author: dwclake
 */

#ifndef SCANNER_H
#define SCANNER_H

#include <stdbool.h>
#include "../helpers/position.h"
#include "../helpers/vector.h"
#include "../helpers/buffer.h"

struct compile_process;

/* Scan flags */
enum {
    SCANNER_FILE_SCANNED_OK,
    SCANER_FAILED_WITH_ERRORS
};

/* Token types */
enum {
    IDENTIFIER,
    KEYWORD,
    OPERATOR,
    SYMBOL,
    INTEGER,
    FLOAT,
    STRING,
    REGEX,
    COMMENT,
    NEWLINE
};

/* Token struct */
struct token {
    int type;
    int flags;

    /* Data for various tokens */
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

/* State for the scanning process */
struct scan_process {
    struct pos pos;
    struct vector* tokens;
    struct compile_process* compiler;

    int current_expression_count;
    struct buffer* parenthesis;
    struct scan_process_functions* function;

    void* private_data;
};

/* Scans the file in the scan process */
int scan(struct scan_process* process);

/* Scan process constructors/destructors/getters */
struct scan_process* scan_process_create(struct compile_process* compiler, 
                                         struct scan_process_functions* functions, 
                                         void* private_data);
void scan_process_free(struct scan_process* process);
void* scan_process_private(struct scan_process* process);
struct vector* scan_process_tokens(struct scan_process* process);

/* Function pointers to abstract scanning utilities */
typedef char (*SCAN_PROCESS_NEXT_CHAR)(struct scan_process* process);
typedef char (*SCAN_PROCESS_PEEK_CHAR)(struct scan_process* process);
typedef void (*SCAN_PROCESS_PUSH_CHAR)(struct scan_process* process, char c);

/* Struct representing the scanning functions used by the scan process */
struct scan_process_functions {
    SCAN_PROCESS_NEXT_CHAR next_char;
    SCAN_PROCESS_PEEK_CHAR peek_char;
    SCAN_PROCESS_PUSH_CHAR push_char;
};

/* Default scan process functions */
char scan_process_next_char(struct scan_process* scan_process);
char scan_process_peek_char(struct scan_process* scan_process);
void scan_process_push_char(struct scan_process* scan_process, char c);

#endif
