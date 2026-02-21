import React, { use, useCallback, useEffect, useMemo, useState } from 'react'

import { TZDate } from '@date-fns/tz'
import ExpandMore from '@mui/icons-material/ExpandMore'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Drawer from '@mui/material/Drawer'
import FormControl from '@mui/material/FormControl'
import Grid from '@mui/material/Grid'
import InputLabel from '@mui/material/InputLabel'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import { alpha } from '@mui/material/styles'
import TextField from '@mui/material/TextField'
import { differenceInBusinessDays, format } from 'date-fns'
import capitalize from 'lodash/capitalize'
import { Channel } from 'phoenix'
import { v4 } from 'uuid'

import { Button } from '@/components/buttons'
import { UserSocketContext } from '@/domains/app/socket'
import OptionsDataGrid from '@/domains/options/OptionsDataGrid'
import OptionTPicker from '@/domains/options/OptionTPicker'
import {
  DisplayMode,
  fetchOptions,
  searchSymbol,
  SymbolSearchResult,
  Timestamp,
} from '@/domains/options/redux'
import { useDispatch, useSelector } from '@/redux'

function Ticker({ symbol }: { symbol: string }) {
  const tickers = useSelector((state) => state.options.tickers)
  const ticker = symbol !== '' ? tickers[symbol] : null

  if (!ticker) {
    return null
  }

  return (
    <Box typography='overline'>
      ${ticker.postMarketPrice?.raw ?? ticker.regularMarketPrice?.raw ?? null}
    </Box>
  )
}

