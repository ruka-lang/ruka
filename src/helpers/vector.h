/*
 * @author: dwclake
 */

#ifndef VECTOR_H
#define VECTOR_H

#include <stddef.h>
#include <stdlib.h>
#include <memory.h>
#include <assert.h>

#define VECTOR_REALLOC_AMOUNT 20
struct Vector {
    void* data;
    const size_t size;
    int elements;
    int capacity;
};

/* Creates a new vector
 * @param type_size
 * @return A new Vector pointer or NULL
 */
struct Vector* create_vector(size_t type_size);

/* Frees a vector from memory
 * @param vector
 * @return void
 */
void free_vector(struct Vector* vector);

/* Pushes a new value onto the vector
 * @param vector
 * @param data
 * @return void
 */
void vector_push(struct Vector* vector, void* data);

/* Pops a value off the end of the vector
 * @param vector
 * @return The void* to the element at the end of the vector
 */
void* vector_pop(struct Vector* vector);

/* Indexes into the vector to get the i'th element
 * @param vector
 * @param i
 * @return The void* to the element at i
 */
void* vector_at(struct Vector* vector, int i);

#endif
