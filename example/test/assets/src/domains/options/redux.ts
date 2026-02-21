import uniq from 'lodash/uniq'
import { Channel } from 'phoenix'
import { Reducer, UnknownAction } from 'redux'
import { v4 } from 'uuid'

import {
  OptionContract,
  OptionsResponse,
} from '@/domains/options/types/options'
import { TickerData } from '@/domains/options/types/ticker'
import { AppDispatch, AppGetState } from '@/redux'

export type BinaryId = string
export type DateString = string
export type Timestamp = number

export interface PredictionData {
  date: DateString
  days_to_expiry: number
  underlying_price: number
  price: number
  cost: number
}

export interface SymbolSearchResult {
  id: number
  name: string
  symbol: string
}

export enum DisplayMode {
  PROFIT_LOSS = 'profit_loss',
  PERCENT_ENTRY = 'percent_entry',
}

export interface OptionsState {
  queryId: BinaryId | null
  query: BinaryId | null
  data: PredictionData[]
  predictionsFetching: boolean
  quoteLoading: boolean
  tickers: Partial<Record<string, TickerData>>
  quoteSearch: string
  searchResults: SymbolSearchResult[]
  searchLoading: boolean
  symbol: string | null
  selectedExpirationDate: Timestamp | null
  optionsLoading: boolean
  buyOrWrite: 'long' | 'write'
  quote: OptionsResponse['quote'] | null
  contracts: number | null
  selectedOption:
    | (OptionContract & {
        strike: number
        price: number
        type: 'call' | 'put'
        buyOrWrite: 'long' | 'write'
      })
    | null
  options: {
    calls: OptionContract[]
    callsByContractSymbol: Partial<Record<string, OptionContract>>
    callsByExpirationDate: Partial<
      Record<string, Partial<Record<string, OptionContract>>>
    >
    expirationDate: number | null // unix seconds
    strikes: number[]
    hasMiniOptions: boolean
    puts: OptionContract[]
    putsByContractSymbol: Partial<Record<string, OptionContract>>
    putsByExpirationDate: Partial<
      Record<string, Partial<Record<string, OptionContract>>>
    >
  }
  overridesInput: {
    price: string
    strike: string
    type: 'call' | 'put' | ''
    iv: string
  }
  overrides: {
    price: number | null
    strike: number | null
    type: 'call' | 'put' | null
    iv: number | null
  }
  searchOpen: boolean
  optionDrawerOpen: boolean
  expirationDates: number[] | null // unix seconds
  lowerBound: number | null
  upperBound: number | null
  displayMode: DisplayMode
}

export const DEFAULT_STATE: OptionsState = {
  queryId: null,
  predictionsFetching: false,
  query: null,
  data: [],
  tickers: {},
  quoteLoading: false,
  quoteSearch: '',
  searchResults: [],
  searchLoading: false,
  symbol: null,
  selectedExpirationDate: null,
  selectedOption: null,
  optionsLoading: false,
  buyOrWrite: 'long',
  quote: null,
  contracts: 1,
  options: {
    calls: [],
    puts: [],
    strikes: [],
    expirationDate: null,
    hasMiniOptions: false,
    callsByContractSymbol: {},
    putsByContractSymbol: {},
    callsByExpirationDate: {},
    putsByExpirationDate: {},
  },
  overridesInput: {
    strike: '',
    price: '',
    type: '',
    iv: '',
  },
  overrides: {
    strike: null,
    price: null,
    type: null,
    iv: null,
  },
  searchOpen: false,
  optionDrawerOpen: false,
  expirationDates: null,
  lowerBound: null,
  upperBound: null,
  displayMode: DisplayMode.PERCENT_ENTRY,
}

export interface RequestPredictions extends UnknownAction {
  type: 'predictions/request'
  payload: {
    id: BinaryId
  }
}

export interface ReceivePredictions extends UnknownAction {
  type: 'predictions/receive'
  payload: {
    id: BinaryId
  }
}

export interface PredictionsStream extends UnknownAction {
  type: 'predictions/stream'
  payload: {
    id: BinaryId
    data: PredictionData
  }
}

export interface TickerUpdate extends UnknownAction {
  type: 'ticker/update'
  payload: TickerData
}

export interface OptionRequest extends UnknownAction {
  type: 'options/request'
  payload: {
    id: BinaryId
  }
}

export interface OptionReceive extends UnknownAction {
  type: 'options/receive'
  payload: OptionsResponse
}

export interface QuoteRequest extends UnknownAction {
  type: 'quote/request'
  payload: {
    id: BinaryId
    ticker: string
  }
}

export interface SymbolSearchRequest extends UnknownAction {
  type: 'equities/search/request'
  payload: {
    id: BinaryId
    search: string
  }
}

