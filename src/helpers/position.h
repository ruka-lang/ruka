/*
 *  @author: dwclake
 */

#ifndef POSITION_H
#define POSITION_H

/* File position structure */
struct pos {
    int line;
    int col;
    const char* filename;
};

#endif
