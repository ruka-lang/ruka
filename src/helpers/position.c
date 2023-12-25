/*
 * @author: dwclake
 */

#include "../../includes/helpers/position.h"

/*
 *
 */
pos_t new_pos(int line, int col, const char* path) {
    return (pos_t){
        .line = line,
        .col = col,
        .path = path
    };
}