export interface SymbolSearchReceive extends UnknownAction {
  type: 'equities/search/receive'
  payload: {
    id: BinaryId
    search: string
    equities: SymbolSearchResult[]
  }
}

export interface SymbolSelect extends UnknownAction {
  type: 'equities/select'
  payload: {
    symbol: string | null
  }
}

export interface SelectExpiration extends UnknownAction {
  type: 'options/selectExpiration'
  payload: {
    expirationDate: Timestamp
  }
}

export interface SearchOpen extends UnknownAction {
  type: 'options/searchOpen'
  payload: boolean
}

export interface OptionsDrawer extends UnknownAction {
  type: 'options/optionsDrawer'
  payload: boolean
}

export interface SelectOption extends UnknownAction {
  type: 'options/selectOption'
  payload: OptionsState['selectedOption']
}

export interface UpdateOptions extends UnknownAction {
  type: 'options/updateOptions'
  payload: Partial<{
    buyOrWrite: 'long' | 'write'
    contracts: number | null
    lowerBound: number | null
    upperBound: number | null
    displayMode: DisplayMode
  }>
}

export interface UpdateOverrides extends UnknownAction {
  type: 'options/updateOverrides'
  payload: Partial<OptionsState['overridesInput']>
}

export type Actions =
  | RequestPredictions
  | ReceivePredictions
  | PredictionsStream
  | TickerUpdate
  | OptionRequest
  | OptionReceive
  | QuoteRequest
  | SymbolSearchRequest
  | SymbolSearchReceive
  | SymbolSelect
  | SelectExpiration
  | SearchOpen
  | OptionsDrawer
  | SelectOption
  | UpdateOptions
  | UpdateOverrides

export const reducer: Reducer<OptionsState, Actions> = (
  state: OptionsState = DEFAULT_STATE,
  action,
) => {
  switch (action.type) {
    case 'predictions/request': {
      return {
        ...state,
        queryId: action.payload.id,
        predictionsFetching: true,
        optionDrawerOpen: false,
        data: [],
      }
    }
    case 'predictions/stream': {
      if (state.queryId !== action.payload.id) {
        console.warn(
          `Received data for ${action.payload.id} but expected ${state.queryId}`,
          action,
        )
        return state
      }
      let value
      if (!Array.isArray(action.payload.data)) {
        value = [action.payload.data]
      } else {
        value = action.payload.data
      }

      return {
        ...state,
        data: [...state.data, ...value],
      }
    }
    case 'predictions/receive': {
      if (state.queryId !== action.payload.id) {
        console.warn(
          `Received data for ${action.payload.id} but expected ${state.queryId}`,
          action,
        )
        return state
      }
      return {
        ...state,
        predictionsFetching: false,
      }
    }
    case 'ticker/update': {
      if (action.payload == null) {
        return state
      }
      return {
        ...state,
        quoteLoading: false,
        tickers: {
          ...state.tickers,
          [action.payload.symbol]: action.payload,
        },
      }
    }
    case 'equities/search/request': {
      return {
        ...state,
        quoteSearch: action.payload.search,
        searchLoading: true,
      }
    }
    case 'equities/search/receive': {
      if (state.quoteSearch !== action.payload.search) {
        return { ...state }
      }
      return {
        ...state,
        searchResults: [...action.payload.equities],
        searchLoading: false,
      }
    }

    case 'equities/select': {
      return {
        ...state,
        data: [],
        quoteLoading: true,
        optionsLoading: false,
        searchLoading: false,
        symbol: action.payload.symbol,
        options: DEFAULT_STATE.options,
        // expirationDates: DEFAULT_STATE.expirationDates,
        selectedExpirationDate: null,
      }
    }

    case 'options/request': {
      return { ...state, optionsLoading: true }
    }

    case 'options/receive': {
      const callsByExpirationDate = action.payload.options.calls.reduce<
        OptionsState['options']['callsByExpirationDate']
      >((map, option) => {
        const options = map[option.expiration] ?? {}
        options[option.strike] = option
        map[option.expiration] = options
        return map
      }, {})

      const putsByExpirationDate = action.payload.options.puts.reduce<
        OptionsState['options']['putsByExpirationDate']
      >((map, option) => {
        const options = map[option.expiration] ?? {}
        options[option.strike] = option
        map[option.expiration] = options
        return map
      }, {})

      let strikes = uniq(
        Object.keys(Object.values(callsByExpirationDate)[0]!).concat(
          Object.keys(Object.values(putsByExpirationDate)[0]!),
        ),
      ).map(parseFloat)
      strikes.sort((a, b) => a - b)

      return {
        ...state,
        ...action.payload,
        optionsLoading: false,
        options: {
          ...action.payload.options,
          calls: action.payload.options.calls,
          callsByContractSymbol: action.payload.options.calls.reduce<
            OptionsState['options']['callsByContractSymbol']
          >((map, option) => {
            map[option.contractSymbol] = option
            return map
          }, {}),
          strikes,
          callsByExpirationDate,
          puts: action.payload.options.puts,
          putsByContractSymbol: action.payload.options.puts.reduce<
            OptionsState['options']['putsByContractSymbol']
          >((map, option) => {
            map[option.contractSymbol] = option
            return map
          }, {}),
          putsByExpirationDate,
        },
      }
    }
    case 'options/selectExpiration': {
      return {
        ...state,
        selectedExpirationDate: action.payload.expirationDate,
        optionDrawerOpen: true,
        selectedOption: null,
        data: [],
      }
    }

    case 'options/optionsDrawer': {
      return { ...state, optionDrawerOpen: action.payload }
    }

    case 'options/searchOpen': {
      return { ...state, searchOpen: action.payload }
    }

    case 'options/selectOption': {
      return {
        ...state,
        selectedOption: action.payload,
        overrides: DEFAULT_STATE.overrides,
        overridesInput: DEFAULT_STATE.overridesInput,
      }
    }

    case 'options/updateOptions': {
      const nextContracts =
        'contracts' in action.payload
          ? typeof action.payload.contracts === 'number' &&
            Number.isFinite(action.payload.contracts)
            ? action.payload.contracts
            : null
          : state.contracts

      const nextBuyOrWrite =
        action.payload.buyOrWrite === 'long' ||
        action.payload.buyOrWrite === 'write'
          ? action.payload.buyOrWrite
          : state.buyOrWrite

      return {
        ...state,
        contracts: nextContracts,
        buyOrWrite: nextBuyOrWrite,
        lowerBound:
          'lowerBound' in action.payload
            ? (action.payload.lowerBound ?? null)
            : state.lowerBound,
        upperBound:
          'upperBound' in action.payload
            ? (action.payload.upperBound ?? null)
            : state.upperBound,
        displayMode: action.payload.displayMode ?? state.displayMode,
      }
    }

    case 'options/updateOverrides': {
      const overridesInput = {
        strike:
          action.payload.strike != null
            ? action.payload.strike
            : state.overridesInput.strike,
        iv:
          action.payload.iv != null
            ? action.payload.iv
            : state.overridesInput.iv,
        type:
          action.payload.type != null
            ? action.payload.type
            : state.overridesInput.type,
        price:
          action.payload.price != null
            ? action.payload.price
            : state.overridesInput.price,
      }

      const overrides = {
        strike:
          overridesInput.strike != ''
            ? parseFloat(overridesInput.strike)
            : null,
        iv: overridesInput.iv != '' ? parseFloat(overridesInput.iv) : null,
        price:
          overridesInput.price != '' ? parseFloat(overridesInput.price) : null,
        type: overridesInput.type != '' ? overridesInput.type : null,
      }

      return {
        ...state,
        overridesInput,
        overrides,
      }
    }

    default:
      return state
  }
}

