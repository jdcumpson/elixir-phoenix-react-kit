import { useMemo } from "react"
import React from "react"

import Box from "@mui/material/Box"
import CssBaseline from "@mui/material/CssBaseline"
import Typography from "@mui/material/Typography"
import merge from "lodash.merge"
import { Provider } from "react-redux"

import { useSyncClientSize } from "@/domains/app/client-size"
import { DEFAULT_STATE } from "@/domains/app/redux"
import AppTheme from "@/domains/app/theme"
import { ApplicationStore, createStore } from "@/redux"

export default function App(props: { state: Partial<ReturnType<ApplicationStore['getState']>> }) {
  const store = useMemo(() => {
    const defaultState = {
      application: {
        ...DEFAULT_STATE
      },
    }
    const store = createStore(merge(props.state, defaultState))
    return store
  }, [])

  const WithClientSize = React.useMemo(() => {
    return () => {
      useSyncClientSize()
      return null
    }
  }, [])

  return (
    <Provider store={store}>
      <AppTheme>
        <CssBaseline enableColorScheme />
        <WithClientSize />
        <Box sx={{ textAlign: { xs: 'center', md: 'left' }, maxWidth: 500 }}>
          <Typography variant="h3" sx={{ mb: 1 }}>
            Move faster <br />
            with intuitive React UI tools
          </Typography>
          <Typography sx={{ color: 'text.secondary', mb: 3 }}>
            MUI offers a comprehensive suite of free UI tools to help you ship new features faster.
            Start with Material UI, our fully-loaded component library, or bring your own design
            system to our production-ready components.
          </Typography>
        </Box>
      </AppTheme>
    </Provider>
  )
}