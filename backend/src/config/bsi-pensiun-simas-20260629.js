// Extracted from numeric source cells only. No macro execution or cached tariff fallback.
// Source: Simulasi Premi AJP (Pensiun) BSI + Atribusi (Standarisasi RTC) - 20260629 - Final.xlsm
// SHA256: 7c6b686e42729f67feabe9ca299c421311a9cb380067f8d69029e24a2ff6d768
// Menurun: Spek Produk L96:AA125. Array index 0 = 1 policy year; null = unavailable.
export const SIMAS_PENSIUN_PROFILE = Object.freeze({
  version: "simas-pensiun-menurun-2026-06-29",
  source_sha256: "7c6b686e42729f67feabe9ca299c421311a9cb380067f8d69029e24a2ff6d768",
  max_sum_assured: 350000000, min_entry_age: 45, max_entry_age: 74,
  max_policy_months: 180, max_end_age: 75,
  month_multipliers: Object.freeze([0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.875, 1, 1, 1, 1]),
  tariffs_permil: Object.freeze({
    "45": Object.freeze([3.6,6.52,9.28,12.08,15.18,18.43,21.57,24.62,28.3,31.91,35.51,38.63,42.34,46.2,50.04]),
    "46": Object.freeze([3.87,7.08,10.09,13.18,16.51,19.99,23.34,27,30.67,34.53,38.41,42.02,46.03,50.14,54.26]),
    "47": Object.freeze([4.18,7.73,11.01,14.38,18.01,21.79,25.41,29.16,33.7,37.52,41.7,45.61,49.92,54.33,58.76]),
    "48": Object.freeze([4.52,8.43,12,15.69,19.65,23.75,27.94,31.99,36.31,40.73,45.21,49.42,54.04,58.78,63.55]),
    "49": Object.freeze([4.87,9.16,13.05,17.12,21.38,25.77,30.24,35.09,39.35,44.07,48.91,53.76,58.75,63.79,68.91]),
    "50": Object.freeze([5.25,10,14.24,18.68,23.32,28.09,32.92,37.9,43.23,47.89,53.1,58.36,63.72,69.12,74.62]),
    "51": Object.freeze([5.69,10.91,15.53,20.39,25.45,30.62,36.2,41.58,46.59,51.99,57.57,63.24,68.98,74.79,80.71]),
    "52": Object.freeze([6.19,11.91,16.95,22.25,27.74,33.35,39.06,44.76,50.46,56.32,62.3,68.37,74.54,80.8,87.15]),
    "53": Object.freeze([6.75,13.01,18.51,24.25,30.2,36.22,42.28,48.38,54.55,60.83,67.23,73.75,80.39,87.13,93.96]),
    "54": Object.freeze([7.39,14.18,20.14,26.35,32.73,39.17,45.63,52.15,58.75,65.47,72.33,79.35,86.51,93.77,101.11]),
    "55": Object.freeze([8.08,15.39,21.81,28.46,35.26,42.1,48.98,55.92,62.97,70.19,77.59,85.16,92.87,100.68,108.58]),
    "56": Object.freeze([8.84,16.59,23.44,30.51,37.69,44.94,52.26,59.67,67.26,75.04,83.01,91.17,99.48,107.89,116.24]),
    "57": Object.freeze([9.61,17.69,24.96,32.43,40,47.67,55.47,63.44,71.62,80.03,88.66,97.46,106.4,115.42,124.55]),
    "58": Object.freeze([10.45,18.71,26.37,34.23,42.23,50.4,58.79,67.39,76.26,85.35,94.67,104.16,113.79,123.52,133.31]),
    "59": Object.freeze([11.35,19.67,27.74,36.01,44.54,53.34,62.4,71.73,81.33,91.18,101.24,111.48,121.85,132.31,142.85]),
    "60": Object.freeze([12.34,20.64,29.13,37.98,47.18,56.7,66.54,76.67,87.07,97.73,108.6,119.63,130.8,142.07,153.4]),
    "61": Object.freeze([13.45,21.66,30.78,40.36,50.36,60.72,71.4,82.4,93.68,105.21,116.94,128.84,140.89,153.02,null]),
    "62": Object.freeze([14.7,23.02,32.98,43.42,54.31,65.59,77.22,89.16,101.37,113.83,126.5,139.35,152.34,null,null]),
    "63": Object.freeze([16.11,25.13,36.02,47.44,59.32,71.59,84.21,97.14,110.36,123.83,137.52,151.4,null,null,null]),
    "64": Object.freeze([17.69,27.78,39.78,51.92,64.86,78.2,91.87,105.88,120.17,134.74,149.54,null,null,null,null]),
    "65": Object.freeze([19.42,30.25,43.27,56.78,70.84,85.3,100.12,115.27,130.75,146.51,null,null,null,null,null]),
    "66": Object.freeze([21.25,33.06,47.22,61.97,77.22,92.9,108.96,125.38,142.14,null,null,null,null,null,null]),
    "67": Object.freeze([23.21,36.07,51.48,67.5,84.06,101.07,118.49,136.31,null,null,null,null,null,null,null]),
    "68": Object.freeze([25.31,39.31,56.06,73.48,91.47,109.96,128.9,null,null,null,null,null,null,null,null]),
    "69": Object.freeze([27.58,42.82,61.07,80.05,99.65,119.79,null,null,null,null,null,null,null,null,null]),
    "70": Object.freeze([30.1,46.75,66.68,87.41,108.82,null,null,null,null,null,null,null,null,null,null]),
    "71": Object.freeze([51.7,99.54,147.37,194.92,null,null,null,null,null,null,null,null,null,null,null]),
    "72": Object.freeze([56.28,108.27,159.86,null,null,null,null,null,null,null,null,null,null,null,null]),
    "73": Object.freeze([61.34,117.51,null,null,null,null,null,null,null,null,null,null,null,null,null]),
    "74": Object.freeze([66.78,null,null,null,null,null,null,null,null,null,null,null,null,null,null]),
  })
});
