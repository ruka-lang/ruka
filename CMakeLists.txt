cmake_minimum_required(VERSION 3.22.1)

set(CMAKE_EXPORT_COMPILE_COMMANDS 1)

project(rex-c LANGUAGES C)


set(INC inc)
set(SRC src)
set(TST tst)
set(INCS)
set(LIBS)
set(SRCS)
set(TSTS)

add_executable(rex-c ${SRC}/main.c
                     ${INCS} 
                     ${SRCS})
target_link_libraries(rex-c PRIVATE ${LIBS})

add_executable(rex-c-test ${TST}/test.c
                           ${TSTS} 
                           ${INCS} 
                           ${SRCS})
target_link_libraries(rex-c-test PRIVATE ${LIBS})

enable_testing()

add_test(
    NAME scanner-test
    COMMAND $<TARGET_FILE:rex-c-test> --scanner
)
