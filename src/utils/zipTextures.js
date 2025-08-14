/**
 * ZIP Texture Utilities
 * 
 * This module provides utilities for loading textures from ZIP files
 * and resolving texture paths for FBX models.
 */

// Supported texture file extensions
const TEXTURE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tga'];

// Check if TGA loader is available (global, THREE namespace, or tga-js)
const hasTGALoader = typeof TGALoader !== 'undefined' ||
                    (typeof THREE !== 'undefined' && typeof THREE.TGALoader !== 'undefined') ||
                    typeof TgaLoader !== 'undefined';

/**
 * Check if a filename is a texture file based on its extension
 * @param {string} filename - The filename to check
 * @returns {boolean} True if the file is a texture
 */
export function isTextureFile(filename) {
  if (!filename || typeof filename !== 'string') return false;
  const lowerName = filename.toLowerCase();
  return TEXTURE_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

/**
 * Load a texture from a Blob object
 * @param {Blob} blob - The blob containing texture data
 * @param {string} filename - The filename for the texture
 * @param {Object} threeModule - The THREE module to use for texture loading
 * @returns {Promise<THREE.Texture>} A promise that resolves to the loaded texture
 */
export function loadTextureFromBlob(blob, filename, threeModule) {
  return new Promise((resolve, reject) => {
    try {
      const url = URL.createObjectURL(blob);
      console.log(`[zipTextures] Loading texture: ${filename} from blob URL: ${url}`);
      
      // Use TGALoader for .tga files if available, otherwise use TextureLoader
      if (filename.toLowerCase().endsWith('.tga')) {
        console.log(`[zipTextures] TGA file detected: ${filename}`);
        console.log(`[zipTextures] TGA loader available:`, hasTGALoader);
        console.debug(`[zipTextures] Available loaders:`, {
          TgaLoader: typeof TgaLoader,
          TGA: typeof TGA,
          TGALoader: typeof TGALoader,
          'THREE.TGALoader': typeof threeModule.TGALoader
        });
        
        try {
          let loader;
          if (typeof TgaLoader !== 'undefined') {
            // Use local tga-js
            console.debug(`[zipTextures] Local TgaLoader available, using it for TGA: ${filename}`);
            const tga = new TgaLoader();
            tga.open(url, () => {
              try {
                const canvas = tga.getCanvas();
                const texture = new threeModule.Texture(canvas);
                texture.name = filename;
                // Remove forced sRGB encoding for all textures - let Materials.js handle encoding by type
                // texture.encoding = threeModule.sRGBEncoding;
                texture.flipY = false;
                texture.needsUpdate = true;
                URL.revokeObjectURL(url);
                console.log(`[zipTextures] TGA texture loaded successfully with local TgaLoader: ${filename}`);
                resolve(texture);
              } catch (textureError) {
                console.error(`[zipTextures] Error creating texture from TGA data:`, textureError);
                URL.revokeObjectURL(url);
                reject(textureError);
              }
            }, (error) => {
              console.error(`[zipTextures] Local TgaLoader loading error:`, error);
              URL.revokeObjectURL(url);
              reject(error);
            });
          } else if (typeof TGA !== 'undefined') {
            // Use tga-js (fallback)
            console.log(`[zipTextures] Using fallback tga-js for TGA: ${filename}`);
            loader = new TGA();
            loader.open(url, (tgaData) => {
              try {
                const texture = new threeModule.Texture(tgaData);
                texture.name = filename;
                // Remove forced sRGB encoding for all textures - let Materials.js handle encoding by type
                // texture.encoding = threeModule.sRGBEncoding;
                texture.flipY = false;
                texture.needsUpdate = true;
                URL.revokeObjectURL(url);
                console.log(`[zipTextures] TGA texture loaded successfully with tga-js: ${filename}`);
                resolve(texture);
              } catch (textureError) {
                console.error(`[zipTextures] Error creating texture from TGA data:`, textureError);
                URL.revokeObjectURL(url);
                reject(textureError);
              }
            }, (error) => {
              console.error(`[zipTextures] tga-js loading error:`, error);
              URL.revokeObjectURL(url);
              reject(error);
            });
          } else if (typeof TGALoader !== 'undefined') {
            // Use global TGALoader
            console.log(`[zipTextures] Using global TGALoader: ${filename}`);
            loader = new TGALoader();
            loader.load(url,
              (texture) => {
                console.log(`[zipTextures] TGA texture loaded successfully with TGALoader: ${filename}`);
                texture.name = filename;
                // Remove forced sRGB encoding for all textures - let Materials.js handle encoding by type
                // texture.encoding = threeModule.sRGBEncoding;
                texture.flipY = false;
                URL.revokeObjectURL(url);
                resolve(texture);
              },
              undefined,
              (error) => {
                console.error(`[zipTextures] TGALoader loading error:`, error);
                URL.revokeObjectURL(url);
                reject(error);
              }
            );
          } else if (typeof threeModule.TGALoader !== 'undefined') {
            // Use THREE.TGALoader
            console.log(`[zipTextures] Using THREE.TGALoader: ${filename}`);
            loader = new threeModule.TGALoader();
            loader.load(url,
              (texture) => {
                console.log(`[zipTextures] TGA texture loaded successfully with THREE.TGALoader: ${filename}`);
                texture.name = filename;
                // Remove forced sRGB encoding for all textures - let Materials.js handle encoding by type
                // texture.encoding = threeModule.sRGBEncoding;
                texture.flipY = false;
                URL.revokeObjectURL(url);
                resolve(texture);
              },
              undefined,
              (error) => {
                console.error(`[zipTextures] THREE.TGALoader loading error:`, error);
                URL.revokeObjectURL(url);
                reject(error);
              }
            );
          } else {
            throw new Error('No TGA loader available');
          }
        } catch (tgaError) {
          console.error(`[zipTextures] TGA loader initialization error:`, tgaError);
          console.log(`[zipTextures] Falling back to TextureLoader for TGA: ${filename}`);
          // Fallback to TextureLoader
          const loader = new threeModule.TextureLoader();
          loader.load(url, (texture) => {
            texture.name = filename;
            // Remove forced sRGB encoding for all textures - let Materials.js handle encoding by type
            // texture.encoding = threeModule.sRGBEncoding;
            texture.flipY = false;
            URL.revokeObjectURL(url);
            resolve(texture);
          }, undefined, (error) => {
            URL.revokeObjectURL(url);
            reject(error);
          });
        }
      } else {
        console.log(`[zipTextures] Loading non-TGA texture: ${filename} with TextureLoader`);
        const loader = new threeModule.TextureLoader();
        
        loader.load(url, (texture) => {
          texture.name = filename;
          // Remove forced sRGB encoding for all textures - let Materials.js handle encoding by type
          // texture.encoding = threeModule.sRGBEncoding;
          texture.flipY = false; // Common for game textures
          URL.revokeObjectURL(url);
          resolve(texture);
        }, (progress) => {
          console.log(`[zipTextures] Non-TGA loading progress:`, progress);
        }, (error) => {
          console.error(`[zipTextures] Non-TGA loading error:`, error);
          URL.revokeObjectURL(url);
          reject(error);
        });
      }
    } catch (error) {
      console.error(`[zipTextures] Blob creation or general error:`, error);
      reject(error);
    }
  });
}

/**
 * Extract the basename from a file path
 * @param {string} path - The file path
 * @returns {string} The basename (filename without directory)
 */
export function getBasename(path) {
  if (!path) return '';
  return path.split('/').pop().split('\\').pop();
}

/**
 * Match a texture path against a texture map with different strategies
 * @param {string} path - The texture path to match
 * @param {Map<string, THREE.Texture>} textureMap - The map of available textures
 * @returns {THREE.Texture|null} The matched texture or null if not found
 */
export function matchTexturePath(path, textureMap) {
  if (!path || !textureMap) return null;
  
  const pathLower = path.toLowerCase();
  
  // 1. Try exact match (case-insensitive)
  if (textureMap.has(pathLower)) {
    return textureMap.get(pathLower);
  }
  
  // 2. Try basename match (case-insensitive)
  const basename = getBasename(path).toLowerCase();
  for (const [key, texture] of textureMap) {
    if (getBasename(key).toLowerCase() === basename) {
      return texture;
    }
  }
  
  // 3. Try partial match (path ends with texture name)
  for (const [key, texture] of textureMap) {
    const keyLower = key.toLowerCase();
    if (keyLower.includes(basename) || basename.includes(keyLower)) {
      return texture;
    }
  }
  
  return null;
}

/**
 * Load textures from a ZIP file using the zip.js library for streaming.
 * @param {File} zipFile - The ZIP file to load textures from.
 * @param {Object} threeModule - The THREE module to use for texture loading.
 * @param {function(number):void} [onProgress] - Callback for progress updates (0-1).
 * @returns {Promise<Map<string, THREE.Texture>>} A promise that resolves to a map of texture paths to textures.
 */
export async function loadTexturesFromZIP(zipFile, threeModule, onProgress) {
    if (!zipFile || !threeModule) {
        throw new Error('ZIP file and THREE module are required');
    }
    if (typeof zip === 'undefined' || typeof zip.BlobReader === 'undefined') {
        throw new Error('zip.js library is not loaded. Please include it in your HTML.');
    }

    const textureMap = new Map();
    const objectUrls = [];
    
    try {
        // Use a BlobReader to read the zipFile streamingly
        const zipReader = new zip.ZipReader(new zip.BlobReader(zipFile));
        
        // Get all entries from the zip file
        const entries = await zipReader.getEntries();
        const textureEntries = entries.filter(entry => !entry.directory && isTextureFile(entry.filename));
        
        console.debug(`[zipTextures] Found ${textureEntries.length} texture entries in ZIP`);
        if (onProgress) onProgress(0);

        // Calculate total size for accurate progress tracking
        const totalSize = textureEntries.reduce((acc, entry) => acc + entry.uncompressedSize, 0);
        let processedSize = 0;

        for (const entry of textureEntries) {
            const filename = entry.filename;
            try {
                // Extract the file data as a Blob
                const blob = await entry.getData(new zip.BlobWriter());
                
                // Load the texture from the blob
                const texture = await loadTextureFromBlob(blob, filename, threeModule);
                objectUrls.push(texture.image.src); // Store the URL for later cleanup

                // Store in map with normalized keys for better matching
                const filenameLower = filename.toLowerCase();
                textureMap.set(filenameLower, texture);

                const basename = getBasename(filename);
                const dot = basename.lastIndexOf('.');
                const basenameNoExt = dot > 0 ? basename.substring(0, dot) : basename;
                const ext = filenameLower.substring(filenameLower.lastIndexOf('.')) || '';

                textureMap.set(basenameNoExt.toLowerCase(), texture);
                textureMap.set((basenameNoExt + ext).toLowerCase(), texture);

                console.log(`[zipTextures] Loaded texture: ${filename} (basename: ${basename})`);
            } catch (error) {
                console.warn(`[zipTextures] Failed to load texture ${filename}:`, error);
            } finally {
                // Update progress based on the size of the processed file
                processedSize += entry.uncompressedSize;
                if (onProgress && totalSize > 0) {
                    onProgress(processedSize / totalSize);
                }
            }
        }

        // Close the zip reader
        await zipReader.close();

        // Clean up object URLs after a short delay to ensure textures are rendered
        setTimeout(() => {
            objectUrls.forEach(url => URL.revokeObjectURL(url));
            console.log(`[zipTextures] Revoked ${objectUrls.length} object URLs.`);
        }, 1000);

        console.log(`[zipTextures] Loaded ${textureMap.size} textures from ZIP`);
        return textureMap;

    } catch (error) {
        console.error('[zipTextures] Failed to process ZIP file:', error);
        // Clean up any URLs created before the error
        objectUrls.forEach(url => URL.revokeObjectURL(url));
        throw error;
    }
}


// Export supported texture types for reference
export const SUPPORTED_TEXTURE_TYPES = TEXTURE_EXTENSIONS;