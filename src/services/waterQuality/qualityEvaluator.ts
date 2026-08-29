import { WaterQualityCategory, WaterQualityEvaluation, QualityParameterDetail } from '../../types';

export interface QualityThresholds {
  ph: {
    idealMin: number;
    idealMax: number;
    acceptableMin: number;
    acceptableMax: number;
    weight: number;
  };
  tds: {
    idealMax: number;
    acceptableMax: number;
    cautionMax: number;
    weight: number;
  };
  turbidity: {
    idealMax: number;
    acceptableMax: number;
    cautionMax: number;
    weight: number;
  };
  temperature: {
    idealMin: number;
    idealMax: number;
    acceptableMax: number;
    weight: number;
  };
}

// Configurable baseline thresholds based on WHO & EPA Drinking Water Guidelines
export const DEFAULT_QUALITY_THRESHOLDS: QualityThresholds = {
  ph: {
    idealMin: 6.8,
    idealMax: 7.8,
    acceptableMin: 6.5,
    acceptableMax: 8.5,
    weight: 0.35, // 35% weight
  },
  tds: {
    idealMax: 250, // ppm
    acceptableMax: 450,
    cautionMax: 800,
    weight: 0.30, // 30% weight
  },
  turbidity: {
    idealMax: 0.8, // NTU
    acceptableMax: 2.5,
    cautionMax: 5.0,
    weight: 0.25, // 25% weight
  },
  temperature: {
    idealMin: 4.0, // °C
    idealMax: 18.0,
    acceptableMax: 28.0,
    weight: 0.10, // 10% weight
  },
};

/**
 * Calculates a 0-100 sub-score for pH level
 */
function evaluatePh(ph: number, thresholds = DEFAULT_QUALITY_THRESHOLDS.ph): QualityParameterDetail {
  let score = 100;
  let status: 'optimal' | 'acceptable' | 'warning' | 'danger' = 'optimal';
  let description = 'Perfect physiological neutrality and mineral balance.';

  if (ph >= thresholds.idealMin && ph <= thresholds.idealMax) {
    score = 100 - Math.abs(ph - 7.3) * 10;
    status = 'optimal';
    description = 'Optimal biological pH for taste and cellular hydration.';
  } else if (ph >= thresholds.acceptableMin && ph <= thresholds.acceptableMax) {
    score = 80 - Math.abs(ph - 7.3) * 15;
    status = 'acceptable';
    description = 'Acceptable drinking range within WHO/EPA guidelines.';
  } else if (ph >= 6.0 && ph <= 9.0) {
    score = 50 - Math.abs(ph - 7.3) * 20;
    status = 'warning';
    description = ph < 6.5 ? 'Mildly acidic; may leach pipe minerals.' : 'Mildly alkaline; may have mineral taste.';
  } else {
    score = Math.max(5, 30 - Math.abs(ph - 7.0) * 10);
    status = 'danger';
    description = ph < 6.0 ? 'Highly acidic water. Filtration recommended.' : 'Excessively alkaline. Not recommended for direct consumption.';
  }

  return {
    name: 'pH Level',
    value: Number(ph.toFixed(1)),
    unit: 'pH',
    status,
    idealRange: `${thresholds.acceptableMin} – ${thresholds.acceptableMax}`,
    description,
    scoreContribution: Math.round(Math.max(0, Math.min(100, score))),
  };
}

/**
 * Calculates a 0-100 sub-score for Total Dissolved Solids (TDS ppm)
 */
function evaluateTds(tds: number, thresholds = DEFAULT_QUALITY_THRESHOLDS.tds): QualityParameterDetail {
  let score = 100;
  let status: 'optimal' | 'acceptable' | 'warning' | 'danger' = 'optimal';
  let description = 'Rich in natural minerals with pristine clarity.';

  if (tds < 30) {
    // Ultra low (e.g. distilled / heavy RO)
    score = 85;
    status = 'acceptable';
    description = 'Very low mineral content. Light refreshing taste.';
  } else if (tds <= thresholds.idealMax) {
    score = 100 - (tds / thresholds.idealMax) * 10;
    status = 'optimal';
    description = 'Ideal mineral balance for crisp taste and hydration.';
  } else if (tds <= thresholds.acceptableMax) {
    score = 85 - ((tds - thresholds.idealMax) / (thresholds.acceptableMax - thresholds.idealMax)) * 20;
    status = 'acceptable';
    description = 'Good drinking water; standard municipal tap profile.';
  } else if (tds <= thresholds.cautionMax) {
    score = 65 - ((tds - thresholds.acceptableMax) / (thresholds.cautionMax - thresholds.acceptableMax)) * 30;
    status = 'warning';
    description = 'High mineral hardness. Elevated dissolved solids.';
  } else {
    score = Math.max(0, 35 - ((tds - thresholds.cautionMax) / 500) * 30);
    status = 'danger';
    description = 'Excessive dissolved solids (>800 ppm). Filtration strongly advised.';
  }

  return {
    name: 'TDS (Dissolved Solids)',
    value: Math.round(tds),
    unit: 'ppm',
    status,
    idealRange: '< 300 ppm',
    description,
    scoreContribution: Math.round(Math.max(0, Math.min(100, score))),
  };
}

