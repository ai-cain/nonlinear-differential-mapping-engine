#include "mapping_engine.hpp"

#include <sstream>
#include <stdexcept>
#include <vector>

namespace {

std::vector<std::string> split_string(const std::string& value, char delimiter) {
    std::vector<std::string> parts;
    std::stringstream ss(value);
    std::string token;

    while (std::getline(ss, token, delimiter)) {
        parts.push_back(token);
    }

    return parts;
}

std::string escape_json(const std::string& value) {
    std::string escaped;
    escaped.reserve(value.size());

    for (char character : value) {
        switch (character) {
            case '\\':
                escaped += "\\\\";
                break;
            case '"':
                escaped += "\\\"";
                break;
            case '\n':
                escaped += "\\n";
                break;
            default:
                escaped += character;
                break;
        }
    }

    return escaped;
}

} // namespace

MappingEngine::MappingEngine(EmitFn emit_fn)
    : emit_fn_(std::move(emit_fn)) {
}

void MappingEngine::start() {
    emit_ready();
    emit_state();
}

void MappingEngine::stop() {
}

void MappingEngine::handle_command(const std::string& line) {
    if (line.empty()) {
        return;
    }

    try {
        const std::vector<std::string> parts = split_string(line, '\t');
        if (parts.empty()) {
            return;
        }

        const std::string& command = parts[0];

        if (command == "CONFIG") {
            if (parts.size() < 10) {
                throw std::runtime_error("CONFIG command requires 9 arguments.");
            }

            MapConfig config{};
            config.map_id = parts[1];
            config.parameter_a = std::stod(parts[2]);
            config.parameter_b = std::stod(parts[3]);
            config.grid_columns = std::stoi(parts[4]);
            config.grid_rows = std::stoi(parts[5]);
            config.domain_extent = std::stod(parts[6]);
            config.selected_x = std::stod(parts[7]);
            config.selected_y = std::stod(parts[8]);
            config.neighborhood_radius = std::stod(parts[9]);

            if (!system_.matches_config(config)) {
                system_.configure(config);
                ++revision_;
            }

            emit_state();
            return;
        }

        if (command == "RESET") {
            system_.reset();
            ++revision_;
            emit_state();
            return;
        }

        if (command == "REQUEST_STATE") {
            emit_state();
            return;
        }

        throw std::runtime_error("Unknown engine command: " + command);
    } catch (const std::exception& error) {
        emit_error(error.what());
    }
}

void MappingEngine::emit_ready() const {
    if (emit_fn_) {
        emit_fn_("{\"type\":\"ready\"}");
    }
}

void MappingEngine::emit_error(const std::string& message) const {
    if (!emit_fn_) {
        return;
    }

    emit_fn_(
        std::string("{\"type\":\"error\",\"message\":\"") + escape_json(message) + "\"}"
    );
}

void MappingEngine::emit_state() const {
    if (emit_fn_) {
        emit_fn_(system_.to_json(revision_));
    }
}
