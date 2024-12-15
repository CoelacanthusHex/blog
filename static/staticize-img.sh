#!/bin/sh

for size in 512 1024 2048 4096 8192; do
    rsvg-convert icon.svg -w ${size} -h ${size} -o icon${variant}-${size}x${size}.png
    cjxl --allow_expert_options --distance=0.0 --effort=10 --brotli_effort=11 -v icon${variant}-${size}x${size}.png icon${variant}-${size}x${size}.jxl
    cwebp -preset icon -lossless -z 9 -m 6 -mt -alpha_filter best -af icon${variant}-${size}x${size}.png -o icon${variant}-${size}x${size}.webp
    avifenc --speed 0 --autotiling --advanced tune=ssim icon${variant}-${size}x${size}.png icon${variant}-${size}x${size}.avif

    rsvg-convert icon.svg --background-color white -w ${size} -h ${size} -o icon-white-bg${variant}-${size}x${size}.png
    cjxl --allow_expert_options --distance=0.0 --effort=10 --brotli_effort=11 -v icon-white-bg${variant}-${size}x${size}.png icon-white-bg${variant}-${size}x${size}.jxl
    cwebp -preset icon -lossless -z 9 -m 6 -mt -alpha_filter best -af icon-white-bg${variant}-${size}x${size}.png -o icon-white-bg${variant}-${size}x${size}.webp
    avifenc --speed 0 --autotiling --advanced tune=ssim icon-white-bg${variant}-${size}x${size}.png icon-white-bg${variant}-${size}x${size}.avif

    rsvg-convert icon-round.svg -w ${size} -h ${size} -o icon-round${variant}-${size}x${size}.png
    cjxl --allow_expert_options --distance=0.0 --effort=10 --brotli_effort=11 -v icon-round${variant}-${size}x${size}.png icon-round${variant}-${size}x${size}.jxl
    cwebp -preset icon -lossless -z 9 -m 6 -mt -alpha_filter best -af icon-round${variant}-${size}x${size}.png -o icon-round${variant}-${size}x${size}.webp
    avifenc --speed 0 --autotiling --advanced tune=ssim icon-round${variant}-${size}x${size}.png icon-round${variant}-${size}x${size}.avif

    rsvg-convert icon-round.svg --background-color white -w ${size} -h ${size} -o icon-round-white-bg${variant}-${size}x${size}.png
    cjxl --allow_expert_options --distance=0.0 --effort=10 --brotli_effort=11 -v icon-round-white-bg${variant}-${size}x${size}.png icon-round-white-bg${variant}-${size}x${size}.jxl
    cwebp -preset icon -lossless -z 9 -m 6 -mt -alpha_filter best -af icon-round-white-bg${variant}-${size}x${size}.png -o icon-round-white-bg${variant}-${size}x${size}.webp
    avifenc --speed 0 --autotiling --advanced tune=ssim icon-round-white-bg${variant}-${size}x${size}.png icon-round-white-bg${variant}-${size}x${size}.avif
done

svgo --multipass -i icon.svg       -o icon.min.svg
svgo --multipass -i icon-round.svg -o icon-round.min.svg
svgo --multipass -i icon-bimi.svg  -o icon-bimi.min.svg
