cmake_minimum_required( VERSION 3.22.1 )

set( CMAKE_EXPORT_COMPILE_COMMANDS 1 )
set( CMAKE_BUILD_TYPE Debug )

project( rex-c LANGUAGES C )

set( SRC src )
set( TST test )
set( HEAD )
set( LIBS )
set( SRCS )
set( TSTS )

add_executable( rex-c ${SRC}/main.c
                      ${HEAD} 
                      ${SRCS} )
target_link_libraries( rex-c PRIVATE ${LIBS} )

add_executable( rex-c-test ${TST}/test.c
                           ${TSTS} 
                           ${HEAD} 
                           ${SRCS} )
target_link_libraries( rex-c-test PRIVATE ${LIBS} )

enable_testing()

add_test(
    NAME scanner-test
    COMMAND $<TARGET_FILE:rex-c-test> --scanner
)
