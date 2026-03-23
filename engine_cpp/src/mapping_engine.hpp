#ifndef MAPPING_ENGINE_HPP
#define MAPPING_ENGINE_HPP

#include "differential_map_system.hpp"

#include <functional>
#include <string>

class MappingEngine {
public:
    using EmitFn = std::function<void(const std::string&)>;

    explicit MappingEngine(EmitFn emit_fn);

    void start();
    void stop();
    void handle_command(const std::string& line);

private:
    EmitFn emit_fn_;
    DifferentialMapSystem system_;
    int revision_{0};

    void emit_ready() const;
    void emit_error(const std::string& message) const;
    void emit_state() const;
};

#endif
