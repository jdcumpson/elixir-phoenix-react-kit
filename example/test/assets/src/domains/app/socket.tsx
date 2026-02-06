import * as React from "react"

import { Socket } from "phoenix"


export const UserSocketContext = React.createContext<{ socket: Socket | null }>({
  socket: null
})

