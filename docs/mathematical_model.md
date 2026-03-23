# Mathematical Model

The project studies differentiable maps

```math
f : \mathbb{R}^2 \to \mathbb{R}^2
```

with emphasis on the local differential structure near a selected point

```math
x_0 = (x_0, y_0).
```

## Component Form

Every preset is interpreted as

```math
f(x, y) = \bigl(f_1(x, y), f_2(x, y)\bigr),
```

so the derivative is encoded by the Jacobian matrix

```math
J_f(x_0) =
\begin{bmatrix}
\frac{\partial f_1}{\partial x}(x_0) & \frac{\partial f_1}{\partial y}(x_0) \\
\frac{\partial f_2}{\partial x}(x_0) & \frac{\partial f_2}{\partial y}(x_0)
\end{bmatrix}.
```

## Differential And Linearization

If `f` is differentiable at `x_0`, then

```math
f(x_0 + h) = f(x_0) + J_f(x_0)h + o(\|h\|),
```

which means the affine map

```math
L_{x_0}(x) = f(x_0) + J_f(x_0)(x - x_0)
```

is the best first-order approximation to `f` near `x_0`.

The visualization engine samples a small circle around `x_0` and compares:

```math
f(\text{neighborhood of } x_0)
```

against

```math
L_{x_0}(\text{same neighborhood}).
```

## Numerical Jacobian Estimation

The current implementation estimates partial derivatives by central finite differences:

```math
\frac{\partial f_i}{\partial x_j}(x) \approx
\frac{f_i(x + h e_j) - f_i(x - h e_j)}{2h},
\qquad i, j \in \{1,2\}.
```

This is a second-order symmetric approximation and works well for smooth preset maps.

## Determinant, Rank, And Singular Set

For a `2 x 2` Jacobian

```math
J_f(x_0) =
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix},
```

the determinant is

```math
\det J_f(x_0) = ad - bc.
```

This quantity controls first-order area scaling:

```math
\text{small area near } x_0
\mapsto
|\det J_f(x_0)| \times \text{that area}.
```

A point is locally singular when the rank drops below `2`. In the square case `\mathbb{R}^2 \to \mathbb{R}^2`, this corresponds to

```math
\det J_f(x_0) = 0.
```

## Singular Values

The singular values `\sigma_1 \ge \sigma_2 \ge 0` of `J_f(x_0)` are the square roots of the eigenvalues of

```math
J_f(x_0)^\top J_f(x_0).
```

They describe the principal local stretching factors of the map. Geometrically:

- a tiny circle near `x_0` is sent approximately to an ellipse
- the ellipse semiaxes have lengths `\sigma_1` and `\sigma_2`

## What The Engine Reports

For the active point and preset, the engine returns:

- `J_f(x_0)`
- `\det J_f(x_0)`
- numerical rank
- singular values
- nonlinear neighborhood samples
- linearized neighborhood samples

This is the mathematical core behind the visual comparison shown in the app.
