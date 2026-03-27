#!/usr/bin/zsh

setopt extendedglob
parallel --line-buffer optipng -v -backup -clobber -preserve -o7 -zm1-9 ::: *.png(#q.)
