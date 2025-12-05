// Lite Brite WebGPU Compute Shader - "Plastic 3D" Upgrade

struct Params {
    width: u32,
    height: u32,
    time: f32,
    glowIntensity: f32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> boardState: array<u32>;
@group(0) @binding(2) var<storage, read_write> outputPixels: array<u32>;

// Color and utility functions (unchanged)
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
    // Boilerplate and background calculation (unchanged)
    let x = globalId.x;
    let y = globalId.y;
    if x >= params.width || y >= params.height { return; }
    let pixelIndex = y * params.width + x;

    let pegSpacing = 32u;
    let pegRadius = 12.0;
    let glowRadius = 24.0;
    let ambientRadius = 45.0;

    let currentPegX = x / pegSpacing;
    let currentPegY = y / pegSpacing;
    let boardWidth = params.width / pegSpacing;
    let boardHeight = params.height / pegSpacing;

    var finalColor = vec4<f32>(0.05, 0.05, 0.05, 1.0);
    let cellX = f32(x % pegSpacing);
    let cellY = f32(y % pegSpacing);
    let cellCenterX = f32(pegSpacing) / 2.0;
    let cellCenterY = f32(pegSpacing) / 2.0;
    let distFromCenter = distance(vec2(cellX, cellY), vec2(cellCenterX, cellCenterY));

    if (abs(cellX - cellCenterX) > (f32(pegSpacing) / 2.0 - 1.0) || abs(cellY - cellCenterY) > (f32(pegSpacing) / 2.0 - 1.0)) {
        finalColor = vec4<f32>(0.02, 0.02, 0.02, 1.0);
    } else {
        let noise = rand(vec2<f32>(f32(x), f32(y))) * 0.03;
        finalColor += vec4<f32>(noise, noise, noise, 0.0);
    }
    if distFromCenter <= pegRadius * 0.8 {
        finalColor = mix(finalColor, vec4<f32>(0.0, 0.0, 0.0, 1.0), 0.8);
    } else if distFromCenter <= pegRadius {
        finalColor = mix(finalColor, vec4<f32>(0.1, 0.1, 0.1, 1.0), 0.5);
    }

    var accumulatedLight = vec3<f32>(0.0, 0.0, 0.0);

    // Loop through 3x3 neighbors
    for (var i = -1; i <= 1; i++) {
        for (var j = -1; j <= 1; j++) {
            let neighborPegX = i32(currentPegX) + i;
            let neighborPegY = i32(currentPegY) + j;

            if neighborPegX >= 0 && neighborPegX < i32(boardWidth) && neighborPegY >= 0 && neighborPegY < i32(boardHeight) {
                let pegIndex = u32(neighborPegY) * boardWidth + u32(neighborPegX);
                let colorIndex = boardState[pegIndex];

                if colorIndex > 0u {
                    let pegColor = getColor(colorIndex);
                    let pulseAmount = sin(params.time * 2.0 + f32(pegIndex) * 0.1) * 0.05 + 0.95;
                    let currentGlowIntensity = params.glowIntensity * pulseAmount;
                    let neighborCenterX = f32(u32(neighborPegX) * pegSpacing) + cellCenterX;
                    let neighborCenterY = f32(u32(neighborPegY) * pegSpacing) + cellCenterY;
                    let distToNeighbor = distance(vec2<f32>(f32(x), f32(y)), vec2<f32>(neighborCenterX, neighborCenterY));

                    // --- NEW PBR LOGIC ---
                    // 1. The Plastic Peg (Only if we are checking the center/current peg)
                    if (i == 0 && j == 0 && distToNeighbor <= pegRadius) {
                        // --- 3D HEMISPHERE MATH ---
                        
                        // Calculate relative position from peg center (-radius to +radius)
                        let relX = f32(x) - neighborCenterX;
                        let relY = f32(y) - neighborCenterY;

                        // Calculate the height (Z) of the sphere at this pixel
                        // Pythagorean theorem: x^2 + y^2 + z^2 = r^2  =>  z = sqrt(r^2 - (x^2 + y^2))
                        let z = sqrt(max(0.0, pegRadius * pegRadius - (relX * relX + relY * relY)));

                        // Create a surface normal vector (defines which way the surface points)
                        // We normalize it to length 1.0
                        let normal = normalize(vec3<f32>(relX, relY, z));

                        // Lighting Setup
                        let lightDir = normalize(vec3<f32>(-0.5, -0.8, 1.0)); // Light coming from top-left-front
                        let viewDir = vec3<f32>(0.0, 0.0, 1.0); // We are looking straight down

                        // Diffuse Lighting (Base plastic color)
                        // How much does the surface face the light?
                        let diff = max(dot(normal, lightDir), 0.0);
                        let materialColor = pegColor.rgb;
                        
                        // Specular Highlight (The shiny reflection)
                        // Standard Phong lighting reflection
                        let reflectDir = reflect(-lightDir, normal);
                        let spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0); // 32.0 is the shininess factor

                        // Combine Lighting
                        // Ambient (0.3) + Diffuse (0.7) + Specular (White reflection)
                        var solidColor = materialColor * (0.3 + 0.7 * diff) + vec3<f32>(1.0) * spec * 0.8;

                        // Internal Glow (Subsurface Scattering approximation)
                        // Edges of the sphere glow more to simulate light bouncing inside plastic
                        let fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
                        solidColor = solidColor + (pegColor.rgb * fresnel * 0.5 * currentGlowIntensity);

                        // Apply global intensity pulse
                        solidColor = solidColor * currentGlowIntensity;

                        accumulatedLight = accumulatedLight + solidColor;

                    } else {
                        // --- UNCHANGED GLOW LOGIC ---
                        // 2. Glow / Light Bleed (From any neighbor, including self)
                        if (distToNeighbor <= glowRadius && distToNeighbor > pegRadius) {
                            let t = (distToNeighbor - pegRadius) / (glowRadius - pegRadius);
                            let glowFalloff = 1.0 - t;
                            let glowStrength = pow(glowFalloff, 2.0) * 0.6 * currentGlowIntensity;
                            accumulatedLight = accumulatedLight + (pegColor.rgb * glowStrength);
                        }
                        if (distToNeighbor <= ambientRadius) {
                             let ambientFactor = smoothstep(ambientRadius, pegRadius, distToNeighbor);
                             let ambientStrength = ambientFactor * 0.15 * currentGlowIntensity;
                             accumulatedLight = accumulatedLight + (pegColor.rgb * ambientStrength);
                         }
                    }
                }
            }
        }
    }

    finalColor = vec4<f32>(finalColor.rgb + accumulatedLight, 1.0);
    outputPixels[pixelIndex] = packColor(clamp(finalColor, vec4<f32>(0.0), vec4<f32>(1.0)));
}