/*
 * @author: dwclake
 */

#ifndef BUFFER_H
#define BUFFER_H

#include <stddef.h>
#include <stdlib.h>
#include <memory.h>
#include <assert.h>

#define BUFFER_REALLOC_AMOUNT 2000
typedef struct buffer_t {
    char* data;
    const size_t size;
    int elements;
    int capacity;
} buffer_t;

/* Creates a new buffer
 * @param type_size The size of the type being stored in the buffer
 * @return A new Buffer pointer or NULL
 */
buffer_t* create_buffer();

/* Frees a buffer from memory
 * @param buffer The buffer to be freed
 * @return void
 */
void free_buffer(buffer_t* buffer);

/* Pushes a new value onto the buffer
 * @param buffer The buffer to push data onto
 * @param data The data to be pushed onto the buffer
 * @return void
 */
void buffer_write(buffer_t* buffer, char data);

/* Peeks the last value from the buffer
 * @param buffer The buffer to peek from
 * @return The void* to the element at the end of the buffer
 */
char* buffer_peek(buffer_t* buffer);

/* Pops a value off the end of the buffer
 * @param buffer The buffer to pop an element off of
 * @return The void* to the element at the end of the buffer
 */
char* buffer_pop(buffer_t* buffer);

/* Indexes into the buffer to get the i'th element
 * @param buffer The buffer to index into
 * @param i The index of the element to access
 * @return The void* to the element at i
 */
char* buffer_read(buffer_t* buffer, int i);

/* Returns the pointer to the buffer data
 * @param buffer The buffer to get the data pointer from
 * @return The char* to the buffer data
 */
char* buffer_ptr(buffer_t* buffer);

#endif
