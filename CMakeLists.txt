# Project info
cmake_minimum_required( VERSION 3.22.1 )

set( CMAKE_EXPORT_COMPILE_COMMANDS 1 )
set( CMAKE_BUILD_TYPE Debug )
set( CMAKE_C_STANDARD 17 )
set( CMAKE_C_STANDARD_REQUIRED 1 )

project( cosmic-c LANGUAGES C )

# Files and Libs
set( SOURCE src )
set( INCLUDE includes )
set( TEST test )

set( INCLUDES ${INCLUDE}/helpers/position.h
              ${INCLUDE}/helpers/vector.h
              ${INCLUDE}/helpers/buffer.h
              ${INCLUDE}/compiler.h
              ${INCLUDE}/scanner.h
              ${INCLUDE}/parser.h )

set( SOURCES ${SOURCE}/helpers/vector.c
             ${SOURCE}/helpers/buffer.c
             ${SOURCE}/helpers/position.c
             ${SOURCE}/compiler/compiler.c 
             ${SOURCE}/compiler/compile_process.c 
             ${SOURCE}/scanner/scanner.c
             ${SOURCE}/scanner/scan_process.c
             ${SOURCE}/scanner/token.c
             ${SOURCE}/parser/parser.c
             ${SOURCE}/parser/parse_process.c )


set( LIBRARIES )

# Executables
add_executable( cosmic-c ${SOURCE}/main.c ${INCLUDES} ${SOURCES} )
target_link_libraries( cosmic-c PRIVATE ${LIBRARIES} )

# Tests
enable_testing()

set( TEST_CMD COMMAND $<TARGET_FILE:cosmic-c-test> )
set( TESTS ${TEST}/scanner/test_scanner.h 
           ${TEST}/scanner/test_scanner.c )

add_executable( cosmic-c-test ${TEST}/test.c ${TESTS} ${INCLUDES} ${SOURCES} )
target_link_libraries( cosmic-c-test PRIVATE ${LIBRARIES} )

add_test( NAME scanner_next_token ${TEST_CMD} scanner next_token )
add_test( NAME scanner_operators ${TEST_CMD} scanner operators )
#add_test( NAME scanner_numbers    ${TEST_CMD} scanner numbers )
