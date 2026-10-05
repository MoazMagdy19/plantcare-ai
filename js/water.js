// Simulated watering estimate (prototype only — NOT agronomic advice).
//
// Base curve, for a leafy plant in a medium pot at ~30°C, aiming for 35% moisture:
//   8% -> 1.2 L · 18% -> 0.8 L · 30% -> 0.3 L · 40%+ -> no watering needed
// The result is then scaled by plant type, pot size and temperature.

const WATER_REFERENCE_TARGET = 35;
const WATER_NO_WATER_FROM = 40;

const WATER_BASE_CURVE = [
  [0, 1.6],
  [8, 1.2],
  [18, 0.8],
  [30, 0.3],
  [40, 0],
];

const WATER_PLANT_FACTOR = {
  cactus: 0.5,
  herb: 0.9,
  leafy: 1,
  flowering: 1.15,
};

const WATER_POT_FACTOR = {
  small: 0.6,
  medium: 1,
  large: 1.5,
};

function waterInterpolate(moisture) {
  const x = Math.min(WATER_NO_WATER_FROM, Math.max(0, moisture));
  for (let i = 0; i < WATER_BASE_CURVE.length - 1; i++) {
    const [x0, y0] = WATER_BASE_CURVE[i];
    const [x1, y1] = WATER_BASE_CURVE[i + 1];
    if (x >= x0 && x <= x1) {
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return 0;
}

function waterTemperatureFactor(temperature) {
  const delta = (temperature - 30) * 0.015;
  return 1 + Math.min(0.2, Math.max(-0.15, delta));
}

/**
 * @param {{currentMoisture:number, targetMoisture:number, temperature:number, plantType:string, potSize:string}} input
 * @returns {{needed:false} | {needed:true, liters:number, timing:'now'|'soon'}}
 */
function calculateWater(input) {
  const { currentMoisture, targetMoisture, temperature, plantType, potSize } = input;

  if (currentMoisture >= WATER_NO_WATER_FROM || currentMoisture >= targetMoisture) {
    return { needed: false };
  }

  // A higher target than the reference means the soil must be wetter => shift the curve down.
  const effectiveMoisture = currentMoisture + (WATER_REFERENCE_TARGET - targetMoisture);
  const base = waterInterpolate(effectiveMoisture);

  const raw =
    base * (WATER_PLANT_FACTOR[plantType] ?? 1) * (WATER_POT_FACTOR[potSize] ?? 1) * waterTemperatureFactor(temperature);
  const liters = Math.max(0.1, Math.round(raw / 0.05) * 0.05);

  return {
    needed: true,
    liters: parseFloat(liters.toFixed(2)),
    timing: currentMoisture < 20 ? 'now' : 'soon',
  };
}
