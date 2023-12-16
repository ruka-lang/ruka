/*
 * @author: dwclake
 */

#include "vector.h"

/* Creates a new dynamic vector */
struct vector* vector_create(size_t type_size) {
    struct vector* vector = calloc(1, sizeof(struct vector));

    struct vector tmp = {
        .data = calloc(20, type_size),
        .size = type_size,
        .elements = 0,
        .capacity = 20
    };

    memcpy(vector, &tmp, sizeof(struct vector));

    return vector;
}

/* Frees a dynamic vector */
void vector_free(struct vector* vector) {
    free(vector->data);
    free(vector);
}

/* Pushes a new value onto the dynamic vector, reallocs when full */
void vector_push(struct vector* vector, void* data) {
    if ((*vector).elements >= (*vector).capacity) {
        (*vector).data = realloc((*vector).data, (*vector).capacity + VECTOR_REALLOC_AMOUNT);
        (*vector).capacity += VECTOR_REALLOC_AMOUNT;
        assert((*vector).data);
    }

    void* ptr = vector_at(vector, (*vector).elements);
    memcpy(ptr, data, (*vector).size);

    (*vector).elements++;
}

/* Pops the element from the end of the vector */
void* vector_pop(struct vector* vector) {
    if ((*vector).elements <= 0) return NULL;

    void* value = vector_at(vector, (*vector).elements - 1);
    (*vector).elements--;

    return value;
}

/* Returns a pointer to the element at idx */
void* vector_at(struct vector* vector, int idx) {
    if (idx >= (*vector).elements) return NULL;

    return (*vector).data + (idx * (*vector).size);
}
