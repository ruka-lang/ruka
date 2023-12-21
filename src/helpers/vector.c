/*
 * @author: dwclake
 */

#include "vector.h"

/* Creates a new vector
 * @param type_size The size of the type being stored in the vector
 * @return A new Vector pointer or NULL
 */
struct Vector* create_vector(size_t type_size) {
    struct Vector* vector = malloc(sizeof(struct Vector));

    vector->data = calloc(VECTOR_REALLOC_AMOUNT, type_size);
    vector->size = type_size;
    vector->elements = 0;
    vector->capacity = VECTOR_REALLOC_AMOUNT;

    return vector;
}

/* Frees a vector from memory
 * @param vector The vector to be freed
 * @return void
 */
void free_vector(struct Vector* vector) {
    free(vector->data);
    free(vector);
}

/* Pushes a new value onto the vector
 * @param vector The vector to push data onto
 * @param data The data to be pushed onto the vector
 * @return void
 */
void vector_push(struct Vector* vector, const void* data) {
    if (vector->elements >= vector->capacity) {
        vector->data = realloc( 
            vector->data, 
            vector->size * (vector->capacity + VECTOR_REALLOC_AMOUNT)
        );

        vector->capacity += VECTOR_REALLOC_AMOUNT;
        assert(vector->data);
    }

    void* ptr = vector_at(vector, vector->elements);
    memcpy(ptr, data, vector->size);

    vector->elements++;
}

/* Peeks the last value from the vector
 * @param vector The vector to peek from
 * @return The void* to the element at the end of the vector
 */
void* vector_peek(struct Vector* vector) {
    if (vector->elements <= 0) return NULL;

    void* value = vector_at(vector, vector->elements - 1);

    return value;
}

/* Pops a value off the end of the vector
 * @param vector The vector to pop an element off of
 * @return The void* to the element at the end of the vector
 */
void* vector_pop(struct Vector* vector) {
    if (vector->elements <= 0) return NULL;

    void* value = vector_at(vector, vector->elements - 1);
    vector->elements--;

    return value;
}

/* Indexes into the vector to get the i'th element
 * @param vector The vector to index into
 * @param i The index of the element to access
 * @return The void* to the element at i
 */
void* vector_at(struct Vector* vector, int i) {
    if (i > vector->elements) return NULL;

    return vector->data + (i * vector->size);
}

/* Returns the pointer to the vector data
 * @param vector The vector to get the data pointer from
 * @return The void* to the vector data
 */
void* vector_ptr(struct Vector* vector) {
    return vector->data;
}
