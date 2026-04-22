export interface RenderOptions {
  theme?: 'default' | 'dark' | 'sketchy' | 'monochrome';
  maxWidth?: number;
}

export function render(_source: string, _options?: RenderOptions): Promise<string> {
  return Promise.reject(new Error('not implemented'));
}

export function renderSync(_source: string, _options?: RenderOptions): string {
  throw new Error('not implemented');
}

export function renderAll(_source: string, _options?: RenderOptions): Promise<string[]> {
  return Promise.reject(new Error('not implemented'));
}
