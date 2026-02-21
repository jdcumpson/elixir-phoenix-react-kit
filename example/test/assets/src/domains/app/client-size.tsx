import React from 'react'

import useMediaQuery from '@mui/material/useMediaQuery'

import { ClientSize } from '@/domains/app/redux'
import { useSelector, useDispatch } from '@/redux'

export type Qualifier = 'up' | 'down' | 'is'

export const useClientSize = ([qualifier, checkSize]: [
  Qualifier,
  ClientSize,
]) => {
  const size = useSelector((state) => state.application.clientSize)

  if (qualifier === 'up') {
    return checkSize >= size
  } else if (qualifier === 'down') {
    return checkSize <= size
  } else {
    return checkSize === size
  }
}

export const useSyncClientSize = () => {
  const dispatch = useDispatch()
  const currentSize = useSelector((state) => state.application.clientSize)

  const isXl = useMediaQuery((theme) => theme.breakpoints.only('xl')) ? 1 : 0
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.only('desktop'))
    ? 1 << 1
    : 0
  const isLaptop = useMediaQuery((theme) => theme.breakpoints.only('laptop'))
    ? 1 << 2
    : 0
  const isTablet = useMediaQuery((theme) => theme.breakpoints.only('tablet'))
    ? 1 << 3
    : 0
  const isMobile = useMediaQuery((theme) => theme.breakpoints.only('mobile'))
    ? 1 << 4
    : 0

  let sizeBits = isXl | isDesktop | isLaptop | isTablet | isMobile

  if (sizeBits === 0) {
    switch (currentSize) {
      case ClientSize.XL:
        sizeBits = 1
        break
      case ClientSize.DESKTOP:
        sizeBits = 1 << 1
        break
      case ClientSize.LAPTOP:
        sizeBits = 1 << 2
        break

      case ClientSize.TABLET:
        sizeBits = 1 << 3
        break
      case ClientSize.MOBILE:
        sizeBits = 1 << 4
        break
    }
  }

  React.useEffect(() => {
    let size: ClientSize = ClientSize.DESKTOP
    switch (sizeBits) {
      case 1:
        size = ClientSize.XL
        break
      case 2:
        size = ClientSize.DESKTOP
        break
      case 4:
        size = ClientSize.LAPTOP
        break
      case 8:
        size = ClientSize.TABLET
        break
      case 16:
        size = ClientSize.MOBILE
    }

    if (size !== currentSize) {
      dispatch({ type: 'application/setClientSize', payload: size })
    }
  }, [sizeBits, currentSize])
}

export const WatchClientSize = () => {
  useSyncClientSize()
  return null
}
