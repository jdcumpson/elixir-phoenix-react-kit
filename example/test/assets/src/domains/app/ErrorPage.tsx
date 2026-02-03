import { useSelector } from "@/redux"

export default function ErrorPage({ error }: { error: { message: string, stack?: string } }) {
  const status = useSelector(state => state.application.responseOptions?.status)

  return (
    <div>
      <div> Status: {status} </div>
      <div>{error.message}</div>
      <div>{error.stack ?? null}</div>
    </div>
  )
}