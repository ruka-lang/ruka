/*
 * @author: dwclake
 */

#include "../../includes/helpers/buffer.h"

/* Creates a new buffer
 * @param type_size The size of the type being stored in the buffer
 * @return A new Buffer pointer or NULL
 */
struct Buffer* create_buffer() {
    struct Buffer* buffer = (struct Buffer*) malloc(sizeof(struct Buffer));
    
    struct Buffer tmp = {
        .data = (char*) calloc(BUFFER_REALLOC_AMOUNT, sizeof(char)),
        .size = sizeof(char),
        .elements = 0,
        .capacity = BUFFER_REALLOC_AMOUNT
    };

    memcpy(buffer, &tmp, sizeof(struct Buffer));

    return buffer;
}

/* Frees a buffer from memory
 * @param buffer The buffer to be freed
 * @return void
 */
void free_buffer(struct Buffer* buffer) {
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
void buffer_write(struct Buffer* buffer, char data) {
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
char* buffer_peek(struct Buffer* buffer) {
    if (buffer->elements <= 0) return NULL;

    char* value = buffer_read(buffer, buffer->elements - 1);

    return value;
}

/* Pops a value off the end of the buffer
 * @param buffer The buffer to pop an element off of
 * @return The void* to the element at the end of the buffer
 */
char* buffer_pop(struct Buffer* buffer) {
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
char* buffer_read(struct Buffer* buffer, int i) {
    if (i > buffer->elements) return NULL;

    return buffer->data + (i * buffer->size);
}

/* Returns the pointer to the buffer data
 * @param buffer The buffer to get the data pointer from
 * @return The char* to the buffer data
 */
char* buffer_ptr(struct Buffer* buffer) {
    return buffer->data;
}
