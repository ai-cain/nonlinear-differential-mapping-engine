cmake_minimum_required(VERSION 3.14)
project(NonlinearDifferentialMappingEngine VERSION 1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

add_executable(
    nonlinear_differential_mapping_cli
    src/main.cpp
    src/differential_map_system.cpp
    src/mapping_engine.cpp
)
