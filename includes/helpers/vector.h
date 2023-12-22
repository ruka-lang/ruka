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
typedef struct vector_t {
    void* data;
    const size_t size;
    int elements;
    int capacity;
} vector_t;

/* Creates a new vector
 * @param type_size The size of the type being stored in the vector
 * @return A new Vector pointer or NULL
 */
vector_t* create_vector(size_t type_size);

/* Frees a vector from memory
 * @param vector The vector to be freed
 * @return void
 */
void free_vector(vector_t* vector);

/* Pushes a new value onto the vector
 * @param vector The vector to push data onto
 * @param data The data to be pushed onto the vector
 * @return void
 */
void vector_push(vector_t* vector, const void* data);

/* Peeks the last value from the vector
 * @param vector The vector to peek from
 * @return The void* to the element at the end of the vector
 */
void* vector_peek(vector_t* vector);

/* Pops a value off the end of the vector
 * @param vector The vector to pop an element off of
 * @return The void* to the element at the end of the vector
 */
void* vector_pop(vector_t* vector);

/* Indexes into the vector to get the i'th element
 * @param vector The vector to index into
 * @param i The index of the element to access
 * @return The void* to the element at i
 */
void* vector_at(vector_t* vector, int i);

/* Returns the pointer to the vector data
 * @param vector The vector to get the data pointer from
 * @return The void* to the vector data
 */
void* vector_ptr(vector_t* vector);

#endif
