#!/bin/sh

process_variant() {
	size=$1
	prefix=$2
	svg=$3
	bg=$4

	rsvg-convert ${svg} ${bg} -w ${size} -h ${size} -o ${prefix}-${size}x${size}.png
	cjxl --allow_expert_options --distance=0.0 --effort=10 --brotli_effort=11 -v ${prefix}-${size}x${size}.png ${prefix}-${size}x${size}.jxl
	cwebp -lossless -z 9 -m 6 -mt -alpha_filter best -af ${prefix}-${size}x${size}.png -o ${prefix}-${size}x${size}.webp
	avifenc --speed 0 --autotiling --advanced tune=ssim ${prefix}-${size}x${size}.png ${prefix}-${size}x${size}.avif
}

export -f process_variant

parallel --line-buffer process_variant {1} {2} {3} {4} ::: 512 1024 2048 4096 8192 ::: avatar avatar-white-bg avatar-round avatar-round-white-bg :::+ avatar.svg avatar.svg avatar-round.svg avatar-round.svg :::+ "" "--background-color white" "" "--background-color white"
