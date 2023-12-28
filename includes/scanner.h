/*
 *  @author: dwclake
 */

#ifndef SCANNER_H
#define SCANNER_H

#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include "helpers/position.h"
#include "helpers/vector.h"
#include "helpers/buffer.h"
#include "compiler.h"

/* Scanner messages */
enum {
    SCANNER_FILE_SCANNED_OK,
    SCANER_FAILED_WITH_ERRORS
};

/* Token types */
enum {
    IDENTIFIER,
    KEYWORD,
    SYMBOL,
    INTEGER,
    FLOAT,
    STRING,
    REGEX,
    COMMENT
};

/* Token structure */
typedef struct token_t {
    pos_t pos;
    /* Data for various tokens */
    union {
        char cval;
        char* sval;
        double fval;
        uint64_t inum;
        void* any;
    } data;

    int type;
    uint32_t flags;
} token_t;

typedef struct scanner_functions_t scanner_functions_t;

/* State for the scanning process */
typedef struct scanner_t {
    pos_t curr_pos;
    pos_t token_pos;
    vector_t* tokens;
    compiler_t* compiler;
    buffer_t* parenthesis;
    scanner_functions_t* function;

    size_t read_pos;
    int current_expression_count;

    void* private_data;
} scanner_t;

/* Fuction types to abstract some scanning functionality */
typedef char (*SCANNER_NEXT_CHAR)(scanner_t* process);
typedef char (*SCANNER_PEEK_CHAR)(scanner_t* process);
typedef void (*SCANNER_PUSH_CHAR)(scanner_t* process, char c);

/* Struct representing the scanning functions used by the scan process */
struct scanner_functions_t {
    SCANNER_NEXT_CHAR next_char;
    SCANNER_PEEK_CHAR peek_char;
    SCANNER_PUSH_CHAR push_char;
};

/* Scans the file in the scan process
 * @param process The scanner process to be used in scanning
 * @return A integer signaling the result of the scan
 */
int scan(scanner_t* process);

/* Reads the next token from the scanner process
 * @param process The scanner process to read from
 * @return The next token in the input file
 */
token_t* read_next_token(scanner_t* process);

/* Creates a new scanner process
 * @param compiler The compiler process the scanner will belong to
 * @param functions The functions the scanner will use
 * @param private_data The private data only the caller understands
 * @return A pointer to a new Scanner or NULL
 */
scanner_t* new_scanner(compiler_t* compiler, 
                       scanner_functions_t* functions, 
                       void* private_data
                       );

/* Frees a scanner process from memory
 * @param process The scanner process to be freed
 * @return void
 */
void free_scanner(scanner_t* process);

/* Retrieves scanner's private data
 * @param process The scanner whose private data is being retrieved
 * @return void
 */
void* scanner_private(scanner_t* process);

/* Retrieves scanner's tokens vector
 * @param process The scanner whose tokens vector is being retrieved
 * @return Pointer to the Token Vector
 */
struct Vector* scanner_tokens(scanner_t* process);

/* Retrieves the next char from the scanner, advancing the read position
 * @param process The process to retrieve the next char from
 * @return The next char in the file
 */
char scanner_next_char(scanner_t* process);

/* Retrieves the next char from the scanner without moving the read position
 * @param process The process to peek the next char from
 * @return The next char in the file
 */
char scanner_peek_char(scanner_t* process);

/* Pushes c onto the file
 * @param process The scanner containing the file to push the char onto
 * @param c The char to push onto the file
 * @return void
 */
void scanner_push_char(scanner_t* process, char c);

/* Creates a new token
 * @param scanner The scanner process the token will belong to
 * @param type The type of the token
 * @return A pointer to a new token_t or NULL
 */
token_t* new_token(scanner_t* scanner, int type);

/* Creates a new token
 * @param type The type of the token
 * @param data The data of the token
 * @param len The len of data if string
 * @param pos The position of the token
 * @param whitespace True if there is whitespace after this token
 * @return A pointer to a new token_t or NULL
 */
token_t* new_token_with_all(int type, 
                            void* data,
                            size_t len,
                            pos_t pos, 
                            uint32_t flags
                            );

/* Frees a token from memory
 * @param token The token to be freed
 * @return void
 */
void free_token(token_t* token);

#endif
