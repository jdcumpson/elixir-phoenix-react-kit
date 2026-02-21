import * as React from 'react'

import MuiLoadingButton from '@mui/lab/LoadingButton'
import MuiButton, { ButtonProps } from '@mui/material/Button'
import MuiIconButton, { IconButtonProps } from '@mui/material/IconButton'

import { type HistoryLinkProps } from '@/components/Link'

type Props = ButtonProps & HistoryLinkProps
type IconProps = IconButtonProps & HistoryLinkProps

export const Button = React.forwardRef(function Button(
  props: Omit<Props, 'variant'> & {
    variant?: 'text' | 'outlined' | 'contained'
  },
  ref: React.ForwardedRef<HTMLButtonElement | null>,
) {
  return <MuiButton {...props} ref={ref} />
})

export const IconButton = React.forwardRef(function IconButton(
  props: IconProps,
  ref: React.ForwardedRef<HTMLButtonElement | null>,
) {
  return <MuiIconButton {...props} ref={ref} />
})

export const LoadingButton = React.forwardRef(function LoadingButton(
  props: Omit<Props, 'variant'> & {
    loading?: boolean
    loadingPosition?: 'center' | 'start' | 'end' | undefined
    variant?: 'text' | 'outlined' | 'contained'
  },
  ref: React.ForwardedRef<HTMLButtonElement | null>,
) {
  return <MuiLoadingButton {...props} ref={ref} />
})
