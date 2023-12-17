/*
 * @author: dwclake
 */

#include "vector.h"

/* Creates a new vector */
struct Vector* create_vector(size_t type_size) {
    struct Vector* vector = calloc(1, sizeof(struct Vector));

    struct Vector tmp = {
        .data = calloc(20, type_size),
        .size = type_size,
        .elements = 0,
        .capacity = 20
    };

    memcpy(vector, &tmp, sizeof(struct Vector));

    return vector;
}

/* Frees a vector from memory */
void free_vector(struct Vector* vector) {
    free(vector->data);
    free(vector);
}

/* Pushes a new value onto the vector */
void vector_push(struct Vector* vector, void* data) {
    if (vector->elements >= vector->capacity) {
        vector->data = realloc( 
                vector->data, 
                vector->capacity + VECTOR_REALLOC_AMOUNT 
        );

        vector->capacity += VECTOR_REALLOC_AMOUNT;
        assert(vector->data);
    }

    void* ptr = vector_at(vector, vector->elements);
    memcpy(ptr, data, vector->size);

    vector->elements++;
}

/* Pops a value off the end of the vector */
void* vector_pop(struct Vector* vector) {
    if (vector->elements <= 0) return NULL;

    void* value = vector_at(vector, vector->elements - 1);
    vector->elements--;

    return value;
}

/* Indexes into the vector to get the i'th element */
void* vector_at(struct Vector* vector, int i) {
    if (i >= vector->elements) return NULL;

    return vector->data + (i * vector->size);
}
