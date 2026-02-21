import Box from '@mui/material/Box'

import { Button } from '@/components/buttons'

export default function HomePage() {
  return (
    <Box>
      <Button to='/options'>Options Example Page</Button>
      <Button to='/other'>Other</Button>
      <Button to='/other2'>Other2</Button>
    </Box>
  )
}
