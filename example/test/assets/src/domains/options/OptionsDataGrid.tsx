import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  DataGrid,
  GridColDef,
  GridColumnGroupingModel,
  GridRenderCellParams,
  GridRowsProp,
} from '@mui/x-data-grid'
import { format, parse } from 'date-fns'
import debounce from 'lodash/debounce'

import { UserSocketContext } from '@/domains/app/socket'
import {
  formatCompactNumber,
  getContrastingTextColor,
  getGradientColor,
  RgbColor,
} from '@/domains/options/helpers'
import {
  DisplayMode,
  fetchPredictions,
  PredictionData,
} from '@/domains/options/redux'
import { useDispatch, useSelector } from '@/redux'

const COLUMN_WIDTH = 45
const MAX_VALUE_COLOR: RgbColor = { r: 21, g: 242, b: 139 }
const MIN_VALUE_COLOR: RgbColor = { r: 106, g: 61, b: 111 }

type ValueRange = { min: number; max: number }
type OptionRow = {
  id: number
  underlying_price: number
} & Record<string, number>

const buildColumnGroupingModel = (
  dateStrings: string[],
): GridColumnGroupingModel => {
  const groups: GridColumnGroupingModel = []
  let currentYearGroupId: string | null = null
  let currentMonthGroupId: string | null = null
  let currentYearGroup: GridColumnGroupingModel[number] | null = null
  let currentMonthGroup: GridColumnGroupingModel[number] | null = null

  dateStrings.forEach((dateString) => {
    const date = parse(dateString, 'yyyy-MM-dd', new Date())
    const yearLabel = format(date, 'yyyy')
    const monthLabel = format(date, 'MMM')
    const monthNumber = format(date, 'MM')
    const yearGroupId = `year-${yearLabel}`
    const monthGroupId = `month-${yearLabel}-${monthNumber}`

    if (currentYearGroupId !== yearGroupId) {
      currentYearGroupId = yearGroupId
      currentYearGroup = {
        groupId: yearGroupId,
        headerName: yearLabel,
        children: [],
      }
      groups.push(currentYearGroup)
      currentMonthGroup = null
      currentMonthGroupId = null
    }

    if (currentMonthGroupId !== monthGroupId) {
      currentMonthGroupId = monthGroupId
      currentMonthGroup = {
        groupId: monthGroupId,
        headerName: monthLabel,
        children: [],
      }
      if (currentYearGroup) {
        currentYearGroup.children.push(currentMonthGroup)
      }
    }

    if (currentMonthGroup) {
      currentMonthGroup.children.push({ field: dateString })
    }
  })

  return groups
}

