#include "differential_map_system.hpp"
#include "mapping_engine.hpp"

#include <iostream>
#include <string>

int main(int argc, char* argv[]) {
    if (argc >= 2 && std::string(argv[1]) == "--stdio-server") {
        MappingEngine engine([](const std::string& line) {
            std::cout << line << std::endl;
        });

        engine.start();

        std::string line;
        while (std::getline(std::cin, line)) {
            engine.handle_command(line);
        }

        engine.stop();
        return 0;
    }

    MapConfig config{
        argc >= 2 ? std::string(argv[1]) : "quadratic_map",
        argc >= 3 ? std::stod(argv[2]) : 0.0,
        argc >= 4 ? std::stod(argv[3]) : 0.0,
        argc >= 5 ? std::stoi(argv[4]) : 17,
        argc >= 6 ? std::stoi(argv[5]) : 17,
        argc >= 7 ? std::stod(argv[6]) : 2.0,
        argc >= 8 ? std::stod(argv[7]) : 0.85,
        argc >= 9 ? std::stod(argv[8]) : 0.45,
        argc >= 10 ? std::stod(argv[9]) : 0.3,
    };

    DifferentialMapSystem system(config);
    std::cout << system.to_json(0) << std::endl;
    return 0;
}
