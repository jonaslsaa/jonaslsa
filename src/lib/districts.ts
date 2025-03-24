// --- Location Bias Mapping ---
export const districtToLocationBias = new Map([
  ['Sør-Øst Politidistrikt', 'point:59.2736681, 10.40305903'],
  ['Oslo Politidistrikt', 'point:59.9138688, 10.75224541'],
  ['Øst Politidistrikt', 'point:59.7155459, 10.83161895'],
  ['Sør-Vest Politidistrikt', 'point:58.9636489, 5.735737659'],
  ['Agder Politidistrikt', 'point:58.1471410, 7.998652932'],
  ['Innlandet Politidistrikt', 'point:60.7960557, 11.09422286'],
  ['Nordland Politidistrikt', 'point:67.2886571, 14.39942244'],
  ['Finnmark Politidistrikt', 'point:69.7306470, 30.02526065'],
  ['Trøndelag Politidistrikt', 'point:63.4397447, 10.39951882'],
  ['Møre og Romsdal Politidistrikt', 'point:62.4767951, 6.143121702'],
  ['Vest Politidistrikt', 'point:60.3929948, 5.329137019'],
  ['Troms Politidistrikt', 'point:69.6598271, 18.96782164'],
]);

export const PoliceDistricts = districtToLocationBias.keys();