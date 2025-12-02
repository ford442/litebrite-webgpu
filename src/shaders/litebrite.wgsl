// Lite Brite WebGPU Compute Shader
// This shader processes the board state and generates glow effects for the pegs

struct Params {
    width: u32,
    height: u32,
    time: f32,
    glowIntensity: f32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> boardState: array<u32>;
@group(0) @binding(2) var<storage, read_write> outputPixels: array<u32>;

// Pre-defined Lite Brite colors (RGBA packed as u32)
// Original Lite Brite had: Red, Orange, Yellow, Green, Blue, Pink/Magenta, White, Purple
fn getColor(colorIndex: u32) -> vec4<f32> {
    switch colorIndex {
        case 1u: { return vec4<f32>(1.0, 0.2, 0.2, 1.0); }   // Red
        case 2u: { return vec4<f32>(1.0, 0.5, 0.1, 1.0); }   // Orange
        case 3u: { return vec4<f32>(1.0, 1.0, 0.2, 1.0); }   // Yellow
        case 4u: { return vec4<f32>(0.2, 1.0, 0.2, 1.0); }   // Green
        case 5u: { return vec4<f32>(0.2, 0.5, 1.0, 1.0); }   // Blue
        case 6u: { return vec4<f32>(1.0, 0.2, 0.8, 1.0); }   // Pink/Magenta
        case 7u: { return vec4<f32>(1.0, 1.0, 1.0, 1.0); }   // White
        case 8u: { return vec4<f32>(0.6, 0.2, 1.0, 1.0); }   // Purple
        default: { return vec4<f32>(0.0, 0.0, 0.0, 0.0); }   // Empty (no peg)
    }
}

fn packColor(color: vec4<f32>) -> u32 {
    let r = u32(clamp(color.r, 0.0, 1.0) * 255.0);
    let g = u32(clamp(color.g, 0.0, 1.0) * 255.0);
    let b = u32(clamp(color.b, 0.0, 1.0) * 255.0);
    let a = u32(clamp(color.a, 0.0, 1.0) * 255.0);
    return (a << 24u) | (b << 16u) | (g << 8u) | r;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let x = globalId.x;
    let y = globalId.y;

    if x >= params.width || y >= params.height {
        return;
    }

    let pixelIndex = y * params.width + x;

    // Each peg is rendered as a circle with glow
    let pegSpacing = 16u;
    let pegRadius = 6.0;
    let glowRadius = 10.0;

    // Calculate which peg cell this pixel belongs to
    let pegX = x / pegSpacing;
    let pegY = y / pegSpacing;

    // Calculate position within the peg cell
    let cellX = f32(x % pegSpacing);
    let cellY = f32(y % pegSpacing);
    let centerX = f32(pegSpacing) / 2.0;
    let centerY = f32(pegSpacing) / 2.0;

    // Distance from center of peg
    let dx = cellX - centerX;
    let dy = cellY - centerY;
    let dist = sqrt(dx * dx + dy * dy);

    // Get board dimensions in pegs
    let boardWidth = params.width / pegSpacing;
    let boardHeight = params.height / pegSpacing;

    // Get peg color from board state
    var finalColor = vec4<f32>(0.02, 0.02, 0.02, 1.0); // Dark board background

    if pegX < boardWidth && pegY < boardHeight {
        let pegIndex = pegY * boardWidth + pegX;
        let colorIndex = boardState[pegIndex];

        if colorIndex > 0u {
            let pegColor = getColor(colorIndex);

            // Create glow effect with time-based pulsing
            let pulseAmount = sin(params.time * 2.0 + f32(pegIndex) * 0.1) * 0.1 + 0.9;
            let glowIntensity = params.glowIntensity * pulseAmount;

            if dist <= pegRadius {
                // Inside the peg - full color with inner glow
                let innerGlow = 1.0 - (dist / pegRadius) * 0.3;
                finalColor = pegColor * innerGlow * glowIntensity;
            } else if dist <= glowRadius {
                // Glow area around the peg
                let glowFalloff = 1.0 - (dist - pegRadius) / (glowRadius - pegRadius);
                let glowStrength = glowFalloff * glowFalloff * 0.5 * glowIntensity;
                finalColor = pegColor * glowStrength;
            }
        } else {
            // Empty peg hole - darker circle
            if dist <= pegRadius * 0.7 {
                finalColor = vec4<f32>(0.01, 0.01, 0.01, 1.0);
            }
        }
    }

    outputPixels[pixelIndex] = packColor(finalColor);
}
