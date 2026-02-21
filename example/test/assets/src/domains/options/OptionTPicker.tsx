import { useCallback, useMemo } from 'react'

import { TZDate } from '@date-fns/tz'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import Grid from '@mui/material/Grid'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import {
  DataGrid,
  GridCellParams,
  GridColDef,
  GridColumnGroupingModel,
} from '@mui/x-data-grid'
import { differenceInBusinessDays, format } from 'date-fns'

import { Button } from '@/components/buttons'
import { Timestamp } from '@/domains/options/redux'
import { OptionContract } from '@/domains/options/types/options'
import { useDispatch, useSelector } from '@/redux'

interface Row {
  id: string | number
  call?: OptionContract | null
  put?: OptionContract | null
  strike: number
}

export default function OptionTPicker() {
  const calls = useSelector(
    (state) => state.options.options.callsByExpirationDate,
  )
  const puts = useSelector(
    (state) => state.options.options.putsByExpirationDate,
  )
  const expirationDates = useSelector((state) => state.options.expirationDates)
  const selectedExpirationDate = useSelector(
    (state) => state.options.selectedExpirationDate,
  )
  const strikes = useSelector((state) => state.options.options.strikes)

  const dispatch = useDispatch()

  const rows: Row[] = useMemo(() => {
    if (selectedExpirationDate == null) {
      return []
    }

    return strikes.map((strike) => {
      const call = calls[selectedExpirationDate]?.[strike]
      const put = puts[selectedExpirationDate]?.[strike]
      return {
        id: strike,
        strike,
        call,
        put,
        callBid: call?.bid,
        callMid:
          call?.bid != null && call.ask != null
            ? call.bid + (call.ask - call.bid) / 2
            : null,
        callAsk: call?.ask,
        putBid: put?.bid,
        putAsk: put?.ask,
        putMid:
          put?.bid != null && put.ask != null
            ? put.bid + (put.ask - put.bid) / 2
            : null,
      }
    })
  }, [expirationDates, calls, puts])

  const columns: GridColDef[] = useMemo(() => {
    const renderCell = (params: GridCellParams<Row, number | null>) => {
      const props =
        params.field === 'strike' ? { backgroundColor: '#e9e9e9' } : {}

      const onClick = useCallback(() => {
        const type = params.field.startsWith('call') ? 'call' : 'put'
        const option = type === 'call' ? params.row.call : params.row.put

        if (option == null) {
          return
        }

        dispatch({
          type: 'options/selectOption',
          payload: {
            ...option,
            strike: params.row.strike,
            price: params.value ?? 0,
            type,
            buyOrWrite: 'long',
          },
        })
      }, [
        params.field,
        params.row.call,
        params.row.put,
        params.row.strike,
        params.value,
      ])
      return (
        <Box {...props}>
          {params.field !== 'strike' ? (
            <Button
              onClick={onClick}
              sx={{ textDecoration: 'underline !important' }}
            >
              {params.value?.toFixed(2) ?? null}
            </Button>
          ) : (
            (params.value?.toFixed(2) ?? null)
          )}
        </Box>
      )
    }

    return [
      {
        field: 'callBid',
        headerName: 'Bid',
        width: 60,
        maxWidth: 60,
        minWidth: 60,
        renderCell,
      },
      {
        field: 'callMid',
        headerName: 'Mid',
        width: 60,
        maxWidth: 60,
        minWidth: 60,
        renderCell,
      },
      {
        field: 'callAsk',
        headerName: 'Ask',
        width: 60,
        maxWidth: 60,
        minWidth: 60,
        renderCell,
      },
      {
        field: 'strike',
        headerName: 'Strike',
        width: 60,
        maxWidth: 60,
        minWidth: 60,
        renderCell,
      },
      {
        field: 'putBid',
        headerName: 'Bid',
        width: 60,
        maxWidth: 60,
        minWidth: 60,
        renderCell,
      },
      {
        field: 'putMid',
        headerName: 'Mid',
        width: 60,
        maxWidth: 60,
        minWidth: 60,
        renderCell,
      },
      {
        field: 'putAsk',
        headerName: 'Ask',
        width: 60,
        maxWidth: 60,
        minWidth: 60,
        renderCell,
      },
    ]
  }, [dispatch])

  const columnGroupingModel: GridColumnGroupingModel = [
    {
      groupId: 'call',
      headerName: 'Call',
      children: [
        { field: 'callBid' },
        { field: 'callMid' },
        { field: 'callAsk' },
      ],
    },
    {
      groupId: 'put',
      headerName: 'Put',
      children: [{ field: 'putBid' }, { field: 'putMid' }, { field: 'putAsk' }],
    },
  ]

  return (
    <Grid container maxHeight='80vh' justifyContent='center'>
      <Grid></Grid>
      <Grid pt={4}>
        <Box display='flex' justifyContent='center'>
          <Box width={300} pb={2}>
            <FormControl fullWidth size='small'>
              <InputLabel sx={{ fontSize: '0.75em' }}>
                <Box typography='body2'>Expiration</Box>
              </InputLabel>
              <Select
                fullWidth
                multiple={false}
                value={selectedExpirationDate ?? ''}
                onChange={(val) => {
                  dispatch({
                    type: 'options/selectExpiration',
                    payload: {
                      expirationDate: val.target.value,
                    },
                  })
                }}
                disabled={
                  expirationDates == null || expirationDates?.length === 0
                }
                renderValue={useCallback(
                  (ts: Timestamp) => (
                    <Box height={24} pt='4px' typography='body2'>
                      {format(new TZDate(ts * 1000, 'UTC'), 'do MMM yyyy')}
                    </Box>
                  ),
                  [expirationDates],
                )}
                size='small'
                label='Expiration'
              >
                {useMemo(
                  () =>
                    expirationDates?.map((date) => (
                      <MenuItem key={date} value={date}>
                        <Box
                          height={24}
                          width='100%'
                          pt='4px'
                          typography='body2'
                          display='flex'
                          alignItems='center'
                        >
                          <Box flex='1 1'>
                            {format(
                              new TZDate(date * 1000, 'UTC'),
                              'do MMM yyyy',
                            )}
                          </Box>
                          <Box typography='caption' color='text.accent'>
                            {Math.max(
                              differenceInBusinessDays(
                                new Date(date * 1000),
                                new Date(),
                              ),
                              0,
                            )}{' '}
                            days
                          </Box>
                        </Box>
                      </MenuItem>
                    )) ?? [],
                  [expirationDates],
                )}
              </Select>
            </FormControl>
          </Box>
        </Box>

        <DataGrid
          rows={rows}
          columns={columns}
          density='compact'
          sortingMode='server'
          checkboxSelection={false}
          disableColumnSorting
          disableColumnFilter
          autosizeOnMount
          disableColumnMenu
          disableColumnSelector
          disableDensitySelector
          disableRowSelectionOnClick
          disableColumnResize
          disableMultipleRowSelection
          hideFooterPagination
          loading={false}
          rowSelection={true}
          sx={{
            flex: '5 1',
            maxWidth: 60 * 7 + 2,
            '& .MuiDataGrid-cell': {
              padding: 0,
              textAlign: 'center',
              whiteSpace: 'break-spaces',
              wordWrap: 'break-word',
              width: 60,
            },
            '& .MuiDataGrid-cellEmpty': {
              flex: '0 1 auto',
              padding: 0,
              border: 'none',
              width: 60,
              maxWidth: 60,
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
      </Grid>
      <Grid></Grid>

      <Grid py={2} size={{ mobile: 12, laptop: 'auto' }}>
        <Button
          fullWidth
          component='div'
          sx={{ m: 1 }}
          variant='contained'
          onClick={() => {
            dispatch({ type: 'options/optionsDrawer', payload: false })
          }}
        >
          Close
        </Button>
      </Grid>
    </Grid>
  )
}
