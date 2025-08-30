# FBX Metadata Inspector - Usage Guide

## Overview

The FBX Metadata Inspector automatically extracts and displays detailed information about loaded FBX files in the Inspector panel. This feature provides valuable insights into the file's origin, creation details, and content statistics.

## Features

### File Information
- **File Name**: Original filename of the loaded FBX
- **File Size**: Human-readable file size (KB, MB, GB)
- **Last Modified**: When the file was last modified

### FBX Properties
- **Creation Time**: When the FBX file was created
- **Software**: The software used to create the FBX (Maya, Blender, 3ds Max, etc.)
- **Version**: FBX format version
- **Units**: Detected units (mm, cm, m, inches, feet)
- **Coordinate System**: Y-Up, Z-Up, or Mixed/Unknown

### Scene Statistics
- **Meshes**: Number of mesh objects in the scene
- **Materials**: Number of unique materials
- **Textures**: Number of unique textures
- **Animations**: Number of animation clips
- **Bones**: Total number of bones/joints

### Features Detection
- **Has Animations**: Whether the model contains animations
- **Has Skeleton**: Whether the model has a skeletal structure
- **Has Textures**: Whether the model uses textures

## How to Use

1. **Load an FBX file** using the file input in the left panel
2. **Open the Inspector** by clicking the Inspector tab or pressing `I`
3. **Select any object** in the scene hierarchy
4. **View metadata** in the Properties panel at the bottom of the Inspector

The metadata will automatically appear in organized sections when viewing properties of any object that belongs to an FBX model.

## Technical Implementation

### Architecture
- **FBXMetadataExtractor**: Utility class that analyzes FBX objects and files
- **FBXLoaderWrapper**: Modified to automatically extract metadata during loading
- **Inspector**: Enhanced to display metadata in the properties panel

### Integration Points
- Metadata is attached to the root FBX object as `userData.fbxMetadata`
- The Inspector searches up the object hierarchy to find metadata
- CSS styling provides organized, themed display of metadata sections

### Code Example

```javascript
// Metadata is automatically extracted when loading FBX files
const fbxObject = await loadFBXFromFile(file);

// Access metadata programmatically
if (fbxObject.userData.fbxMetadata) {
  const metadata = fbxObject.userData.fbxMetadata;
  console.log('Software:', metadata.software);
  console.log('Creation Time:', metadata.creationTime);
  console.log('Mesh Count:', metadata.meshCount);
}
```

## Supported FBX Features

### Software Detection
The system can identify FBX files created by:
- Autodesk Maya
- Blender
- 3ds Max
- Cinema 4D
- MotionBuilder
- Unity
- Unreal Engine
- Houdini
- Modo
- Lightwave

### Unit Detection
Automatic unit detection based on:
- FBX GlobalSettings.UnitScaleFactor
- Object scale analysis
- Common scale factor mappings

### Coordinate System Detection
- Analyzes mesh orientations
- Checks FBX GlobalSettings.CoordAxis
- Determines Y-Up vs Z-Up orientation

## Troubleshooting

### Metadata Not Showing
- Ensure you've selected an object that belongs to the loaded FBX model
- Check that the Inspector panel is open
- Verify the FBX file loaded successfully

### Incomplete Metadata
- Some FBX files may not contain all metadata fields
- Older FBX versions may have limited metadata
- Files exported with minimal settings may lack creation info

### Metadata Not Clearing on Scene Clear/Model Load
- The Inspector automatically clears metadata cache when:
  - Scene is cleared (SCENE_CLEARED event)
  - New model is loaded (MODEL_LOADED event)
- If metadata persists, check browser console for errors
- Try refreshing the Inspector panel manually

### Manual Testing and Debugging
- **Test Script**: Load `test_metadata_clearing.js` in browser console to run automated tests
- **Manual Clearing**: Call `window.inspectorApi.clearFBXMetadata()` in console
- **Force Update**: Call `window.inspectorApi.forceUpdatePropertiesPanel()` to refresh panel
- **Check State**: Call `window.inspectorApi.getCurrentFBXMetadata()` to see current metadata
- **Event Testing**: Use browser console to emit events:
  ```javascript
  window.eventSystem.emit('scene-cleared');
  window.eventSystem.emit('model-loaded', { model: null });
  ```

### Performance Considerations
- Metadata extraction adds minimal overhead to FBX loading
- Large scenes with many objects are handled efficiently
- Metadata is cached and doesn't require re-extraction
- Cache is automatically cleared when switching models

## Future Enhancements

Planned improvements include:
- Export metadata to JSON/CSV
- Metadata comparison between FBX versions
- Custom metadata fields support
- Batch metadata analysis for multiple files

## API Reference

### FBXMetadataExtractor Methods

```javascript
const extractor = new FBXMetadataExtractor();

// Extract complete metadata
const metadata = extractor.extractMetadata(fbxObject, file);

// Individual extraction methods
const software = extractor.extractSoftware(fbxObject);
const units = extractor.detectUnits(fbxObject);
const meshCount = extractor.countMeshes(fbxObject);
```

### Metadata Object Structure

```javascript
{
  // File info
  fileName: "model.fbx",
  fileSize: "2.5 MB",
  lastModified: "12/25/2023, 3:30:45 PM",
  
  // FBX properties
  creationTime: "12/20/2023, 10:15:30 AM",
  software: "Maya",
  version: "7.4",
  units: "cm",
  coordinateSystem: "Y-Up",
  
  // Statistics
  meshCount: 15,
  materialCount: 8,
  textureCount: 12,
  animationCount: 3,
  boneCount: 45,
  
  // Features
  hasAnimations: true,
  hasSkeleton: true,
  hasTextures: true
}