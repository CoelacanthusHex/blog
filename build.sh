#!/bin/bash

# For compatibility with old icon income links.
pushd static
    ln -sfr avatar.min.svg icon.svg
    ln -sfr avatar.png icon.png
    ln -sfr avatar.webp icon.webp
    ln -sfr avatar.jxl icon.jxl
popd

bun run build #&& bun run ipfs-deploy
