import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from './MTLLoader.js';
import { LoadingManager } from 'three';

class OBJLoaderWrapper {
    constructor() {
        this.loader = new OBJLoader();
        this.mtlLoader = new MTLLoader();
    }

    /**
     * Loads an OBJ model and its associated MTL materials.
     * @param {string} objUrl - The URL of the OBJ file.
     * @param {string} [mtlUrl] - The optional URL of the MTL file.
     * @returns {Promise<THREE.Group>} A promise that resolves with the loaded 3D object.
     */
    loadFromFile(objFile, mtlFile) {
        return new Promise((resolve, reject) => {
            const objUrl = URL.createObjectURL(objFile);
            const mtlUrl = mtlFile ? URL.createObjectURL(mtlFile) : null;

            const onFinally = () => {
                URL.revokeObjectURL(objUrl);
                if (mtlUrl) {
                    URL.revokeObjectURL(mtlUrl);
                }
            };

            this.load(objUrl, mtlUrl)
                .then(resolve)
                .catch(reject)
                .finally(onFinally);
        });
    }

    load(objUrl, mtlUrl) {
        return new Promise((resolve, reject) => {
            if (mtlUrl) {
                this.mtlLoader.setPath(mtlUrl.substring(0, mtlUrl.lastIndexOf('/') + 1));
                this.mtlLoader.load(mtlUrl, (materials) => {
                    materials.preload();
                    this.loader.setMaterials(materials);
                    this.loader.load(objUrl, resolve, undefined, reject);
                }, undefined, reject);
            } else {
                this.loader.load(objUrl, resolve, undefined, reject);
            }
        });
    }
}

export { OBJLoaderWrapper };