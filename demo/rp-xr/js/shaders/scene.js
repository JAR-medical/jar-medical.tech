// WebGL2 GLSL ES 3.00 shaders for the scene pass (street and video scenes).

export const STREET_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColor;
layout(location = 3) in float aMaterial;

uniform mat4 uView;
uniform mat4 uProj;
uniform mat4 uModel;

out vec3 vWorldPos;
out vec3 vNormal;
out vec3 vColor;
out float vMaterial;

void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorldPos = wp.xyz;
  // Normal matrix (assumes uniform scale / orthonormal model upper 3x3)
  vNormal = normalize((uModel * vec4(aNormal, 0.0)).xyz);
  vColor = aColor;
  vMaterial = aMaterial;
  gl_Position = uProj * uView * wp;
}
`;

export const STREET_FS = `#version 300 es
precision highp float;
precision highp int;

in vec3 vWorldPos;
in vec3 vNormal;
in vec3 vColor;
in float vMaterial;

uniform float uNight;
uniform float uTime;
uniform vec3 uEyePos;

out vec4 fragColor;

// Simple hash for building windows
float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  // Material 8: Sky dome (unlit gradient)
  if (vMaterial > 7.5) {
    float h = clamp(normalize(vWorldPos).y, 0.0, 1.0);
    vec3 daySky = mix(vec3(0.68, 0.78, 0.90), vec3(0.18, 0.45, 0.85), pow(h, 0.6));
    vec3 nightSky = mix(vec3(0.015, 0.02, 0.04), vec3(0.003, 0.005, 0.012), pow(h, 0.8));
    fragColor = vec4(mix(daySky, nightSky, uNight), 1.0);
    return;
  }

  vec3 N = normalize(vNormal);
  vec3 baseColor = vColor;
  float emissive = 0.0;
  vec3 emissiveColor = vec3(0.0);

  // Material 2: Buildings — procedural window pattern based on world position
  if (abs(vMaterial - 2.0) < 0.5) {
    // Windows on vertical facades
    if (abs(N.y) < 0.3 && vWorldPos.y > 1.2) {
      float floorH = 3.2;
      float winW = 2.4;
      vec2 grid = vec2(abs(vWorldPos.z) / winW, vWorldPos.y / floorH);
      vec2 cell = fract(grid);
      vec2 id = floor(grid) + vec2(floor(vWorldPos.x * 0.1), 0.0);

      // Window area within cell
      if (cell.x > 0.22 && cell.x < 0.78 && cell.y > 0.25 && cell.y < 0.82) {
        float h = hash2(id + 13.7);
        if (uNight > 0.5) {
          // Night windows: warm yellow lights or dark
          if (h > 0.42) {
            baseColor = vec3(1.0, 0.86, 0.45);
            emissive = 0.9;
            emissiveColor = baseColor;
          } else {
            baseColor = vec3(0.015, 0.02, 0.03);
          }
        } else {
          // Day windows: tinted dark reflective glass
          baseColor = vec3(0.12, 0.16, 0.22);
        }
      }
    }
  }
  // Material 4: Street lamp light fixture (head)
  else if (abs(vMaterial - 4.0) < 0.5) {
    if (uNight > 0.5) {
      baseColor = vec3(1.0, 0.92, 0.75);
      emissive = 1.0;
      emissiveColor = baseColor;
    }
  }
  // Material 6: Vehicle headlights / taillights
  else if (abs(vMaterial - 6.0) < 0.5) {
    if (uNight > 0.5) {
      emissive = 1.0;
      emissiveColor = baseColor;
    }
  }
  // Material 0: Road asphalt with center lane dashes
  else if (abs(vMaterial - 0.0) < 0.5) {
    // Road center is at x = -3.0. Dashed yellow line at center
    if (abs(vWorldPos.x - (-3.0)) < 0.08) {
      if (fract(vWorldPos.z / 4.0) > 0.4) {
        baseColor = vec3(0.85, 0.75, 0.2); // yellow dash
      }
    }
  }

  // --- Lighting: Lambert + Hemisphere Ambient ---
  // Sun / Moon directional light
  vec3 sunDir = normalize(vec3(0.45, 0.85, 0.25));
  vec3 moonDir = normalize(vec3(-0.35, 0.75, -0.35));
  vec3 lightDir = mix(sunDir, moonDir, uNight);

  float NdotL = max(dot(N, lightDir), 0.0);
  vec3 sunColor = vec3(0.95, 0.92, 0.85) * 0.85;
  vec3 moonColor = vec3(0.25, 0.35, 0.55) * 0.12;
  vec3 directLight = mix(sunColor, moonColor, uNight) * NdotL;

  // Hemisphere ambient
  vec3 skyAmbDay = vec3(0.35, 0.42, 0.55) * 0.5;
  vec3 gndAmbDay = vec3(0.18, 0.16, 0.15) * 0.4;
  vec3 skyAmbNight = vec3(0.015, 0.02, 0.035);
  vec3 gndAmbNight = vec3(0.008, 0.008, 0.01);

  vec3 skyAmb = mix(skyAmbDay, skyAmbNight, uNight);
  vec3 gndAmb = mix(gndAmbDay, gndAmbNight, uNight);
  vec3 ambientLight = mix(gndAmb, skyAmb, N.y * 0.5 + 0.5);

  // Street lamp light pools at night
  vec3 lampLight = vec3(0.0);
  if (uNight > 0.05) {
    // Lamps are spaced along both sidewalks (east x = 0.3, west x = -6.3)
    // Periodic in Z every 20m from z = +15 to -105
    for (int side = 0; side < 2; side++) {
      float lx = side == 0 ? 0.3 : -6.3;
      // Nearest lamp z index:
      float lzBase = floor((15.0 - vWorldPos.z) / 20.0);
      for (float off = -1.0; off <= 1.0; off += 1.0) {
        float lz = 15.0 - (lzBase + off) * 20.0;
        if (lz >= -115.0 && lz <= 25.0) {
          vec3 lampPos = vec3(lx, 4.6, lz);
          vec3 toL = lampPos - vWorldPos;
          float d2 = dot(toL, toL);
          float att = 1.0 / (1.0 + 0.12 * d2);
          vec3 lDir = normalize(toL);
          float lampNdotL = max(dot(N, lDir), 0.0);
          lampLight += vec3(1.0, 0.88, 0.6) * 1.8 * lampNdotL * att;
        }
      }
    }
    lampLight *= uNight;
  }

  vec3 litColor = baseColor * (ambientLight + directLight + lampLight) + emissiveColor * emissive;

  // Distance fog
  float dist = length(vWorldPos - uEyePos);
  float fogFactor = 1.0 - exp(-pow(dist * 0.011, 1.4));
  vec3 dayFog = vec3(0.68, 0.78, 0.90);
  vec3 nightFog = vec3(0.015, 0.02, 0.04);
  vec3 fogColor = mix(dayFog, nightFog, uNight);

  vec3 finalColor = mix(litColor, fogColor, clamp(fogFactor, 0.0, 1.0));
  fragColor = vec4(finalColor, 1.0);
}
`;

export const VIDEO_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aUV;

uniform mat4 uView;
uniform mat4 uProj;
uniform mat4 uModel;

out vec2 vUV;
out vec3 vWorldPos;

void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorldPos = wp.xyz;
  vUV = aUV;
  gl_Position = uProj * uView * wp;
}
`;

export const VIDEO_FS = `#version 300 es
precision highp float;

in vec2 vUV;
in vec3 vWorldPos;

uniform sampler2D uVideoTex;
uniform float uIsScreen;

out vec4 fragColor;

void main() {
  if (uIsScreen > 0.5) {
    fragColor = vec4(texture(uVideoTex, vUV).rgb, 1.0);
  } else {
    // Dark room floor / dome
    float h = clamp(vWorldPos.y / 10.0, 0.0, 1.0);
    vec3 roomColor = mix(vec3(0.018, 0.02, 0.025), vec3(0.005, 0.006, 0.009), h);
    fragColor = vec4(roomColor, 1.0);
  }
}
`;
