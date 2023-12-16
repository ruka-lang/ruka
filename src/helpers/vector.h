/*
 * @author: dwclake
 */

#ifndef VECTOR_H
#define VECTOR_H

#include <stddef.h>
#include <stdlib.h>
#include <memory.h>

#define VECTOR_REALLOC_AMOUNT 20
struct vector {
    void* data;
    size_t size;
    int elements;
    int capacity;
};

struct vector* vector_create(size_t type_size);
void vector_free(struct vector* vector);
void vector_push(struct vector* vector, void* data);
void* vector_pop(struct vector* vector);
void* vector_at(struct vector* vector, int idx);

#endif
