# Project info
cmake_minimum_required( VERSION 3.22.1 )

set( CMAKE_EXPORT_COMPILE_COMMANDS 1 )
set( CMAKE_BUILD_TYPE Debug )

project( rex-c LANGUAGES C )

# Files and Libs
set( SRC src )
set( TST test )

set( HEAD ${SRC}/compiler/compiler.h )

set( SRCS ${SRC}/compiler/compiler.c 
          ${SRC}/compiler/cprocess.c )

set( TSTS ${TST}/scanner/scanner.h ${TST}/scanner/scanner.c )

set( LIBS )

# Executables
add_executable( rex-c ${SRC}/main.c ${HEAD} ${SRCS} )
target_link_libraries( rex-c PRIVATE ${LIBS} )

add_executable( rex-c-test ${TST}/test.c ${TSTS} ${HEAD} ${SRCS} )
target_link_libraries( rex-c-test PRIVATE ${LIBS} )

# Tests
enable_testing()

add_test(
    NAME scanner-test COMMAND $<TARGET_FILE:rex-c-test> --scanner
)
