#!/bin/sh

# Canvas size: 65536 × 65536
# Canvas center: (32768, 32768)
# Incircle:
#  Radius: 32768
#  Diameter: 65536
# Current outermost rectangle:
#   Size: 59648 × 55808
#   Diagonal: √(59648² + 55808²) = √(3557881984 + 3114532864) = √6672414848 ≈ 81684.86
# For rectangle inscribed in incircle:
#   Diagonal must equal diameter
#   width² + height² = diameter²
# 
# With uniform scaling factor k:
#   (k × 59648)² + (k × 55808)² = 65536²
#        k² × (59648² + 55808²) = 65536²
#                            k² = 65536² / (59648² + 55808²)
#                             k = 65536 / √(59648² + 55808²)
#                             k ≈ 0.8023028743

sed 's|<g>|<g transform="translate(32768 32768) scale(0.8, 0.8) translate(-32768 -32768)">|' avatar.svg > avatar-round.svg
sed 's|<g>|<g transform="translate(32768 32768) scale(0.7, 0.7) translate(-32768 -32768)">|' avatar.svg > avatar-round-smaller.svg
sed -E -e '/\tversion="1.1"/d' \
       -e '/<svg/a \\tversion="1.2"\n\tbaseProfile="tiny-ps"' \
       -e '/<desc>/{N; N; d}' \
    avatar-round.svg > avatar-bimi.svg

svgo --multipass -i avatar.svg       -o avatar.min.svg
svgo --multipass -i avatar-round.svg -o avatar-round.min.svg
svgo --multipass -i avatar-bimi.svg  -o avatar-bimi.min.svg

