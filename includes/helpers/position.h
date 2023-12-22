/*
 *  @author: dwclake
 */

#ifndef POSITION_H
#define POSITION_H

/* File position structure */
typedef struct {
    int line;
    int col;
    const char* filename;
} pos_t;

#endif
