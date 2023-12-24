/*
 * @author: dwclake
 */

#include "../../includes/helpers/vector.h"

/* Creates a new vector
 * @param type_size The size of the type being stored in the vector
 * @return A new Vector pointer or NULL
 */
vector_t* create_vector(size_t type_size) {
    vector_t* vector = (vector_t*) malloc(sizeof(vector_t));

    vector_t tmp = {
        .data = calloc(VECTOR_REALLOC_AMOUNT, type_size),
        .size = type_size,
        .elements = 0,
        .capacity = VECTOR_REALLOC_AMOUNT
    };

    memcpy(vector, &tmp, sizeof(vector_t));

    return vector;
}

/* Frees a vector from memory
 * @param vector The vector to be freed
 * @return void
 */
void free_vector(vector_t* vector, VECTOR_ELEM_DESTRUCTOR destructor) {
    if (destructor) {
        for (int i = 0; i < vector->capacity; i++) {
            if (vector_at(vector, i)) {
                destructor(vector_at(vector, i));
            }
        }
    }

    free(vector->data);
    free(vector);
}

/* Pushes a new value onto the vector
 * @param vector The vector to push data onto
 * @param data The data to be pushed onto the vector
 * @return void
 */
void vector_push(vector_t* vector, const void* data) {
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
void* vector_peek(vector_t* vector) {
    if (vector->elements <= 0) return NULL;

    void* value = vector_at(vector, vector->elements - 1);

    return value;
}

/* Pops a value off the end of the vector
 * @param vector The vector to pop an element off of
 * @return The void* to the element at the end of the vector
 */
void* vector_pop(vector_t* vector) {
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
void* vector_at(vector_t* vector, int i) {
    if (i > vector->elements) return NULL;

    return vector->data + (i * vector->size);
}

/* Returns the pointer to the vector data
 * @param vector The vector to get the data pointer from
 * @return The void* to the vector data
 */
void* vector_ptr(vector_t* vector) {
    return vector->data;
}
