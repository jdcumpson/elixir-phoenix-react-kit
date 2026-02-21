import * as React from 'react'

import Box from '@mui/material/Box'
import MuiLink, { LinkBaseProps, LinkProps } from '@mui/material/Link'
import { styled } from '@mui/material/styles'
import isEqual from 'lodash/isEqual'
import queryString from 'query-string'

import { useHistory } from '@/domains/app/history'
import { useSelector } from '@/redux'

export type HistoryLinkProps = LinkBaseProps &
  LinkProps & {
    to?: string
    href?: string
    attemptBack?: boolean
    onNavigate?: () => void
    variant?: 'text' | 'outlined' | 'contained'
  }

export const HistoryLink = React.forwardRef(function HistoryLink(
  props: React.PropsWithChildren<HistoryLinkProps>,
  forwardedRef,
) {
  const history = useHistory()
  const {
    href,
    className,
    children,
    attemptBack,
    onNavigate,
    onTouchEnd,
    ...otherProps
  } = props
  const canGoBack = useSelector((state) => state.application.canGoBack)
  const previousLocation = useSelector(
    (state) => state.application.previousLocation,
  )

  const onClick = props.onClick
  const path = useSelector((state) => state.application.path)
  const urlArgs = useSelector((state) => state.application.urlArgs)
  const locale = useSelector((state) => state.application.locale)
  const to = React.useMemo(() => {
    if (locale === 'en-US') {
      return props.to
    }
    return `/${locale}${props.to}`
  }, [props.to, locale])

  const handlePress = React.useCallback(
    (event: React.TouchEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return
      }
      event.preventDefault()
      event.stopPropagation()

      if (event.type === 'click') {
        onClick?.(event as React.MouseEvent<HTMLAnchorElement, MouseEvent>)
      } else {
        onTouchEnd?.(event as React.TouchEvent<HTMLAnchorElement>)
      }

      if (to != '') {
        const { url: newPath, query: newUrlArgs } = queryString.parseUrl(
          to ?? '',
        )
        if (path === newPath && isEqual(newUrlArgs, urlArgs)) {
          return
        }
        if (attemptBack != null && canGoBack && previousLocation != null) {
          history.back()
        } else if (to != null) {
          history.push(to)
        }
        onNavigate?.()
      }
    },
    [to, props.attemptBack, props.onNavigate, onClick, onTouchEnd],
  )

  if (props.href != null) {
    return (
      <Box
        component='a'
        className={className}
        href={href}
        {...otherProps}
        sx={{ cursor: 'pointer' }}
      >
        {children}
      </Box>
    )
  }
  return (
    <Box
      component='a'
      ref={forwardedRef}
      className={className}
      {...otherProps}
      href={to}
      onClick={handlePress}
    >
      {children}
    </Box>
  )
})

interface Props extends LinkProps {
  to: string
}

export default styled(MuiLink)<Props>(
  (_props: { color?: LinkProps['color'] }) => ({
    textDecoration: 'inherit',
    variant: 'inherit',
    textTransform: 'none',
  }),
)