export const OptionsPage = () => {
  const dispatch = useDispatch()
  const { userChannel, socket } = use(UserSocketContext)
  const symbol = useSelector((state) => state.options.symbol)
  const tickers = useSelector((state) => state.options.tickers)
  const ticker = symbol ? tickers[symbol] : null
  const search = useSelector((state) => state.options.quoteSearch)
  const selectedExpirationDate = useSelector(
    (state) => state.options.selectedExpirationDate,
  )

  const [tickerChannel, setTickerChannel] = useState<Channel | null>(null)
  const expirationDates =
    useSelector((state) => state.options.expirationDates) ?? []

  const searchResults = useSelector((state) => state.options.searchResults)
  const searchLoading = useSelector((state) => state.options.searchLoading)
  const optionsLoading = useSelector((state) => state.options.optionsLoading)
  const quoteLoading = useSelector((state) => state.options.quoteLoading)
  const selectedOption = useSelector((state) => state.options.selectedOption)
  const predictionsFetching = useSelector(
    (state) => state.options.predictionsFetching,
  )
  const searchOpen = useSelector((state) => state.options.searchOpen)
  const optionDrawerOpen = useSelector(
    (state) => state.options.optionDrawerOpen,
  )
  const contracts = useSelector((state) => state.options.contracts)
  const buyOrWrite = useSelector((state) => state.options.buyOrWrite)
  const lowerBound = useSelector((state) => state.options.lowerBound)
  const upperBound = useSelector((state) => state.options.upperBound)
  const overrides = useSelector((state) => state.options.overrides)
  const overridesInput = useSelector((state) => state.options.overridesInput)
  const displayMode = useSelector((state) => state.options.displayMode)
  const type = overrides.type ?? selectedOption?.type
  const strike = overrides.strike ?? selectedOption?.strike
  const price = overrides.price ?? selectedOption?.price

  useEffect(() => {
    if (socket == null) {
      return
    }
    if (tickerChannel != null) {
      tickerChannel.leave()
    }
    if (!symbol) {
      return
    }
    const channel = socket.channel(`ticker:${symbol}`)
    channel.on('action', (action) => {
      dispatch(action)
    })
    channel.join().receive('ok', () => {
      setTickerChannel(channel)
      dispatch(fetchOptions(channel))
    })
  }, [socket, symbol])

  useEffect(() => {
    if (!userChannel) {
      return
    }
    dispatch(searchSymbol(userChannel, search))
  }, [userChannel, search])

  useEffect(() => {
    if (!tickerChannel || selectedExpirationDate == null || symbol == null) {
      return
    }
    dispatch(fetchOptions(tickerChannel))
  }, [tickerChannel, symbol, selectedExpirationDate])

  const handleSearch = useCallback(
    (_event: React.SyntheticEvent, value: string) => {
      if (!userChannel) {
        return
      }
      dispatch({ type: 'options/searchOpen', payload: true })
      dispatch({
        type: 'equities/search/request',
        payload: {
          id: v4(),
          search: value,
        },
      })
    },
    [userChannel],
  )

  return (
    <Box>
      <Box
        width='100%'
        sx={{
          opacity:
            searchLoading ||
            optionsLoading ||
            quoteLoading ||
            predictionsFetching
              ? 1
              : 0,
        }}
      >
        <LinearProgress />
      </Box>
      <Container maxWidth='desktop'>
        <Grid
          container
          gap={8}
          rowGap={0}
          sx={{ pt: 4 }}
          justifyContent='center'
        >
          <Grid>
            <Box>
              <Box typography='h6' display='flex' alignItems='center'>
                <Box>
                  <Box display='flex' flex='1 0'>
                    <Box width={300}>
                      <Autocomplete
                        open={searchOpen}
                        slotProps={{
                          paper: {
                            sx: {
                              '& .MuiAutocomplete-option[aria-selected="true"]':
                                {
                                  backgroundColor: (theme) => {
                                    return `${alpha(theme.palette.text.accent, 0.22)} !important`
                                  },
                                },
                              '& .MuiAutocomplete-option[aria-selected="true"].Mui-focused, & .MuiAutocomplete-option[aria-selected="true"]:hover, & .MuiAutocomplete-option[aria-selected="true"].Mui-focusVisible':
                                {
                                  backgroundColor: (theme) => {
                                    return `${alpha(theme.palette.text.accent, 0.28)} !important`
                                  },
                                },
                            },
                          },
                        }}
                        getOptionLabel={(x) => x.id.toString()}
                        filterOptions={(x) => x}
                        openOnFocus
                        multiple={false}
                        onFocus={() => {
                          dispatch({
                            type: 'options/searchOpen',
                            payload: true,
                          })
                        }}
                        onBlur={() => {
                          dispatch({
                            type: 'options/searchOpen',
                            payload: false,
                          })
                        }}
                        onChange={(_event, value) => {
                          if (value?.symbol != null) {
                            dispatch({
                              type: 'options/searchOpen',
                              payload: false,
                            })
                          } else {
                            dispatch({
                              type: 'options/searchOpen',
                              payload: true,
                            })
                          }
                          dispatch({
                            type: 'equities/select',
                            payload: {
                              symbol: value?.symbol ?? null,
                            },
                          })
                        }}
                        renderOption={useCallback(
                          (
                            props: React.HTMLAttributes<HTMLLIElement> & {
                              key: string
                            },
                            option: SymbolSearchResult,
                          ) => (
                            <Box component='li' {...props} key={option.id}>
                              <Box typography='body2' fontWeight='bolder'>
                                {option.symbol}
                              </Box>
                              <Box pl={2} typography='caption'>
                                {option.name}
                              </Box>
                            </Box>
                          ),
                          [],
                        )}
                        renderValue={useCallback(
                          (_value: SymbolSearchResult) => (
                            <Box
                              display='flex'
                              onClick={() =>
                                dispatch({
                                  type: 'options/searchOpen',
                                  payload: true,
                                })
                              }
                              height={24}
                            >
                              <Box
                                display='flex'
                                alignItems='center'
                                whiteSpace='nowrap'
                                gap={1}
                                pl='8.5px'
                              >
                                <Box
                                  typography='body2'
                                  fontWeight='bolder'
                                  justifyContent='right'
                                >
                                  {symbol}
                                </Box>
                                {quoteLoading && (
                                  <CircularProgress
                                    color='primary'
                                    size='small'
                                    sx={{ width: 18, height: 18 }}
                                  />
                                )}
                                {!quoteLoading && ticker?.symbol != null && (
                                  <Box>
                                    <Ticker symbol={ticker?.symbol} />
                                  </Box>
                                )}
                              </Box>
                            </Box>
                          ),
                          [ticker, symbol, quoteLoading],
                        )}
                        options={searchResults}
                        size='small'
                        onInputChange={handleSearch}
                        renderInput={(params) => (
                          <TextField
                            slotProps={{
                              inputLabel: { size: 'small' },
                            }}
                            onClick={() =>
                              dispatch({
                                type: 'options/searchOpen',
                                payload: true,
                              })
                            }
                            {...params}
                            placeholder={
                              symbol == null ? 'Try typing "GME"' : ''
                            }
                            size='small'
                            label={
                              <Box typography='body2'>
                                {!quoteLoading
                                  ? (ticker?.longName ??
                                    ticker?.shortName ??
                                    symbol ??
                                    'Choose Symbol')
                                  : 'Loading'}
                              </Box>
                            }
                            fullWidth
                          />
                        )}
                      />
                    </Box>
                  </Box>
                  <Box pt={2}>
                    <Box width={300}>
                      <FormControl fullWidth size='small'>
                        <InputLabel size='small'>
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
                            expirationDates == null ||
                            expirationDates?.length === 0
                          }
                          renderValue={useCallback(
                            (ts: Timestamp) => (
                              <Box height={24} pt='4px' typography='body2'>
                                {format(
                                  new TZDate(ts * 1000, 'UTC'),
                                  'do MMM yyyy',
                                )}
                              </Box>
                            ),
                            [expirationDates],
                          )}
                          size='small'
                          label='Expiration'
                        >
                          {useMemo(
                            () =>
                              expirationDates.map((date) => (
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
                                    <Box
                                      typography='caption'
                                      color='text.accent'
                                    >
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
                              )),
                            [expirationDates],
                          )}
                        </Select>
                      </FormControl>
                    </Box>
                  </Box>
                  <Box pt={2}>
                    <Box width={300}>
                      <Button
                        disabled={
                          selectedOption == null ||
                          selectedExpirationDate == null
                        }
                        fullWidth
                        onClick={() => {
                          dispatch({
                            type: 'options/optionsDrawer',
                            payload: true,
                          })
                        }}
                      >
                        {!selectedOption
                          ? 'Select Option'
                          : 'Change Option Strike'}
                      </Button>
                    </Box>
                  </Box>
                  {strike != null &&
                    price != null &&
                    selectedExpirationDate != null && (
                      <Box typography='body2' pt={2}>
                        <Accordion sx={{ width: 300 }}>
                          <AccordionSummary expandIcon={<ExpandMore />}>
                            <Box
                              display='flex'
                              justifyContent='center'
                              alignItems='center'
                            >
                              <Box typography='body2'>
                                <Box component='span' fontWeight='700'>
                                  {symbol}
                                </Box>{' '}
                                ${strike.toFixed(2)}{' '}
                                <Chip
                                  label={capitalize(type)}
                                  size='small'
                                  sx={{ mx: 1 }}
                                  color={
                                    type === 'call' ? 'secondary' : 'primary'
                                  }
                                />
                                <Box
                                  component='span'
                                  typography='caption'
                                  color='primary.main'
                                >
                                  {format(
                                    selectedExpirationDate * 1000,
                                    'MMM do yyyy',
                                  )}
                                </Box>
                                <Box
                                  pl={1}
                                  component='span'
                                  typography='caption'
                                >
                                  ($
                                  {((contracts ?? 1) * price * 100).toFixed(2)})
                                </Box>
                              </Box>
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Box>
                              <Box typography='overline'>Details</Box>
                              <Box>
                                <Box component='span' fontWeight={700}>
                                  Strike:{' '}
                                </Box>
                                ${strike.toFixed(2)}
                              </Box>
                              <Box>
                                <Box component='span' fontWeight={700}>
                                  Type:{' '}
                                </Box>
                                <Chip
                                  label={capitalize(type)}
                                  size='small'
                                  sx={{ mx: 1 }}
                                  color={
                                    type === 'call' ? 'secondary' : 'primary'
                                  }
                                />
                              </Box>
                              <Box>
                                <Box component='span' fontWeight={700}>
                                  Buy or write:{' '}
                                </Box>
                                {buyOrWrite === 'long' ? 'Buy' : 'Write'}
                              </Box>
                              <Box>
                                <Box component='span' fontWeight={700}>
                                  Underlying Price: $
                                </Box>
                                {ticker?.postMarketPrice?.raw?.toFixed(2) ??
                                  ticker?.regularMarketPrice?.raw?.toFixed(2)}
                              </Box>
                              <Box>
                                <Box component='span' fontWeight={700}>
                                  Expiration:{' '}
                                </Box>
                                {format(
                                  new TZDate(
                                    selectedExpirationDate * 1000,
                                    'UTC',
                                  ),
                                  `MMM do yyyy`,
                                )}
                              </Box>
                              <Box>
                                <Box component='span' fontWeight={700}>
                                  Contracts:
                                </Box>{' '}
                                {contracts}
                              </Box>
                              <Box>
                                <Box component='span' fontWeight={700}>
                                  Entry Cost:{' '}
                                </Box>
                                $
                                {(1 * (contracts ?? 1) * price * 100).toFixed(
                                  2,
                                )}
                              </Box>
                            </Box>
                          </AccordionDetails>
                        </Accordion>
                      </Box>
                    )}
                </Box>
              </Box>
            </Box>
          </Grid>
          <Grid size={12} display={{ desktop: 'none' }} pt={2}></Grid>
          <Grid>
            <Box width={300}>
              <Box pb={2} width='100%'>
                <TextField
                  size='small'
                  fullWidth
                  slotProps={{
                    inputLabel: {
                      size: 'small',
                      shrink: true,
                    },
                  }}
                  label={
                    <Box pt='2px' typography='body2'>
                      Contracts
                    </Box>
                  }
                  value={contracts ?? ''}
                  onChange={(event) => {
                    dispatch({
                      type: 'options/updateOptions',
                      payload: {
                        contracts:
                          event.target.value !== ''
                            ? parseInt(event.target.value)
                            : undefined,
                      },
                    })
                  }}
                />
              </Box>
              <Box pb={1} width={300}>
                <FormControl fullWidth size='small'>
                  <InputLabel size='small'>
                    <Box typography='body2' pt='2px'>
                      Buy or write
                    </Box>
                  </InputLabel>
                  <Select
                    fullWidth
                    size='small'
                    label={<Box typography='body2'>Buy or write</Box>}
                    value={buyOrWrite}
                    onChange={(event) => {
                      dispatch({
                        type: 'options/updateOptions',
                        payload: {
                          buyOrWrite: event.target.value,
                        },
                      })
                    }}
                  >
                    <MenuItem value='long'>Buy</MenuItem>
                    <MenuItem value='write'>Write</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box py={1} width={300}>
                <FormControl fullWidth size='small'>
                  <InputLabel size='small'>
                    <Box typography='body2' pt='2px'>
                      Mode
                    </Box>
                  </InputLabel>
                  <Select
                    fullWidth
                    size='small'
                    label={<Box typography='body2'>Mode</Box>}
                    value={displayMode}
                    onChange={(event) => {
                      dispatch({
                        type: 'options/updateOptions',
                        payload: {
                          displayMode: event.target.value,
                        },
                      })
                    }}
                  >
                    <MenuItem value={DisplayMode.PERCENT_ENTRY}>
                      % Entry
                    </MenuItem>
                    <MenuItem value={DisplayMode.PROFIT_LOSS}>
                      Profit/Loss
                    </MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box>
                <Accordion sx={{ width: '100%' }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box typography='caption' color='text.secondary'>
                      Overrides
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box pb={2}>
                      <FormControl fullWidth size='small'>
                        <InputLabel size='small'>
                          <Box typography='body2' pt='2px'>
                            Type
                          </Box>
                        </InputLabel>
                        <Select
                          fullWidth
                          size='small'
                          label={<Box typography='body2'>Type</Box>}
                          value={overridesInput.type}
                          onChange={(event) => {
                            dispatch({
                              type: 'options/updateOverrides',
                              payload: {
                                type: event.target.value,
                              },
                            })
                          }}
                          renderValue={(v) => {
                            return (
                              <Chip
                                label={capitalize(v)}
                                size='small'
                                color={v === 'call' ? 'secondary' : 'primary'}
                              />
                            )
                          }}
                        >
                          <MenuItem value='call'>
                            <Chip label='Call' size='small' color='secondary' />
                          </MenuItem>
                          <MenuItem value='put'>
                            <Chip label='Put' size='small' color='primary' />
                          </MenuItem>
                        </Select>
                      </FormControl>
                      <Box pt={2}>
                        <TextField
                          size='small'
                          fullWidth
                          slotProps={{
                            inputLabel: {
                              size: 'small',
                              shrink: true,
                            },
                          }}
                          label={
                            <Box pt='2px' typography='body2'>
                              IV
                            </Box>
                          }
                          value={overridesInput.iv}
                          placeholder={
                            selectedOption?.impliedVolatility?.toString() ?? ''
                          }
                          onChange={(event) => {
                            dispatch({
                              type: 'options/updateOverrides',
                              payload: {
                                iv: event.target.value,
                              },
                            })
                          }}
                        />
                      </Box>
                      <Box pt={2}>
                        <TextField
                          size='small'
                          fullWidth
                          slotProps={{
                            inputLabel: {
                              size: 'small',
                              shrink: true,
                            },
                          }}
                          label={
                            <Box pt='2px' typography='body2'>
                              Strike
                            </Box>
                          }
                          placeholder={selectedOption?.strike?.toFixed(2) ?? ''}
                          value={overridesInput.strike}
                          onChange={(event) => {
                            dispatch({
                              type: 'options/updateOverrides',
                              payload: {
                                strike: event.target.value,
                              },
                            })
                          }}
                        />
                      </Box>
                      <Box pt={2}>
                        <TextField
                          size='small'
                          fullWidth
                          slotProps={{
                            inputLabel: {
                              size: 'small',
                              shrink: true,
                            },
                          }}
                          label={
                            <Box pt='2px' typography='body2'>
                              Price per option
                            </Box>
                          }
                          placeholder={selectedOption?.price?.toFixed(2) ?? ''}
                          value={overridesInput.price}
                          onChange={(event) => {
                            dispatch({
                              type: 'options/updateOverrides',
                              payload: {
                                price: event.target.value,
                              },
                            })
                          }}
                        />
                      </Box>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              </Box>
            </Box>
          </Grid>
          <Grid size={12} justifyContent='center' display='flex'>
            <Box pt={2} pb={1} width={300}>
              <Box py={1} typography='caption' textAlign='center'>
                Graph bounds (Underlying Price)
              </Box>
              <Grid container justifyContent='space-evenly'>
                <Grid size={5}>
                  <TextField
                    size='small'
                    fullWidth
                    slotProps={{
                      inputLabel: {
                        size: 'small',
                        shrink: true,
                      },
                    }}
                    label={
                      <Box pt='2px' typography='body2'>
                        Minimum
                      </Box>
                    }
                    placeholder='Auto'
                    value={lowerBound ?? ''}
                    onChange={(event) => {
                      dispatch({
                        type: 'options/updateOptions',
                        payload: {
                          lowerBound:
                            event.target.value !== ''
                              ? parseInt(event.target.value)
                              : null,
                        },
                      })
                    }}
                  />
                </Grid>
                <Grid size={1}></Grid>
                <Grid size={5}>
                  <TextField
                    size='small'
                    fullWidth
                    slotProps={{
                      inputLabel: {
                        size: 'small',
                        shrink: true,
                      },
                    }}
                    label={
                      <Box pt='2px' typography='body2'>
                        Maximum
                      </Box>
                    }
                    placeholder='Auto'
                    value={upperBound ?? ''}
                    onChange={(event) => {
                      dispatch({
                        type: 'options/updateOptions',
                        payload: {
                          upperBound:
                            event.target.value !== ''
                              ? parseInt(event.target.value)
                              : null,
                        },
                      })
                    }}
                  />
                </Grid>
              </Grid>
            </Box>
          </Grid>
          <Grid size={12} justifyContent='center'>
            <Box pt={2} display='flex' justifyContent='center'>
              <OptionsDataGrid />
            </Box>
          </Grid>
        </Grid>
      </Container>
      <Drawer
        anchor='bottom'
        open={optionDrawerOpen}
        onClose={() => {
          dispatch({ type: 'options/optionsDrawer', payload: false })
        }}
      >
        <OptionTPicker />
      </Drawer>
    </Box>
  )
}

export default OptionsPage
