import * as React from 'react'

import { ThemeProvider, alpha, createTheme } from '@mui/material/styles'
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
      palette: {
        text: {
          secondary: '#A8A8A8',
          accent: 'rgb(151,71,221)',
        },
        primary: {
          main: 'rgb(151,71,221)',
        },
        secondary: {
          main: 'rgb(58, 244, 158)',
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
        MuiOutlinedInput: {
          styleOverrides: {
            root: ({ theme }) => ({
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.text.accent,
              },
            }),
          },
        },
        MuiInputLabel: {
          styleOverrides: {
            root: ({ theme }) => ({
              color: theme.palette.text.secondary,
              '&.Mui-focused': {
                color: theme.palette.text.secondary,
              },
            }),
          },
        },
        MuiInputBase: {
          styleOverrides: {
            input: ({ theme }) => ({
              '&::placeholder': {
                color: theme.palette.text.secondary,
                opacity: 1,
              },
            }),
          },
        },
        MuiSelect: {
          styleOverrides: {
            root: ({ theme }) => ({
              '&:hover:not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.text.accent,
              },
            }),
          },
        },
        MuiAutocomplete: {
          styleOverrides: {
            root: ({ theme }) => ({
              '& .MuiOutlinedInput-root:hover:not(.Mui-disabled) .MuiOutlinedInput-notchedOutline':
                {
                  borderColor: theme.palette.text.accent,
                },
            }),
            option: ({ theme }) => ({
              '&:hover': {
                backgroundColor: alpha(theme.palette.text.accent, 0.14),
              },
            }),
            paper: ({ theme }) => ({
              '& .MuiAutocomplete-option.Mui-focused, & .MuiAutocomplete-option.Mui-focusVisible':
                {
                  backgroundColor: `${alpha(theme.palette.text.accent, 0.14)} !important`,
                },
              '& .MuiAutocomplete-option[aria-selected="true"]': {
                backgroundColor: `${alpha(theme.palette.text.accent, 0.22)} !important`,
              },
              '& .MuiAutocomplete-option[aria-selected="true"].Mui-focused, & .MuiAutocomplete-option[aria-selected="true"]:hover, & .MuiAutocomplete-option[aria-selected="true"].Mui-focusVisible':
                {
                  backgroundColor: `${alpha(theme.palette.text.accent, 0.28)} !important`,
                },
            }),
            listbox: ({ theme }) => ({
              '& .MuiAutocomplete-option[aria-selected="true"]': {
                backgroundColor: `${alpha(theme.palette.text.accent, 0.22)} !important`,
              },
              '& .MuiAutocomplete-option[aria-selected="true"].Mui-focused, & .MuiAutocomplete-option[aria-selected="true"]:hover':
                {
                  backgroundColor: `${alpha(theme.palette.text.accent, 0.28)} !important`,
                },
              '& .MuiAutocomplete-option[aria-selected="true"].Mui-focusVisible':
                {
                  backgroundColor: `${alpha(theme.palette.text.accent, 0.28)} !important`,
                },
            }),
          },
        },
        MuiMenuItem: {
          styleOverrides: {
            root: ({ theme }) => ({
              '&:hover': {
                backgroundColor: alpha(theme.palette.text.accent, 0.14),
              },
              '&&.Mui-selected': {
                backgroundColor: `${alpha(theme.palette.text.accent, 0.22)} !important`,
              },
              '&&.Mui-selected:hover': {
                backgroundColor: `${alpha(theme.palette.text.accent, 0.28)} !important`,
              },
              '&&.Mui-selected.Mui-focusVisible': {
                backgroundColor: `${alpha(theme.palette.text.accent, 0.28)} !important`,
              },
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