export const fetchPredictions = (channel: Channel) => {
  return (dispatch: AppDispatch, getState: AppGetState) => {
    const id = v4()
    const {
      symbol,
      selectedOption,
      overrides,
      selectedExpirationDate,
      upperBound,
      lowerBound,
    } = getState().options
    if (symbol == null) {
      return
    }
    dispatch({
      type: 'predictions/request',
      payload: {
        id,
      },
    })
    channel.push('predictions', {
      id,
      symbol,
      option: {
        expirationDate: selectedExpirationDate,
        ...selectedOption,
        price: overrides.price ?? selectedOption?.price,
        strike: overrides.strike ?? selectedOption?.strike,
        type: overrides.type ?? selectedOption?.type,
        iv: overrides.iv,
      },
      range: [lowerBound, upperBound],
    })
  }
}

export const fetchOptions = (channel: Channel) => {
  return (dispatch: AppDispatch, getState: AppGetState) => {
    const id = v4()
    dispatch({
      type: 'options/request',
      payload: {
        id,
      },
    })
    const expirationDate = getState().options.selectedExpirationDate
    channel
      .push('options', { id, expirationDate })
      .receive('ok', (response: OptionsResponse) => {
        dispatch({
          type: 'options/receive',
          payload: response,
        })
      })
  }
}

export const searchSymbol = (channel: Channel, search: string) => {
  return (dispatch: AppDispatch, _getState: AppGetState) => {
    const id = v4()
    dispatch({
      type: 'equities/search/request',
      payload: {
        id,
        search,
      },
    })
    channel
      .push('equities_search', { id, search })
      .receive('ok', (response: SymbolSearchResult[]) => {
        dispatch({
          type: 'equities/search/receive',
          payload: {
            id,
            search,
            equities: response,
          },
        })
      })
  }
}
