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
struct Buffer {
    char* data;
    const size_t size;
    int elements;
    int capacity;
};

/* Creates a new buffer
 * @param type_size The size of the type being stored in the buffer
 * @return A new Buffer pointer or NULL
 */
struct Buffer* create_buffer();

/* Frees a buffer from memory
 * @param buffer The buffer to be freed
 * @return void
 */
void free_buffer(struct Buffer* buffer);

/* Pushes a new value onto the buffer
 * @param buffer The buffer to push data onto
 * @param data The data to be pushed onto the buffer
 * @return void
 */
void buffer_write(struct Buffer* buffer, char data);

/* Peeks the last value from the buffer
 * @param buffer The buffer to peek from
 * @return The void* to the element at the end of the buffer
 */
char* buffer_peek(struct Buffer* buffer);

/* Pops a value off the end of the buffer
 * @param buffer The buffer to pop an element off of
 * @return The void* to the element at the end of the buffer
 */
char* buffer_pop(struct Buffer* buffer);

/* Indexes into the buffer to get the i'th element
 * @param buffer The buffer to index into
 * @param i The index of the element to access
 * @return The void* to the element at i
 */
char* buffer_read(struct Buffer* buffer, int i);

/* Returns the pointer to the buffer data
 * @param buffer The buffer to get the data pointer from
 * @return The char* to the buffer data
 */
char* buffer_ptr(struct Buffer* buffer);

#endif
