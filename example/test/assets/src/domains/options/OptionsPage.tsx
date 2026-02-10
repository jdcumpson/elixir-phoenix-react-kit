import { use, useEffect } from "react"

import Container from "@mui/material/Container"
import { DataGrid, GridColDef, GridColumnGroupingModel } from "@mui/x-data-grid"

import { UserSocketContext } from "@/domains/app/socket"

const columns: GridColDef[] = [
  { field: 'id', headerName: 'ID', width: 90 },
  {
    field: 'firstName',
    headerName: 'First name',
    width: 150,
  },
  {
    field: 'lastName',
    headerName: 'Last name',
    width: 150,
  },
  {
    field: 'age',
    headerName: 'Age',
    type: 'number',
    width: 110,
  },
]

const rows = [
  { id: 1, lastName: 'Snow', firstName: 'Jon', age: 14 },
  { id: 2, lastName: 'Lannister', firstName: 'Cersei', age: 31 },
  { id: 3, lastName: 'Lannister', firstName: 'Jaime', age: 31 },
  { id: 4, lastName: 'Stark', firstName: 'Arya', age: 11 },
  { id: 5, lastName: 'Targaryen', firstName: 'Daenerys', age: null },
  { id: 6, lastName: 'Melisandre', firstName: null, age: 150 },
  { id: 7, lastName: 'Clifford', firstName: 'Ferrara', age: 44 },
  { id: 8, lastName: 'Frances', firstName: 'Rossini', age: 36 },
  { id: 9, lastName: 'Roxie', firstName: 'Harvey', age: 65 },
]

const columnGroupingModel: GridColumnGroupingModel = [
  {
    groupId: 'Internal',
    description: '',
    children: [{ field: 'id' }],
  },
  {
    groupId: 'Basic info',
    children: [
      {
        groupId: 'Full name',
        children: [{ field: 'lastName' }, { field: 'firstName' }],
      },
      { field: 'age' },
    ],
  },
]

export const OptionsPage = () => {
  // const clientSize = useSelector(state => state.application.clientSize)
  const { userChannel } = use(UserSocketContext)

  useEffect(() => {
    if (!userChannel) {
      return
    }
    console.info(userChannel)
    const push = userChannel.push("options", {})
    push.receive("ok", (id) => {
      const updateRef = userChannel.on(`options:${id}`, (data) => {
        console.info('data', data)
      })
      const finishRef = userChannel.on(`options:${id}:done`, () => {
        userChannel.off(`options:${id}`, updateRef)
        userChannel.off(`options:${id}:done`, finishRef)
      })
    }).send()
    // socket?.channel()
  }, [userChannel])

  return (
    <Container>
      <DataGrid
        rows={rows}
        columns={columns}
        sortingMode="server"
        checkboxSelection={false}
        disableRowSelectionOnClick
        disableColumnSorting
        disableColumnFilter
        disableColumnMenu
        disableColumnSelector
        disableDensitySelector
        disableColumnResize
        disableMultipleRowSelection
        rowSelection={false}
        onCellClick={(_params, e) => {
          e.defaultMuiPrevented = true
        }}
        sx={{
          "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": {
            outline: "none",
            outlineOffset: 0,
            // border: '1px solid transparent'
          },
          "& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within": {
            outline: "none",
            outlineOffset: 0,
            // border: '1px solid transparent'
          },
          // Keep column separators visible (MUI defaults to fading them)
          "& .MuiDataGrid-columnSeparator": {
            opacity: "1 !important",
            visibility: "visible !important",
          },

          // Some themes/state rules target these variants
          "& .MuiDataGrid-columnSeparator--sideLeft, & .MuiDataGrid-columnSeparator--sideRight": {
            opacity: "1 !important",
            visibility: "visible !important",
          },

          // Optional: prevent any hover-driven changes
          "& .MuiDataGrid-columnSeparator:hover": {
            opacity: "1 !important",
          },
        }}
        columnGroupingModel={columnGroupingModel}
      />
    </Container >
  )
}

export default OptionsPage