/**
 * Calculates a 0-100 sub-score for Turbidity (cloudiness NTU)
 */
function evaluateTurbidity(turbidity: number, thresholds = DEFAULT_QUALITY_THRESHOLDS.turbidity): QualityParameterDetail {
  let score = 100;
  let status: 'optimal' | 'acceptable' | 'warning' | 'danger' = 'optimal';
  let description = 'Pristine optical clarity with negligible particulates.';

  if (turbidity <= thresholds.idealMax) {
    score = 100 - (turbidity / thresholds.idealMax) * 10;
    status = 'optimal';
    description = 'Pristine optical clarity. Exceeds standard purification criteria.';
  } else if (turbidity <= thresholds.acceptableMax) {
    score = 85 - ((turbidity - thresholds.idealMax) / (thresholds.acceptableMax - thresholds.idealMax)) * 25;
    status = 'acceptable';
    description = 'Minor suspended particles. Well within standard municipal guidelines.';
  } else if (turbidity <= thresholds.cautionMax) {
    score = 60 - ((turbidity - thresholds.acceptableMax) / (thresholds.cautionMax - thresholds.acceptableMax)) * 30;
    status = 'warning';
    description = 'Noticeable haze detected. Check bottle chamber or filter.';
  } else {
    score = Math.max(0, 30 - (turbidity - thresholds.cautionMax) * 10);
    status = 'danger';
    description = 'High turbidity detected. High particulate concentration.';
  }

  return {
    name: 'Turbidity (Clarity)',
    value: Number(turbidity.toFixed(1)),
    unit: 'NTU',
    status,
    idealRange: '< 1.0 NTU',
    description,
    scoreContribution: Math.round(Math.max(0, Math.min(100, score))),
  };
}

/**
 * Calculates sub-score for Water Temperature (°C)
 */
function evaluateTemperature(temp: number, thresholds = DEFAULT_QUALITY_THRESHOLDS.temperature): QualityParameterDetail {
  let score = 95;
  let status: 'optimal' | 'acceptable' | 'warning' | 'danger' = 'optimal';
  let description = 'Crisp, refreshing drinking temperature.';

  if (temp >= 4.0 && temp <= 18.0) {
    score = 100;
    status = 'optimal';
    description = 'Optimal cool temperature. Ingestion promotes efficient hydration.';
  } else if (temp > 18.0 && temp <= 26.0) {
    score = 90;
    status = 'acceptable';
    description = 'Comfortable ambient room temperature.';
  } else if (temp > 26.0 && temp <= 40.0) {
    score = 75;
    status = 'warning';
    description = 'Warm water. May promote bacterial replication if stored prolonged.';
  } else {
    score = 60;
    status = 'warning';
    description = temp < 4 ? 'Near freezing; may cause mild esophageal vasoconstriction.' : 'Very warm or hot.';
  }

  return {
    name: 'Temperature',
    value: Number(temp.toFixed(1)),
    unit: '°C',
    status,
    idealRange: '4°C – 20°C',
    description,
    scoreContribution: Math.round(Math.max(0, Math.min(100, score))),
  };
}

/**
 * Master Water Quality Evaluator
 * Computes transparent, explainable 0-100 overall score from sensor inputs.
 */
