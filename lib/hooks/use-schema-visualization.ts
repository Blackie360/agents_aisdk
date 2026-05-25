import { useState } from 'react'
import { Node, Edge } from '@xyflow/react'
import { generateDiagram } from '@/lib/services/diagram-generator'
import { fetchSchema, streamSchemaExplanation } from '@/lib/services/schema-api-client'
import { Table } from '@/lib/types/schema'

interface DiagramState {
  nodes: Node[]
  edges: Edge[]
}

interface UseSchemaVisualizationResult {
  isLoading: boolean
  isStreaming: boolean
  explanation: string
  diagram: DiagramState | null
  selectedTable: Table | null
  setSelectedTable: (table: Table | null) => void
  generateFromSchema: (input: string) => Promise<void>
}

export function useSchemaVisualization (): UseSchemaVisualizationResult {
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [diagram, setDiagram] = useState<DiagramState | null>(null)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [explanation, setExplanation] = useState('')

  const generateFromSchema = async (input: string): Promise<void> => {
    setIsLoading(true)
    setIsStreaming(true)
    setExplanation('')
    setSelectedTable(null)

    try {
      const schema = await fetchSchema(input)
      const diagramData = generateDiagram(schema)

      setDiagram({
        nodes: diagramData.nodes as unknown as Node[],
        edges: diagramData.edges as unknown as Edge[]
      })

      await streamSchemaExplanation(schema, (chunk) => {
        setExplanation((previous) => previous + chunk)
      })
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Failed to generate diagram. Please check your schema format.'

      setExplanation(`Error: ${message}`)
    } finally {
      setIsStreaming(false)
      setIsLoading(false)
    }
  }

  return {
    isLoading,
    isStreaming,
    explanation,
    diagram,
    selectedTable,
    setSelectedTable,
    generateFromSchema
  }
}
