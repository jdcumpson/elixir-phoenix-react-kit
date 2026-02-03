import * as React from 'react'

import { ThemeProvider, createTheme } from '@mui/material/styles'
import type { ThemeOptions } from '@mui/material/styles'

import { HistoryLink as Link } from '@/components/Link'


interface AppThemeProps {
  children: React.ReactNode
  /**
   * This is for the docs site. You can ignore it or remove it.
   */
  themeComponents?: ThemeOptions['components']
}

declare module '@mui/material/styles' {
  interface BreakpointOverrides {
    xs: false // removes the `xs` breakpoint
    sm: false
    md: false
    lg: false
    xl: true
    mobile: true // adds the `mobile` breakpoint
    tablet: true
    laptop: true
    desktop: true
  }
}

export default function AppTheme(props: AppThemeProps) {
  const { children, themeComponents } = props
  const theme = React.useMemo(() => {
    return createTheme({
      // For more details about CSS variables configuration, see https://mui.com/material-ui/customization/css-theme-variables/configuration/
      breakpoints: {
        values: {
          laptop: 1080,
          tablet: 768,
          mobile: 0,
          desktop: 1280,
          xl: 1500,
        },
      },
      typography: {
        fontFamily: [
          "'Inter'",
          "'Bebas Neue'",
          '"Roboto Condensed"',
          'arial',
          'sans-serif',
          'system',
        ].join(', '),
        h4: {
          fontWeight: '700',
        },
        h5: {
          fontWeight: '700',
        },
        h6: {
          fontWeight: '700',
        },
      },
      shape: {
        borderRadius: 4,
      },
      components: {
        MuiUseMediaQuery: {
          defaultProps: {
            // defaultMatches: true,
          },
        },
        MuiCssBaseline: {
          styleOverrides: {
            fontWeight: 800,
            fontSmooth: 'always',
            fill: '#675dff',
            height: '100vh',
          },
        },
        MuiLink: {
          defaultProps: {
            component: Link,
          },
        },
        MuiButtonBase: {
          defaultProps: {
            LinkComponent: Link,
          },
        },
        MuiButton: {
          styleOverrides: {
            root: ({ ownerState }) => ({
              ...(ownerState.variant === 'contained' && {
                boxShadow: 'none',
                border: '1px solid',
                ':hover': {
                  boxShadow: 'none',
                },
              }),
            }),
          },
        },
        MuiIconButton: {
          defaultProps: {
            LinkComponent: Link,
          },
        },
      },
    })
  }, [themeComponents])
  return (
    <ThemeProvider theme={theme} disableTransitionOnChange>
      {children}
    </ThemeProvider>
  )
}