export default function OptionsDataGrid() {
  const dispatch = useDispatch()
  const overrides = useSelector((state) => state.options.overrides)
  const { userChannel } = use(UserSocketContext)
  const symbol = useSelector((state) => state.options.symbol)
  const [optionRows, setOptionRows] = useState<GridRowsProp<OptionRow>>([])
  const tickers = useSelector((state) => state.options.tickers)
  const [columns, setColumns] = useState<GridColDef[]>([])
  const ticker = symbol ? tickers[symbol] : null
  const price = overrides.price ?? ticker?.regularMarketPrice.raw ?? null
  const [selectedRows, setSelectedRows] = useState(new Set())
  const optionsData = useSelector((state) => state.options.data)
  const selectedOption = useSelector((state) => state.options.selectedOption)
  const selectedExpirationDate = useSelector(
    (state) => state.options.selectedExpirationDate,
  )
  const optionsLoading = useSelector((state) => state.options.optionsLoading)
  const predictionsFetching = useSelector(
    (state) => state.options.predictionsFetching,
  )
  const contracts = useSelector((state) => state.options.contracts ?? 1)
  const lowerBound = useSelector((state) => state.options.lowerBound)
  const upperBound = useSelector((state) => state.options.upperBound)
  const displayMode = useSelector((state) => state.options.displayMode)

  const debouncedFetchPredictions = useMemo(
    () =>
      debounce(
        () => {
          if (!userChannel) {
            return
          }
          return dispatch(fetchPredictions(userChannel))
        },
        1000,
        { trailing: true },
      ),
    [dispatch, fetchPredictions, userChannel],
  )

  const updatePredictions = useCallback(() => {
    optionsByUnderlying.current = {}

    optionsData.forEach((option) => {
      const underlyingKey = String(option.underlying_price)
      const existing = optionsByUnderlying.current[underlyingKey] ?? {}
      optionsByUnderlying.current[underlyingKey] = {
        ...existing,
        [option.date]: option,
      }
    })
    let minValue = Infinity
    let maxValue = -Infinity

    const rows: Array<[OptionRow, string[]]> = Object.entries(
      optionsByUnderlying.current,
    )
      .flatMap(([_k, map], index) => {
        const sorted = Object.keys(map)
          .map((dateString) => {
            return [
              dateString,
              parse(dateString, 'yyyy-MM-dd', new Date()).getTime(),
            ] as [string, number]
          })
          .sort((a, b) => {
            return a[1] - b[1]
          })
          .map((tuple) => tuple[0])
        const firstDate = sorted[0]
        if (firstDate == null) {
          return []
        }
        const output: OptionRow = {
          id: index,
          underlying_price: map[firstDate].underlying_price,
        }
        sorted.forEach((dateString) => {
          const option = map[dateString]
          const value = Math.round(option.price - option.cost)
          output[dateString] = value
          if (Number.isFinite(value)) {
            minValue = Math.min(minValue, value)
            maxValue = Math.max(maxValue, value)
          }
        })
        const row: [OptionRow, string[]] = [output, sorted]
        return [row]
      })
      .reverse()

    const valueRange: ValueRange | null =
      Number.isFinite(minValue) && Number.isFinite(maxValue)
        ? { min: minValue, max: maxValue }
        : null

    const firstRow = rows[0]
    if (firstRow == null) {
      setOptionRows([])
      setColumnGroupingModel([])
      setColumns([])
      return
    }
    const first = rows.reduce((best, current) => {
      return current[1].length > best[1].length ? current : best
    }, firstRow)
    const fixedWidth = {
      width: COLUMN_WIDTH,
      minWidth: COLUMN_WIDTH,
      maxWidth: COLUMN_WIDTH,
    }
    const nextColumns: GridColDef[] = [
      {
        field: 'underlying_price',
        headerName: symbol ? `${symbol}` : '',
        renderCell: (params) => {
          return `$${params.value?.toFixed(2)}`
        },
        width: COLUMN_WIDTH * 2,
      },
    ]
    const renderGradientCell = (params: GridRenderCellParams) => {
      const value =
        typeof params.value === 'number' ? params.value : Number(params.value)
      const backgroundColor = valueRange
        ? getGradientColor(
            value,
            valueRange.min,
            valueRange.max,
            MAX_VALUE_COLOR,
            MIN_VALUE_COLOR,
          )
        : 'transparent'

      const textColor = getContrastingTextColor(backgroundColor)

      let val = value * contracts
      const optionPrice = overrides.price ?? selectedOption?.price ?? 0
      if (displayMode === DisplayMode.PERCENT_ENTRY) {
        if (optionPrice != null && optionPrice > 0) {
          val = val / optionPrice / contracts
        }
      }
      const displayValue = Number.isFinite(value)
        ? formatCompactNumber(val, 4)
        : params.value

      const selected = selectedRows.has(params.row.id)
      const formatted = `${displayValue}${displayMode === DisplayMode.PERCENT_ENTRY ? '%' : ''}`

      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.3s',
            opacity: !selected && selectedRows.size > 0 ? 0.3 : 1,
            backgroundColor,
            color: textColor,
            fontWeight: selected ? 700 : 500,
          }}
        >
          {formatted}
        </div>
      )
    }

    first[1].forEach((dateString) => {
      const dayLabel = format(parse(dateString, 'yyyy-MM-dd', new Date()), 'd')
      nextColumns.push({
        field: dateString,
        headerName: dayLabel,
        ...fixedWidth,
        renderCell: renderGradientCell,
      })
    })
    setColumns(nextColumns)
    setColumnGroupingModel(buildColumnGroupingModel(first[1]))

    const nextRows = rows.map(([row]) => row)
    setOptionRows(nextRows)
  }, [price, selectedRows, optionsData, contracts, overrides, displayMode])

  const throttledUpdatePredictions = useMemo(() => {
    return debounce(updatePredictions, 50, { maxWait: 100, trailing: true })
  }, [updatePredictions])

  const [columnGroupingModel, setColumnGroupingModel] =
    useState<GridColumnGroupingModel>([])

  const optionsByUnderlying = useRef<
    Record<string, Record<string, PredictionData>>
  >({})

  useEffect(() => {
    throttledUpdatePredictions()
  }, [optionsData, contracts, displayMode])

  useEffect(() => {
    updatePredictions()
  }, [selectedRows])

  useEffect(() => {
    if (
      userChannel == null ||
      symbol == null ||
      selectedOption == null ||
      selectedExpirationDate == null
    ) {
      return
    }
    setSelectedRows(new Set())
    dispatch(fetchPredictions(userChannel))
  }, [userChannel, symbol, selectedExpirationDate, selectedOption])

  useEffect(() => {
    if (
      userChannel == null ||
      symbol == null ||
      selectedOption == null ||
      selectedExpirationDate == null
    ) {
      return
    }
    debouncedFetchPredictions()
  }, [overrides, lowerBound, upperBound])

  return (
    <>
      {optionRows?.length > 0 && (
        <DataGrid
          rows={optionRows}
          columns={columns}
          onRowSelectionModelChange={(model, _details) => {
            setSelectedRows(new Set(model.ids.values()))
          }}
          sortingMode='server'
          density='compact'
          checkboxSelection={false}
          disableColumnSorting
          disableColumnFilter
          autosizeOnMount
          disableColumnMenu
          disableColumnSelector
          disableDensitySelector
          disableColumnResize
          disableMultipleRowSelection
          hideFooterPagination
          loading={predictionsFetching || optionsLoading}
          rowSelection={true}
          sx={{
            maxWidth:
              Math.max(Object.keys(optionRows?.[0] ?? {})?.length - 2, 0) *
                COLUMN_WIDTH +
              COLUMN_WIDTH * 2 +
              10,
            '& .MuiDataGrid-cell': {
              padding: 0,
              textAlign: 'center',
              whiteSpace: 'break-spaces',
              wordWrap: 'break-word',
            },
            '& .MuiDataGrid-cellEmpty': {
              flex: '1 1 auto',
              width: 0,
              padding: 0,
              border: 'none',
            },

            // header cells (optional, to match)
            '& .MuiDataGrid-columnHeader': {
              padding: 0,
              textAlign: 'center',
            },
            '& .MuiDataGrid-columnHeader--filledGroup': {
              backgroundColor: '#ffffff',
            },
            '& .MuiDataGrid-columnHeader--filledGroup:nth-of-type(even)': {
              backgroundColor: '#f2f2f2',
            },
            '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
              outline: 'none',
              outlineOffset: 0,
            },
            '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within':
              {
                outline: 'none',
                outlineOffset: 0,
              },
            // Keep column separators visible (MUI defaults to fading them)
            '& .MuiDataGrid-columnSeparator': {
              opacity: '1 !important',
              visibility: 'visible !important',
            },

            // Some themes/state rules target these variants
            '& .MuiDataGrid-columnSeparator--sideLeft, & .MuiDataGrid-columnSeparator--sideRight':
              {
                opacity: '1 !important',
                visibility: 'visible !important',
              },

            // Optional: prevent any hover-driven changes
            '& .MuiDataGrid-columnSeparator:hover': {
              opacity: '1 !important',
            },

            '& .MuiDataGrid-columnHeaderTitleContainer': {
              justifyContent: 'center',
            },
            '& .MuiDataGrid-virtualScroller': {
              // overflow: 'hidden',
            },
          }}
          columnGroupingModel={columnGroupingModel}
        />
      )}
    </>
  )
}
