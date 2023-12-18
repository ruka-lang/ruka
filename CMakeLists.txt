# Project info
cmake_minimum_required( VERSION 3.22.1 )

set( CMAKE_EXPORT_COMPILE_COMMANDS 1 )
set( CMAKE_BUILD_TYPE Debug )

project( iodine-c LANGUAGES C )

# Files and Libs
set( SOURCE src )
set( TEST test )

set( HEAD ${SOURCE}/helpers/position.h
          ${SOURCE}/helpers/vector.h
          ${SOURCE}/helpers/buffer.h
          ${SOURCE}/compiler/compiler.h
          ${SOURCE}/scanner/scanner.h
          ${SOURCE}/parser/parser.h )

set( SOURCES ${SOURCE}/helpers/vector.c
             ${SOURCE}/helpers/buffer.c
             ${SOURCE}/compiler/compiler.c 
             ${SOURCE}/compiler/compile_process.c 
             ${SOURCE}/scanner/scanner.c
             ${SOURCE}/scanner/scan_process.c
             ${SOURCE}/parser/parser.c
             ${SOURCE}/parser/parse_process.c )

set( TESTS ${TEST}/scanner/scanner.h ${TEST}/scanner/scanner.c )

set( LIBRARIES )

# Executables
add_executable( iodine-c ${SOURCE}/main.c ${HEAD} ${SOURCES} )
target_link_libraries( iodine-c PRIVATE ${LIBRARIES} )

add_executable( iodine-c-test ${TEST}/test.c ${TESTS} ${HEAD} ${SOURCES} )
target_link_libraries( iodine-c-test PRIVATE ${LIBRARIES} )

# Tests
enable_testing()

add_test(
    NAME scanner-test COMMAND $<TARGET_FILE:iodine-c-test> --scanner
)
