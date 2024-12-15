#!/bin/sh

for size in 512 1024 2048 4096 8192; do
    rsvg-convert avatar.svg -w ${size} -h ${size} -o avatar${variant}-${size}x${size}.png
    cjxl --allow_expert_options --distance=0.0 --effort=10 --brotli_effort=11 -v avatar${variant}-${size}x${size}.png avatar${variant}-${size}x${size}.jxl
    cwebp -preset avatar -lossless -z 9 -m 6 -mt -alpha_filter best -af avatar${variant}-${size}x${size}.png -o avatar${variant}-${size}x${size}.webp
    avifenc --speed 0 --autotiling --advanced tune=ssim avatar${variant}-${size}x${size}.png avatar${variant}-${size}x${size}.avif

    rsvg-convert avatar.svg --background-color white -w ${size} -h ${size} -o avatar-white-bg${variant}-${size}x${size}.png
    cjxl --allow_expert_options --distance=0.0 --effort=10 --brotli_effort=11 -v avatar-white-bg${variant}-${size}x${size}.png avatar-white-bg${variant}-${size}x${size}.jxl
    cwebp -preset avatar -lossless -z 9 -m 6 -mt -alpha_filter best -af avatar-white-bg${variant}-${size}x${size}.png -o avatar-white-bg${variant}-${size}x${size}.webp
    avifenc --speed 0 --autotiling --advanced tune=ssim avatar-white-bg${variant}-${size}x${size}.png avatar-white-bg${variant}-${size}x${size}.avif

    rsvg-convert avatar-round.svg -w ${size} -h ${size} -o avatar-round${variant}-${size}x${size}.png
    cjxl --allow_expert_options --distance=0.0 --effort=10 --brotli_effort=11 -v avatar-round${variant}-${size}x${size}.png avatar-round${variant}-${size}x${size}.jxl
    cwebp -preset avatar -lossless -z 9 -m 6 -mt -alpha_filter best -af avatar-round${variant}-${size}x${size}.png -o avatar-round${variant}-${size}x${size}.webp
    avifenc --speed 0 --autotiling --advanced tune=ssim avatar-round${variant}-${size}x${size}.png avatar-round${variant}-${size}x${size}.avif

    rsvg-convert avatar-round.svg --background-color white -w ${size} -h ${size} -o avatar-round-white-bg${variant}-${size}x${size}.png
    cjxl --allow_expert_options --distance=0.0 --effort=10 --brotli_effort=11 -v avatar-round-white-bg${variant}-${size}x${size}.png avatar-round-white-bg${variant}-${size}x${size}.jxl
    cwebp -preset avatar -lossless -z 9 -m 6 -mt -alpha_filter best -af avatar-round-white-bg${variant}-${size}x${size}.png -o avatar-round-white-bg${variant}-${size}x${size}.webp
    avifenc --speed 0 --autotiling --advanced tune=ssim avatar-round-white-bg${variant}-${size}x${size}.png avatar-round-white-bg${variant}-${size}x${size}.avif
done

svgo --multipass -i avatar.svg       -o avatar.min.svg
svgo --multipass -i avatar-round.svg -o avatar-round.min.svg
svgo --multipass -i avatar-bimi.svg  -o avatar-bimi.min.svg
