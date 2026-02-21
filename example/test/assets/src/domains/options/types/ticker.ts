type FmtRawNumber = {
  fmt: string
  raw: number
}

type FmtRawInteger = {
  fmt: string
  longFmt: string
  raw: number
}

type FmtRawRangeString = {
  fmt: string
  raw: string
}

export type TickerData = {
  region: string // e.g. "US"
  cryptoTradeable: boolean
  marketState: string // e.g. "PRE"
  exchangeTimezoneName: string // e.g. "America/New_York"

  regularMarketChange: FmtRawNumber
  firstTradeDateMilliseconds: number

  sharesOutstanding: FmtRawInteger

  exchangeTimezoneShortName: string // e.g. "EST"
  triggerable: boolean
  hasPrePostMarketData: boolean

  regularMarketDayHigh: FmtRawNumber

  typeDisp: string // e.g. "Equity"

  fiftyTwoWeekHighChange: FmtRawNumber
  regularMarketVolume: FmtRawInteger

  priceHint: number

  fiftyTwoWeekLowChange: FmtRawNumber

  gmtOffSetMilliseconds: number
  exchange: string // e.g. "NYQ"

  regularMarketDayRange: FmtRawRangeString

  currency: string // e.g. "USD"
  sourceInterval: number

  marketCap: FmtRawInteger

  exchangeDataDelayedBy: number

  regularMarketTime: {
    fmt: string // e.g. "4:00PM EST"
    raw: number // epoch seconds
  }

  longName: string
  quoteSourceName: string

  regularMarketPreviousClose: FmtRawNumber

  fiftyTwoWeekHigh: FmtRawNumber

  fiftyTwoWeekLowChangePercent: FmtRawNumber // raw is ratio, e.g. 0.2453

  language: string // e.g. "en-US"
  tradeable: boolean
  timestamp: number

  fiftyTwoWeekRange: FmtRawRangeString

  shortName: string

  regularMarketPrice: FmtRawNumber
  postMarketPrice?: FmtRawNumber

  market: string // e.g. "us_market"

  fiftyTwoWeekHighChangePercent: FmtRawNumber // raw is ratio, e.g. -0.3068

  fullExchangeName: string // e.g. "NYSE"

  regularMarketDayLow: FmtRawNumber

  customPriceAlertConfidence: string // e.g. "HIGH"

  regularMarketOpen: FmtRawNumber

  quoteType: 'EQUITY' | string
  symbol: string

  regularMarketChangePercent: FmtRawNumber // raw is ratio, e.g. 0.0073

  fiftyTwoWeekLow: FmtRawNumber
}
