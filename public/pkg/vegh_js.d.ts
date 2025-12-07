/* tslint:disable */
/* eslint-disable */

export class VeghStreamingHasher {
  free(): void;
  [Symbol.dispose](): void;
  constructor();
  update(chunk: Uint8Array): void;
  finalize(): string;
}

export function check_cache_hit(cache_val: any, path: string, current_size: bigint, current_modified: bigint): boolean;

export function create_empty_cache(): any;

export function get_file_content(data: Uint8Array, target_path: string): Uint8Array;

export function get_library_info(): any;

export function get_metadata(data: Uint8Array): any;

export function list_files(data: Uint8Array): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_veghstreaminghasher_free: (a: number, b: number) => void;
  readonly check_cache_hit: (a: any, b: number, c: number, d: bigint, e: bigint) => number;
  readonly create_empty_cache: () => [number, number, number];
  readonly get_file_content: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly get_library_info: () => [number, number, number];
  readonly get_metadata: (a: number, b: number) => [number, number, number];
  readonly list_files: (a: number, b: number) => [number, number, number];
  readonly veghstreaminghasher_finalize: (a: number) => [number, number];
  readonly veghstreaminghasher_new: () => number;
  readonly veghstreaminghasher_update: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
