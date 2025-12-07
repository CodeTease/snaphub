// CodeTease - VeghJS Worker
// "The Thread" - Handles heavy lifting off-main-thread.

import init, { VeghStreamingHasher, get_metadata, list_files, check_cache_hit, get_file_content } from "./pkg/vegh_js.js";

let isReady = false;

(async () => {
    try {
        await init();
        isReady = true;
        postMessage({ type: 'READY' });
    } catch (err) {
        console.error("VeghJS Worker Init Failed:", err);
        postMessage({ type: 'ERROR', payload: `WASM Init Failed: ${err}` });
    }
})();

self.onmessage = async (e) => {
    if (!isReady) {
        postMessage({ type: 'ERROR', payload: 'Core not ready yet. Please wait.' });
        return;
    }

    const { command, payload } = e.data;

    try {
        switch (command) {
            case 'CHECK_INTEGRITY_STREAM':
                // Payload: { file, chunkSize }
                await handleIntegrityStream(payload.file, payload.chunkSize);
                break;

            case 'GET_METADATA':
                // Payload: { file }
                await handleMetadata(payload.file);
                break;

            case 'LIST_FILES':
                // Payload: { file }
                await handleListFiles(payload.file);
                break;
            
            case 'CHECK_CACHE':
                // Payload: { cacheObj, path, size, modified }
                const isHit = check_cache_hit(payload.cacheObj, payload.path, BigInt(payload.size), BigInt(payload.modified));
                postMessage({ type: 'RESULT_CACHE_HIT', payload: isHit });
                break;

            case 'GET_FILE_CONTENT':
                // [NEW] Extract specific file content
                // Payload: { file, path }
                await handleGetFileContent(payload.file, payload.path);
                break;

            default:
                postMessage({ type: 'ERROR', payload: `Unknown command: ${command}` });
        }
    } catch (err) {
        postMessage({ type: 'ERROR', payload: err.message || String(err) });
    }
};

async function handleIntegrityStream(file, chunkSize = 5 * 1024 * 1024) {
    const totalBytes = file.size;
    let loadedBytes = 0;
    
    let hasher = new VeghStreamingHasher();
    const reader = file.stream().getReader();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            hasher.update(value);
            loadedBytes += value.length;
            
            const progress = (loadedBytes / totalBytes) * 100;
            postMessage({ type: 'PROGRESS', payload: { task: 'integrity_blake3', progress } });
        }

        const hash = hasher.finalize();
        hasher = null; // Mark as consumed

        postMessage({ type: 'RESULT_INTEGRITY', payload: hash });
        
    } finally {
        if (hasher && hasher.free) {
            hasher.free();
        }
    }
}

async function handleMetadata(file) {
    const buffer = await file.arrayBuffer();
    const meta = get_metadata(new Uint8Array(buffer));
    postMessage({ type: 'RESULT_METADATA', payload: meta });
}

async function handleListFiles(file) {
    const buffer = await file.arrayBuffer();
    const list = list_files(new Uint8Array(buffer));
    postMessage({ type: 'RESULT_FILES', payload: list });
}

// [NEW] Handler for extracting content
async function handleGetFileContent(file, targetPath) {
    const buffer = await file.arrayBuffer();
    const content = get_file_content(new Uint8Array(buffer), targetPath);
    
    // Transferable objects optimization can be applied here if needed
    postMessage({ 
        type: 'RESULT_FILE_CONTENT', 
        payload: { 
            path: targetPath, 
            data: content // This is a Uint8Array
        } 
    });
}