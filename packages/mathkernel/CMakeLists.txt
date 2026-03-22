cmake_minimum_required(VERSION 3.20)
project(mathkernel LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ── Eigen (header-only) ─────────────────────────────────────────────────────
# 1. Env var EIGEN3_INCLUDE_DIR (set by Nix devshell or CI)
# 2. CMake cache -DEIGEN3_INCLUDE_DIR=<path>
# 3. find_package (native builds)
# 4. Vendored fallback
if(DEFINED ENV{EIGEN3_INCLUDE_DIR} AND NOT EIGEN3_INCLUDE_DIR)
  set(EIGEN3_INCLUDE_DIR "$ENV{EIGEN3_INCLUDE_DIR}")
endif()

if(EIGEN3_INCLUDE_DIR AND EXISTS "${EIGEN3_INCLUDE_DIR}/Eigen/Dense")
  message(STATUS "Using Eigen from: ${EIGEN3_INCLUDE_DIR}")
elseif(NOT EMSCRIPTEN)
  find_package(Eigen3 3.4 QUIET)
  if(Eigen3_FOUND)
    message(STATUS "Using system Eigen ${EIGEN3_VERSION}")
  else()
    message(FATAL_ERROR "Eigen not found. Set EIGEN3_INCLUDE_DIR or install via Nix.")
  endif()
else()
  message(FATAL_ERROR "Eigen not found. Set EIGEN3_INCLUDE_DIR env var (Nix devshell exports this).")
endif()

# ── Source files ─────────────────────────────────────────────────────────────
# common.hpp is header-only (all inline) — no separate .cpp needed.
set(KERNEL_SOURCES
  # Phase 1: Core (refactored to use common.hpp)
  src/cpp/linalg.cpp
  src/cpp/decompositions.cpp
  src/cpp/regression.cpp
  # Phase 2: Tier 2 critical stubs
  src/cpp/regression_diag.cpp
  src/cpp/timeseries.cpp
  src/cpp/signal.cpp
  src/cpp/robust_stats.cpp
  # Phase 3: Tier 3 vectorized
  src/cpp/vectorized.cpp
  # Phase 4: Tier 4+5
  src/cpp/numerical.cpp
  src/cpp/special.cpp
)

# ── WASM target via Emscripten ───────────────────────────────────────────────
if(EMSCRIPTEN)
  add_executable(mathkernel ${KERNEL_SOURCES})

  target_include_directories(mathkernel PRIVATE
    ${EIGEN3_INCLUDE_DIR}
    ${CMAKE_SOURCE_DIR}/src/cpp
  )

  # C++ exception support (wasm-exceptions for proper propagation to JS)
  target_compile_options(mathkernel PRIVATE -fwasm-exceptions)

  # Embind for JS/TS bindings
  target_link_options(mathkernel PRIVATE
    --bind
    -sEXPORT_ES6=1
    -sMODULARIZE=1
    -sEXPORT_NAME=createMathKernel
    -sALLOW_MEMORY_GROWTH=1
    -sINITIAL_MEMORY=16MB
    -sMAXIMUM_MEMORY=256MB
    -sSTACK_SIZE=1MB
    --emit-tsd mathkernel.d.ts
    -sENVIRONMENT=node,web
    -sWASM_BIGINT=1
    -fwasm-exceptions
  )

  # Output to dist/
  set_target_properties(mathkernel PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/dist"
    OUTPUT_NAME "mathkernel"
    SUFFIX ".js"
  )

else()
  # ── Native target (for NIF or testing) ─────────────────────────────────────
  # Build as a static library that can be linked into a Rustler/Fine NIF.
  # Compile with -DMATHKERNEL_NIF to enable the NIF bridge.

  option(MATHKERNEL_NIF "Build Elixir NIF bridge via fine" OFF)

  if(MATHKERNEL_NIF)
    # NIF target: nif_bridge.cpp + common.hpp (header-only Eigen math)
    add_library(mathkernel_nif SHARED src/cpp/nif_bridge.cpp)

    target_include_directories(mathkernel_nif PRIVATE
      ${EIGEN3_INCLUDE_DIR}
      ${CMAKE_SOURCE_DIR}/src/cpp
    )

    target_compile_definitions(mathkernel_nif PRIVATE MATHKERNEL_NIF)

    # fine and erl_nif headers must be available
    # Set via: -DFINE_INCLUDE_DIR=... -DERL_NIF_INCLUDE_DIR=...
    if(FINE_INCLUDE_DIR)
      target_include_directories(mathkernel_nif PRIVATE ${FINE_INCLUDE_DIR})
    endif()
    if(ERL_NIF_INCLUDE_DIR)
      target_include_directories(mathkernel_nif PRIVATE ${ERL_NIF_INCLUDE_DIR})
    endif()

    set_target_properties(mathkernel_nif PROPERTIES
      OUTPUT_NAME "mathkernel_nif"
      PREFIX ""  # No lib prefix — NIF convention
    )

    message(STATUS "Building Elixir NIF target (fine)")
  else()
    # Plain native static library for testing
    add_library(mathkernel_native STATIC ${KERNEL_SOURCES})
    target_include_directories(mathkernel_native PRIVATE
      ${EIGEN3_INCLUDE_DIR}
      ${CMAKE_SOURCE_DIR}/src/cpp
    )
    message(STATUS "Building native static library (no WASM, no NIF)")
  endif()
endif()
