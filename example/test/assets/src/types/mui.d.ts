import '@mui/material/styles'
import '@mui/material/styles/createPalette'

declare module '@mui/material/styles' {
  interface TypeText {
    accent: string
  }
}

declare module '@mui/material/styles/createPalette' {
  interface TypeText {
    accent: string
  }
}
