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
        case 1u: { return vec4<f32>(1.0, 0.1, 0.1, 1.0); }   // Red
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

// Simple noise function for background texture
fn rand(co: vec2<f32>) -> f32 {
    return fract(sin(dot(co, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let x = globalId.x;
    let y = globalId.y;

    if x >= params.width || y >= params.height {
        return;
    }

    let pixelIndex = y * params.width + x;

    // Updated dimensions for higher resolution
    let pegSpacing = 32u;
    let pegRadius = 12.0;       // Physical peg size
    let glowRadius = 24.0;      // Immediate glow around peg
    let ambientRadius = 45.0;   // Light bleed onto surroundings

    // Calculate which peg cell this pixel belongs to
    let currentPegX = x / pegSpacing;
    let currentPegY = y / pegSpacing;

    // Get board dimensions in pegs
    let boardWidth = params.width / pegSpacing;
    let boardHeight = params.height / pegSpacing;

    // --- Background Texture ---
    // Simulate black plastic mesh with a grid pattern and noise
    var finalColor = vec4<f32>(0.05, 0.05, 0.05, 1.0); // Base dark plastic

    // Position within current cell for grid lines
    let cellX = f32(x % pegSpacing);
    let cellY = f32(y % pegSpacing);
    let cellCenterX = f32(pegSpacing) / 2.0;
    let cellCenterY = f32(pegSpacing) / 2.0;
    let dx = cellX - cellCenterX;
    let dy = cellY - cellCenterY;
    let distFromCenter = sqrt(dx * dx + dy * dy);

    // Grid lines (gaps between modules)
    let gridLineX = abs(dx) > (f32(pegSpacing) / 2.0 - 1.0);
    let gridLineY = abs(dy) > (f32(pegSpacing) / 2.0 - 1.0);
    if (gridLineX || gridLineY) {
         finalColor = vec4<f32>(0.02, 0.02, 0.02, 1.0); // Darker cracks
    } else {
         // Subtle noise/grain for plastic texture
         let noise = rand(vec2<f32>(f32(x), f32(y))) * 0.03;
         finalColor = vec4<f32>(finalColor.r + noise, finalColor.g + noise, finalColor.b + noise, 1.0);
    }

    // Render Holes (passive effect)
    // If we are near the center of a cell, render the "hole" appearance regardless of content first
    // This provides depth even if the peg covers it later
    if distFromCenter <= pegRadius * 0.8 {
        finalColor = mix(finalColor, vec4<f32>(0.0, 0.0, 0.0, 1.0), 0.8);
    } else if distFromCenter <= pegRadius {
        // Rim of the hole
        finalColor = mix(finalColor, vec4<f32>(0.1, 0.1, 0.1, 1.0), 0.5);
    }

    // --- Light Accumulation (3x3 Grid) ---
    // To handle light bleeding across cell boundaries, we must check the current cell
    // AND its neighbors.

    var accumulatedLight = vec3<f32>(0.0, 0.0, 0.0);

    // Loop through 3x3 neighbors
    for (var i = -1; i <= 1; i++) {
        for (var j = -1; j <= 1; j++) {
            let neighborPegX = i32(currentPegX) + i;
            let neighborPegY = i32(currentPegY) + j;

            // Bounds check
            if neighborPegX >= 0 && neighborPegX < i32(boardWidth) &&
               neighborPegY >= 0 && neighborPegY < i32(boardHeight) {

                let pegIndex = u32(neighborPegY) * boardWidth + u32(neighborPegX);
                let colorIndex = boardState[pegIndex];

                if colorIndex > 0u {
                    let pegColor = getColor(colorIndex);

                    // Pulse effect
                    let pulseAmount = sin(params.time * 2.0 + f32(pegIndex) * 0.1) * 0.05 + 0.95;
                    let currentGlowIntensity = params.glowIntensity * pulseAmount;

                    // Calculate distance from THIS neighbor peg center to the current pixel
                    // Neighbor center in pixel coordinates:
                    let neighborCenterX = f32(u32(neighborPegX) * pegSpacing) + cellCenterX;
                    let neighborCenterY = f32(u32(neighborPegY) * pegSpacing) + cellCenterY;

                    let distToNeighbor = distance(vec2<f32>(f32(x), f32(y)), vec2<f32>(neighborCenterX, neighborCenterY));

                    // 1. The Plastic Peg (Only if we are checking the center/current peg)
                    // We only render the solid plastic peg body if it's the one in the current cell (i=0, j=0)
                    // Otherwise, we only render its glow/light contribution.
                    if (i == 0 && j == 0 && distToNeighbor <= pegRadius) {
                         // Base color
                        var solidColor = pegColor.rgb * 0.8;

                        // Inner glow / volume scattering
                        let innerGlow = smoothstep(0.0, pegRadius, distToNeighbor);
                        solidColor = mix(solidColor, pegColor.rgb * 1.2, 1.0 - innerGlow * 0.5);

                        // Specular Highlight
                        let lightDir = normalize(vec2<f32>(-1.0, -1.0));
                        // Vector from center to current pixel relative to peg radius
                        let relativePos = vec2<f32>(f32(x) - neighborCenterX, f32(y) - neighborCenterY);

                        // Simple faux-specular
                        // Highlight position is offset towards top-left
                        let highlightPos = vec2<f32>(neighborCenterX - 3.0, neighborCenterY - 3.0);
                        let highlightDist = distance(vec2<f32>(f32(x), f32(y)), highlightPos);
                        let highlight = smoothstep(3.0, 0.0, highlightDist);

                        solidColor = mix(solidColor, vec3<f32>(1.0, 1.0, 1.0), highlight * 0.6);

                        // Apply intensity
                        solidColor = solidColor * (currentGlowIntensity * 1.2);

                        // Because the peg is solid object, it overrides the background.
                        // However, we want to add the accumulated glow from OTHERS later?
                        // Actually, easiest is to just blend this straight in.
                        // But we need to handle the case where "accumulatedLight" has glow from neighbors.
                        // A solid peg obscures the background but might be lit by neighbors?
                        // For Lite Brite, pegs are self-emissive. They don't really receive light from others effectively.
                        // So we can set the base color here.

                        // We'll add it to accumulator, but with a high weight or just set a flag?
                        // Let's just add it. Since typical Lite Brite backgrounds are black,
                        // adding the peg color is fine.
                        accumulatedLight = accumulatedLight + solidColor;

                    } else {
                        // 2. Glow / Light Bleed (From any neighbor, including self)

                        // Immediate Glow (Bloom)
                        if (distToNeighbor <= glowRadius) {
                            let t = (distToNeighbor - pegRadius) / (glowRadius - pegRadius);
                            // Avoid division by zero or negative if inside pegRadius (though handled above usually)
                            if (distToNeighbor > pegRadius) {
                                let glowFalloff = 1.0 - t;
                                let glowStrength = pow(glowFalloff, 2.0) * 0.6 * currentGlowIntensity;
                                accumulatedLight = accumulatedLight + (pegColor.rgb * glowStrength);
                            }
                        }

                        // Ambient Light Bleed (Large soft area)
                         if (distToNeighbor <= ambientRadius) {
                             // Smoothstep 1->0
                             let ambientFactor = smoothstep(ambientRadius, pegRadius, distToNeighbor);
                             let ambientStrength = ambientFactor * 0.15 * currentGlowIntensity;
                             accumulatedLight = accumulatedLight + (pegColor.rgb * ambientStrength);
                         }
                    }
                }
            }
        }
    }

    // Combine background with accumulated light
    // Use screen blend or simple addition? Addition is physically plausible for light.
    finalColor = vec4<f32>(finalColor.rgb + accumulatedLight, 1.0);

    // Clamp result
    finalColor = clamp(finalColor, vec4<f32>(0.0, 0.0, 0.0, 0.0), vec4<f32>(1.0, 1.0, 1.0, 1.0));
    outputPixels[pixelIndex] = packColor(finalColor);
}
