#!/bin/sh

sed 's|<g>|<g transform="translate(256 256) scale(0.8, 0.8) translate(-256 -256)">|' avatar.svg > avatar-round.svg
sed -E -e '/\tversion="1.1"/d' \
       -e '/<svg/a \\tversion="1.2"\n\tbaseProfile="tiny-ps"' \
    avatar-round.svg > avatar-bimi.svg

svgo --multipass -i avatar.svg       -o avatar.min.svg
svgo --multipass -i avatar-round.svg -o avatar-round.min.svg
svgo --multipass -i avatar-bimi.svg  -o avatar-bimi.min.svg

