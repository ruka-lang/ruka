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
token_t* create_token(scanner_t* scanner, int type, pos_t pos) {
    token_t* token = create_token_with_all(scanner, type, pos, false, 0, NULL);

    return token;
}

/* Creates a new token
 * @param scanner The scanner process the token will belong to
 * @param type The type of the token
 * @param data The data of the token
 * @param pos The position of the token
 * @param whitespace True if there is whitespace after this token
 * @param flags Token flags
 * @param between_brackets Data between brackets
 * @return A pointer to a new token_t or NULL
 */
token_t* create_token_with_all(
    scanner_t* scanner, 
    int type, 
    pos_t pos, 
    bool whitespace,
    int flags,
    char* between_brackets
) {
    token_t* token = (token_t*) malloc(sizeof(token_t));

    token->type = type;
    token->pos= pos;
    token->flags = flags;
    token->whitespace = whitespace;
    token->between_brackets = between_brackets;
    token->data.llnum = 0;

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
