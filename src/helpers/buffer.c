/*
 * @author: dwclake
 */

#include "../../includes/helpers/buffer.h"

/* Creates a new buffer
 * @param type_size The size of the type being stored in the buffer
 * @return A new Buffer pointer or NULL
 */
buffer_t* new_buffer() {
    buffer_t* buffer = (buffer_t*) malloc(sizeof(buffer_t));
    
    buffer_t tmp = {
        .data = (char*) calloc(BUFFER_REALLOC_AMOUNT, sizeof(char)),
        .size = sizeof(char),
        .elements = 0,
        .capacity = BUFFER_REALLOC_AMOUNT
    };

    memcpy(buffer, &tmp, sizeof(buffer_t));

    return buffer;
}

/* Frees a buffer from memory
 * @param buffer The buffer to be freed
 * @return void
 */
void free_buffer(buffer_t* buffer) {
    if (buffer->data) {
        free(buffer->data);
    }

    free(buffer);
}

/* Pushes a new value onto the buffer
 * @param buffer The buffer to push data onto
 * @param data The data to be pushed onto the buffer
 * @return void
 */
void buffer_write(buffer_t* buffer, char data) {
    if (buffer->elements >= buffer->capacity) {
        buffer->data = realloc( 
            buffer->data, 
            buffer->size * (buffer->capacity + BUFFER_REALLOC_AMOUNT) 
        );

        buffer->capacity += BUFFER_REALLOC_AMOUNT;
        assert(buffer->data);
    }

    void* ptr = buffer_read(buffer, buffer->elements);
    memcpy(ptr, &data, buffer->size);

    buffer->elements++;
}

/* Peeks the last value from the buffer
 * @param buffer The buffer to peek from
 * @return The void* to the element at the end of the buffer
 */
char* buffer_peek(buffer_t* buffer) {
    if (buffer->elements <= 0) return NULL;

    char* value = buffer_read(buffer, buffer->elements - 1);

    return value;
}

/* Pops a value off the end of the buffer
 * @param buffer The buffer to pop an element off of
 * @return The void* to the element at the end of the buffer
 */
char* buffer_pop(buffer_t* buffer) {
    if (buffer->elements <= 0) return NULL;

    char* value = buffer_read(buffer, buffer->elements - 1);
    buffer->elements--;

    return value;
}

/* Indexes into the buffer to get the i'th element
 * @param buffer The buffer to index into
 * @param i The index of the element to access
 * @return The void* to the element at i
 */
char* buffer_read(buffer_t* buffer, int i) {
    if (i > buffer->elements) return NULL;

    return buffer->data + (i * buffer->size);
}

/* Returns the pointer to the buffer data
 * @param buffer The buffer to get the data pointer from
 * @return The char* to the buffer data
 */
char* buffer_ptr(buffer_t* buffer) {
    return buffer->data;
}
