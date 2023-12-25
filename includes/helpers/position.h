/*
 *  @author: dwclake
 */

#ifndef POSITION_H
#define POSITION_H

/* File position structure */
typedef struct pos_t {
    int line;
    int col;
    const char* path;
} pos_t;

/*
 *
 */
pos_t new_pos(int line, int col, const char* path);

#endif
