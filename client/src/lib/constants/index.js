export const API_BASE_URL = 'http://localhost:4000';

export const MIC_NAMES = {
  XNAS: 'NASDAQ',
  XNYS: 'NYSE',
  XASE: 'NYSE American',
  ARCX: 'NYSE Arca',
  XCHI: 'NYSE Chicago',
  BATS: 'Cboe BZX',
  EDGX: 'Cboe EDGX',
  IEXG: 'IEX',
  OTCM: 'OTC Markets',
  XOTC: 'OTC Bulletin Board',
  XPHL: 'Nasdaq PHLX',
  XBOS: 'Nasdaq BX',
  XISE: 'ISE',
  XCBO: 'Cboe Options',
  XNCM: 'Nasdaq Capital Market',
  XNGS: 'Nasdaq Global Select',
  XNMS: 'Nasdaq Global Market',
};

export function getMicName(mic) {
  return MIC_NAMES[mic] ?? mic;
}

export const MIC_CURRENCY = {
  XNAS: 'USD',
  XNYS: 'USD',
  XASE: 'USD',
  ARCX: 'USD',
  XCHI: 'USD',
  BATS: 'USD',
  EDGX: 'USD',
  IEXG: 'USD',
  OTCM: 'USD',
  XOTC: 'USD',
  XPHL: 'USD',
  XBOS: 'USD',
  XISE: 'USD',
  XCBO: 'USD',
  XNCM: 'USD',
  XNGS: 'USD',
  XNMS: 'USD',
};

export function getMicCurrency(mic) {
  return MIC_CURRENCY[mic] ?? null;
}
