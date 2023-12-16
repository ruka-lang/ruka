# Project info
cmake_minimum_required( VERSION 3.22.1 )

set( CMAKE_EXPORT_COMPILE_COMMANDS 1 )
set( CMAKE_BUILD_TYPE Debug )

project( rex-c LANGUAGES C )

# Files and Libs
set( SOURCE src )
set( TEST test )

set( HEAD ${SOURCE}/compiler/compiler.h
          ${SOURCE}/helpers/position.h
          ${SOURCE}/helpers/vector.h
          ${SOURCE}/helpers/buffer.h
          ${SOURCE}/scanner/scanner.h
          ${SOURCE}/parser/parser.h )

set( SOURCES ${SOURCE}/compiler/compiler.c 
             ${SOURCE}/compiler/cprocess.c 
             ${SOURCE}/helpers/vector.c
             ${SOURCE}/helpers/buffer.c
             ${SOURCE}/scanner/scanner.c
             ${SOURCE}/scanner/sprocess.c
             ${SOURCE}/parser/parser.c
             ${SOURCE}/parser/pprocess.c )

set( TESTS ${TEST}/scanner/scanner.h ${TEST}/scanner/scanner.c )

set( LIBRARIES )

# Executables
add_executable( rex-c ${SOURCE}/main.c ${HEAD} ${SOURCES} )
target_link_libraries( rex-c PRIVATE ${LIBRARIES} )

add_executable( rex-c-test ${TEST}/test.c ${TESTS} ${HEAD} ${SOURCES} )
target_link_libraries( rex-c-test PRIVATE ${LIBRARIES} )

# Tests
enable_testing()

add_test(
    NAME scanner-test COMMAND $<TARGET_FILE:rex-c-test> --scanner
)
