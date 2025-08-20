# Docker Layer Composition Strategy

## Overview

This document outlines a strategy for composing new Docker images from arbitrary existing image layers using `docker save`, `tar`, and the `ADD` Dockerfile instruction. This approach enables efficient image composition by reusing existing layers from multiple sources.

## Key Benefits

- **Layer Reuse**: Only new/different layers need to be pulled when someone already has the base layers
- **Efficient Distribution**: Reduces bandwidth and storage requirements
- **Modular Architecture**: Enables mixing and matching layers from different images
- **Selective Updates**: Update only specific components without rebuilding entire images

## Strategy Breakdown

### Core Concept

Instead of building monolithic images, you can extract layers from existing images and compose them into new images. This works because Docker images are essentially a stack of filesystem layers, each identified by a unique SHA256 hash.

### Prerequisites

- Access to source Docker images
- Understanding of layer dependencies
- Knowledge of what each layer contains

## Practical Example

### Scenario Setup

Let's say we have three existing images with useful layers:
- **Image A**: Base OS + curl installation
- **Image B**: Development tools + gcc compiler
- **Image C**: Application libraries + some-lib

### Step 1: Extract Layers from Source Images

```bash
# Extract Image A (contains curl layer)
docker save image-a:latest > image-a.tar
mkdir image-a-extracted
cd image-a-extracted
tar -xf ../image-a.tar

# Extract Image B (contains gcc layer)
docker save image-b:latest > image-b.tar
mkdir image-b-extracted
cd image-b-extracted
tar -xf ../image-b.tar

# Extract Image C (contains some-lib layer)
docker save image-c:latest > image-c.tar
mkdir image-c-extracted
cd image-c-extracted
tar -xf ../image-c.tar
```

### Step 2: Identify Required Layers

After extraction, examine the `manifest.json` and `blobs/sha256/` directories to identify the layers you need:

```bash
# Check manifest to understand layer structure
cat image-a-extracted/manifest.json | jq '.[0].Layers'
cat image-b-extracted/manifest.json | jq '.[0].Layers'
cat image-c-extracted/manifest.json | jq '.[0].Layers'
```

Example layer identification:
- **curl layer**: `sha256:abcd1234...` (from Image A)
- **gcc layer**: `sha256:efgh5678...` (from Image B)  
- **some-lib layer**: `sha256:ijkl9012...` (from Image C)

### Step 3: Create Composition Directory Structure

```bash
mkdir docker-composition
cd docker-composition

# Copy required layers
cp ../image-a-extracted/blobs/sha256/abcd1234... ./curl-layer.tar
cp ../image-b-extracted/blobs/sha256/efgh5678... ./gcc-layer.tar
cp ../image-c-extracted/blobs/sha256/ijkl9012... ./some-lib-layer.tar
```

### Step 4: Build Composed Image

Create a `Dockerfile` that composes these layers:

```dockerfile
FROM ubuntu:20.04

# Layer 1: Add curl installation from Image A
ADD curl-layer.tar /

# Layer 2: Add gcc compiler from Image B
ADD gcc-layer.tar /

# Layer 3: Add application libraries from Image C
ADD some-lib-layer.tar /

# Optional: Add any new customizations
RUN apt-get update && apt-get install -y \
    vim \
    htop \
    && rm -rf /var/lib/apt/lists/*

# Set up environment
ENV PATH="/usr/local/bin:$PATH"
WORKDIR /app

CMD ["/bin/bash"]
```

### Step 5: Build and Tag the New Image

```bash
docker build -t my-composed-image:v1.0 .
```

## Advanced Example: Multi-Source Layer Composition

### Complex Scenario

Suppose you want to create a development environment that combines:
- **Base OS**: Ubuntu 20.04
- **Language Runtime**: Node.js from `node:16-alpine` 
- **Build Tools**: GCC/Make from `buildpack-deps:buster`
- **Database Client**: PostgreSQL client from `postgres:13`
- **Custom Tools**: Your organization's internal tools

