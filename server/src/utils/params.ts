import { notFound } from './errors'

export function routeId(value: string | string[] | undefined, label: string) {
  const id = Array.isArray(value) ? value[0] : value
  if (!id) {
    throw notFound(`${label} not found.`)
  }
  return id
}
