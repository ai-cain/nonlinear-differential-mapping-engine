#include "differential_map_system.hpp"

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <limits>
#include <sstream>
#include <vector>

namespace {

constexpr int DEFAULT_GRID_COLUMNS = 17;
constexpr int DEFAULT_GRID_ROWS = 17;
constexpr double DEFAULT_DOMAIN_EXTENT = 2.0;
constexpr double DEFAULT_NEIGHBORHOOD_RADIUS = 0.3;
constexpr double DEFAULT_SELECTED_X = 0.85;
constexpr double DEFAULT_SELECTED_Y = 0.45;
constexpr double DEFAULT_PARAMETER_A = 0.0;
constexpr double DEFAULT_PARAMETER_B = 0.0;
constexpr int CIRCLE_SAMPLE_COUNT = 96;
constexpr double PI = 3.14159265358979323846;

bool nearly_equal(double left, double right, double epsilon = 1e-9) {
    return std::abs(left - right) <= epsilon;
}

double sanitize_number(double value, double fallback) {
    return std::isfinite(value) ? value : fallback;
}

double clamp_value(double value, double min_value, double max_value) {
    return std::min(max_value, std::max(min_value, value));
}

int clamp_integer(int value, int min_value, int max_value) {
    return std::min(max_value, std::max(min_value, value));
}

bool valid_map_id(const std::string& map_id) {
    return map_id == "linear_shear" ||
           map_id == "anisotropic_scaling" ||
           map_id == "quadratic_map" ||
           map_id == "cubic_distortion" ||
           map_id == "singular_fold";
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

std::string map_name(const std::string& map_id) {
    if (map_id == "linear_shear") {
        return "Linear shear";
    }

    if (map_id == "anisotropic_scaling") {
        return "Anisotropic scaling";
    }

    if (map_id == "quadratic_map") {
        return "Quadratic map";
    }

    if (map_id == "cubic_distortion") {
        return "Cubic distortion";
    }

    if (map_id == "singular_fold") {
        return "Singular fold";
    }

    return "Unknown map";
}

std::string map_formula(const MapConfig& config) {
    if (config.map_id == "linear_shear") {
        return "f(x, y) = (x + k y, y)";
    }

    if (config.map_id == "anisotropic_scaling") {
        return "f(x, y) = (lambda1 x, lambda2 y)";
    }

    if (config.map_id == "quadratic_map") {
        return "f(x, y) = (x^2 - y^2, 2xy)";
    }

    if (config.map_id == "cubic_distortion") {
        return "f(x, y) = (x + alpha x^3, y + beta y^3)";
    }

    if (config.map_id == "singular_fold") {
        return "f(x, y) = (s x^2, y + t x)";
    }

    return "f(x, y) = (x, y)";
}

Point2 evaluate_map(const MapConfig& config, const Point2& point) {
    const double x = point[0];
    const double y = point[1];

    if (config.map_id == "linear_shear") {
        return {x + config.parameter_a * y, y};
    }

    if (config.map_id == "anisotropic_scaling") {
        return {config.parameter_a * x, config.parameter_b * y};
    }

    if (config.map_id == "quadratic_map") {
        return {x * x - y * y, 2.0 * x * y};
    }

    if (config.map_id == "cubic_distortion") {
        return {
            x + config.parameter_a * x * x * x,
            y + config.parameter_b * y * y * y,
        };
    }

    if (config.map_id == "singular_fold") {
        return {config.parameter_a * x * x, y + config.parameter_b * x};
    }

    return point;
}

Matrix2 estimate_jacobian(const MapConfig& config, const Point2& point) {
    const double step = std::max(1e-4, config.domain_extent * 1e-4);

    Point2 x_minus = point;
    Point2 x_plus = point;
    Point2 y_minus = point;
    Point2 y_plus = point;

    x_minus[0] -= step;
    x_plus[0] += step;
    y_minus[1] -= step;
    y_plus[1] += step;

    const Point2 fx_minus = evaluate_map(config, x_minus);
    const Point2 fx_plus = evaluate_map(config, x_plus);
    const Point2 fy_minus = evaluate_map(config, y_minus);
    const Point2 fy_plus = evaluate_map(config, y_plus);

    const double scale = 1.0 / (2.0 * step);

    return {{
        {{
            (fx_plus[0] - fx_minus[0]) * scale,
            (fy_plus[0] - fy_minus[0]) * scale,
        }},
        {{
            (fx_plus[1] - fx_minus[1]) * scale,
            (fy_plus[1] - fy_minus[1]) * scale,
        }},
    }};
}

double determinant(const Matrix2& matrix) {
    return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
}

std::array<double, 2> singular_values(const Matrix2& matrix) {
    const double a = matrix[0][0];
    const double b = matrix[0][1];
    const double c = matrix[1][0];
    const double d = matrix[1][1];
    const double trace = a * a + b * b + c * c + d * d;
    const double determinant_squared = determinant(matrix) * determinant(matrix);
    const double discriminant = std::sqrt(std::max(0.0, trace * trace - 4.0 * determinant_squared));
    const double lambda_1 = std::max(0.0, 0.5 * (trace + discriminant));
    const double lambda_2 = std::max(0.0, 0.5 * (trace - discriminant));

    return {std::sqrt(lambda_1), std::sqrt(lambda_2)};
}

int matrix_rank(const std::array<double, 2>& values) {
    const double epsilon = std::max(1e-5, values[0] * 1e-4);
    int rank = 0;

    if (values[0] > epsilon) {
        ++rank;
    }

    if (values[1] > epsilon) {
        ++rank;
    }

    return rank;
}

std::string regularity_label(int rank) {
    return rank == 2 ? "regular" : "singular";
}

std::vector<Point2> sample_domain_grid(const MapConfig& config) {
    std::vector<Point2> points;
    points.reserve(static_cast<std::size_t>(config.grid_columns * config.grid_rows));

    const double min_x = -config.domain_extent;
    const double max_x = config.domain_extent;
    const double min_y = -config.domain_extent;
    const double max_y = config.domain_extent;

    for (int row = 0; row < config.grid_rows; ++row) {
        const double row_t =
            config.grid_rows == 1 ? 0.0 : static_cast<double>(row) / static_cast<double>(config.grid_rows - 1);
        const double y = max_y + (min_y - max_y) * row_t;

        for (int column = 0; column < config.grid_columns; ++column) {
            const double column_t =
                config.grid_columns == 1
                    ? 0.0
                    : static_cast<double>(column) / static_cast<double>(config.grid_columns - 1);
            const double x = min_x + (max_x - min_x) * column_t;
            points.push_back({x, y});
        }
    }

    return points;
}

std::vector<Point2> transform_points(const MapConfig& config, const std::vector<Point2>& points) {
    std::vector<Point2> mapped_points;
    mapped_points.reserve(points.size());

    for (const Point2& point : points) {
        mapped_points.push_back(evaluate_map(config, point));
    }

    return mapped_points;
}

std::vector<Point2> sample_circle(const Point2& center, double radius, int samples) {
    std::vector<Point2> points;
    points.reserve(static_cast<std::size_t>(samples + 1));

    for (int index = 0; index <= samples; ++index) {
        const double angle = (2.0 * PI * static_cast<double>(index)) / static_cast<double>(samples);
        points.push_back({
            center[0] + radius * std::cos(angle),
            center[1] + radius * std::sin(angle),
        });
    }

    return points;
}

Point2 apply_linearization(
    const Point2& point,
    const Point2& selected_point,
    const Point2& mapped_point,
    const Matrix2& jacobian
) {
    const double dx = point[0] - selected_point[0];
    const double dy = point[1] - selected_point[1];

    return {
        mapped_point[0] + jacobian[0][0] * dx + jacobian[0][1] * dy,
        mapped_point[1] + jacobian[1][0] * dx + jacobian[1][1] * dy,
    };
}

std::vector<Point2> linearize_points(
    const std::vector<Point2>& points,
    const Point2& selected_point,
    const Point2& mapped_point,
    const Matrix2& jacobian
) {
    std::vector<Point2> linearized_points;
    linearized_points.reserve(points.size());

    for (const Point2& point : points) {
        linearized_points.push_back(
            apply_linearization(point, selected_point, mapped_point, jacobian)
        );
    }

    return linearized_points;
}

std::string serialize_point(const Point2& point) {
    std::ostringstream ss;
    ss << "[" << point[0] << "," << point[1] << "]";
    return ss.str();
}

std::string serialize_points(const std::vector<Point2>& points) {
    std::ostringstream ss;
    ss << "[";

    for (std::size_t index = 0; index < points.size(); ++index) {
        ss << serialize_point(points[index]);
        if (index + 1 < points.size()) {
            ss << ",";
        }
    }

    ss << "]";
    return ss.str();
}

std::string serialize_matrix(const Matrix2& matrix) {
    std::ostringstream ss;
    ss << "["
       << "[" << matrix[0][0] << "," << matrix[0][1] << "],"
       << "[" << matrix[1][0] << "," << matrix[1][1] << "]"
       << "]";
    return ss.str();
}

std::string serialize_pair(const std::array<double, 2>& values) {
    std::ostringstream ss;
    ss << "[" << values[0] << "," << values[1] << "]";
    return ss.str();
}

MapConfig default_config() {
    return {
        "quadratic_map",
        DEFAULT_PARAMETER_A,
        DEFAULT_PARAMETER_B,
        DEFAULT_GRID_COLUMNS,
        DEFAULT_GRID_ROWS,
        DEFAULT_DOMAIN_EXTENT,
        DEFAULT_SELECTED_X,
        DEFAULT_SELECTED_Y,
        DEFAULT_NEIGHBORHOOD_RADIUS,
    };
}

} // namespace

DifferentialMapSystem::DifferentialMapSystem()
    : DifferentialMapSystem(default_config()) {
}

DifferentialMapSystem::DifferentialMapSystem(const MapConfig& config) {
    configure(config);
}

void DifferentialMapSystem::configure(const MapConfig& config) {
    config_ = sanitize_config(config);
}

void DifferentialMapSystem::reset() {
    config_ = default_config();
}

bool DifferentialMapSystem::matches_config(const MapConfig& config) const {
    const MapConfig sanitized = sanitize_config(config);

    return config_.map_id == sanitized.map_id &&
           nearly_equal(config_.parameter_a, sanitized.parameter_a) &&
           nearly_equal(config_.parameter_b, sanitized.parameter_b) &&
           config_.grid_columns == sanitized.grid_columns &&
           config_.grid_rows == sanitized.grid_rows &&
           nearly_equal(config_.domain_extent, sanitized.domain_extent) &&
           nearly_equal(config_.selected_x, sanitized.selected_x) &&
           nearly_equal(config_.selected_y, sanitized.selected_y) &&
           nearly_equal(config_.neighborhood_radius, sanitized.neighborhood_radius);
}

const MapConfig& DifferentialMapSystem::config() const {
    return config_;
}

std::string DifferentialMapSystem::to_json(int revision) const {
    const Point2 selected_point{config_.selected_x, config_.selected_y};
    const Point2 mapped_point = evaluate_map(config_, selected_point);
    const Matrix2 jacobian = estimate_jacobian(config_, selected_point);
    const double jacobian_determinant = determinant(jacobian);
    const std::array<double, 2> sigma = singular_values(jacobian);
    const int rank = matrix_rank(sigma);
    const std::vector<Point2> domain_points = sample_domain_grid(config_);
    const std::vector<Point2> mapped_points = transform_points(config_, domain_points);
    const std::vector<Point2> domain_neighborhood =
        sample_circle(selected_point, config_.neighborhood_radius, CIRCLE_SAMPLE_COUNT);
    const std::vector<Point2> mapped_neighborhood =
        transform_points(config_, domain_neighborhood);
    const std::vector<Point2> linearized_neighborhood =
        linearize_points(domain_neighborhood, selected_point, mapped_point, jacobian);

    std::ostringstream ss;
    ss << std::fixed << std::setprecision(6);
    ss << "{\"type\":\"state\",\"data\":{";
    ss << "\"revision\":" << revision << ",";
    ss << "\"map_id\":\"" << escape_json(config_.map_id) << "\",";
    ss << "\"map_name\":\"" << escape_json(map_name(config_.map_id)) << "\",";
    ss << "\"formula\":\"" << escape_json(map_formula(config_)) << "\",";
    ss << "\"parameter_a\":" << config_.parameter_a << ",";
    ss << "\"parameter_b\":" << config_.parameter_b << ",";
    ss << "\"grid_columns\":" << config_.grid_columns << ",";
    ss << "\"grid_rows\":" << config_.grid_rows << ",";
    ss << "\"domain_extent\":" << config_.domain_extent << ",";
    ss << "\"domain_min_x\":" << -config_.domain_extent << ",";
    ss << "\"domain_max_x\":" << config_.domain_extent << ",";
    ss << "\"domain_min_y\":" << -config_.domain_extent << ",";
    ss << "\"domain_max_y\":" << config_.domain_extent << ",";
    ss << "\"selected_point\":" << serialize_point(selected_point) << ",";
    ss << "\"mapped_point\":" << serialize_point(mapped_point) << ",";
    ss << "\"neighborhood_radius\":" << config_.neighborhood_radius << ",";
    ss << "\"jacobian\":" << serialize_matrix(jacobian) << ",";
    ss << "\"determinant\":" << jacobian_determinant << ",";
    ss << "\"rank\":" << rank << ",";
    ss << "\"singular_values\":" << serialize_pair(sigma) << ",";
    ss << "\"regularity\":\"" << regularity_label(rank) << "\",";
    ss << "\"domain_points\":" << serialize_points(domain_points) << ",";
    ss << "\"mapped_points\":" << serialize_points(mapped_points) << ",";
    ss << "\"domain_neighborhood\":" << serialize_points(domain_neighborhood) << ",";
    ss << "\"mapped_neighborhood\":" << serialize_points(mapped_neighborhood) << ",";
    ss << "\"linearized_neighborhood\":" << serialize_points(linearized_neighborhood);
    ss << "}}";

    return ss.str();
}

MapConfig DifferentialMapSystem::sanitize_config(const MapConfig& raw_config) {
    MapConfig config{};
    config.map_id = valid_map_id(raw_config.map_id) ? raw_config.map_id : default_config().map_id;
    config.parameter_a = clamp_value(
        sanitize_number(raw_config.parameter_a, DEFAULT_PARAMETER_A),
        -2.5,
        2.5
    );
    config.parameter_b = clamp_value(
        sanitize_number(raw_config.parameter_b, DEFAULT_PARAMETER_B),
        -2.5,
        2.5
    );
    config.grid_columns = clamp_integer(raw_config.grid_columns, 7, 33);
    config.grid_rows = clamp_integer(raw_config.grid_rows, 7, 33);
    config.domain_extent = clamp_value(
        sanitize_number(raw_config.domain_extent, DEFAULT_DOMAIN_EXTENT),
        0.75,
        4.5
    );
    config.selected_x = clamp_value(
        sanitize_number(raw_config.selected_x, DEFAULT_SELECTED_X),
        -config.domain_extent,
        config.domain_extent
    );
    config.selected_y = clamp_value(
        sanitize_number(raw_config.selected_y, DEFAULT_SELECTED_Y),
        -config.domain_extent,
        config.domain_extent
    );
    config.neighborhood_radius = clamp_value(
        sanitize_number(raw_config.neighborhood_radius, DEFAULT_NEIGHBORHOOD_RADIUS),
        0.05,
        std::max(0.12, config.domain_extent * 0.75)
    );

    return config;
}
