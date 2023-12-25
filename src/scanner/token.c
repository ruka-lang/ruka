/*
 *  @author: dwclake
 */

#include <stdlib.h>
#include <string.h>
#include "../../includes/scanner.h"

/* Creates a new token
 * @param scanner The scanner token the token will belong to
 * @return A pointer to a new token_t or NULL
 */
token_t* new_token(scanner_t* scanner, int type, pos_t pos) {
    token_t* token = new_token_with_all(scanner, type, NULL, 0, pos, false);

    return token;
}

/* Creates a new token
 * @param scanner The scanner process the token will belong to
 * @param type The type of the token
 * @param data The data of the token
 * @param len The length of string if data is a string
 * @param pos The position of the token
 * @param whitespace True if there is whitespace after this token
 * @return A pointer to a new token_t or NULL
 */
token_t* new_token_with_all(
    scanner_t* scanner, 
    int type, 
    void* data,
    int len,
    pos_t pos, 
    bool whitespace
) {
    token_t* token = (token_t*) malloc(sizeof(token_t));

    token->type = type;
    token->pos= pos;
    token->flags = 0;
    token->whitespace = whitespace;
    token->data.inum = 0;

    char* sval = NULL;
    switch (type) {
        case KEYWORD:
        case IDENTIFIER:
            sval = calloc(len, sizeof(char));
            memcpy(sval, data, len); 
            token->data.sval = sval;
            break;
        case INTEGER:
            memcpy(&token->data.inum, data, sizeof(u64));
            break;
        case SYMBOL:
            memcpy(&token->data.cval, data, sizeof(char));
            break;
    }

    return token;
}

/* Frees a token from memory
 * @param token The token to be freed
 * @return void
 */
void free_token(token_t* token) {
    if (!token) return;

    if (
        token->type == IDENTIFIER ||
        token->type == KEYWORD &&
        token->data.sval != NULL
    ) {
        free(token->data.sval);
    }
}