# How to read the Riemann–Newton Atlas

The picture is not a decorative fractal. Every pixel is the recorded outcome of a numerical experiment.

## The numbered dots

Each numbered dot is a root: a complex-number solution of the active polynomial. Think of the roots as mathematical magnets.

## The colored territories

Every pixel begins as a different complex number. Newton's method repeatedly updates it using:

```text
next z = current z - p(z) / p'(z)
```

When the sequence reaches a root, the starting pixel receives that root's color. A large colored region is therefore that root's basin of attraction.

## The shading

Shade variation records convergence effort. Pixels that settle quickly look different from pixels requiring many iterations.

## The tangled filaments

The narrow, branching boundaries are where the outcome is extremely sensitive. Two almost identical starting points can converge to different roots. Repeating that sensitivity at smaller scales produces the fractal structure.

## The overlays

- **Numbered root markers:** drag them to rebuild the polynomial and reshape every basin.
- **Flow lines:** sample smooth Newton-flow trajectories toward roots.
- **Boundary overlay:** emphasizes locations where neighboring pixels have different destinations.
- **Entropy:** measures how thoroughly different basin labels are mixed.
- **Box dimension:** estimates the geometric complexity of the boundary.

## Interaction

- Drag the canvas to pan.
- Scroll or use `+` and `−` to zoom.
- Drag a numbered root to alter the polynomial.
- Change presets to compare degrees and root arrangements.
- Toggle flow lines and boundaries.
- Export the current view as a PNG.
