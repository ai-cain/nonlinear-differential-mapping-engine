#ifndef DIFFERENTIAL_MAP_SYSTEM_HPP
#define DIFFERENTIAL_MAP_SYSTEM_HPP

#include <array>
#include <string>

using Point2 = std::array<double, 2>;
using Matrix2 = std::array<std::array<double, 2>, 2>;

struct MapConfig {
    std::string map_id;
    double parameter_a;
    double parameter_b;
    int grid_columns;
    int grid_rows;
    double domain_extent;
    double selected_x;
    double selected_y;
    double neighborhood_radius;
};

class DifferentialMapSystem {
public:
    DifferentialMapSystem();
    explicit DifferentialMapSystem(const MapConfig& config);

    void configure(const MapConfig& config);
    void reset();

    bool matches_config(const MapConfig& config) const;
    const MapConfig& config() const;

    std::string to_json(int revision) const;

private:
    MapConfig config_;

    static MapConfig sanitize_config(const MapConfig& raw_config);
};

#endif