export function evaluateWaterQuality(
  params: {
    ph?: number | null;
    tds?: number | null;
    turbidity?: number | null;
    temperature?: number | null;
    isOffline?: boolean;
  },
  thresholds = DEFAULT_QUALITY_THRESHOLDS
): WaterQualityEvaluation {
  // If explicitly flagged offline or all critical sensor telemetry is null/undefined
  const isOffline =
    params.isOffline ||
    params.ph === null ||
    params.ph === undefined ||
    params.tds === null ||
    params.tds === undefined ||
    params.turbidity === null ||
    params.turbidity === undefined ||
    params.temperature === null ||
    params.temperature === undefined;

  if (isOffline) {
    return {
      score: null,
      category: 'Offline',
      headline: 'DEVICE OFFLINE',
      description: 'AquaSense X device is currently offline. Connect your bottle or stream telemetry to view active purity screening.',
      colorClass: 'text-neutral-400',
      badgeBg: 'bg-neutral-800/80 border-neutral-700/60',
      badgeText: 'text-neutral-300',
      parameters: {
        ph: {
          name: 'pH Level',
          value: null,
          unit: 'pH',
          status: 'optimal',
          idealRange: `${thresholds.ph.acceptableMin} – ${thresholds.ph.acceptableMax}`,
          description: 'Sensor offline. Waiting for telemetry sync.',
          scoreContribution: 0,
        },
        tds: {
          name: 'TDS (Dissolved Solids)',
          value: null,
          unit: 'ppm',
          status: 'optimal',
          idealRange: '< 300 ppm',
          description: 'Sensor offline. Waiting for telemetry sync.',
          scoreContribution: 0,
        },
        turbidity: {
          name: 'Turbidity (Clarity)',
          value: null,
          unit: 'NTU',
          status: 'optimal',
          idealRange: '< 1.0 NTU',
          description: 'Sensor offline. Waiting for telemetry sync.',
          scoreContribution: 0,
        },
        temperature: {
          name: 'Temperature',
          value: null,
          unit: '°C',
          status: 'optimal',
          idealRange: '4°C – 20°C',
          description: 'Sensor offline. Waiting for telemetry sync.',
          scoreContribution: 0,
        },
      },
      safetyDisclaimer:
        'AquaSense X is currently offline. Connect your bottle to resume real-time multi-spectral sensor screening.',
      isDrinkable: false,
    };
  }

  const phDetail = evaluatePh(params.ph!, thresholds.ph);
  const tdsDetail = evaluateTds(params.tds!, thresholds.tds);
  const turbidityDetail = evaluateTurbidity(params.turbidity!, thresholds.turbidity);
  const tempDetail = evaluateTemperature(params.temperature!, thresholds.temperature);

  // Weighted total
  const rawScore =
    phDetail.scoreContribution * thresholds.ph.weight +
    tdsDetail.scoreContribution * thresholds.tds.weight +
    turbidityDetail.scoreContribution * thresholds.turbidity.weight +
    tempDetail.scoreContribution * thresholds.temperature.weight;

  const score = Math.round(Math.max(0, Math.min(100, rawScore)));

  let category: WaterQualityCategory = 'Excellent';
  let headline = 'EXCELLENT PURITY';
  let description = 'Your water has optimal chemical balance, low particulate matter, and pure mineral content.';
  let colorClass = 'text-emerald-400';
  let badgeBg = 'bg-emerald-500/10 border-emerald-500/20';
  let badgeText = 'text-emerald-300';
  let isDrinkable = true;

  if (score >= 88) {
    category = 'Excellent';
    headline = 'GOOD TO DRINK';
    description = 'Optimal chemical balance, pristine optical clarity, and refreshing mineral profile.';
    colorClass = 'text-cyan-400';
    badgeBg = 'bg-cyan-500/10 border-cyan-500/20';
    badgeText = 'text-cyan-300';
    isDrinkable = true;
  } else if (score >= 70) {
    category = 'Good';
    headline = 'ACCEPTABLE QUALITY';
    description = 'Standard drinking water parameters within normal safe municipal tolerances.';
    colorClass = 'text-emerald-400';
    badgeBg = 'bg-emerald-500/10 border-emerald-500/20';
    badgeText = 'text-emerald-300';
    isDrinkable = true;
  } else if (score >= 50) {
    category = 'Caution';
    headline = 'CAUTION ADVISED';
    description = 'Elevated TDS, turbidity, or pH deviation detected. Inspect source or filter before drinking.';
    colorClass = 'text-amber-400';
    badgeBg = 'bg-amber-500/10 border-amber-500/20';
    badgeText = 'text-amber-300';
    isDrinkable = false;
  } else {
    category = 'Poor';
    headline = 'NOT RECOMMENDED';
    description = 'Critical sensor thresholds exceeded. High turbidity or abnormal chemical indicators.';
    colorClass = 'text-rose-400';
    badgeBg = 'bg-rose-500/10 border-rose-500/20';
    badgeText = 'text-rose-300';
    isDrinkable = false;
  }

  return {
    score,
    category,
    headline,
    description,
    colorClass,
    badgeBg,
    badgeText,
    parameters: {
      ph: phDetail,
      tds: tdsDetail,
      turbidity: turbidityDetail,
      temperature: tempDetail,
    },
    safetyDisclaimer:
      'AquaSense X optical and electrochemical sensors provide real-time screening. They do not replace certified biological laboratory analysis or medical diagnostics.',
    isDrinkable,
  };
}
