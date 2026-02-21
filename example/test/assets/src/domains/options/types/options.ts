export type OptionsResponse = {
  options: {
    calls: OptionContract[]
    expirationDate: number // unix seconds
    hasMiniOptions: boolean
    puts: OptionContract[]
  }
  quote: Quote
  expirationDates: number[] // unix seconds
  strikes: number[]
}

export type ContractSize = 'REGULAR' | (string & {})
export type CurrencyCode = 'USD' | (string & {})
export type MarketState =
  | 'PREPRE'
  | 'PRE'
  | 'REGULAR'
  | 'POST'
  | 'CLOSED'
  | (string & {})
export type QuoteType = 'EQUITY' | (string & {})

export type OptionContract = {
  ask: number
  bid: number
  change: number
  contractSize: ContractSize
  contractSymbol: string
  currency: CurrencyCode
  expiration: number // unix seconds
  impliedVolatility: number
  inTheMoney: boolean
  lastPrice: number
  lastTradeDate: number // unix seconds
  openInterest: number
  percentChange: number
  strike: number
  volume?: number // optional: not always present
}

export type Quote = {
  postMarketPrice: number
  isEarningsDateEstimate: boolean
  region: string

  postMarketChange: number
  postMarketChangePercent: number
  postMarketTime: number // unix seconds

  regularMarketPrice: number
  regularMarketChange: number
  regularMarketChangePercent: number
  regularMarketTime: number // unix seconds
  regularMarketPreviousClose: number
  regularMarketOpen: number
  regularMarketDayHigh: number
  regularMarketDayLow: number
  regularMarketDayRange: string
  regularMarketVolume: number

  averageDailyVolume10Day: number
  averageDailyVolume3Month: number

  cryptoTradeable: boolean
  tradeable: boolean
  triggerable: boolean
  hasPrePostMarketData: boolean

  exchange: string
  fullExchangeName: string
  quoteSourceName: string
  exchangeDataDelayedBy: number
  exchangeTimezoneName: string
  exchangeTimezoneShortName: string
  gmtOffSetMilliseconds: number
  market: string
  marketState: MarketState

  typeDisp: string
  quoteType: QuoteType

  symbol: string
  shortName: string
  longName: string

  currency: CurrencyCode
  financialCurrency: CurrencyCode
  language: string

  priceHint: number
  ask: number
  askSize: number
  bid: number
  bidSize: number

  marketCap: number
  sharesOutstanding: number

  epsCurrentYear: number
  epsForward: number
  epsTrailingTwelveMonths: number

  forwardPE: number
  priceEpsCurrentYear: number
  priceToBook: number
  bookValue: number

  fiftyDayAverage: number
  fiftyDayAverageChange: number
  fiftyDayAverageChangePercent: number

  twoHundredDayAverage: number
  twoHundredDayAverageChange: number
  twoHundredDayAverageChangePercent: number

  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  fiftyTwoWeekRange: string

  fiftyTwoWeekHighChange: number
  fiftyTwoWeekHighChangePercent: number

  fiftyTwoWeekLowChange: number
  fiftyTwoWeekLowChangePercent: number

  trailingAnnualDividendRate: number
  trailingAnnualDividendYield: number
  dividendDate: number // unix seconds

  esgPopulated: boolean

  corporateActions: unknown[]
  customPriceAlertConfidence: string

  messageBoardId: string

  earningsTimestamp: number // unix seconds
  earningsTimestampStart: number // unix seconds
  earningsTimestampEnd: number // unix seconds
  earningsCallTimestampStart: number // unix seconds
  earningsCallTimestampEnd: number // unix seconds

  averageAnalystRating: string

  nameChangeDate: string // "YYYY-MM-DD"
  prevName: string

  firstTradeDateMilliseconds: number // unix ms
  sourceInterval: number
}