### Implementation

```dockerfile
FROM ubuntu:20.04 as base

# Add Node.js runtime layer
ADD node-runtime-layer.tar /

# Add build tools layer  
ADD build-tools-layer.tar /

# Add PostgreSQL client layer
ADD postgres-client-layer.tar /

# Add custom tools layer
ADD custom-tools-layer.tar /

# Configure environment
ENV NODE_VERSION=16.14.0
ENV PATH="/usr/local/bin:/usr/local/node/bin:$PATH"

# Install any additional dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
CMD ["/bin/bash"]
```

## Important Considerations

### Layer Dependencies

- **Order Matters**: Layers must be added in dependency order
- **File Conflicts**: Later layers can overwrite files from earlier layers
- **Permissions**: Ensure file permissions are preserved correctly

### Layer Completeness

```bash
# Example: Creating clean layers to avoid missing dependencies
FROM base-image as layer-builder

# Install curl cleanly
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*

# Export this clean layer
# ... (save and extract process)
```

### Verification Steps

```bash
# Verify layer contents before composition
mkdir temp-layer
cd temp-layer
tar -tf ../extracted-layer.tar | head -20

# Check for potential conflicts
tar -tf layer1.tar | sort > layer1-files.txt
tar -tf layer2.tar | sort > layer2-files.txt
comm -12 layer1-files.txt layer2-files.txt  # Show overlapping files
```

## Automation Script Example

```bash
#!/bin/bash
# compose-docker-layers.sh

set -e

IMAGES_TO_EXTRACT=("curl-image:latest" "gcc-image:latest" "libs-image:latest")
LAYER_MAPPING=(
    "curl-image:sha256:abcd1234:curl-layer.tar"
    "gcc-image:sha256:efgh5678:gcc-layer.tar" 
    "libs-image:sha256:ijkl9012:libs-layer.tar"
)

# Extract all source images
for image in "${IMAGES_TO_EXTRACT[@]}"; do
    echo "Extracting $image..."
    docker save "$image" > "${image//[:\/]/_}.tar"
    mkdir -p "extracted/${image//[:\/]/_}"
    tar -xf "${image//[:\/]/_}.tar" -C "extracted/${image//[:\/]/_}"
done

# Copy required layers
mkdir -p composition
for mapping in "${LAYER_MAPPING[@]}"; do
    IFS=':' read -r image_name layer_hash output_name <<< "$mapping"
    source_path="extracted/${image_name//[:\/]/_}/blobs/sha256/${layer_hash#sha256:}"
    cp "$source_path" "composition/$output_name"
    echo "Copied layer $layer_hash to $output_name"
done

echo "Layer extraction complete. Ready for composition."
```

## Limitations and Gotchas

### 1. Layer Diff Behavior
- If a base layer already contains a file, subsequent layers won't include it in their diff
- This can lead to missing dependencies when composing layers out of order

### 2. Architecture Compatibility
- Ensure all layers are built for the same architecture (amd64, arm64, etc.)
- Check platform compatibility before composition

### 3. Security Considerations
- Verify the integrity and source of all layers
- Scan composed images for vulnerabilities
- Maintain an audit trail of layer sources

### 4. Registry Efficiency
- The efficiency gain only occurs if the target registry already has the base layers
- Initial pushes may not show bandwidth savings

## Best Practices

1. **Document Layer Sources**: Keep track of where each layer originated
2. **Version Control**: Tag and version your composed images consistently
3. **Testing**: Thoroughly test composed images in isolation
4. **Minimal Layers**: Create focused, single-purpose layers when possible
5. **Regular Updates**: Update base layers regularly for security patches

## Conclusion

Docker layer composition enables powerful image reuse patterns and can significantly reduce distribution overhead when implemented correctly. However, it requires careful planning around layer dependencies and thorough testing to ensure the resulting images function as expected.

The key to success is understanding what each layer contains and how they interact when stacked together.