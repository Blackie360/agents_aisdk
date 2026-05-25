import { Schema } from '@/lib/types/schema'

interface SchemaVisualizerSuccessResponse {
  success: true
  schema: Schema
}

interface SchemaVisualizerErrorResponse {
  success?: false
  message?: string
}

type SchemaVisualizerResponse = SchemaVisualizerSuccessResponse | SchemaVisualizerErrorResponse

function isSchemaVisualizerSuccess (
  data: SchemaVisualizerResponse
): data is SchemaVisualizerSuccessResponse {
  return data.success === true && typeof data.schema === 'object' && data.schema !== null
}

export async function fetchSchema (input: string): Promise<Schema> {
  const response = await fetch('/api/schema-visualizer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ schema: input })
  })

  if (!response.ok) {
    const error = await response.json() as SchemaVisualizerErrorResponse
    throw new Error(error.message ?? 'Failed to parse schema')
  }

  const data = await response.json() as SchemaVisualizerResponse

  if (!isSchemaVisualizerSuccess(data)) {
    throw new Error(data.message ?? 'Failed to parse schema')
  }

  return data.schema
}

export async function streamSchemaExplanation (
  schema: Schema,
  onChunk: (chunk: string) => void
): Promise<void> {
  const response = await fetch('/api/schema-explanation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ schema })
  })

  if (!response.ok) {
    const error = await response.json() as SchemaVisualizerErrorResponse
    throw new Error(error.message ?? 'Failed to generate schema explanation')
  }

  if (!response.body) {
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const delta = parseTextDelta(line)

      if (delta) {
        onChunk(delta)
      }
    }
  }

  if (!buffer) {
    return
  }

  const trailingDelta = parseTextDelta(buffer)

  if (trailingDelta) {
    onChunk(trailingDelta)
  }
}

function parseTextDelta (line: string): string | null {
  if (!line.trim()) {
    return null
  }

  const separatorIndex = line.indexOf(':')

  if (separatorIndex < 0) {
    return null
  }

  const payload = line.slice(separatorIndex + 1).trim()

  if (!payload) {
    return null
  }

  try {
    const parsed = JSON.parse(payload) as unknown

    if (typeof parsed === 'string') {
      return parsed
    }

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'type' in parsed &&
      'textDelta' in parsed &&
      parsed.type === 'text-delta' &&
      typeof parsed.textDelta === 'string'
    ) {
      return parsed.textDelta
    }
  } catch {
    return payload.replace(/^"(.+)"$/, '$1')
  }

  return null
}
