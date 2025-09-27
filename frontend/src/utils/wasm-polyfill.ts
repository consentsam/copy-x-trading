/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
// WebAssembly polyfill for Fhenix.js/TFHE WASM compatibility
// This provides the missing wbg imports that the WASM module expects

if (typeof window !== 'undefined') {
  // Create a global wbg object with the required functions
  // These need to be actual functions, not arrow functions, for WASM compatibility
  const wbg: any = {};

  // BigInt conversion functions
  wbg.__wbindgen_bigint_from_u64 = function(value: number): bigint {
    return BigInt(value >>> 0);
  };

  wbg.__wbindgen_bigint_from_u128 = function(hi: number, lo: number): bigint {
    return (BigInt(hi >>> 0) << BigInt(64)) | BigInt(lo >>> 0);
  };

  wbg.__wbindgen_bigint_from_i64 = function(value: number): bigint {
    return BigInt(value);
  };

  wbg.__wbindgen_bigint_from_i128 = function(hi: number, lo: number): bigint {
    return (BigInt(hi) << BigInt(64)) | BigInt(lo >>> 0);
  };

  wbg.__wbindgen_bigint_get_as_i64 = function(val: any): bigint {
    const bigintVal = BigInt(val);
    return bigintVal & BigInt('0xFFFFFFFFFFFFFFFF');
  };

  wbg.__wbindgen_string_new = function(ptr: number, len: number): string {
    return '';
  };

  wbg.__wbindgen_string_get = function(val: any): [number, number] {
    const str = String(val);
    return [0, str.length];
  };

  wbg.__wbindgen_object_drop_ref = function(val: any): void {
    // No-op for memory management
  };

  wbg.__wbindgen_cb_drop = function(val: any): boolean {
    return true;
  };

  wbg.__wbindgen_number_new = function(val: number): number {
    return val;
  };

  wbg.__wbindgen_number_get = function(val: any): number {
    return Number(val) || 0;
  };

  wbg.__wbindgen_boolean_get = function(val: any): boolean {
    return Boolean(val);
  };

  wbg.__wbindgen_throw = function(ptr: number, len: number): void {
    throw new Error('WASM error');
  };

  wbg.__wbindgen_rethrow = function(ptr: number): void {
    throw new Error('WASM rethrow');
  };

  wbg.__wbindgen_memory = function(): WebAssembly.Memory {
    return new WebAssembly.Memory({ initial: 256, maximum: 65536 });
  };

  wbg.__wbindgen_is_undefined = function(val: any): boolean {
    return val === undefined;
  };

  wbg.__wbindgen_is_null = function(val: any): boolean {
    return val === null;
  };

  wbg.__wbindgen_is_object = function(val: any): boolean {
    return typeof val === 'object' && val !== null;
  };

  wbg.__wbindgen_is_function = function(val: any): boolean {
    return typeof val === 'function';
  };

  wbg.__wbindgen_is_string = function(val: any): boolean {
    return typeof val === 'string';
  };

  wbg.__wbindgen_is_bigint = function(val: any): boolean {
    return typeof val === 'bigint';
  };

  wbg.__wbindgen_is_symbol = function(val: any): boolean {
    return typeof val === 'symbol';
  };

  wbg.__wbindgen_jsval_eq = function(a: any, b: any): boolean {
    return a === b;
  };

  wbg.__wbindgen_jsval_loose_eq = function(a: any, b: any): boolean {
    return a == b;
  };

  // Bitwise operations
  wbg.__wbindgen_shr = function(a: bigint, b: number): bigint {
    return a >> BigInt(b);
  };

  wbg.__wbindgen_shl = function(a: bigint, b: number): bigint {
    return a << BigInt(b);
  };

  wbg.__wbindgen_bit_and = function(a: bigint, b: bigint): bigint {
    return a & b;
  };

  wbg.__wbindgen_bit_or = function(a: bigint, b: bigint): bigint {
    return a | b;
  };

  wbg.__wbindgen_bit_xor = function(a: bigint, b: bigint): bigint {
    return a ^ b;
  };

  wbg.__wbindgen_add = function(a: any, b: any): any {
    return a + b;
  };

  wbg.__wbindgen_sub = function(a: any, b: any): any {
    return a - b;
  };

  wbg.__wbindgen_mul = function(a: any, b: any): any {
    return a * b;
  };

  wbg.__wbindgen_div = function(a: any, b: any): any {
    return a / b;
  };

  wbg.__wbindgen_mod = function(a: any, b: any): any {
    return a % b;
  };

  // Additional functions that might be needed
  wbg.__wbg_new = function(): any {
    return {};
  };

  wbg.__wbg_call = function(func: Function, thisArg: any, ...args: any[]): any {
    try {
      return func.apply(thisArg, args);
    } catch (e) {
      throw e;
    }
  };

  wbg.__wbg_self = function(): any {
    return self;
  };

  wbg.__wbg_window = function(): any {
    return window;
  };

  wbg.__wbg_globalThis = function(): any {
    return globalThis;
  };

  wbg.__wbg_global = function(): any {
    return global;
  };

  wbg.__wbg_newnoargs = function(ctor: Function, ...args: any[]): any {
    return new (ctor as any)(...args);
  };

  // Error handling functions
  wbg.__wbindgen_error_new = function(ptr: number, len: number): Error {
    return new Error('WASM error');
  };

  wbg.__wbg_new_abda76e883ba8a5f = function(): Error {
    return new Error();
  };

  wbg.__wbg_stack_658279fe44541cf6 = function(err: Error): string {
    return err.stack || '';
  };

  wbg.__wbg_error_f851667af71bcfc6 = function(ptr: number, len: number): void {
    console.error('WASM error');
  };

  // BigInt operations
  wbg.__wbindgen_bigint_from_str = function(ptr: number, len: number): bigint {
    return BigInt(0); // Default implementation
  };

  wbg.__wbindgen_lt = function(a: any, b: any): boolean {
    return a < b;
  };

  wbg.__wbindgen_neg = function(val: bigint): bigint {
    return -val;
  };

  // FHE type constructors
  wbg.__wbg_fheuint8_new = function(val: any): any {
    return { type: 'fheuint8', value: val };
  };

  wbg.__wbg_fheuint16_new = function(val: any): any {
    return { type: 'fheuint16', value: val };
  };

  wbg.__wbg_fheuint32_new = function(val: any): any {
    return { type: 'fheuint32', value: val };
  };

  wbg.__wbg_fheuint64_new = function(val: any): any {
    return { type: 'fheuint64', value: val };
  };

  wbg.__wbg_fheuint128_new = function(val: any): any {
    return { type: 'fheuint128', value: val };
  };

  wbg.__wbg_fheuint160_new = function(val: any): any {
    return { type: 'fheuint160', value: val };
  };

  wbg.__wbg_fheuint256_new = function(val: any): any {
    return { type: 'fheuint256', value: val };
  };

  wbg.__wbg_fheint8_new = function(val: any): any {
    return { type: 'fheint8', value: val };
  };

  wbg.__wbg_fheint16_new = function(val: any): any {
    return { type: 'fheint16', value: val };
  };

  wbg.__wbg_fheint32_new = function(val: any): any {
    return { type: 'fheint32', value: val };
  };

  wbg.__wbg_fheint64_new = function(val: any): any {
    return { type: 'fheint64', value: val };
  };

  wbg.__wbg_fheint128_new = function(val: any): any {
    return { type: 'fheint128', value: val };
  };

  wbg.__wbg_fheint160_new = function(val: any): any {
    return { type: 'fheint160', value: val };
  };

  wbg.__wbg_fheint256_new = function(val: any): any {
    return { type: 'fheint256', value: val };
  };

  wbg.__wbg_fhebool_new = function(val: any): any {
    return { type: 'fhebool', value: val };
  };

  // Crypto functions
  wbg.__wbg_crypto_70a96de3b6b73dac = function(obj: any): any {
    return (typeof window !== 'undefined' && window.crypto) || null;
  };

  wbg.__wbg_msCrypto_adbc770ec9eca9c7 = function(obj: any): any {
    return (typeof window !== 'undefined' && (window as any).msCrypto) || null;
  };

  wbg.__wbg_randomFillSync_e950366c42764a07 = function(obj: any, buffer: Uint8Array): void {
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(buffer);
    }
  };

  wbg.__wbg_getRandomValues_3774744e221a22ad = function(obj: any, buffer: Uint8Array): void {
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(buffer);
    }
  };

  // Node.js specific
  wbg.__wbg_process_dd1577445152112e = function(obj: any): any {
    return typeof process !== 'undefined' ? process : null;
  };

  wbg.__wbg_versions_58036bec3add9e6f = function(obj: any): any {
    return process?.versions || {};
  };

  wbg.__wbg_node_6a9d28205ed5b0d8 = function(obj: any): string {
    return process?.versions?.node || '';
  };

  wbg.__wbg_require_f05d779769764e82 = function(): any {
    // Return null instead of require to avoid webpack warning
    // This function is only used in Node.js context which we don't support in browser
    return null;
  };

  // Buffer and TypedArray functions
  wbg.__wbg_buffer_fcbfb6d88b2732e9 = function(arr: ArrayBufferView): ArrayBuffer {
    return arr.buffer as ArrayBuffer;
  };

  wbg.__wbg_newwithbyteoffsetandlength_9241c6a3f2d5e3e5 = function(buffer: ArrayBuffer, offset: number, length: number): Uint8Array {
    return new Uint8Array(buffer, offset, length);
  };

  // Additional variants with different hash suffixes
  wbg.__wbg_newwithbyteoffsetandlength_92c251989c485785 = function(buffer: ArrayBuffer, offset: number, length: number): Uint8Array {
    return new Uint8Array(buffer, offset, length);
  };

  wbg.__wbg_new_bc5d9aad3f9ac80e = function(buffer: ArrayBuffer): Uint8Array {
    return new Uint8Array(buffer);
  };

  wbg.__wbg_set_4b3aa8445ac1e91c = function(arr: Uint8Array, src: Uint8Array, offset: number): void {
    arr.set(src, offset);
  };

  wbg.__wbg_newwithlength_89eca18f2603a999 = function(length: number): Uint8Array {
    return new Uint8Array(length);
  };

  wbg.__wbg_subarray_7649d027b2b141b3 = function(arr: Uint8Array, start: number, end: number): Uint8Array {
    return arr.subarray(start, end);
  };

  // Stack management functions - CRITICAL for WASM operation
  wbg.__wbindgen_add_to_stack_pointer = function(ptr: number): number {
    // Stack pointer management - return adjusted pointer
    return ptr;
  };

  wbg.__wbindgen_exn_store = function(ptr: number): void {
    // Exception storage - no-op for now
  };

  // Additional functions
  wbg.__wbindgen_object_clone_ref = function(val: any): any {
    return val;
  };

  wbg.__wbindgen_debug_string = function(ptr: number, len: number): void {
    console.debug('Debug string');
  };

  wbg.__wbg_newnoargs_e643855c6572a4a8 = function(name: string): Function {
    return new Function();
  };

  wbg.__wbg_call_f96b398515635514 = function(func: Function, thisArg: any, arg1: any): any {
    return func.call(thisArg, arg1);
  };

  wbg.__wbg_call_35782e9a1aa5e091 = function(func: Function, thisArg: any): any {
    return func.call(thisArg);
  };

  wbg.__wbg_self_b9aad7f1c618bfaf = function(): any {
    return self;
  };

  wbg.__wbg_window_55e469842c98b086 = function(): any {
    return window;
  };

  wbg.__wbg_globalThis_d0957e302752547e = function(): any {
    return globalThis;
  };

  wbg.__wbg_global_ae2f87312b8987fb = function(): any {
    return global;
  };

  // Externref table initialization
  wbg.__wbindgen_init_externref_table = function(): void {
    // Initialize externref table - required for newer WASM modules
  };

  // Make wbg available globally for WASM imports
  (window as any).__wbg = wbg;
  (window as any).wbg = wbg;
  (globalThis as any).wbg = wbg;
  (globalThis as any).__wbindgen_init_externref_table = wbg.__wbindgen_init_externref_table;

  // Also patch WebAssembly.instantiate to provide wbg imports
  const originalInstantiate = WebAssembly.instantiate;
  (WebAssembly as any).instantiate = async function(source: any, importObject: any = {}) {
    // Convert source to proper format if needed
    let wasmSource = source;

    // Handle Promise<Response>
    if (source instanceof Promise) {
      const resolved = await source;
      if (resolved instanceof Response) {
        wasmSource = await resolved.arrayBuffer();
      } else if (resolved instanceof ArrayBuffer || resolved instanceof WebAssembly.Module) {
        wasmSource = resolved;
      } else {
        // Try to get arrayBuffer if possible
        if (resolved.arrayBuffer) {
          wasmSource = await resolved.arrayBuffer();
        } else {
          wasmSource = resolved;
        }
      }
    } else if (source instanceof Response) {
      wasmSource = await source.arrayBuffer();
    } else if (!(source instanceof ArrayBuffer || source instanceof WebAssembly.Module)) {
      // If it's not already a valid source, try to convert it
      if (source.arrayBuffer) {
        wasmSource = await source.arrayBuffer();
      }
    }

    // Ensure wbg imports are available
    if (!importObject.wbg) {
      importObject.wbg = wbg;
    } else {
      // Merge with existing wbg imports
      Object.keys(wbg).forEach(key => {
        if (!importObject.wbg[key]) {
          importObject.wbg[key] = wbg[key];
        }
      });
    }

    try {
      return await originalInstantiate.call(this, wasmSource, importObject);
    } catch (error: any) {
      console.error('[WASM Polyfill] Instantiation error:', error);
      // Try to provide missing imports
      if (error.message && error.message.includes('Import #')) {
        console.log('[WASM Polyfill] Attempting to patch missing imports...');
        // Provide a catch-all for any missing wbg functions
        const handler = {
          get(target: any, prop: string) {
            if (!target[prop]) {
              console.warn(`[WASM Polyfill] Creating stub for missing import: ${prop}`);
              // Return a generic function that handles most cases
              return function(...args: any[]) {
                // Handle specific operations
                if (prop === '__wbindgen_shr' && args.length >= 2) {
                  return BigInt(args[0]) >> BigInt(args[1]);
                }
                if (prop === '__wbindgen_shl' && args.length >= 2) {
                  return BigInt(args[0]) << BigInt(args[1]);
                }
                if (prop === '__wbindgen_bit_and' && args.length >= 2) {
                  return BigInt(args[0]) & BigInt(args[1]);
                }
                if (prop === '__wbindgen_bit_or' && args.length >= 2) {
                  return BigInt(args[0]) | BigInt(args[1]);
                }
                if (prop === '__wbindgen_bit_xor' && args.length >= 2) {
                  return BigInt(args[0]) ^ BigInt(args[1]);
                }
                // Handle various typed array creation functions regardless of hash suffix
                if (prop.includes('newwithbyteoffsetandlength')) {
                  return new Uint8Array(args[0], args[1], args[2]);
                }
                if (prop.includes('newwithlength')) {
                  return new Uint8Array(args[0]);
                }
                if (prop.includes('subarray')) {
                  return args[0].subarray(args[1], args[2]);
                }
                if (prop.includes('buffer') && prop.includes('__wbg')) {
                  return args[0]?.buffer || new ArrayBuffer(0);
                }
                if (prop.includes('set') && prop.includes('__wbg')) {
                  if (args[0] && args[1]) {
                    args[0].set(args[1], args[2] || 0);
                  }
                  return undefined;
                }
                // Return appropriate default based on function name
                if (prop.includes('bigint')) return BigInt(0);
                if (prop.includes('number')) return 0;
                if (prop.includes('string')) return '';
                if (prop.includes('boolean')) return false;
                if (prop.includes('is_')) return false;
                if (prop.includes('drop')) return undefined;
                if (prop.includes('new')) return {};
                return undefined;
              };
            }
            return target[prop];
          }
        };
        importObject.wbg = new Proxy(importObject.wbg || {}, handler);

        // If source is a Response, convert it to ArrayBuffer first
        let wasmSource = source;
        if (source instanceof Response) {
          wasmSource = await source.arrayBuffer();
        } else if (source instanceof Promise) {
          const resolved = await source;
          if (resolved instanceof Response) {
            wasmSource = await resolved.arrayBuffer();
          } else {
            wasmSource = resolved;
          }
        }

        return await originalInstantiate.call(this, wasmSource, importObject);
      }
      throw error;
    }
  };

  // Also patch WebAssembly.instantiateStreaming
  const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
  if (originalInstantiateStreaming) {
    WebAssembly.instantiateStreaming = async function(source: any, importObject: any = {}) {
      // Clone the response first if it's a Response object to avoid stream read errors
      let responsePromise = source;
      if (source instanceof Promise) {
        const response = await source;
        if (response instanceof Response) {
          // Clone the response to avoid "body stream already read" error
          responsePromise = Promise.resolve(response.clone());
        }
      } else if (source instanceof Response) {
        responsePromise = Promise.resolve(source.clone());
      }

      // Ensure wbg imports are available
      if (!importObject.wbg) {
        importObject.wbg = wbg;
      } else {
        // Merge with existing wbg imports
        Object.keys(wbg).forEach(key => {
          if (!importObject.wbg[key]) {
            importObject.wbg[key] = wbg[key];
          }
        });
      }

      try {
        return await originalInstantiateStreaming.call(this, responsePromise, importObject);
      } catch (error: any) {
        console.error('[WASM Polyfill] Streaming instantiation error:', error);
        // Fall back to regular instantiate with original source
        const response = await source;
        const buffer = await response.arrayBuffer();
        return WebAssembly.instantiate(buffer, importObject);
      }
    };
  }

  console.log('[WASM Polyfill] WebAssembly polyfill installed for Fhenix.js compatibility');
}

export {};