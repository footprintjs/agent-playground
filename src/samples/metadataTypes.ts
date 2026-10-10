export interface SampleMetadata {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly group: string;
}

export type SampleDiscovery =
  | { readonly kind: 'runnable'; readonly meta: SampleMetadata }
  | { readonly kind: 'cli-only' | 'unsupported'; readonly reason: string; readonly meta?: SampleMetadata };
