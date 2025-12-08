// Lite Brite WebGPU Compute Shader - Staggered Grid & Plastic 3D

struct Params {
    width: u32,
    height: u32,
    time: f32,
    glowIntensity: f32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> boardState: array<u32>;
@group(0) @binding(2) var<storage, read_write> outputPixels: array<u32>;

// getColor, packColor, rand functions (unchanged)
fn getColor(colorIndex: u32) -> vec4<f32> {
    switch colorIndex {
        case 1u: { return vec4<f32>(1.0, 0.0, 0.0, 1.0); }   // Red
        case 2u: { return vec4<f32>(1.0, 0.5, 0.1, 1.0); }   // Orange
        case 3u: { return vec4<f32>(1.0, 1.0, 0.0, 1.0); }  // Yellow
        case 4u: { return vec4<f32>(0.2, 1.0, 0.2, 1.0); }   // Green
        case 5u: { return vec4<f32>(0.0, 1.0, 1.0, 1.0); }   // Cyan
        case 6u: { return vec4<f32>(0.2, 0.8, 1.0, 1.0); }   // Light Blue
        case 7u: { return vec4<f32>(0.2, 0.5, 1.0, 1.0); }   // Blue
        case 8u: { return vec4<f32>(0.6, 0.2, 1.0, 1.0); }   // Purple
        case 9u: { return vec4<f32>(1.0, 0.2, 0.8, 1.0); }   // Pink
        case 10u: { return vec4<f32>(1.0, 1.0, 1.0, 1.0); }   // White
        default: { return vec4<f32>(0.0, 0.0, 0.0, 0.0); }   // Empty
    }
}

fn packColor(color: vec4<f32>) -> u32 {
    let r = u32(clamp(color.r, 0.0, 1.0) * 255.0);
    let g = u32(clamp(color.g, 0.0, 1.0) * 255.0);
    let b = u32(clamp(color.b, 0.0, 1.0) * 255.0);
    let a = u32(clamp(color.a, 0.0, 1.0) * 255.0);
    return (a << 24u) | (r << 16u) | (g << 8u) | b;
}

fn rand(co: vec2<f32>) -> f32 {
    return fract(sin(dot(co, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}


@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let x = globalId.x;
    let y = globalId.y;

    if x >= params.width || y >= params.height { return; }

    let pixelIndex = y * params.width + x;
    let pegSpacing = 32u;
    let pegRadius = 12.0;       
    let glowRadius = 24.0;      
    let ambientRadius = 45.0;   

    let boardWidth = params.width / pegSpacing;
    let boardHeight = params.height / pegSpacing;

    // --- Staggered Grid Calculation ---
    let currentRow = y / pegSpacing;
    let isOddRow = (currentRow % 2u) != 0u;
    let rowShift = f32(pegSpacing) * 0.5;
    let currentShift = select(0.0, rowShift, isOddRow);

    // --- Render Background Holes (Staggered) ---
    // Adjust the pixel's 'x' coordinate before calculating its position within a cell
    let adjustedX = f32(x) - currentShift;
    
    // Use modulo logic to find position within the shifted cell
    let cellX = adjustedX - floor(adjustedX / f32(pegSpacing)) * f32(pegSpacing);
    let cellY = f32(y % pegSpacing);
    
    let cellCenterX = f32(pegSpacing) / 2.0;
    let cellCenterY = f32(pegSpacing) / 2.0;
    
    let distFromCenter = distance(vec2(cellX, cellY), vec2(cellCenterX, cellCenterY));

    // Draw background texture and hole
    var finalColor = vec4<f32>(0.05, 0.05, 0.05, 1.0);
    let noise = rand(vec2<f32>(f32(x), f32(y))) * 0.03;
    finalColor += vec4(noise, noise, noise, 0.0);
    if distFromCenter <= pegRadius * 0.8 {
        finalColor = mix(finalColor, vec4<f32>(0.0, 0.0, 0.0, 1.0), 0.8);
    } else if distFromCenter <= pegRadius {
        finalColor = mix(finalColor, vec4<f32>(0.1, 0.1, 0.1, 1.0), 0.5);
    }

    // --- Light Accumulation (Staggered) ---
    var accumulatedLight = vec3<f32>(0.0, 0.0, 0.0);

    // Determine logical grid coordinates for the current pixel
    let currentPegX = i32(floor((f32(x) - currentShift) / f32(pegSpacing)));
    let currentPegY = i32(currentRow);

    // Loop through logical neighbors
    for (var i = -1; i <= 1; i++) {
        for (var j = -1; j <= 1; j++) {
            let neighborPegX = currentPegX + i;
            let neighborPegY = currentPegY + j;

            if neighborPegX >= 0 && neighborPegX < i32(boardWidth) && neighborPegY >= 0 && neighborPegY < i32(boardHeight) {

                let pegIndex = u32(neighborPegY) * boardWidth + u32(neighborPegX);
                let colorIndex = boardState[pegIndex];

                if colorIndex > 0u {
                    let pegColor = getColor(colorIndex);
                    
                    // --- Crucial: Calculate the PHYSICAL center of this neighbor peg ---
                    var neighborCenterX = f32(u32(neighborPegX) * pegSpacing) + cellCenterX;
                    let neighborCenterY = f32(u32(neighborPegY) * pegSpacing) + cellCenterY;
                    
                    // Apply the stagger offset if the *neighbor's* row is odd
                    let neighborIsOdd = (u32(neighborPegY) % 2u) != 0u;
                    let neighborShift = select(0.0, rowShift, neighborIsOdd);
                    neighborCenterX = neighborCenterX + neighborShift;

                    let distToNeighbor = distance(vec2<f32>(f32(x), f32(y)), vec2<f32>(neighborCenterX, neighborCenterY));
                    
                    let pulseAmount = sin(params.time * 2.0 + f32(pegIndex) * 0.1) * 0.05 + 0.95;
                    let currentGlowIntensity = params.glowIntensity * pulseAmount;

                    // --- PLASTIC 3D RENDERING LOGIC (UNCHANGED) ---
                    // This logic now correctly operates on the staggered `distToNeighbor`
                        // --- ENHANCED PLASTIC RENDERING ---
                        let relX = f32(x) - neighborCenterX;
                        let relY = f32(y) - neighborCenterY;
                        
                        // 1. Calculate Normal for a sphere
                        let z = sqrt(max(0.0, pegRadius * pegRadius - (relX * relX + relY * relY)));
                        let normal = normalize(vec3<f32>(relX, relY, z));
                        
                        // 2. Lighting Vectors
                        let lightDir = normalize(vec3<f32>(-0.5, -0.8, 1.0)); // Top-left light
                        let viewDir = vec3<f32>(0.0, 0.0, 1.0);
                        
                        // 3. Inner "Hot Core" Glow (Simulates light source inside peg)
                        let centerDist = distance(vec2<f32>(0.0, 0.0), vec2<f32>(relX, relY));
                        let innerGlow = smoothstep(pegRadius, 0.0, centerDist);
                        let coreColor = mix(pegColor.rgb, vec3<f32>(1.0, 1.0, 1.0), innerGlow * 0.6); // White center
                        
                        // 4. Sharp Specular Reflection (Wet/Glossy look)
                        let reflectDir = reflect(-lightDir, normal);
                        let specAngle = max(dot(viewDir, reflectDir), 0.0);
                        let spec = pow(specAngle, 64.0); // Sharper exponent (was 32.0)
                        
                        // 5. Fresnel Rim Light (Glowing edges)
                        let fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
                        
                        // 6. Combine
                        var solidColor = coreColor * (0.4 + 0.6 * currentGlowIntensity); // Base
                        solidColor += vec3<f32>(1.0) * spec * 0.9; // Add reflection
                        solidColor += pegColor.rgb * fresnel * 0.8 * currentGlowIntensity; // Add rim glow
                        
                        accumulatedLight += solidColor;
                    } else {
                        // Glow / Light Bleed Logic (from previous step)
                        if (distToNeighbor <= glowRadius && distToNeighbor > pegRadius) {
                            let t = (distToNeighbor - pegRadius) / (glowRadius - pegRadius);
                            let glowFalloff = 1.0 - t;
                            let glowStrength = pow(glowFalloff, 2.0) * 0.6 * currentGlowIntensity;
                            accumulatedLight += (pegColor.rgb * glowStrength);
                        }
                        if (distToNeighbor <= ambientRadius) {
                             let ambientFactor = smoothstep(ambientRadius, pegRadius, distToNeighbor);
                             let ambientStrength = ambientFactor * 0.15 * currentGlowIntensity;
                             accumulatedLight += (pegColor.rgb * ambientStrength);
                         }
                    }
                }
            }
        }
    }

    finalColor = vec4<f32>(finalColor.rgb + accumulatedLight, 1.0);
    outputPixels[pixelIndex] = packColor(clamp(finalColor, vec4<f32>(0.0), vec4<f32>(1.0)));
}
