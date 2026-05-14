# Anveshak Battery Calculator ☄️

An advanced, real-time thermal and electrical analysis suite designed by Team Anveshak IITM. 

## 1. Temp Rise Calculator

- Predicts the equilibrium temperature of conductors under varying current loads.
- Dynamic Resistivity Engine: Accounts for temperature-dependent resistivity ($\rho$) using material-specific alpha coefficients ($\alpha$) for Nickel, Copper, and Aluminum.
- Adaptive Environment: Inputs for ambient temperature and parallel busbar stacking.
- Multi-Unit Interface: Seamlessly toggle between mm, cm, and m.

## 2. Conductor Sizing 

- An engineering tool to determine the minimum physical footprint required for safety.
- Automated Iteration: Solves for the smallest width (0.5mm precision) that maintains temperatures below your specified thermal ceiling ($T_{max}$).
- Safety Critical Feedback: Real-time margin analysis and "At Minimum" metric readouts.

## 3. Pack Design

- Architectural modeling for complex battery systems.
- Chemistry Presets: One-click loading for LFP, NMC, LTO, and NCA cell profiles.
- Topology Visualizer: Dynamic rendering of Series (S) and Parallel (P) configurations.
- Energy Audit: Calculates total vs. usable energy capacity (Wh) with a visual utilization bar.

## Thermal Status

    The output interface utilizes a dynamic color-coded telemetry system based on safety margins:
    🟢 SAFE: Stable thermal equilibrium.
    🟡 CAUTION: Operating within 10°C of the thermal limit.
    🔴 DANGER: Thermal limit exceeded; physical geometry or current load must be adjusted.

## Technical Specifications

    Physics Core: Utilizes a convection coefficient ($h$) of $15 \times 10^{-6} W/mm^2 \cdot ^\circ C$ for realistic air-cooling simulation.
    Stack: Vanilla JS, CSS3 (Mars Nebula Theme), and HTML5.
    Dependencies: Zero. Runs locally or via static hosting like Netlify.
    Developed by Nithin, Team Anveshak IIT Madras