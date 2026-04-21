declare module 'bidi-js' {
  // Minimal surface used by @ant/ink — opaque until we need more.
  type BidiParagraph = {
    levels: Uint8Array
    paragraphs: Array<{ start: number; end: number; level: number }>
  }

  type BidiFactory = () => {
    getEmbeddingLevels(text: string, baseDirection?: 'auto' | 'ltr' | 'rtl'): BidiParagraph
    getReorderedIndices(
      text: string,
      embeddingLevels: BidiParagraph,
      start: number,
      end: number,
    ): number[]
    getReorderedString(text: string, embeddingLevels: BidiParagraph): string
  }

  const factory: BidiFactory
  export default factory
}
